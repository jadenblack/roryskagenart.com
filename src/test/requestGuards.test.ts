import { describe, it, expect, vi } from 'vitest';
import {
  clientIp,
  hitRateLimit,
  honeypotGate,
  isHoneypotTripped,
  rateLimit,
  sweepStore,
  HONEYPOT_FIELD,
  MAX_TRACKED_KEYS,
  PUBLIC_WRITE_LIMITS,
  type RateLimitRule,
  type RateLimitStore,
} from '../../server/lib/requestGuards';

const MINUTE = 60 * 1000;
const RULE: RateLimitRule = { windowMs: 10 * MINUTE, max: 3 };

/** A store keyed by a single caller, which is all any one case needs. */
const freshStore = (): RateLimitStore => new Map();

/* ------------------------------------------------------------------ *
 * Honeypot                                                            *
 * ------------------------------------------------------------------ */

describe('isHoneypotTripped', () => {
  it('is not tripped by an empty, absent or whitespace-only field', () => {
    for (const body of [
      {},
      { title: 'real' },
      { [HONEYPOT_FIELD]: '' },
      { [HONEYPOT_FIELD]: '   ' },
      { [HONEYPOT_FIELD]: null },
      { [HONEYPOT_FIELD]: undefined },
    ]) {
      expect(isHoneypotTripped(body)).toBe(false);
    }
  });

  it('is tripped by anything a bot would type into it', () => {
    for (const value of ['https://spam.example', 'x', 1, true, { nested: true }]) {
      expect(isHoneypotTripped({ [HONEYPOT_FIELD]: value })).toBe(true);
    }
  });

  it('is not tripped by a body that is not an object', () => {
    for (const body of [null, undefined, 'a string', 42]) {
      expect(isHoneypotTripped(body)).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ *
 * The sliding window                                                  *
 * ------------------------------------------------------------------ */

describe('hitRateLimit', () => {
  it('allows up to the cap and refuses the one after it', () => {
    const store = freshStore();
    const now = 1_000_000;

    for (let i = 0; i < RULE.max; i += 1) {
      const verdict = hitRateLimit(store, 'ip', RULE, now);
      expect(verdict.allowed).toBe(true);
      expect(verdict.remaining).toBe(RULE.max - i - 1);
      expect(verdict.retryAfterSeconds).toBe(0);
    }

    const refused = hitRateLimit(store, 'ip', RULE, now);
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('reports how long until the oldest hit leaves the window', () => {
    const store = freshStore();
    const start = 1_000_000;
    for (let i = 0; i < RULE.max; i += 1) hitRateLimit(store, 'ip', RULE, start);

    // Half a window later, the first hit still has half a window left on it.
    const verdict = hitRateLimit(store, 'ip', RULE, start + 5 * MINUTE);
    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSeconds).toBe(5 * 60);
  });

  it('slides: a caller is allowed again once the window has passed', () => {
    const store = freshStore();
    const start = 1_000_000;
    for (let i = 0; i < RULE.max; i += 1) hitRateLimit(store, 'ip', RULE, start);
    expect(hitRateLimit(store, 'ip', RULE, start).allowed).toBe(false);

    expect(hitRateLimit(store, 'ip', RULE, start + RULE.windowMs + 1).allowed).toBe(true);
  });

  it('keeps callers independent', () => {
    const store = freshStore();
    const now = 1_000_000;
    for (let i = 0; i < RULE.max; i += 1) hitRateLimit(store, 'a', RULE, now);

    expect(hitRateLimit(store, 'a', RULE, now).allowed).toBe(false);
    expect(hitRateLimit(store, 'b', RULE, now).allowed).toBe(true);
  });

  it('does not grow the stored window when it refuses', () => {
    const store = freshStore();
    const now = 1_000_000;
    for (let i = 0; i < RULE.max; i += 1) hitRateLimit(store, 'ip', RULE, now);
    hitRateLimit(store, 'ip', RULE, now);
    hitRateLimit(store, 'ip', RULE, now);
    expect(store.get('ip')).toHaveLength(RULE.max);
  });
});

describe('sweepStore', () => {
  it('drops keys whose hits have all left the window', () => {
    const store = freshStore();
    store.set('stale', [0, 1, 2]);
    store.set('live', [1_000_000]);

    sweepStore(store, RULE, 1_000_000);
    expect(store.has('stale')).toBe(false);
    expect(store.has('live')).toBe(true);
  });

  it('bounds the store even when every key is live', () => {
    const store = freshStore();
    const now = 1_000_000;
    for (let i = 0; i < MAX_TRACKED_KEYS + 100; i += 1) store.set(`ip-${i}`, [now]);

    sweepStore(store, RULE, now);
    // An unbounded limiter is a memory leak with a security story, so the cap is asserted
    // rather than described.
    expect(store.size).toBe(MAX_TRACKED_KEYS);
  });
});

/* ------------------------------------------------------------------ *
 * Client identity                                                     *
 * ------------------------------------------------------------------ */

describe('clientIp', () => {
  it('prefers the first hop of x-forwarded-for, which is what Vercel sets', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' } })).toBe('203.0.113.9');
  });

  it('falls back to x-real-ip and then to the socket', () => {
    expect(clientIp({ headers: { 'x-real-ip': '198.51.100.4' } })).toBe('198.51.100.4');
    expect(clientIp({ headers: {}, socket: { remoteAddress: '::1' } })).toBe('::1');
  });

  it('handles a repeated header without stringifying the array', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': ['203.0.113.9', '10.0.0.1'] } })).toBe('203.0.113.9');
  });

  it('unwraps the two shapes a real proxy puts around an address', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '[2001:db8::1]' } })).toBe('2001:db8::1');
    expect(clientIp({ headers: { 'x-forwarded-for': '203.0.113.9:54321' } })).toBe('203.0.113.9');
  });

  /**
   * The value becomes a `Map` key, so it is **validated**, not sanitised. Stripping the
   * characters an address cannot contain would turn this header into a key that merely
   * starts like a real one — letting a caller mint arbitrary buckets and spread a flood
   * across them. Collapsing to `'unknown'` makes the limiter stricter instead.
   */
  it('rejects a header that is not an address instead of mining a key out of it', () => {
    for (const header of [
      'garbage!@#$',
      '203.0.113.9\r\nX-Real-IP: 1.2.3.4',
      '203.0.113.9 extra',
      '999.999.999.999',
      '1.2.3',
      ':::',
      `2001:db8::${'a'.repeat(200)}`,
    ]) {
      expect(clientIp({ headers: { 'x-forwarded-for': header } })).toBe('unknown');
    }
  });

  it('collapses an absent or unusable address to one shared bucket', () => {
    expect(clientIp({})).toBe('unknown');
    expect(clientIp({ headers: {} })).toBe('unknown');
    expect(clientIp({ headers: {}, socket: {} })).toBe('unknown');
  });

  it('accepts the address shapes a browser and a proxy actually produce', () => {
    for (const [header, expected] of [
      ['203.0.113.9', '203.0.113.9'],
      ['198.51.100.4', '198.51.100.4'],
      ['::1', '::1'],
      ['fe80::', 'fe80::'],
      ['2001:db8:0:0:0:0:0:1', '2001:db8:0:0:0:0:0:1'],
      ['  203.0.113.9  ', '203.0.113.9'],
    ] as const) {
      expect(clientIp({ headers: { 'x-forwarded-for': header } })).toBe(expected);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Middleware                                                          *
 * ------------------------------------------------------------------ */

function fakeRes() {
  const headers: Record<string, string> = {};
  const state: { status: number; payload: any } = { status: 200, payload: null };
  const res: any = {
    setHeader: (key: string, value: unknown) => {
      headers[key] = String(value);
      return res;
    },
    status: (code: number) => {
      state.status = code;
      return res;
    },
    json: (body: unknown) => {
      state.payload = body;
      return res;
    },
  };
  return { res, headers, state };
}

describe('rateLimit middleware', () => {
  it('sets the budget headers on an allowed request and calls next', () => {
    const middleware = rateLimit({ rule: { windowMs: MINUTE, max: 2 } });
    const { res, headers, state } = fakeRes();
    const next = vi.fn();

    middleware({ headers: { 'x-forwarded-for': '203.0.113.9' } } as any, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(state.status).toBe(200);
    expect(headers['X-RateLimit-Limit']).toBe('2');
    expect(headers['X-RateLimit-Remaining']).toBe('1');
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('answers 429 with Retry-After and does not call next once the budget is spent', () => {
    const middleware = rateLimit({ rule: { windowMs: MINUTE, max: 1 } });
    const req = { headers: { 'x-forwarded-for': '203.0.113.9' } } as any;

    middleware(req, fakeRes().res, vi.fn());

    const second = fakeRes();
    const next = vi.fn();
    middleware(req, second.res, next);

    expect(next).not.toHaveBeenCalled();
    expect(second.state.status).toBe(429);
    // A whole minute is the ceiling; the exact value depends on how long the first call took.
    const retryAfter = Number(second.headers['Retry-After']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(second.state.payload.error).toMatch(/Too many submissions/);
  });

  it('uses the supplied key function, so an authenticated route can key on the account', () => {
    const middleware = rateLimit({ rule: { windowMs: MINUTE, max: 1 }, keyFor: (req) => req.cmsUser!.id });
    const alice = { cmsUser: { id: 'alice' } } as any;
    const bob = { cmsUser: { id: 'bob' } } as any;

    middleware(alice, fakeRes().res, vi.fn());
    const second = fakeRes();
    const next = vi.fn();
    middleware(alice, second.res, next);
    expect(next).not.toHaveBeenCalled();

    // A different account from the same address is not throttled by the first one.
    const third = fakeRes();
    const thirdNext = vi.fn();
    middleware(bob, third.res, thirdNext);
    expect(thirdNext).toHaveBeenCalledTimes(1);
  });
});

describe('honeypotGate middleware', () => {
  it('passes a clean body straight through', () => {
    const { res, state } = fakeRes();
    const next = vi.fn();

    honeypotGate()({ body: { title: 'real' } } as any, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(state.status).toBe(200);
  });

  /**
   * 201 with a plausible success, not 400 — a bot told "rejected" learns which field to
   * leave alone. The client reads only `success`, so a human who trips it sees the normal
   * thank-you.
   */
  it('answers a tripped honeypot with a plausible success and stores nothing', () => {
    const { res, state } = fakeRes();
    const next = vi.fn();

    honeypotGate()({ body: { title: 'spam', [HONEYPOT_FIELD]: 'https://spam.example' } } as any, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.status).toBe(201);
    expect(state.payload).toEqual({ success: true });
  });
});

describe('PUBLIC_WRITE_LIMITS', () => {
  it('gives the expensive door the tighter budget', () => {
    // Inquiries send two Resend emails each; feedback sends none.
    const perHour = (rule: RateLimitRule) => (rule.max / rule.windowMs) * 60 * MINUTE;
    expect(perHour(PUBLIC_WRITE_LIMITS.inquiries)).toBeLessThan(perHour(PUBLIC_WRITE_LIMITS.feedback));
    expect(perHour(PUBLIC_WRITE_LIMITS.inquiries)).toBeLessThan(perHour(PUBLIC_WRITE_LIMITS.planItems));
  });

  it('is generous enough for a real person to ask about several artworks', () => {
    expect(PUBLIC_WRITE_LIMITS.inquiries.max).toBeGreaterThanOrEqual(3);
  });
});
