/**
 * Shared PostgreSQL connection-target resolution for the scripts in `scripts/`.
 *
 * WHY THIS EXISTS
 * Every script used to hardcode `ssl: { rejectUnauthorized: false }`. That is correct for the
 * hosted Supabase database and **wrong for the local scratch database** that `supabase start`
 * serves on `127.0.0.1:54322`: that Postgres does not offer TLS, so the connection dies with
 *
 *     Migration runner error: The server does not support SSL connections
 *
 * and the scratch-database workflow — which ADR 0001 Phase A verification, the pre-migration
 * checklist, and risk R-08 ("apply to a scratch DB first") all depend on — was impossible.
 * Discovered and fixed 2026-09-14. See docs/runbooks/database-backup-restore.md §7b and
 * plan/ROADMAP_V3.md Phase 0 item 5.
 *
 * THE RULE: loopback targets get no TLS; everything else keeps the previous behaviour exactly.
 * For a remote host the returned `ssl` is byte-identical to what the scripts used before, so
 * production is unaffected.
 *
 * This module is pure and side-effect-free, so `src/test/pgTarget.test.ts` can lock the rule
 * down offline — no database, no network, no credentials.
 *
 * NOT COVERED HERE: `src/server/db.ts` has the same hardcoded `ssl` and is deliberately left
 * alone. It is production runtime code, and importing across the `src/` → `scripts/` boundary
 * risks pulling this file into the Vercel server bundle. To run the *application* against local
 * Supabase, apply the same loopback rule there.
 */

/** Raised for every refusal, so a CLI can exit non-zero with a clear reason. */
export class TargetSafetyError extends Error {}

export interface TargetClassification {
  /** Hostname only — never includes credentials. */
  host: string;
  /**
   * True for anything that is not loopback. Supabase hosts are remote:
   * `db.<ref>.supabase.co` (direct) and `...pooler.supabase.com` (pooled).
   */
  isRemote: boolean;
}

/**
 * Decide whether a connection string points at this machine.
 *
 * `host.docker.internal` counts as local because a container reaching the host by that name is
 * still reaching this machine — relevant when a script runs inside a container.
 *
 * ⚠️ TWO PARSING TRAPS, both fixed here after being caught by `src/test/pgTarget.test.ts`:
 *
 *  1. **WHATWG URL serialises an IPv6 host *with* brackets.** For
 *     `postgresql://…@[::1]:54322/postgres`, `url.hostname` is `'[::1]'` — never `'::1'`. The
 *     original `host === '::1'` comparison could therefore never match, so an IPv6 loopback
 *     target was silently misclassified as **remote**. That failed safe in `assertSafeTarget`
 *     (it refused), but it would have attached TLS to a loopback target here.
 *  2. **`postgresql:` is not a WHATWG "special scheme",** so the host is not guaranteed to be
 *     lowercased. Comparison is done case-insensitively because DNS hostnames are.
 */
export function classifyTarget(rawUrl: string): TargetClassification {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new TargetSafetyError('Target connection string is not a parseable URL.');
  }
  const host = url.hostname;
  const bare = (host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host).toLowerCase();
  const isLoopback =
    bare === 'localhost' || bare === '127.0.0.1' || bare === '::1' || bare === 'host.docker.internal';
  return { host, isRemote: !isLoopback };
}

/**
 * Remove query parameters from a connection string so the explicit `ssl` setting is
 * authoritative rather than `sslmode=` in the URL.
 *
 * ⚠️ A password containing `?` would be truncated by this. That is pre-existing behaviour
 * (it is what `getCleanConnectionString()` in `src/server/db.ts` does too) and Supabase
 * passwords are alphanumeric by default.
 */
export function stripQueryParams(rawUrl: string): string {
  return rawUrl.replace(/\?.*$/, '');
}

export interface PoolTarget extends TargetClassification {
  /** Connection string with query params stripped. Safe to pass straight to `pg`. */
  connectionString: string;
  /**
   * `undefined` for a loopback target — node-postgres then negotiates no TLS, which is what the
   * local Supabase database needs. For a remote target this is the hosted-database setting the
   * scripts have always used.
   */
  ssl: { rejectUnauthorized: false } | undefined;
}

/**
 * Resolve a raw connection string into everything a `pg.Pool` needs.
 *
 * Throws `TargetSafetyError` if the string is not a parseable URL — better to fail loudly than
 * to connect somewhere unintended.
 */
export function resolvePoolTarget(rawUrl: string): PoolTarget {
  if (!rawUrl) {
    throw new TargetSafetyError('PostgreSQL connection string is missing from environment.');
  }
  const target = classifyTarget(rawUrl);
  return {
    ...target,
    connectionString: stripQueryParams(rawUrl),
    ssl: target.isRemote ? { rejectUnauthorized: false } : undefined,
  };
}
