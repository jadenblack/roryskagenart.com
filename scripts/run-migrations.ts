/**
 * Applies SQL migrations from supabase/migrations in filename order.
 * Tracks applied files in public.schema_migrations; safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/run-migrations.ts                     # apply all not-yet-tracked
 *   npx tsx scripts/run-migrations.ts 2026_09_12_x.sql    # apply specific files
 *
 * Against the local scratch database (docs/runbooks/database-backup-restore.md §7b). This is
 * also the empirical test of ADR 0001 Phase A — that the migrations reproduce the live schema
 * from version control alone. Either connection-variable name works: an operator-exported variable
 * now outranks the one `.env` supplies (see `pickConnectionString`).
 *   VRCL_SUPA_POSTGRES_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
 *     npx tsx scripts/run-migrations.ts
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { MIGRATIONS_DIR, assertExist, resolveTargets, selectPending } from './lib/migrationPlan';
import {
  connectionVarsSetByOperator,
  pickConnectionString,
  resolvePoolTarget,
  type PoolTarget,
} from './lib/pgTarget';

// ⚠️ BEFORE `dotenv.config()`, deliberately: record which connection variables the operator
// exported. `.env` supplies the production `VRCL_SUPA_POSTGRES_PRISMA_URL`, which outranks the
// shorter name a scratch-database command sets — so without this the documented scratch command
// applies migrations to **production**. See `pickConnectionString` for the full story.
const operatorVars = connectionVarsSetByOperator(process.env);
dotenv.config();

/**
 * Resolve the target database, including whether it needs TLS.
 *
 * The loopback rule lives in `./lib/pgTarget`. The local scratch database that `supabase start`
 * serves on 127.0.0.1:54322 does not offer TLS, so a hardcoded
 * `ssl: { rejectUnauthorized: false }` makes this script fail against it with
 * "The server does not support SSL connections". Remote behaviour is unchanged.
 */
function getPoolTarget(): PoolTarget {
  return resolvePoolTarget(pickConnectionString(process.env, operatorVars));
}

async function main(): Promise<void> {
  const files = resolveTargets(process.argv.slice(2));
  assertExist(files);

  const target = getPoolTarget();
  // Print the target before touching anything: this is the highest-consequence script in the
  // repo, and an accidental production run should be obvious in the log.
  console.log(`Target: ${target.host}${target.isRemote ? '  ⚠ REMOTE' : '  (local)'}`);

  const pool = new Pool({
    connectionString: target.connectionString,
    ssl: target.ssl,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Lock the ledger down: RLS enabled with NO policies means only the table owner (this runner
  // connects as `postgres`) and `service_role` can read it — the anon key sees zero rows.
  //
  // This lives here rather than in a migration on purpose. `src/test/migrationSafety.test.ts`
  // asserts that RLS is enabled only on tables that a *migration* creates, and no migration
  // creates this table — the runner does, so the runner owns its RLS state too.
  //
  // Found by building a database from version control and diffing it against production
  // (2026-09-14): production already had RLS enabled here, but nothing in the repo said so, so a
  // rebuilt database left the migration ledger readable with the anon key. Verified safe first —
  // the owner bypasses RLS (no FORCE), so both the read and the write path above still work, and
  // the statement is idempotent.
  await pool.query('ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY');

  // One read of the ledger, then decide in memory — the selection logic itself is pure
  // and unit-tested in src/test/migrationPlan.test.ts.
  const ledger = await pool.query('SELECT filename FROM public.schema_migrations');
  const pending = new Set(
    selectPending(files, ledger.rows.map((r: { filename: string }) => r.filename))
  );

  let applied = 0;
  for (const file of files) {
    if (!pending.has(file)) {
      console.log(`= ${file} (already applied, skipping)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      // Multi-statement simple query runs as one implicit transaction
      await pool.query(sql);
      await pool.query('INSERT INTO public.schema_migrations (filename) VALUES ($1)', [file]);
      console.log(`+ ${file} applied`);
      applied += 1;
    } catch (err: any) {
      console.error(`x ${file} FAILED:`, err?.message || err);
      await pool.end();
      process.exit(1);
    }
  }

  await pool.end();
  console.log(applied === 0 ? 'Nothing to do.' : `Done — ${applied} migration(s) applied.`);
}

main().catch((err) => {
  console.error('Migration runner error:', err?.message || err);
  process.exit(1);
});
