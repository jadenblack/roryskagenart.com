/**
 * Applies SQL migrations from supabase/migrations in filename order.
 * Tracks applied files in public.schema_migrations; safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/run-migrations.ts                     # apply all not-yet-tracked
 *   npx tsx scripts/run-migrations.ts 2026_09_12_x.sql    # apply specific files
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');

function getConnectionString(): string {
  const raw =
    process.env.VRCL_SUPA_POSTGRES_PRISMA_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    '';
  if (!raw) throw new Error('PostgreSQL connection string missing from environment.');
  // Strip query params so pg SSL configuration is authoritative (matches src/server/db.ts)
  return raw.replace(/\?.*$/, '');
}

async function main(): Promise<void> {
  const explicit = process.argv.slice(2);
  const allFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const files = explicit.length ? explicit : allFiles;

  for (const f of files) {
    if (!fs.existsSync(path.join(MIGRATIONS_DIR, f))) {
      throw new Error(`Migration file not found: ${f}`);
    }
  }

  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  let applied = 0;
  for (const file of files) {
    const tracked = await pool.query(
      'SELECT 1 FROM public.schema_migrations WHERE filename = $1',
      [file]
    );
    if (tracked.rows.length > 0) {
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
