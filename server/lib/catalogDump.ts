/**
 * Build a catalog dump **in memory** — the shared core of the backup writer and the cron route.
 *
 * WHY THIS EXISTS
 * `scripts/backup-catalog.ts` writes a dump to disk. The scheduled off-site backup has to do the
 * same thing inside a serverless function, where a filesystem is not a place to keep anything.
 * Duplicating the dump logic would mean two writers of manifest format v2 that can silently drift
 * apart — and a drift between "what the script writes" and "what the cron uploads" is exactly the
 * class of bug that makes a backup unusable at the moment you need it. So both go through here.
 *
 * The database access is **injected** as a `runQuery` function rather than importing `pg`. That
 * keeps this module free of any driver, which is what makes it testable offline
 * (`src/test/catalogDump.test.ts` builds a complete dump from a fake query function) and what lets
 * the same code run against the local scratch database and production.
 *
 * This module reads from `scripts/lib/` deliberately. Those helpers are pure — they import nothing
 * but `node:crypto` and each other — but "pure" is an assertion that can rot, so
 * `src/test/bundleSafety.test.ts` fails if a `scripts/lib/` module that runtime code depends on
 * ever starts importing `pg`, `fs` or `dotenv`. That keeps the serverless bundle clean without
 * duplicating the table list, the ordering, or the manifest format.
 */
import {
  buildManifest,
  buildTableEntry,
  tableFileName,
  verifyDump,
  type BackupManifest,
  type MigrationEntry,
  type TableEntry,
} from '../../scripts/lib/backupManifest';
import { RESTORE_ORDER, TABLES as TABLE_SPECS } from '../../scripts/lib/restorePlan';

/** Runs one SQL statement and returns its rows. The only I/O this module performs. */
export type DumpQuery = (sql: string) => Promise<Record<string, unknown>[]>;

export interface DumpFile {
  /** Name inside the dump directory, e.g. `artworks.json` or `manifest.json`. */
  name: string;
  content: string;
}

export interface CatalogDump {
  /** Directory-style name: an ISO-ish timestamp safe to use as a path segment. */
  stamp: string;
  /** The dump's file set, including `manifest.json`. */
  files: DumpFile[];
  manifest: BackupManifest;
}

/**
 * `2026-09-14T17-27-10-591Z`.
 *
 * `:` and `.` are replaced because this becomes a directory name (locally) and a Blob path
 * segment (off-site), and neither is a good place for either character. The result is fixed
 * width, so a lexicographic sort of stamps is a chronological sort.
 */
export function dumpStamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * Turn a stamp back into a real ISO timestamp.
 *
 * ⚠️ This is not cosmetic. `Date.parse('2026-09-14T17-27-10-591Z')` is **NaN** — the `-` before the
 * milliseconds is not a valid separator — and `selectForRetention` skips any dump whose
 * `createdAt` fails to parse when applying its minimum-age floor. Feeding a raw stamp in would
 * therefore silently disable the one rule that stops a run of bad dumps from deleting the good
 * ones before it. Always convert.
 */
export function stampToIso(stamp: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(stamp);
  if (!match) return null;
  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
}

const TABLES: readonly string[] = RESTORE_ORDER;

/** The table's primary key, used to make each dump byte-for-byte deterministic. */
function orderByClause(table: string): string {
  const spec = TABLE_SPECS[table];
  if (!spec) throw new Error(`No primary key recorded for table "${table}" in scripts/lib/restorePlan.ts.`);
  return spec.conflictTarget.map((column) => `"${column}"`).join(', ');
}

export interface CatalogDumpOptions {
  /** Defaults to "now". Only tests pass this, to make a dump's bytes deterministic. */
  now?: Date;
  /**
   * Credential-free description of where the dump came from, e.g.
   * `db.abc123.supabase.co:5432/postgres`. Use `describeTarget()` from `scripts/lib/pgTarget.ts` —
   * never a raw connection string, which would put the database password inside the dump.
   *
   * "Which database is this?" is the first question asked during a restore, and the answer is
   * impossible to recover later: the CLI script and the scheduled cron route read the same catalog
   * through different hosts (a pooler vs a direct connection), and every off-site dump looked
   * identical until this was passed in.
   */
  target?: string;
}

/**
 * Read every catalog table and assemble a verified dump.
 *
 * The manifest is built from the **query results** and then checked against the **serialised
 * files** before this returns, so a caller cannot receive a dump that does not agree with itself.
 * See `scripts/lib/backupManifest.ts` for why that check is the whole point.
 */
export async function buildCatalogDump(
  runQuery: DumpQuery,
  options: CatalogDumpOptions = {}
): Promise<CatalogDump> {
  const now = options.now ?? new Date();
  const info = await runQuery('SELECT current_database() AS db, version() AS version');
  const first = info[0] ?? {};
  const database = String(first.db ?? '');
  // First line only — the full version string carries the host's kernel details.
  const serverVersion = String(first.version ?? '').split('\n')[0];

  const files: DumpFile[] = [];
  const tables: Record<string, TableEntry> = {};

  for (const table of TABLES) {
    // `table` comes from RESTORE_ORDER in scripts/lib/restorePlan.ts, never from user input.
    // ORDER BY the primary key so two dumps of identical data are byte-identical — that is what
    // makes a before/after diff meaningful, and what lets a checksum comparison mean anything.
    const rows = await runQuery(`SELECT * FROM public.${table} ORDER BY ${orderByClause(table)}`);
    const json = JSON.stringify(rows, null, 2);
    files.push({ name: tableFileName(table), content: json });
    tables[table] = buildTableEntry(json, rows.length);
  }

  // Not restorable (the migration runner owns it), but recorded: it tells you which schema a
  // dump was taken against, which is the first question after "is it intact?".
  const migrations = (await runQuery(
    'SELECT filename, applied_at FROM public.schema_migrations ORDER BY filename'
  )) as unknown as MigrationEntry[];

  const manifest = buildManifest({
    createdAt: now.toISOString(),
    target: options.target ?? '(unknown)',
    database,
    serverVersion,
    tables,
    appliedMigrations: migrations,
  });

  files.push({ name: 'manifest.json', content: JSON.stringify(manifest, null, 2) });

  const problems = verifyDump(manifest, new Map(files.map((file) => [file.name, file.content])));
  if (problems.length > 0) {
    const detail = problems.map((p) => `[${p.kind}] ${p.detail}`).join('; ');
    throw new Error(`Dump failed its own verification (${problems.length} problem(s)): ${detail}`);
  }

  return { stamp: dumpStamp(now), files, manifest };
}
