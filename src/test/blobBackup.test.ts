/**
 * Tests for the off-site backup layout, usage accounting and retention
 * (`server/lib/blobBackup.ts` + the stamp helpers in `server/lib/catalogDump.ts`).
 *
 * WHY THIS EXISTS
 * The off-site dump is the only copy of the catalog that does not live on one laptop, so the rules
 * that decide **what gets deleted** are high-consequence in a way that is easy to under-test:
 * retention code that is too aggressive destroys the very history it exists to protect, and it
 * tends to do so silently, on a schedule, at 6am.
 *
 * The Vercel **Hobby** plan makes this sharper: Blob includes 1 GB/month and 2,000 advanced
 * operations, and exceeding either **cuts off access for 30 days rather than billing** (verified
 * against vercel.com/docs/vercel-blob/usage-and-pricing, 2026-09-14). For a backup sink that is a
 * worse failure than an overage — the thing you need during an incident is the thing switched off.
 *
 * Zero tokens, no network, no `@vercel/blob` import: everything here is pure.
 */
import { describe, expect, it } from 'vitest';
import {
  BLOB_PREFIX,
  DEFAULT_INCOMPLETE_GRACE_HOURS,
  DEFAULT_RETENTION,
  HOBBY_STORAGE_ALLOWANCE_BYTES,
  blobPathFor,
  dumpsFromBlobs,
  incompleteStamps,
  planPrune,
  stampFromBlobPath,
  summarizeBlobs,
  type BlobRef,
} from '../../server/lib/blobBackup';
import { dumpStamp, stampToIso } from '../../server/lib/catalogDump';
import { selectForRetention } from '../../scripts/lib/backupManifest';

/** A blob at a known path/time. `size` defaults to something small and boring. */
function blob(pathname: string, uploadedAt: string, size = 1024): BlobRef {
  return { pathname, size, uploadedAt: new Date(uploadedAt) };
}

function dumpBlobs(stamp: string, uploadedAt: string, files = ['artworks.json', 'manifest.json']): BlobRef[] {
  return files.map((name) => blob(`${BLOB_PREFIX}/${stamp}/${name}`, uploadedAt));
}

describe('blob paths', () => {
  it('keeps every off-site object under one prefix', () => {
    expect(blobPathFor('2026-09-14T17-27-10-591Z', 'artworks.json')).toBe(
      'catalog-backups/2026-09-14T17-27-10-591Z/artworks.json'
    );
  });

  it('recovers the dump a path belongs to', () => {
    expect(stampFromBlobPath('catalog-backups/2026-09-14T17-27-10-591Z/artworks.json')).toBe(
      '2026-09-14T17-27-10-591Z'
    );
  });

  it('rejects paths outside the prefix, so other stores content cannot be pruned', () => {
    expect(stampFromBlobPath('other/2026-09-14T17-27-10-591Z/artworks.json')).toBeNull();
    expect(stampFromBlobPath('catalog-backups/2026-09-14T17-27-10-591Z')).toBeNull();
    expect(stampFromBlobPath('catalog-backups')).toBeNull();
  });
});

describe('dump stamps', () => {
  it('produces a path-safe, fixed-width, lexicographically sortable stamp', () => {
    const stamp = dumpStamp(new Date('2026-09-14T17:27:10.591Z'));
    expect(stamp).toBe('2026-09-14T17-27-10-591Z');
    expect(stamp).not.toMatch(/[:.]/);
    expect(dumpStamp(new Date('2026-01-02T03:04:05.006Z'))).toHaveLength(dumpStamp().length);
  });

  it('sorts chronologically when compared as strings', () => {
    const a = dumpStamp(new Date('2026-09-01T00:00:00.000Z'));
    const b = dumpStamp(new Date('2026-09-30T00:00:00.000Z'));
    expect([b, a].sort()).toEqual([a, b]);
  });

  // This is the bug the converter exists to prevent. A raw stamp is NOT a parseable date, and
  // selectForRetention silently skips any dump whose createdAt does not parse when it applies the
  // minimum-age floor — so feeding stamps in raw would quietly disable the one rule that stops a
  // run of bad dumps from deleting every good one.
  it('a raw stamp does NOT parse as a date — which is why stampToIso exists', () => {
    const stamp = dumpStamp(new Date('2026-09-14T17:27:10.591Z'));
    expect(Number.isNaN(Date.parse(stamp))).toBe(true);
    expect(stampToIso(stamp)).toBe('2026-09-14T17:27:10.591Z');
    expect(Date.parse(stampToIso(stamp) as string)).toBe(Date.parse('2026-09-14T17:27:10.591Z'));
  });

  it('returns null for something that is not a stamp', () => {
    expect(stampToIso('nonsense')).toBeNull();
    expect(stampToIso('2026-09-14T17:27:10.591Z')).toBeNull();
  });

  it('a dump whose createdAt cannot be parsed is unprotected by the age floor', () => {
    // Documents the hazard rather than fixing it here: the fix is to never pass a raw stamp.
    const dumps = [{ name: 'unparseable', createdAt: 'not-a-date' }];
    const { remove } = selectForRetention(dumps, { keepRecent: 0, keepMonthly: false, minAgeDays: 365 }, new Date());
    expect(remove).toEqual(['unparseable']);
  });
});

describe('dumpsFromBlobs', () => {
  it('groups files into dumps and orders newest first', () => {
    const dumps = dumpsFromBlobs([
      ...dumpBlobs('2026-09-01T04-00-00-000Z', '2026-09-01T04:00:00.000Z'),
      ...dumpBlobs('2026-09-14T04-00-00-000Z', '2026-09-14T04:00:00.000Z'),
    ]);
    expect(dumps.map((d) => d.name)).toEqual(['2026-09-14T04-00-00-000Z', '2026-09-01T04-00-00-000Z']);
  });

  it('prefers a real upload time over the stamp', () => {
    const dumps = dumpsFromBlobs(dumpBlobs('2026-09-14T04-00-00-000Z', '2026-09-14T04:00:00.000Z'));
    expect(dumps[0].createdAt).toBe('2026-09-14T04:00:00.000Z');
  });

  it('falls back to a converted stamp, not the raw stamp, when there is no upload time', () => {
    const [dump] = dumpsFromBlobs([
      { pathname: `${BLOB_PREFIX}/2026-09-14T04-00-00-000Z/artworks.json`, size: 10, uploadedAt: new Date('') },
    ]);
    // `new Date('')` is Invalid Date; the fallback must still yield something parseable.
    expect(dump.createdAt).toBe('2026-09-14T04:00:00.000Z');
  });

  it('ignores objects that are not off-site dumps', () => {
    expect(dumpsFromBlobs([blob('somewhere-else/a.json', '2026-09-14T04:00:00.000Z')])).toEqual([]);
  });

  it('marks a stamp without manifest.json as incomplete — an interrupted run, not a dump', () => {
    // Looked up by name: `dumpsFromBlobs` returns newest first, so positional indexing would
    // silently assert against the wrong dump.
    const dumps = dumpsFromBlobs([
      ...dumpBlobs('2026-09-14T04-00-00-000Z', '2026-09-14T04:00:00.000Z'),
      ...dumpBlobs('2026-09-14T05-00-00-000Z', '2026-09-14T05:00:00.000Z', ['artworks.json', 'pages.json']),
    ]);
    const complete = dumps.find((d) => d.name === '2026-09-14T04-00-00-000Z')!;
    const partial = dumps.find((d) => d.name === '2026-09-14T05-00-00-000Z')!;

    expect(complete.hasManifest).toBe(true);
    expect(partial.hasManifest).toBe(false);
    expect(partial.files).toBe(2);
  });
});

describe('incompleteStamps', () => {
  it('names only the stamps that never received a manifest', () => {
    const dumps = dumpsFromBlobs([
      ...dumpBlobs('2026-09-14T04-00-00-000Z', '2026-09-14T04:00:00.000Z'),
      ...dumpBlobs('2026-09-14T05-00-00-000Z', '2026-09-14T05:00:00.000Z', ['artworks.json']),
    ]);
    expect(incompleteStamps(dumps)).toEqual(['2026-09-14T05-00-00-000Z']);
  });

  it('is empty for a store where every run finished', () => {
    expect(incompleteStamps(dumpsFromBlobs(dumpBlobs('2026-09-14T04-00-00-000Z', '2026-09-14T04:00:00.000Z')))).toEqual([]);
  });
});

describe('summarizeBlobs', () => {
  it('counts dumps, files and bytes, and reports the Hobby allowance fraction', () => {
    const usage = summarizeBlobs([
      ...dumpBlobs('2026-09-01T04-00-00-000Z', '2026-09-01T04:00:00.000Z', ['a.json', 'b.json', 'c.json']).map(
        (b) => ({ ...b, size: 100 })
      ),
      ...dumpBlobs('2026-09-14T04-00-00-000Z', '2026-09-14T04:00:00.000Z').map((b) => ({ ...b, size: 200 })),
      blob('unrelated/thing.json', '2026-09-14T04:00:00.000Z', 999_999),
    ]);

    expect(usage.dumps).toBe(2);
    expect(usage.files).toBe(5);
    expect(usage.bytes).toBe(3 * 100 + 2 * 200);
    expect(usage.fractionOfHobbyAllowance).toBeCloseTo(700 / HOBBY_STORAGE_ALLOWANCE_BYTES);
  });

  it('a month of daily dumps stays three orders of magnitude inside the Hobby allowance', () => {
    // ~0.5 MB per dump is the real size; 30 days of them is the actual steady state.
    const usage = summarizeBlobs([{ pathname: `${BLOB_PREFIX}/s/artworks.json`, size: 512 * 1024, uploadedAt: new Date() }]);
    const month = usage.bytes * 30;
    expect(month / HOBBY_STORAGE_ALLOWANCE_BYTES).toBeLessThan(0.02);
  });
});

describe('planPrune', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 8, n, 4, 0, 0));
  const dumps = Array.from({ length: 20 }, (_, i) => ({
    name: `dump-${String(i + 1).padStart(2, '0')}`,
    createdAt: day(i + 1).toISOString(),
  }));

  it('keeps the recent window and drops the rest', () => {
    const { keep, remove } = planPrune(dumps, day(20), DEFAULT_RETENTION);
    expect(keep).toHaveLength(DEFAULT_RETENTION.keepRecent);
    expect(keep).toContain('dump-20');
    expect(keep).not.toContain('dump-01');
    expect(remove.length).toBeGreaterThan(0);
  });

  it('never deletes the dump that was just written, even when policy would discard it', () => {
    // The realistic way this happens: every dump in the store is outside the keepRecent window
    // because the clock, the clock-skew or a bad timestamp says so.
    const hostile = { keepRecent: 0, keepMonthly: false, minAgeDays: 0 };
    const { keep, remove } = planPrune(dumps, day(20), hostile, 'dump-01');
    expect(keep).toContain('dump-01');
    expect(remove).not.toContain('dump-01');
  });

  it('never deletes anything inside the minimum-age floor, so a run of bad dumps cannot wipe history', () => {
    const recent = dumps.slice(-3);
    const { remove } = planPrune(recent, day(20), { keepRecent: 0, keepMonthly: false, minAgeDays: 7 });
    expect(remove).toEqual([]);
  });

  it('keeps one dump per month for long-range history', () => {
    const across = [
      { name: 'aug', createdAt: new Date(Date.UTC(2026, 7, 15)).toISOString() },
      { name: 'sep-01', createdAt: day(1).toISOString() },
      { name: 'sep-20', createdAt: day(20).toISOString() },
    ];
    const { keep, remove } = planPrune(across, day(20), { keepRecent: 1, keepMonthly: true, minAgeDays: 0 });
    expect(keep).toContain('aug');
    expect(remove).not.toContain('aug');
  });

  /**
   * An interrupted run leaves objects behind that can never be restored. Worse, while such a stamp
   * is the newest in the store `scripts/verify-offsite-backup.ts` refuses everything — so the
   * scheduled backup looks broken for as long as retention takes to clear it.
   */
  it('deletes an incomplete stamp that is past its grace period, despite the age floor', () => {
    const hostileAgeFloor = { keepRecent: 14, keepMonthly: true, minAgeDays: 7 };
    // Both are 2 days old: inside the 7-day age floor, so only the incompleteness distinguishes them.
    const dumps = [
      { name: 'good', createdAt: day(18).toISOString(), files: 9, hasManifest: true },
      { name: 'half-written', createdAt: day(18).toISOString(), files: 3, hasManifest: false },
    ];

    const { remove } = planPrune(dumps, day(20), hostileAgeFloor);
    expect(remove).toContain('half-written');
    expect(remove).not.toContain('good');
  });

  it('leaves an incomplete stamp alone inside the grace period — a sibling run may still be writing it', () => {
    const dumps = [
      { name: 'in-flight', createdAt: day(20).toISOString(), files: 3, hasManifest: false },
    ];
    const oneHourLater = new Date(day(20).getTime() + 3_600_000);

    expect(planPrune(dumps, oneHourLater).remove).toEqual([]);
    expect(DEFAULT_INCOMPLETE_GRACE_HOURS).toBeGreaterThan(1);
  });

  it('never deletes the just-written stamp even if its manifest has not landed yet', () => {
    const dumps = [
      { name: 'just-written', createdAt: day(1).toISOString(), files: 4, hasManifest: false },
    ];
    const { remove } = planPrune(dumps, day(20), DEFAULT_RETENTION, 'just-written');
    expect(remove).not.toContain('just-written');
  });

  it('does not treat a summary with no manifest information as incomplete', () => {
    // Callers that only know names and timestamps must keep the previous behaviour.
    const plain = [{ name: 'legacy', createdAt: day(1).toISOString() }];
    expect(planPrune(plain, day(20), DEFAULT_RETENTION).remove).toEqual([]);
  });
});
