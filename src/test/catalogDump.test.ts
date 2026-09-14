/**
 * Tests for the in-memory catalog dump (`server/lib/catalogDump.ts`) — the shared core behind both
 * `scripts/backup-catalog.ts` and the scheduled off-site backup.
 *
 * WHY THIS EXISTS
 * Two writers of the same backup format is how a backup silently stops being restorable: the CLI
 * script and the cron route would drift, and the drift would only be discovered during an incident.
 * This module is the single writer, and it is testable offline because the database is injected as
 * a function rather than imported.
 *
 * The property that matters most is **determinism**: two dumps of unchanged data must be
 * byte-identical, because that is the only thing that makes a checksum comparison (and therefore
 * verification) meaningful at all. The `ORDER BY` assertion below is what guarantees it.
 *
 * Zero tokens: no database, no network, no filesystem.
 */
import { describe, expect, it } from 'vitest';
import { buildCatalogDump, dumpStamp, stampToIso, type DumpQuery } from '../../server/lib/catalogDump';
import { FORMAT_VERSION, sha256Hex, tableFileName } from '../../scripts/lib/backupManifest';
import { RESTORE_ORDER, TABLES as TABLE_SPECS } from '../../scripts/lib/restorePlan';

/** Stands in for the database. `counts` is rows per table; values are unimportant. */
function fakeDb(counts: Record<string, number> = {}): { run: DumpQuery; seen: string[] } {
  const seen: string[] = [];

  const run: DumpQuery = async (sql) => {
    seen.push(sql);

    if (sql.includes('current_database()')) {
      return [{ db: 'postgres', version: 'PostgreSQL 17.2 on x86_64\ncompiled by gcc' }];
    }
    if (sql.includes('schema_migrations')) {
      return [
        { filename: '2026_09_01_baseline_core_tables.sql', applied_at: '2026-09-14T00:00:00Z' },
        { filename: '2026_09_14_v2_12_1_staff_scoped_policies.sql', applied_at: '2026-09-14T12:00:00Z' },
      ] as unknown as Record<string, unknown>[];
    }

    const match = /FROM public\.([a-z_]+)/.exec(sql);
    const table = match?.[1] ?? '';
    const rows = counts[table] ?? 0;
    return Array.from({ length: rows }, (_, i) => ({ id: `${table}-${i}` }));
  };

  return { run, seen };
}

const COUNTS = { artworks: 138, media_assets: 152, pages: 4, inquiries: 1, settings: 5, profiles: 3, taxonomies: 3 };

describe('buildCatalogDump', () => {
  it('emits one file per restorable table plus the manifest', async () => {
    const { run } = fakeDb(COUNTS);
    const dump = await buildCatalogDump(run);

    expect(dump.files.map((f) => f.name).sort()).toEqual(
      [...RESTORE_ORDER.map(tableFileName), 'manifest.json'].sort()
    );
  });

  it('records format v2, so the dump is verifiable off-site', async () => {
    const { run } = fakeDb(COUNTS);
    const dump = await buildCatalogDump(run);
    expect(dump.manifest.formatVersion).toBe(FORMAT_VERSION);
  });

  it('counts every row and every recorded migration', async () => {
    const { run } = fakeDb(COUNTS);
    const dump = await buildCatalogDump(run);
    const expected = Object.values(COUNTS).reduce((a, b) => a + b, 0);
    expect(dump.manifest.totalRows).toBe(expected);
    expect(dump.manifest.appliedMigrations).toHaveLength(2);
  });

  it('hashes the exact bytes it returns — the manifest and the files cannot disagree', async () => {
    const { run } = fakeDb(COUNTS);
    const dump = await buildCatalogDump(run);

    for (const [table, entry] of Object.entries(dump.manifest.tables)) {
      const file = dump.files.find((f) => f.name === tableFileName(table));
      expect(file).toBeDefined();
      expect(sha256Hex(file!.content)).toBe(entry.sha256);
      expect(Buffer.byteLength(file!.content, 'utf8')).toBe(entry.bytes);
    }
  });

  it('orders every table by its primary key, so identical data yields identical bytes', async () => {
    const { run, seen } = fakeDb(COUNTS);
    await buildCatalogDump(run);

    for (const table of RESTORE_ORDER) {
      const sql = seen.find((s) => s.includes(`FROM public.${table} `));
      expect(sql, `no dump query issued for ${table}`).toBeDefined();
      for (const column of TABLE_SPECS[table].conflictTarget) {
        expect(sql).toContain(`"${column}"`);
      }
      expect(sql).toMatch(/ORDER BY "/);
    }
  });

  it('is deterministic — two runs over unchanged data produce identical bytes', async () => {
    const a = await buildCatalogDump(fakeDb(COUNTS).run, new Date('2026-09-14T04:00:00.000Z'));
    const b = await buildCatalogDump(fakeDb(COUNTS).run, new Date('2026-09-14T04:00:00.000Z'));
    expect(b.files).toEqual(a.files);
    expect(b.stamp).toBe(a.stamp);
  });

  it('names the dump with a path-safe stamp derived from its own timestamp', async () => {
    const { run } = fakeDb(COUNTS);
    const dump = await buildCatalogDump(run, new Date('2026-09-14T17:27:10.591Z'));
    expect(dump.stamp).toBe('2026-09-14T17-27-10-591Z');
    expect(stampToIso(dump.stamp)).toBe(dump.manifest.createdAt);
  });

  it('keeps only the first line of the server version', async () => {
    const { run } = fakeDb(COUNTS);
    const dump = await buildCatalogDump(run);
    expect(dump.manifest.serverVersion).toBe('PostgreSQL 17.2 on x86_64');
    expect(dump.manifest.serverVersion).not.toContain('\n');
  });
});

describe('dumpStamp / stampToIso', () => {
  it('round-trips a timestamp through the path-safe form', () => {
    const stamp = dumpStamp(new Date('2026-09-14T17:27:10.591Z'));
    expect(stamp).toBe('2026-09-14T17-27-10-591Z');
    expect(stampToIso(stamp)).toBe('2026-09-14T17:27:10.591Z');
  });

  it('produces stamps that sort chronologically as plain strings', () => {
    const stamps = [
      dumpStamp(new Date('2026-12-01T00:00:00.000Z')),
      dumpStamp(new Date('2026-02-01T00:00:00.000Z')),
      dumpStamp(new Date('2026-09-01T00:00:00.000Z')),
    ];
    expect([...stamps].sort()).toEqual([stamps[1], stamps[2], stamps[0]]);
  });
});
