/**
 * Read-only logical backup of the catalog.
 *
 * WHY THIS EXISTS
 * docs/adr/0001 found that the catalog had no documented rollback path: the only recovery
 * option for a bad write was "restore the whole Supabase project". This script produces a
 * self-contained, human-readable snapshot of every catalog table before any migration or
 * backfill runs, so a bad write can be diagnosed and reversed row by row.
 *
 * It is STRICTLY READ-ONLY — it issues nothing but SELECTs. It never writes to the database.
 *
 * Usage:
 *   npx tsx scripts/backup-catalog.ts                 # → data/backups/<timestamp>/
 *   npx tsx scripts/backup-catalog.ts --out ./tmp/bk  # explicit destination
 *
 * Output: one JSON file per table, plus manifest.json (row counts, applied migrations,
 * server version) so a snapshot is self-describing.
 *
 * ⚠️ The dump contains production data and `profiles` rows include studio member emails.
 * `data/backups/` is gitignored — keep it that way. See docs/runbooks/database-backup-restore.md.
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Every table in `public` except `schema_migrations` (the runner owns it and it is
 * reconstructible). Order is dependency-friendly for a future scripted restore:
 * parents before the M2M rows that reference them.
 */
const TABLES = [
  'profiles',
  'taxonomies',
  'settings',
  'artworks',
  'artwork_terms',
  'media_assets',
  'pages',
  'inquiries',
] as const;

function getConnectionString(): string {
  const raw =
    process.env.VRCL_SUPA_POSTGRES_PRISMA_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    '';
  if (!raw) throw new Error('PostgreSQL connection string missing from environment.');
  return raw.replace(/\?.*$/, '');
}

/** Connection target without credentials, safe to write into the manifest. */
function describeTarget(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}

function resolveOutDir(): string {
  const flag = process.argv.indexOf('--out');
  if (flag !== -1 && process.argv[flag + 1]) {
    return path.resolve(process.cwd(), process.argv[flag + 1]);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(process.cwd(), 'data', 'backups', stamp);
}

async function main(): Promise<void> {
  const connectionString = getConnectionString();
  const outDir = resolveOutDir();
  fs.mkdirSync(outDir, { recursive: true });

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const info = await pool.query<{ db: string; version: string }>(
    'SELECT current_database() AS db, version() AS version'
  );

  const manifest: {
    createdAt: string;
    target: string;
    database: string;
    serverVersion: string;
    tables: Record<string, { rows: number; bytes: number }>;
    appliedMigrations: { filename: string; applied_at: string }[];
  } = {
    createdAt: new Date().toISOString(),
    target: describeTarget(connectionString),
    database: info.rows[0].db,
    // First line only — the full string carries the host's kernel details.
    serverVersion: info.rows[0].version.split('\n')[0],
    tables: {},
    appliedMigrations: [],
  };

  console.log(`Backing up ${manifest.database} → ${path.relative(process.cwd(), outDir)}`);

  let totalRows = 0;
  for (const table of TABLES) {
    // `table` comes from the hardcoded TABLES tuple above, never from user input.
    const { rows } = await pool.query(`SELECT * FROM public.${table}`);
    const json = JSON.stringify(rows, null, 2);
    fs.writeFileSync(path.join(outDir, `${table}.json`), json);
    const bytes = Buffer.byteLength(json, 'utf8');
    manifest.tables[table] = { rows: rows.length, bytes };
    totalRows += rows.length;
    console.log(`  ${table.padEnd(14)} ${String(rows.length).padStart(5)} rows  ${bytes} B`);
  }

  const migrations = await pool.query<{ filename: string; applied_at: string }>(
    'SELECT filename, applied_at FROM public.schema_migrations ORDER BY filename'
  );
  manifest.appliedMigrations = migrations.rows;

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  await pool.end();

  console.log(
    `Done — ${TABLES.length} tables, ${totalRows} rows, ` +
      `${manifest.appliedMigrations.length} recorded migrations.`
  );
  console.log('Restore procedure: docs/runbooks/database-backup-restore.md');
}

main().catch((err) => {
  console.error('Backup error:', err?.message || err);
  process.exit(1);
});
