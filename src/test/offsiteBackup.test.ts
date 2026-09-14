import { describe, it, expect } from 'vitest';
import {
  filesForDump,
  groupOffsiteDumps,
  selectOffsiteDump,
  type OffsiteBlobRef,
} from '../../scripts/lib/offsiteBackup';

/**
 * The invariant under test: **verification must never quietly accept something other than a
 * complete, recent dump.** A dump whose upload died halfway is indistinguishable from a good one by
 * stamp alone (see finding B5), and a stale "newest" dump is exactly what a broken nightly cron
 * looks like. Each failure below is asserted to fail.
 */

const blob = (pathname: string, uploadedAt: string, size = 100): OffsiteBlobRef => ({
  pathname,
  size,
  uploadedAt: new Date(uploadedAt),
});

const completeDump = (stamp: string, at: string) => [
  blob(`catalog-backups/${stamp}/artworks.json`, at),
  blob(`catalog-backups/${stamp}/manifest.json`, at),
];

describe('groupOffsiteDumps', () => {
  it('groups objects by stamp, newest first, and flags manifest presence', () => {
    const dumps = groupOffsiteDumps([
      ...completeDump('2026-09-14T20-08-20-091Z', '2026-09-14T20:08:22Z'),
      blob('catalog-backups/2026-09-14T21-00-00-000Z/artworks.json', '2026-09-14T21:00:01Z'),
    ]);

    expect(dumps).toHaveLength(2);
    expect(dumps[0].name).toBe('2026-09-14T21-00-00-000Z');
    expect(dumps[0].hasManifest).toBe(false); // upload died before the manifest landed
    expect(dumps[1].hasManifest).toBe(true);
    expect(dumps[1].files).toBe(2);
    expect(dumps[1].bytes).toBe(200);
  });

  it('ignores objects that are not inside a stamp directory', () => {
    expect(groupOffsiteDumps([blob('catalog-backups/stray.json', '2026-09-14T20:00:00Z')])).toEqual([]);
  });

  it('falls back to the stamp for timing when uploadedAt is unusable', () => {
    const [dump] = groupOffsiteDumps([
      { pathname: 'catalog-backups/2026-09-14T20-08-20-091Z/manifest.json', size: 1, uploadedAt: 'not-a-date' },
    ]);
    expect(dump.createdAt).toBe('2026-09-14T20:08:20.091Z');
  });
});

describe('selectOffsiteDump', () => {
  const dumps = groupOffsiteDumps([
    ...completeDump('2026-09-14T19-29-08-498Z', '2026-09-14T19:29:10Z'),
    ...completeDump('2026-09-14T20-08-20-091Z', '2026-09-14T20:08:22Z'),
  ]);

  it('picks the newest complete dump', () => {
    const pick = selectOffsiteDump(dumps);
    expect(pick.ok).toBe(true);
    expect(pick.dump?.name).toBe('2026-09-14T20-08-20-091Z');
  });

  it('reports an empty store without pretending to verify anything', () => {
    const pick = selectOffsiteDump([]);
    expect(pick.ok).toBe(false);
    expect(pick.problem).toBe('no-dumps');
  });

  it('refuses an incomplete newest dump instead of falling back to an older one', () => {
    // This is the B5 case: a run that died mid-upload must not be silently skipped in favour of
    // yesterday's dump — that is how a broken nightly goes unnoticed.
    const withPartial = groupOffsiteDumps([
      ...completeDump('2026-09-14T19-29-08-498Z', '2026-09-14T19:29:10Z'),
      blob('catalog-backups/2026-09-14T21-00-00-000Z/artworks.json', '2026-09-14T21:00:01Z'),
    ]);
    const pick = selectOffsiteDump(withPartial);
    expect(pick.ok).toBe(false);
    expect(pick.problem).toBe('incomplete-dump');
    expect(pick.message).toMatch(/did not finish/);
  });

  it('honours an explicit --stamp', () => {
    const pick = selectOffsiteDump(dumps, { stamp: '2026-09-14T19-29-08-498Z' });
    expect(pick.ok).toBe(true);
    expect(pick.dump?.name).toBe('2026-09-14T19-29-08-498Z');
  });

  it('fails when the requested stamp does not exist', () => {
    const pick = selectOffsiteDump(dumps, { stamp: 'nope' });
    expect(pick.problem).toBe('stamp-not-found');
  });

  it('flags a dump older than the max-age threshold as stale', () => {
    const now = new Date('2026-09-16T12:00:00Z'); // ~40 h after the newest dump
    const pick = selectOffsiteDump(dumps, { now, maxAgeHours: 26 });
    expect(pick.problem).toBe('stale-dump');
    expect(pick.message).toMatch(/not running/);
  });

  it('accepts a dump inside the max-age window', () => {
    const now = new Date('2026-09-14T22:00:00Z');
    expect(selectOffsiteDump(dumps, { now, maxAgeHours: 26 }).ok).toBe(true);
  });
});

describe('filesForDump', () => {
  it('returns only the objects of one stamp, in deterministic order', () => {
    const paths = filesForDump(
      [
        blob('catalog-backups/AAA/manifest.json', '2026-09-14T20:00:00Z'),
        blob('catalog-backups/BBB/manifest.json', '2026-09-14T20:00:00Z'),
        blob('catalog-backups/AAA/artworks.json', '2026-09-14T20:00:00Z'),
      ],
      'AAA'
    );
    expect(paths).toEqual([
      'catalog-backups/AAA/artworks.json',
      'catalog-backups/AAA/manifest.json',
    ]);
  });
});
