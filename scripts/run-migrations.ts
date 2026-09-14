/**
 * Applies SQL migrations from supabase/migrations in filename order.
 * Tracks applied files in public.schema_migrations; safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/run-migrations.ts                     # apply all not-yet-tracked
 *   npx tsx scripts/run-migrations.ts 2026_09_12_x.sql    # apply specific files
 *
 * Against the local scratch database (docs/runbooks/database-backup-restore.md §7b). This is
 * also the empirical test of ADR 0001 Phase A — that the nine migrations reproduce the live
 * schema from version control alone:
 *   VRCL_SUPA_POSTGRES_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
 *     npx tsx scripts/run-migrations.ts
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { MIGRATIONS_DIR, assertExist, resolveTargets, selectPending } from './lib/migrationPlan';
import { resolvePoolTarget, type PoolTarget } from './lib/pgTarget';

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
  const raw =
    process.env.VRCL_SUPA_POSTGRES_PRISMA_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    '';
  return resolvePoolTarget(raw);
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
