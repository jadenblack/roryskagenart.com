/**
 * Shared abuse controls for the public write endpoints.
 *
 * WHY THIS FILE EXISTS
 * `POST /api/inquiries` has been an unguarded public write since it was written:
 * `plan/BACKLOG_STUDIO_CMS.md` §1.3 records no captcha, no honeypot and no rate limit,
 * and every submission spends Resend quota and lands in the studio's inbox. v3.1.0 adds
 * a *second* public write (`POST /api/plan/feedback`). Shipping the second one
 * unguarded next to the first would be knowingly repeating a documented defect, so the
 * helper is written once here and applied to both in the same release.
 *
 * WHAT IS GUARDED, AND WHY THE ASYMMETRY
 *   * **Honeypot** — public doors only. It is a heuristic; a false positive on an
 *     authenticated submission would silently discard a staff member's work. The staff
 *     door is gated by a session instead.
 *   * **Rate limit** — every write door, keyed by IP for the public ones and by user id
 *     for the authenticated one.
 *
 * ⚠️ WHAT THIS IS NOT: A SECURITY BOUNDARY.
 * The store is an in-process `Map`. Vercel may run several instances of the function and
 * may recycle any of them at any moment, so a determined attacker gets `max` attempts
 * per instance rather than per deployment. That is the honest description of an
 * in-memory limiter on a serverless platform, and it is still the right trade here: it
 * removes the trivial flood (a loop, a botnet of one, a form-resubmit storm) without a
 * Redis/KV dependency this project does not otherwise have, and without a schema change
 * in a release whose whole point is "one new table". Do not describe it as a guarantee.
 *
 * The pure decision functions take an injected store and an injected `now`, so the
 * window arithmetic is unit-tested offline (`src/test/requestGuards.test.ts`) with no
 * clock and no HTTP server.
 */

import type { Request, Response, NextFunction } from 'express';
import { HONEYPOT_FIELD } from '../../src/lib/antiSpam';

export { HONEYPOT_FIELD };

/* ------------------------------------------------------------------ *
 * Honeypot                                                            *
 * ------------------------------------------------------------------ */

/**
 * True when the honeypot field carries a value.
 *
 * Absent, `null`, `undefined`, `''` and whitespace are all "not tripped" — a form that
 * renders the field leaves it empty, and JSON bodies that omit it entirely must be
 * treated as clean rather than suspicious.
 */
export function isHoneypotTripped(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const value = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  if (value === undefined || value === null) return false;
  return String(value).trim().length > 0;
}

/**
 * Express middleware: drop a tripped submission with a **plausible success**.
 *
 * ⚠️ 201 with `{ success: true }`, not 400. A bot told "rejected" learns which field to
 * leave alone; a bot told "created" learns nothing. The response body is deliberately
 * the same shape a real success returns, and the caller's client only ever reads
 * `success` (see `src/components/ContactView.tsx`), so a genuine user who somehow trips
 * this — a password manager, an over-eager autofill — sees the ordinary thank-you and
 * the studio sees nothing. That is the accepted cost of the heuristic.
 */
export function honeypotGate() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isHoneypotTripped(req.body)) return next();
    console.warn('[request-guards] honeypot tripped — submission dropped without storage');
    return res.status(201).json({ success: true });
  };
}

/* ------------------------------------------------------------------ *
 * Rate limiting                                                       *
 * ------------------------------------------------------------------ */

export interface RateLimitRule {
  /** Length of the sliding window, in milliseconds. */
  windowMs: number;
  /** How many hits are allowed inside one window. */
  max: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Hits left in the current window. Zero when `allowed` is false. */
  remaining: number;
  /** Seconds until the oldest hit leaves the window. Zero when `allowed` is true. */
  retryAfterSeconds: number;
}

/** Timestamps of the hits still inside the window, oldest first. */
export type RateLimitStore = Map<string, number[]>;

/**
 * Cap on tracked keys. Memory must never be the thing that disables the limiter: an
 * attacker who rotates source addresses would otherwise grow the map without bound.
 * Exported so `src/test/requestGuards.test.ts` can assert the bound rather than trust it.
 */
export const MAX_TRACKED_KEYS = 2000;

/**
 * Record one hit and decide whether it is allowed. Pure apart from the store it is
 * handed, and `now` is injected so the window arithmetic is deterministic in tests.
 */
export function hitRateLimit(
  store: RateLimitStore,
  key: string,
  rule: RateLimitRule,
  now: number = Date.now()
): RateLimitVerdict {
  const cutoff = now - rule.windowMs;
  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= rule.max) {
    // Keep the pruned list so the next call does not re-scan stale timestamps.
    store.set(key, hits);
    const oldest = hits[0] ?? now;
    const retryAfterMs = Math.max(1, oldest + rule.windowMs - now);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  hits.push(now);
  store.set(key, hits);
  if (store.size > MAX_TRACKED_KEYS) sweepStore(store, rule, now);

  return { allowed: true, remaining: rule.max - hits.length, retryAfterSeconds: 0 };
}

/**
 * Drop entries that can no longer affect a decision, and — if the store is *still* over
 * the cap — the least recently active keys. Exported for the test that proves the bound
 * actually holds, because an unbounded limiter is a memory leak with a security story.
 */
export function sweepStore(store: RateLimitStore, rule: RateLimitRule, now: number): void {
  const cutoff = now - rule.windowMs;
  for (const [key, hits] of store) {
    if (hits.every((t) => t <= cutoff)) store.delete(key);
  }
  if (store.size <= MAX_TRACKED_KEYS) return;

  const byLeastRecent = [...store.entries()].sort(
    (a, b) => (a[1][a[1].length - 1] ?? 0) - (b[1][b[1].length - 1] ?? 0)
  );
  for (const [key] of byLeastRecent) {
    if (store.size <= MAX_TRACKED_KEYS) break;
    store.delete(key);
  }
}

/* ------------------------------------------------------------------ *
 * Client identity                                                     *
 * ------------------------------------------------------------------ */

/**
 * The subset of a request `clientIp` needs. Narrowed to a structural type so the
 * function is testable with a plain object literal instead of a mock Express request.
 */
export interface ClientIpSource {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string | null };
}

/**
 * Recover the caller's address, or `'unknown'`.
 *
 * ⚠️ `req.ip` is deliberately not used: this app never calls `app.set('trust proxy', …)`,
 * so Express would report the load balancer. Vercel sets `x-forwarded-for` itself and
 * overwrites anything the client sent, so the first entry is the real peer there; in
 * local dev there is no proxy and the socket address is used.
 *
 * ⚠️ AND THE VALUE IS VALIDATED, NOT SANITISED.
 * An earlier version kept every character an address *could* contain and dropped the rest.
 * That is the wrong shape of defence: it turns `"garbage!@#$"` into the key `"abae"`, and
 * `"203.0.113.9\r\nX-Real-IP: 1.2.3.4"` into a key that merely *starts* like a real address
 * — so a header could mint arbitrary, attacker-chosen buckets and spread a flood across
 * them. Now the candidate is either a well-formed IPv4/IPv6 literal or it collapses to one
 * shared `'unknown'` bucket, which is the safe direction: it makes the limiter *stricter*,
 * never looser.
 */
export function clientIp(source: ClientIpSource): string {
  const headers = source.headers ?? {};

  const forwarded = headers['x-forwarded-for'];
  const forwardedRaw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstForwarded = typeof forwardedRaw === 'string' ? forwardedRaw.split(',')[0] : '';

  const real = headers['x-real-ip'];
  const realIp = typeof real === 'string' ? real : '';

  const socketIp = source.socket?.remoteAddress ?? '';

  const candidate = normaliseCandidate(firstForwarded || realIp || socketIp);
  return isIpLiteral(candidate) ? candidate : 'unknown';
}

/**
 * Unwrap the two shapes a real proxy puts around an address: `[2001:db8::1]` and
 * `203.0.113.9:54321`. Anything else is returned unchanged and then validated.
 */
function normaliseCandidate(value: string): string {
  const trimmed = value.trim();

  const bracketed = /^\[(.+)\]$/.exec(trimmed);
  if (bracketed) return bracketed[1];

  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(trimmed);
  if (withPort) return withPort[1];

  return trimmed;
}

function isIpLiteral(value: string): boolean {
  return isIpv4(value) || isIpv6(value);
}

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/**
 * A **shape** check, not a full RFC 4291 validator: at most one `::`, hex groups of at most
 * four digits, no other character. A malformed IPv6 that slips through is still a bounded
 * string of hex and colons, so it is a harmless `Map` key; a real address this rejects
 * collapses to `'unknown'`, which only makes the limit stricter.
 */
function isIpv6(value: string): boolean {
  if (value.length < 2 || value.length > 45) return false;
  if (!value.includes(':')) return false;
  if (!/^[0-9a-fA-F:]+$/.test(value)) return false;
  if (value.split('::').length > 2) return false;

  const groups = value.split(':');
  // `::` yields empty groups; at most two, and only in that one place.
  if (groups.filter((group) => group === '').length > 2) return false;
  return groups.every((group) => group.length <= 4);
}

/* ------------------------------------------------------------------ *
 * Middleware                                                          *
 * ------------------------------------------------------------------ */

export interface RateLimitOptions {
  rule: RateLimitRule;
  /** Defaults to the caller's IP. Use the authenticated user id where there is one. */
  keyFor?: (req: Request) => string;
}

/**
 * Express middleware enforcing one sliding-window rule.
 *
 * Each call owns its own store, so two routes with different rules cannot spend each
 * other's budget. `Retry-After` and the `X-RateLimit-*` headers are set on every
 * response — including the allowed ones — so a client can back off before it is refused
 * rather than after.
 */
export function rateLimit(options: RateLimitOptions) {
  const { rule, keyFor = (req: Request) => clientIp(req) } = options;
  const store: RateLimitStore = new Map();

  return (req: Request, res: Response, next: NextFunction) => {
    const verdict = hitRateLimit(store, keyFor(req), rule, Date.now());

    res.setHeader('X-RateLimit-Limit', String(rule.max));
    res.setHeader('X-RateLimit-Remaining', String(verdict.remaining));

    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many submissions from this address. Please wait a few minutes and try again.',
      });
    }

    return next();
  };
}

/* ------------------------------------------------------------------ *
 * The rules themselves                                                *
 * ------------------------------------------------------------------ */

/**
 * How much each door costs, and therefore how tight its window is.
 *
 * The inquiry door is the expensive one: each accepted submission sends **two** Resend
 * emails and lands in the studio's inbox. So it gets the tightest budget of the three —
 * and the ordering below is the point, not an accident: an expensive door must never be
 * allowed more submissions per hour than a cheap one.
 *
 * All three are still generous enough for a real person. A collector asking about three
 * artworks in one sitting uses three of the inquiry door's five; a studio filing a dozen
 * ideas in an afternoon uses a fifth of the staff door's sixty.
 */
export const PUBLIC_WRITE_LIMITS: Record<'inquiries' | 'feedback' | 'planItems', RateLimitRule> = {
  /** `POST /api/inquiries` — 5 per 30 minutes (10/hour). Two Resend sends per hit. */
  inquiries: { windowMs: 30 * 60 * 1000, max: 5 },
  /** `POST /api/plan/feedback` — 20 per hour. No email, but a spammed board is still a spammed board. */
  feedback: { windowMs: 60 * 60 * 1000, max: 20 },
  /** `POST /api/plan/items` — 60 per hour, per signed-in user. */
  planItems: { windowMs: 60 * 60 * 1000, max: 60 },
};
