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
 * Output: one JSON file per table, plus manifest.json (format version, per-table sha256 + row count
 * + byte length, applied migrations, server version) so a snapshot is self-describing **and**
 * verifiable.
 *
 * SELF-VERIFYING
 * The manifest is format v2, which records a sha256 of each table file. After writing, this script
 * re-reads the directory and checks it against the manifest before exiting. A truncated write, a
 * disk error or a silently skipped table therefore fails *here*, at creation time, with a non-zero
 * exit — rather than being discovered during a restore, when it is far too late. Re-check an
 * existing dump at any time with `npx tsx scripts/verify-backup.ts`.
 *
 * ⚠️ The dump contains production data and `profiles` rows include studio member emails.
 * `data/backups/` is gitignored — keep it that way. See docs/runbooks/database-backup-restore.md.
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { resolvePoolTarget } from './lib/pgTarget';
import { RESTORE_ORDER, TABLES as TABLE_SPECS } from './lib/restorePlan';
import {
  buildManifest,
  buildTableEntry,
  tableFileName,
  verifyDump,
  type MigrationEntry,
  type TableEntry,
} from './lib/backupManifest';
import { readDumpDir } from './lib/dumpDir';

dotenv.config();

/**
 * Every table in `public` except `schema_migrations` (the runner owns it and it is
 * reconstructible).
 *
 * Both the list and the primary keys come from `scripts/lib/restorePlan.ts`, which is the single
 * source of truth for the backup/restore pair — so the dump order, the dump's row order, and the
 * restore's insert order cannot drift apart. `RESTORE_ORDER` is dependency-friendly: parents
 * before the M2M rows that reference them, and it is unit-tested in
 * `src/test/restorePlan.test.ts`.
 */
const TABLES = RESTORE_ORDER;

/** The table's primary key, used to make each dump deterministic. */
function orderByClause(table: string): string {
  const spec = TABLE_SPECS[table];
  if (!spec) throw new Error(`No primary key recorded for table "${table}" in scripts/lib/restorePlan.ts.`);
  return spec.conflictTarget.map((column) => `"${column}"`).join(', ');
}

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

  // Loopback targets (the local scratch database on 127.0.0.1:54322) get no TLS — the SSL rule
  // lives in scripts/lib/pgTarget.ts. Remote behaviour is unchanged.
  const poolTarget = resolvePoolTarget(connectionString);
  const pool = new Pool({
    connectionString: poolTarget.connectionString,
    ssl: poolTarget.ssl,
  });

  const info = await pool.query<{ db: string; version: string }>(
    'SELECT current_database() AS db, version() AS version'
  );

  const target = describeTarget(connectionString);
  const database = info.rows[0].db;
  // First line only — the full string carries the host's kernel details.
  const serverVersion = info.rows[0].version.split('\n')[0];

  console.log(`Backing up ${database} → ${path.relative(process.cwd(), outDir)}`);

  try {
    const tables: Record<string, TableEntry> = {};

    for (const table of TABLES) {
      // `table` comes from RESTORE_ORDER in scripts/lib/restorePlan.ts, never from user input.
      // ORDER BY the primary key so two dumps of identical data are byte-identical — that is what
      // makes the before/after diff in docs/runbooks/database-backup-restore.md §4a reliable, and
      // what lets a checksum comparison mean something.
      const { rows } = await pool.query(`SELECT * FROM public.${table} ORDER BY ${orderByClause(table)}`);
      const json = JSON.stringify(rows, null, 2);
      fs.writeFileSync(path.join(outDir, tableFileName(table)), json);
      // The row count comes from the query result, not from re-parsing the JSON, so a file that is
      // valid JSON but structurally wrong cannot agree with the manifest by accident.
      tables[table] = buildTableEntry(json, rows.length);
      console.log(`  ${table.padEnd(14)} ${String(rows.length).padStart(5)} rows  ${tables[table].bytes} B`);
    }

    const migrations = await pool.query<MigrationEntry>(
      'SELECT filename, applied_at FROM public.schema_migrations ORDER BY filename'
    );

    const manifest = buildManifest({
      createdAt: new Date().toISOString(),
      target,
      database,
      serverVersion,
      tables,
      appliedMigrations: migrations.rows,
    });

    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Self-check — see the header. Read the directory back from disk (not from memory) so this
    // catches a short write, not just a bookkeeping mistake.
    const problems = verifyDump(manifest, readDumpDir(outDir));
    if (problems.length > 0) {
      for (const problem of problems) {
        console.error(`  ✗ [${problem.kind}]${problem.table ? ` ${problem.table}:` : ''} ${problem.detail}`);
      }
      throw new Error(
        `Self-verification failed with ${problems.length} problem(s). The dump at ` +
          `${path.relative(process.cwd(), outDir)} must NOT be used for a restore.`
      );
    }

    console.log(
      `Done — ${TABLES.length} tables, ${manifest.totalRows} rows, ` +
        `${manifest.appliedMigrations.length} recorded migrations.`
    );
    console.log(`Verified — format v${manifest.formatVersion}, sha256 matched for all ${TABLES.length} tables.`);
    console.log('Restore procedure: docs/runbooks/database-backup-restore.md');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Backup error:', err?.message || err);
  process.exit(1);
});
