/**
 * Tests for the media reconciliation (`scripts/lib/mediaReconcile.ts`).
 *
 * WHY THIS EXISTS
 * Storage objects are the one thing a database restore cannot bring back, and nothing compared the
 * `media_assets` rows against the bucket before this. The failure modes are both directions, and
 * both are quiet: a row pointing at a deleted file looks fine in the CMS until someone loads the
 * page, and an orphaned file is simply never looked at again.
 *
 * One subtlety these tests pin down, because it is the easiest way to write a reconciliation that
 * reports clean while checking almost nothing: **`renditions` is not always present.** Uploads
 * through `POST /api/media/upload` write a single object and set `url` and `thumbnail_url` to the
 * same value, with no renditions at all. Only 151 of 152 current rows have `renditions` — so a
 * check that read only `renditions` would skip exactly the newest asset, and the gap would widen
 * with every upload.
 *
 * Zero tokens: no database, no network, no filesystem.
 */
import { describe, expect, it } from 'vitest';
import {
  BUCKET,
  PUBLIC_URL_MARKER,
  expectedPathsForRow,
  formatBytes,
  isOriginalObject,
  pathFromMediaUrl,
  reconcileMedia,
  renditionPaths,
  type MediaAssetRow,
  type StorageObject,
} from '../../scripts/lib/mediaReconcile';

const ORIGIN = 'https://orphcusijzkxpxkzapjp.supabase.co';

function row(over: Partial<MediaAssetRow> = {}): MediaAssetRow {
  return {
    id: 'row-1',
    public_id: 'kirunan',
    url: `${ORIGIN}${PUBLIC_URL_MARKER}kirunan/hero.webp`,
    thumbnail_url: `${ORIGIN}${PUBLIC_URL_MARKER}kirunan/thumb.webp`,
    folder: 'kirunan',
    renditions: null,
    ...over,
  };
}

const obj = (path: string, bytes: number | null = 1000): StorageObject => ({ path, bytes });

describe('pathFromMediaUrl', () => {
  it('extracts the in-bucket path from a public URL', () => {
    expect(pathFromMediaUrl(`${ORIGIN}${PUBLIC_URL_MARKER}kirunan/hero.webp`)).toBe('kirunan/hero.webp');
  });

  it('accepts a bare relative path, which is what newer single-object uploads store', () => {
    expect(pathFromMediaUrl('kirunan/hero.webp')).toBe('kirunan/hero.webp');
    expect(pathFromMediaUrl('/artwork-images/kirunan/hero.webp')).toBe('kirunan/hero.webp');
  });

  it('decodes percent-escaped segments', () => {
    expect(pathFromMediaUrl(`${ORIGIN}${PUBLIC_URL_MARKER}austin-Recovered%20copy/hero.webp`)).toBe(
      'austin-Recovered copy/hero.webp'
    );
  });

  // Pre-Cloudinary-exit rows point off-platform. Those are resolved by the asset registry, not by
  // this bucket, so they must not be reported as "missing".
  it('returns null for an external URL rather than inventing a path', () => {
    expect(pathFromMediaUrl('https://res.cloudinary.com/demo/image/upload/v1/x.jpg')).toBeNull();
    expect(pathFromMediaUrl(null)).toBeNull();
    expect(pathFromMediaUrl('')).toBeNull();
    expect(pathFromMediaUrl('   ')).toBeNull();
  });
});

describe('renditionPaths', () => {
  it('collects every rendition that carries a path', () => {
    const paths = renditionPaths({
      thumb: { path: 'kirunan/thumb.webp', bytes: 6610, width: 200, height: 140 },
      hero: { path: 'kirunan/hero.webp', bytes: 70444, width: 576, height: 403 },
      full: { path: 'kirunan/full.webp', bytes: 77938, width: 576, height: 403 },
    });
    expect(paths.map((p) => p.path)).toEqual(['kirunan/thumb.webp', 'kirunan/hero.webp', 'kirunan/full.webp']);
    expect(paths[0].bytes).toBe(6610);
  });

  it('tolerates junk without throwing', () => {
    expect(renditionPaths(null)).toEqual([]);
    expect(renditionPaths('nope')).toEqual([]);
    expect(renditionPaths([{ path: 'x' }])).toEqual([]);
    expect(renditionPaths({ thumb: {}, hero: { path: '' } })).toEqual([]);
  });
});

describe('expectedPathsForRow', () => {
  it('prefers renditions, which know the byte size', () => {
    const paths = expectedPathsForRow(
      row({
        renditions: {
          hero: { path: 'kirunan/hero.webp', bytes: 70444 },
          thumb: { path: 'kirunan/thumb.webp', bytes: 6610 },
        },
      })
    );
    expect(paths).toEqual([
      { path: 'kirunan/hero.webp', bytes: 70444 },
      { path: 'kirunan/thumb.webp', bytes: 6610 },
    ]);
  });

  // The regression that matters: without the URL fallback this row yields nothing at all.
  it('falls back to the URLs when there are no renditions — the single-object upload case', () => {
    const paths = expectedPathsForRow(row({ renditions: null }));
    expect(paths.map((p) => p.path)).toEqual(['kirunan/hero.webp', 'kirunan/thumb.webp']);
  });

  it('de-duplicates when url and thumbnail_url are the same object', () => {
    const same = `${ORIGIN}${PUBLIC_URL_MARKER}kirunan/original.jpg`;
    expect(expectedPathsForRow(row({ url: same, thumbnail_url: same, renditions: null }))).toEqual([
      { path: 'kirunan/original.jpg', bytes: null },
    ]);
  });

  it('does not let a URL overwrite a rendition entry that already knows the size', () => {
    const paths = expectedPathsForRow(
      row({ renditions: { hero: { path: 'kirunan/hero.webp', bytes: 70444 } } })
    );
    const hero = paths.find((p) => p.path === 'kirunan/hero.webp');
    expect(hero?.bytes).toBe(70444);
  });
});

describe('reconcileMedia', () => {
  // `url: null` is deliberate: the helper's default URLs would add two more expected paths, and a
  // test that quietly expects three paths instead of one is a test that can pass for the wrong reason.
  it('reports nothing when rows and objects agree exactly', () => {
    const report = reconcileMedia(
      [row({ url: null, thumbnail_url: null, renditions: { hero: { path: 'kirunan/hero.webp', bytes: 1000 } } })],
      [obj('kirunan/hero.webp', 1000)]
    );
    expect(report.problems).toEqual([]);
    expect(report.missing).toBe(0);
    expect(report.unreferenced).toBe(0);
    expect(report.objectBytes).toBe(1000);
  });

  it('flags a row whose object is gone — the case a database restore cannot fix', () => {
    const report = reconcileMedia(
      [row({ url: null, thumbnail_url: null, renditions: { hero: { path: 'kirunan/hero.webp' } } })],
      []
    );
    expect(report.missing).toBe(1);
    expect(report.problems[0].kind).toBe('missing-object');
    expect(report.problems[0].path).toBe('kirunan/hero.webp');
  });

  it('flags an object no row references', () => {
    const report = reconcileMedia([], [obj('stray/hero.webp')]);
    expect(report.unreferenced).toBe(1);
    expect(report.blocking).toBe(1);
    expect(report.problems[0].kind).toBe('unreferenced-object');
  });

  // The real bucket holds 151 of these — one per folder — because the Cloudinary migration stored
  // thumb/hero/full/original but only the first three are recorded in `renditions`. Reporting them
  // as failures would bury every real signal under 151 lines of expected noise.
  it('separates original.* masters from genuine orphans, and does not fail on them', () => {
    const report = reconcileMedia([], [obj('kirunan/original.jpg'), obj('stray/hero.webp')]);
    expect(report.unreferencedOriginals).toBe(1);
    expect(report.unreferenced).toBe(1);
    expect(report.blocking).toBe(1);
    expect(report.problems.find((p) => p.path === 'kirunan/original.jpg')?.kind).toBe('unreferenced-original');
  });

  it('recognises an original whatever the extension or case', () => {
    expect(isOriginalObject('a/original.jpg')).toBe(true);
    expect(isOriginalObject('a/original.webp')).toBe(true);
    expect(isOriginalObject('a/Original.PNG')).toBe(true);
    expect(isOriginalObject('a/hero.webp')).toBe(false);
    expect(isOriginalObject('original')).toBe(true);
    expect(isOriginalObject('a/original-copy.jpg')).toBe(false);
  });

  it('counts missing objects and size mismatches as blocking', () => {
    const report = reconcileMedia(
      [row({ url: null, thumbnail_url: null, renditions: { hero: { path: 'a/hero.webp', bytes: 50 } } })],
      [obj('a/hero.webp', 51)]
    );
    expect(report.sizeMismatches).toBe(1);
    expect(report.blocking).toBe(1);
  });

  it('flags a size disagreement as possible truncation', () => {
    const report = reconcileMedia(
      [row({ renditions: { hero: { path: 'kirunan/hero.webp', bytes: 70444 } } })],
      [obj('kirunan/hero.webp', 12)]
    );
    expect(report.sizeMismatches).toBe(1);
    expect(report.problems[0].detail).toContain('70444');
  });

  it('does not flag a size it never claimed', () => {
    const report = reconcileMedia([row({ renditions: null })], [obj('kirunan/hero.webp', 12)]);
    expect(report.sizeMismatches).toBe(0);
  });

  it('reports an unresolved row instead of silently skipping it', () => {
    const external = row({ url: 'https://res.cloudinary.com/demo/x.jpg', thumbnail_url: null, renditions: null });
    const report = reconcileMedia([external], [obj('kirunan/hero.webp')]);
    expect(report.external).toBe(1);
    expect(report.problems.some((p) => p.kind === 'external-or-unresolved')).toBe(true);
  });

  // A reconciliation that finds nothing is only meaningful if it could have found something.
  it('counts every direction independently', () => {
    const report = reconcileMedia(
      [
        row({ id: 'a', public_id: 'a', url: null, thumbnail_url: null, renditions: { hero: { path: 'a/hero.webp' } } }), // missing
        row({ id: 'b', public_id: 'b', renditions: null, url: null, thumbnail_url: null }), // unresolved
      ],
      [obj('orphan/hero.webp')] // unreferenced
    );
    expect(report.missing).toBe(1);
    expect(report.unreferenced).toBe(1);
    expect(report.external).toBe(1);
    expect(report.problems).toHaveLength(3);
    // The unresolved row is informational; only two of the three should fail a run.
    expect(report.blocking).toBe(2);
  });

  it('names the bucket in every message that mentions one', () => {
    const report = reconcileMedia([row({ renditions: { hero: { path: 'a/hero.webp' } } })], []);
    expect(BUCKET).toBe('artwork-images');
    expect(report.problems[0].detail).toContain('a/hero.webp');
  });
});

describe('formatBytes', () => {
  it('renders the unit the bucket size has always been quoted in', () => {
    expect(formatBytes(76.6 * 1024 * 1024)).toBe('76.6 MiB');
    expect(formatBytes(0)).toBe('0.0 MiB');
  });
});
