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

/**
 * Describe a connection target **without any credentials**, safe to write into a backup manifest.
 *
 * WHY: a manifest travels with its dump — to `data/backups/` locally and to Blob off-site — and
 * "which database did this come from?" is the first question asked during a restore. The
 * connection string answers it but also carries the password, so only the host, port and database
 * name are kept. `postgres://u:p@db.abc.supabase.co:5432/postgres` → `db.abc.supabase.co:5432/postgres`.
 *
 * Shared by both dump writers (`scripts/backup-catalog.ts` and `server/routes/cronBackup.ts`) so an
 * on-disk dump and an off-site dump describe their origin in exactly the same way.
 */
export function describeTarget(rawUrl: string): string {
  if (!rawUrl) return '(unknown)';
  try {
    const url = new URL(rawUrl);
    return `${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
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

/**
 * The connection-string variables, in the order the scripts have always consulted them.
 * `.env` uses the Vercel-integration names; `POSTGRES_URL` is kept last as a legacy fallback.
 */
export const CONNECTION_VARS = [
  'VRCL_SUPA_POSTGRES_PRISMA_URL',
  'VRCL_SUPA_POSTGRES_URL',
  'VRCL_SUPA_POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL',
] as const;

/**
 * Which connection variables are **already set**. Call this *before* `dotenv.config()` — that is
 * the whole point of it.
 */
export function connectionVarsSetByOperator(env: Record<string, string | undefined>): string[] {
  return CONNECTION_VARS.filter((name) => Boolean(env[name]));
}

/**
 * Choose a connection string, letting a variable the **operator** exported beat one that only
 * `.env` supplied.
 *
 * ⚠️ WHY THIS EXISTS — a real trap, measured 2026-09-15.
 *
 * `dotenv` does not overwrite a variable that is already set, but it *does* fill in one the
 * operator did not set. `.env` defines `VRCL_SUPA_POSTGRES_PRISMA_URL` pointing at production, and
 * that name is the first one consulted. So this documented scratch command:
 *
 *     VRCL_SUPA_POSTGRES_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
 *       npx tsx scripts/run-migrations.ts
 *
 * exported the *second* name, `dotenv` then supplied the *first* one from `.env`, and the runner
 * silently applied migrations to **production** while the operator believed they were rehearsing
 * on the scratch database. That is R-07's exact nightmare: an unrehearsed, unbacked-up write, with
 * a log line that says `⚠ REMOTE` only if you happen to be reading it.
 *
 * The fix is to prefer any variable the operator actually exported, in the historical order,
 * before falling back to the `.env` order. With no operator variables set, behaviour is unchanged.
 */
export function pickConnectionString(
  env: Record<string, string | undefined>,
  operatorVars: readonly string[]
): string {
  const ordered = [
    ...CONNECTION_VARS.filter((name) => operatorVars.includes(name)),
    ...CONNECTION_VARS.filter((name) => !operatorVars.includes(name)),
  ];
  for (const name of ordered) {
    const value = env[name];
    if (value) return value;
  }
  return '';
}
