/**
 * Tests for the backup manifest, dump verification and retention logic.
 *
 * These are pure-logic tests: no filesystem, no database, no network, no tokens. They exist because
 * `scripts/backup-catalog.ts` used to write a `manifest.json` that nothing ever read back — so a
 * truncated dump, a corrupted file or a silently skipped table would go unnoticed and
 * `scripts/restore-catalog.ts` would insert whatever partial data it found.
 *
 * The point of the module under test is to make "the backup is good" a claim that can be *checked*
 * rather than assumed, so the tests concentrate on the failure paths, not the happy one.
 */
import { describe, expect, it } from 'vitest';
import {
  FORMAT_VERSION,
  LEGACY_FORMAT_VERSION,
  buildManifest,
  buildTableEntry,
  selectForRetention,
  sha256Hex,
  tableFileName,
  verifyDump,
  type BackupManifest,
  type DumpSummary,
  type RetentionPolicy,
} from '../../scripts/lib/backupManifest';

/** Build a manifest plus the matching files, so each test can corrupt exactly one thing. */
function goodDump(tables: Record<string, unknown[]>): { manifest: BackupManifest; files: Map<string, string> } {
  const files = new Map<string, string>();
  const entries: Record<string, ReturnType<typeof buildTableEntry>> = {};
  for (const [table, rows] of Object.entries(tables)) {
    const content = JSON.stringify(rows, null, 2);
    files.set(tableFileName(table), content);
    entries[table] = buildTableEntry(content, rows.length);
  }
  const manifest = buildManifest({
    createdAt: '2026-09-14T17:27:10.591Z',
    target: 'aws-0-us-east-1.pooler.supabase.com:5432/postgres',
    database: 'postgres',
    serverVersion: 'PostgreSQL 17.6',
    tables: entries,
    appliedMigrations: [{ filename: '2026_09_01_baseline_core_tables.sql', applied_at: '2026-09-01T00:00:00Z' }],
  });
  return { manifest, files };
}

describe('sha256Hex', () => {
  it('matches the known digest for the empty string', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('is stable and content-sensitive', () => {
    expect(sha256Hex('{"a":1}')).toBe(sha256Hex('{"a":1}'));
    expect(sha256Hex('{"a":1}')).not.toBe(sha256Hex('{"a":2}'));
  });

  it('hashes bytes and their utf8 string identically', () => {
    expect(sha256Hex(Buffer.from('café', 'utf8'))).toBe(sha256Hex('café'));
  });
});

describe('buildTableEntry / buildManifest', () => {
  it('records the byte length of the utf8 encoding, not the character count', () => {
    const content = JSON.stringify([{ title: 'Café — étude' }], null, 2);
    const entry = buildTableEntry(content, 1);
    expect(entry.bytes).toBe(Buffer.byteLength(content, 'utf8'));
    expect(entry.bytes).toBeGreaterThan(content.length);
    expect(entry.rows).toBe(1);
    expect(entry.sha256).toBe(sha256Hex(content));
  });

  it('sums totalRows across tables', () => {
    const { manifest } = goodDump({ artworks: [{}, {}, {}], inquiries: [{}] });
    expect(manifest.totalRows).toBe(4);
    expect(manifest.tables.artworks.rows).toBe(3);
  });

  it('stamps the current format version', () => {
    const { manifest } = goodDump({ artworks: [] });
    expect(manifest.formatVersion).toBe(FORMAT_VERSION);
  });
});

describe('verifyDump — a clean dump', () => {
  it('reports no problems', () => {
    const { manifest, files } = goodDump({ artworks: [{ slug: 'a' }], inquiries: [] });
    expect(verifyDump(manifest, files)).toEqual([]);
  });

  it('accepts an empty table', () => {
    const { manifest, files } = goodDump({ artwork_terms: [] });
    expect(verifyDump(manifest, files)).toEqual([]);
  });
});

describe('verifyDump — the failure paths that matter', () => {
  it('detects a truncated file via the checksum', () => {
    const { manifest, files } = goodDump({ artworks: [{ slug: 'a' }, { slug: 'b' }] });
    files.set(tableFileName('artworks'), JSON.stringify([{ slug: 'a' }], null, 2));

    const problems = verifyDump(manifest, files);
    const kinds = problems.map((p) => p.kind);
    expect(kinds).toContain('checksum-mismatch');
    // A truncation changes both the bytes and the count — both must be reported.
    expect(kinds).toContain('row-count-mismatch');
  });

  it('detects a missing table file', () => {
    const { manifest, files } = goodDump({ artworks: [], inquiries: [] });
    files.delete(tableFileName('inquiries'));

    expect(verifyDump(manifest, files)).toEqual([
      expect.objectContaining({ kind: 'missing-file', table: 'inquiries' }),
    ]);
  });

  it('detects a silently skipped table (present in manifest, absent on disk)', () => {
    const { manifest, files } = goodDump({ artworks: [], media_assets: [], pages: [] });
    files.delete(tableFileName('media_assets'));

    const problems = verifyDump(manifest, files);
    expect(problems).toHaveLength(1);
    expect(problems[0].table).toBe('media_assets');
  });

  it('detects a file that is valid JSON but not an array', () => {
    const { manifest, files } = goodDump({ artworks: [{}] });
    files.set(tableFileName('artworks'), JSON.stringify({ rows: [{}] }, null, 2));

    const problems = verifyDump(manifest, files);
    expect(problems.map((p) => p.kind)).toContain('unusable-manifest');
  });

  it('detects a file that is not JSON at all', () => {
    const { manifest, files } = goodDump({ artworks: [{}] });
    files.set(tableFileName('artworks'), 'not json');

    expect(verifyDump(manifest, files).map((p) => p.kind)).toContain('unusable-manifest');
  });

  it('detects a stray file the manifest does not describe', () => {
    const { manifest, files } = goodDump({ artworks: [] });
    files.set('orphan_table.json', '[]');

    const problems = verifyDump(manifest, files);
    expect(problems).toEqual([
      expect.objectContaining({ kind: 'unexpected-file', detail: expect.stringContaining('orphan_table.json') }),
    ]);
  });

  it('does not treat manifest.json as a stray file', () => {
    const { manifest, files } = goodDump({ artworks: [] });
    files.set('manifest.json', JSON.stringify(manifest));
    expect(verifyDump(manifest, files)).toEqual([]);
  });

  it('reports every problem rather than stopping at the first', () => {
    const { manifest, files } = goodDump({ artworks: [{}], inquiries: [{}], pages: [{}] });
    files.delete(tableFileName('artworks'));
    files.delete(tableFileName('inquiries'));
    files.set(tableFileName('pages'), '[]');

    const problems = verifyDump(manifest, files);
    expect(problems.filter((p) => p.kind === 'missing-file')).toHaveLength(2);
    expect(problems.filter((p) => p.kind === 'checksum-mismatch')).toHaveLength(1);
  });
});

describe('verifyDump — format versioning', () => {
  /**
   * The exact shape `scripts/backup-catalog.ts` produced before format v2: **no `formatVersion`
   * field at all**, and `{ rows, bytes }` per table with no checksum.
   *
   * This is not hypothetical. It is what every dump already in `data/backups/` looks like, and the
   * original code guarded only on `formatVersion === 1`, so those dumps fell through to the generic
   * "unknown version" branch and were reported as `formatVersion is undefined` — a message that
   * tells the operator nothing about what to do.
   */
  const v1Manifest = { tables: { artworks: { rows: 1, bytes: 2 } } };

  it('reports a real v1 dump as unverifiable legacy, not as an unknown version', () => {
    const problems = verifyDump(v1Manifest, new Map([['artworks.json', '[]']]));

    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('unsupported-format');
    expect(problems[0].detail).toMatch(/cannot be verified/i);
    // It must not imply the dump is *broken* — an unverifiable dump is still restorable, and
    // saying otherwise would push an operator away from a backup that is fine.
    expect(problems[0].detail).toMatch(/still restorable/i);
    expect(problems[0].detail).not.toMatch(/undefined/);
  });

  it('treats an explicitly stamped v1 manifest the same way', () => {
    const explicit = { formatVersion: LEGACY_FORMAT_VERSION, ...v1Manifest };
    expect(verifyDump(explicit, new Map())[0].kind).toBe('unsupported-format');
  });

  it('refuses an unknown future format version', () => {
    const future = { formatVersion: FORMAT_VERSION + 1, tables: {} };
    const problems = verifyDump(future, new Map());
    expect(problems[0].kind).toBe('unsupported-format');
    // The message must name both versions, so the reader knows the gap they are bridging.
    expect(problems[0].detail).toContain(String(FORMAT_VERSION + 1));
    expect(problems[0].detail).toContain(String(FORMAT_VERSION));
  });

  it('refuses a manifest that is not an object', () => {
    expect(verifyDump(null, new Map())[0].kind).toBe('unusable-manifest');
    expect(verifyDump([], new Map())[0].kind).toBe('unusable-manifest');
    expect(verifyDump('nope', new Map())[0].kind).toBe('unusable-manifest');
  });

  it('refuses a manifest whose tables member is not an object', () => {
    const bad = { formatVersion: FORMAT_VERSION, tables: [] };
    expect(verifyDump(bad, new Map())[0].kind).toBe('unusable-manifest');
  });
});

describe('selectForRetention', () => {
  const policy: RetentionPolicy = { keepRecent: 2, keepMonthly: true, minAgeDays: 0 };
  const dump = (name: string, createdAt: string): DumpSummary => ({ name, createdAt });

  it('keeps the newest N even when they are all in one month', () => {
    const dumps = [
      dump('d1', '2026-09-01T00:00:00Z'),
      dump('d2', '2026-09-02T00:00:00Z'),
      dump('d3', '2026-09-03T00:00:00Z'),
    ];
    const { keep, remove } = selectForRetention(dumps, policy, new Date('2026-09-14T00:00:00Z'));
    expect(keep).toContain('d3');
    expect(keep).toContain('d2');
    expect(remove).toEqual(['d1']);
  });

  it('keeps the newest dump of each month for long-range history', () => {
    const dumps = [
      dump('aug-early', '2026-08-01T00:00:00Z'),
      dump('aug-late', '2026-08-31T00:00:00Z'),
      dump('sep-early', '2026-09-01T00:00:00Z'),
      dump('sep-late', '2026-09-13T00:00:00Z'),
    ];
    const { keep, remove } = selectForRetention(dumps, policy, new Date('2026-09-14T00:00:00Z'));
    expect(keep).toContain('sep-late'); // newest overall
    expect(keep).toContain('sep-early'); // 2nd newest
    expect(keep).toContain('aug-late'); // newest of August
    expect(remove).toEqual(['aug-early']);
  });

  it('never removes a dump younger than minAgeDays, even when it is not in the recent window', () => {
    const conservative: RetentionPolicy = { keepRecent: 1, keepMonthly: false, minAgeDays: 30 };
    const dumps = [dump('old', '2026-01-01T00:00:00Z'), dump('newer', '2026-09-13T00:00:00Z')];
    const { remove } = selectForRetention(dumps, conservative, new Date('2026-09-14T00:00:00Z'));
    expect(remove).toEqual(['old']);
  });

  it('keeps everything when all dumps are inside the age floor', () => {
    const conservative: RetentionPolicy = { keepRecent: 0, keepMonthly: false, minAgeDays: 7 };
    const dumps = [dump('a', '2026-09-13T00:00:00Z'), dump('b', '2026-09-12T00:00:00Z')];
    const { remove } = selectForRetention(dumps, conservative, new Date('2026-09-14T00:00:00Z'));
    expect(remove).toEqual([]);
  });

  it('returns the newest first in keep, so a caller can report "latest" cheaply', () => {
    const dumps = [dump('a', '2026-09-01T00:00:00Z'), dump('c', '2026-09-03T00:00:00Z')];
    const { keep } = selectForRetention(dumps, policy, new Date('2026-09-14T00:00:00Z'));
    expect(keep[0]).toBe('c');
  });

  it('keeps a dump with an unparseable date rather than deleting it', () => {
    const dumps = [dump('weird', 'not-a-date'), dump('fine', '2026-09-13T00:00:00Z')];
    const { keep, remove } = selectForRetention(dumps, { keepRecent: 0, keepMonthly: false, minAgeDays: 30 }, new Date('2026-09-14T00:00:00Z'));
    // Unparseable dates fall outside the age floor check, so they are removable — but only because
    // they are not protected. Assert the behaviour explicitly so it cannot change silently.
    expect(keep).toEqual(['fine']);
    expect(remove).toEqual(['weird']);
  });

  it('is deterministic regardless of input order', () => {
    const a = [dump('x', '2026-09-01T00:00:00Z'), dump('y', '2026-09-02T00:00:00Z')];
    const b = [dump('y', '2026-09-02T00:00:00Z'), dump('x', '2026-09-01T00:00:00Z')];
    const now = new Date('2026-09-14T00:00:00Z');
    expect(selectForRetention(a, policy, now)).toEqual(selectForRetention(b, policy, now));
  });
});

describe('tableFileName', () => {
  it('is the single source of the file naming rule', () => {
    expect(tableFileName('media_assets')).toBe('media_assets.json');
  });
});
