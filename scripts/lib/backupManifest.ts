/**
 * Pure logic for backup manifests, dump verification and retention.
 *
 * WHY THIS EXISTS
 * `scripts/backup-catalog.ts` wrote a `manifest.json` describing a snapshot, but nothing ever read
 * it back. That left a real hole in the recovery story: if a dump were truncated, a file were
 * corrupted, or a table were silently skipped, **nothing would notice** — and `restore-catalog.ts`
 * would happily insert whatever partial data it found. A backup that cannot be verified is not a
 * backup; it is a hope.
 *
 * This module is the verification half. It is deliberately free of `fs` and `pg` so it runs in the
 * vitest suite with no filesystem, no database and no network — the same constraint
 * `scripts/lib/restorePlan.ts` and `scripts/lib/pgTarget.ts` follow, and what makes the write path
 * testable at all.
 *
 * The manifest format is versioned. `FORMAT_VERSION` is bumped whenever the shape changes, and
 * `verifyDump` refuses a manifest it does not understand rather than guessing — an old dump read by
 * a new verifier must fail loudly, not pass quietly.
 */
import { createHash } from 'crypto';

/** Bumped when the manifest shape changes incompatibly. v1 was `scripts/backup-catalog.ts`'s original. */
export const FORMAT_VERSION = 2;

/** A v1 manifest predates checksums, so it cannot be verified — only reported as unverifiable. */
export const LEGACY_FORMAT_VERSION = 1;

export interface TableEntry {
  rows: number;
  bytes: number;
  /** Hex sha256 of the exact bytes written to `<table>.json`. */
  sha256: string;
}

export interface MigrationEntry {
  filename: string;
  applied_at: string;
}

export interface BackupManifest {
  formatVersion: number;
  createdAt: string;
  /** Host/database of the source, without credentials. */
  target: string;
  database: string;
  serverVersion: string;
  totalRows: number;
  tables: Record<string, TableEntry>;
  appliedMigrations: MigrationEntry[];
}

/** The file a table's rows are written to. One function so writer and verifier cannot disagree. */
export function tableFileName(table: string): string {
  return `${table}.json`;
}

/** Hex sha256 of the exact content written to disk. */
export function sha256Hex(content: string | Buffer): string {
  const hash = createHash('sha256');
  // `update`'s (data, encoding) overload only accepts a string, so the two cases are branched
  // rather than passing `undefined` as the encoding for a Buffer.
  if (typeof content === 'string') hash.update(content, 'utf8');
  else hash.update(content);
  return hash.digest('hex');
}

/**
 * Describe one table's dump file. `rows` is passed in rather than inferred from the JSON so that a
 * file which is valid JSON but structurally wrong (e.g. an object where an array is expected)
 * cannot pass verification by accident.
 */
export function buildTableEntry(content: string, rows: number): TableEntry {
  return { rows, bytes: Buffer.byteLength(content, 'utf8'), sha256: sha256Hex(content) };
}

export function buildManifest(input: {
  createdAt: string;
  target: string;
  database: string;
  serverVersion: string;
  tables: Record<string, TableEntry>;
  appliedMigrations: MigrationEntry[];
}): BackupManifest {
  return {
    formatVersion: FORMAT_VERSION,
    createdAt: input.createdAt,
    target: input.target,
    database: input.database,
    serverVersion: input.serverVersion,
    totalRows: Object.values(input.tables).reduce((sum, t) => sum + t.rows, 0),
    tables: input.tables,
    appliedMigrations: input.appliedMigrations,
  };
}

export type ProblemKind =
  | 'unusable-manifest'
  | 'unsupported-format'
  | 'missing-file'
  | 'checksum-mismatch'
  | 'row-count-mismatch'
  | 'unexpected-file';

export interface VerifyProblem {
  kind: ProblemKind;
  table?: string;
  detail: string;
}

/**
 * Compare a manifest against the files actually present on disk.
 *
 * `files` maps file name → exact content, so the caller owns I/O and this stays pure. Every failure
 * is collected rather than thrown, because the useful output of a verification is the *list* of
 * what is wrong.
 *
 * A row count that disagrees is reported separately from a checksum mismatch: the checksum proves
 * the bytes are what was written, the row count proves the writer counted correctly. Both are
 * required, and a mismatch in either means the dump should not be trusted for a restore.
 */
export function verifyDump(manifest: unknown, files: Map<string, string>): VerifyProblem[] {
  const problems: VerifyProblem[] = [];

  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return [{ kind: 'unusable-manifest', detail: 'manifest.json is not an object.' }];
  }

  const m = manifest as Partial<BackupManifest>;

  // A v1 manifest is defined by the *absence* of `formatVersion`: v1 was the original shape of
  // `scripts/backup-catalog.ts`'s manifest, which had no version field and no checksums. Guarding
  // only on `formatVersion === 1` made this branch dead for every v1 dump actually on disk (all of
  // them report `undefined`), so a real legacy dump was reported as an unknown version instead of
  // as what it is.
  if (m.formatVersion === undefined || m.formatVersion === LEGACY_FORMAT_VERSION) {
    return [
      {
        kind: 'unsupported-format',
        detail:
          'This dump has no per-table checksums (manifest format v1, the pre-checksum shape), so ' +
          'it cannot be verified. It is still restorable — but nothing here can prove it is intact. ' +
          'Re-take it with scripts/backup-catalog.ts for a verifiable format v2 dump.',
      },
    ];
  }

  if (m.formatVersion !== FORMAT_VERSION) {
    return [
      {
        kind: 'unsupported-format',
        detail: `Manifest formatVersion is ${String(m.formatVersion)}; this verifier understands ${FORMAT_VERSION}.`,
      },
    ];
  }

  if (!m.tables || typeof m.tables !== 'object' || Array.isArray(m.tables)) {
    return [{ kind: 'unusable-manifest', detail: 'manifest.json has no usable "tables" object.' }];
  }

  const tables = m.tables as Record<string, TableEntry>;

  for (const [table, entry] of Object.entries(tables)) {
    const fileName = tableFileName(table);
    const content = files.get(fileName);

    if (content === undefined) {
      problems.push({ kind: 'missing-file', table, detail: `${fileName} is listed in the manifest but is not present.` });
      continue;
    }

    const actualSha = sha256Hex(content);
    if (actualSha !== entry.sha256) {
      problems.push({
        kind: 'checksum-mismatch',
        table,
        detail: `${fileName} sha256 is ${actualSha}, manifest recorded ${entry.sha256}.`,
      });
    }

    let rows: number | null = null;
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) rows = parsed.length;
    } catch {
      problems.push({ kind: 'unusable-manifest', table, detail: `${fileName} is not valid JSON.` });
      continue;
    }

    if (rows === null) {
      problems.push({ kind: 'unusable-manifest', table, detail: `${fileName} does not contain a JSON array.` });
    } else if (rows !== entry.rows) {
      problems.push({
        kind: 'row-count-mismatch',
        table,
        detail: `${fileName} contains ${rows} rows, manifest recorded ${entry.rows}.`,
      });
    }
  }

  // A stray table file means the dump directory is not what the manifest describes — for example a
  // second backup written into the same folder. Report it rather than ignore it.
  for (const fileName of files.keys()) {
    if (fileName === 'manifest.json') continue;
    const table = fileName.replace(/\.json$/, '');
    if (!Object.prototype.hasOwnProperty.call(tables, table)) {
      problems.push({ kind: 'unexpected-file', detail: `${fileName} is present but not listed in the manifest.` });
    }
  }

  return problems;
}

export interface DumpSummary {
  /** Directory name, e.g. `2026-09-14T17-27-10-591Z`. */
  name: string;
  /** ISO timestamp from the manifest. */
  createdAt: string;
}

export interface RetentionPolicy {
  /** Always keep the newest N dumps, whatever else the policy says. */
  keepRecent: number;
  /** Also keep the newest dump from each calendar month, for long-range history. */
  keepMonthly: boolean;
  /** Never delete a dump younger than this, so a bad run cannot wipe recent history. */
  minAgeDays: number;
}

/**
 * Decide which dumps to keep.
 *
 * The policy exists so an automated off-site backup cannot grow without bound while still retaining
 * a long-range trail: recent dumps are kept densely (the useful case), one per month is kept for
 * history, and a floor on age means a bug that produces a run of empty dumps cannot cause the
 * deletion of everything that came before it.
 *
 * `now` is injected rather than read from the clock so this is deterministic under test.
 */
export function selectForRetention(
  dumps: DumpSummary[],
  policy: RetentionPolicy,
  now: Date
): { keep: string[]; remove: string[] } {
  const ordered = [...dumps].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const keep = new Set<string>();
  for (const dump of ordered.slice(0, Math.max(0, policy.keepRecent))) keep.add(dump.name);

  if (policy.keepMonthly) {
    const seenMonths = new Set<string>();
    for (const dump of ordered) {
      const month = dump.createdAt.slice(0, 7); // YYYY-MM
      if (!month) continue;
      if (seenMonths.has(month)) continue;
      seenMonths.add(month);
      keep.add(dump.name);
    }
  }

  const cutoff = now.getTime() - policy.minAgeDays * 24 * 60 * 60 * 1000;
  for (const dump of ordered) {
    const at = Date.parse(dump.createdAt);
    if (Number.isFinite(at) && at >= cutoff) keep.add(dump.name);
  }

  const remove: string[] = [];
  const keepList: string[] = [];
  for (const dump of ordered) {
    if (keep.has(dump.name)) keepList.push(dump.name);
    else remove.push(dump.name);
  }

  return { keep: keepList, remove };
}
