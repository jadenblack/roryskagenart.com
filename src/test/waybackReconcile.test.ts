/**
 * Offline tests for the Wayback reconciler.
 *
 * The merge's central risk is R-01: a mural silently attaching itself to the wrong fine-art row.
 * These tests pin the three behaviours that keep that from happening — the seed map wins over
 * guessing, COLLISION is detected rather than resolved, and "unavailable" is never reported as
 * "needs upload".
 */
import { describe, expect, it } from 'vitest';
import {
  alnumKey,
  diceCoefficient,
  normalizeForMatch,
  reconcile,
  slugifyTitle,
  type CanonicalArtworkRef,
  type CanonicalMediaRef,
} from '../../scripts/lib/waybackReconcile';
import { extractPage, type ExtractedPage } from '../../scripts/lib/waybackExtract';

function page(partial: Partial<ExtractedPage> & { slugCandidate: string; category: string }): ExtractedPage {
  return {
    archive: 'roryskagen.com-v1',
    relPath: `${partial.category}/${partial.slugCandidate}/index.html`,
    title: partial.slugCandidate.replace(/-/g, ' '),
    description: '',
    narrative: '',
    categories: [],
    publishedAt: null,
    modifiedAt: null,
    year: null,
    wpPostId: null,
    images: [],
    warnings: [],
    ...partial,
  } as ExtractedPage;
}

const CATALOG: CanonicalArtworkRef[] = [
  { slug: 'today-atomic-sunrise', title: 'Today (Atomic Sunrise)', imageUrl: 'today.jpg' },
  { slug: 'regador-v', title: 'Regador V', imageUrl: 'regadorv.jpg' },
  { slug: 'beerland-mural-like', title: 'Something Else Entirely', imageUrl: 'other.jpg' },
  { slug: 'jungle-tempo', title: 'Jungle Tempo', imageUrl: 'jungletempo.jpg' },
];

const MEDIA: CanonicalMediaRef[] = [
  { publicId: 'today-atomic-sunrise', artworkSlug: 'today-atomic-sunrise', basename: 'today' },
  { publicId: 'regador-v', artworkSlug: 'regador-v', basename: 'regadorv' },
  { publicId: 'jungle-tempo', artworkSlug: 'jungle-tempo', basename: 'jungletempo' },
];

describe('waybackReconcile — primitives', () => {
  it('normalizes to the shape DB slugs are written in', () => {
    expect(normalizeForMatch('  Regador 5! ')).toBe('regador-5');
    expect(normalizeForMatch('--edge--')).toBe('edge');
  });

  it('reduces to an alphanumeric key, so punctuation and case cannot defeat a match', () => {
    expect(alnumKey('regador-5')).toBe('regador5');
    expect(alnumKey('RegadorV')).toBe('regadorv');
    expect(alnumKey('GreetingsfromAustin')).toBe('greetingsfromaustin');
  });

  it('scores identical titles at 1 and unrelated titles below the threshold', () => {
    expect(diceCoefficient('Jungle Tempo', 'Jungle Tempo')).toBe(1);
    expect(diceCoefficient('Jungle Tempo', 'Regador V')).toBeLessThan(0.85);
  });

  it('slugifies a title into a usable slug', () => {
    expect(slugifyTitle('The Cats of the Colloseum')).toBe('the-cats-of-the-colloseum');
    expect(slugifyTitle('***')).toBe('untitled');
  });
});

describe('waybackReconcile — matching', () => {
  it('prefers the hand-seeded divergence map over any guess', () => {
    const [record] = reconcile(
      [page({ category: 'commissions-misc', slugCandidate: 'today', title: 'Today' })],
      { artworks: CATALOG, media: MEDIA }
    ).records;
    expect(record.canonicalSlug).toBe('today-atomic-sunrise');
    expect(record.matchKind).toBe('divergence-map');
    expect(record.classification).toBe('EXISTS');
  });

  it('matches an exact slug', () => {
    const [record] = reconcile(
      [page({ category: 'x', slugCandidate: 'jungle-tempo', title: 'Jungle Tempo' })],
      { artworks: CATALOG, media: MEDIA }
    ).records;
    expect(record.canonicalSlug).toBe('jungle-tempo');
    expect(record.matchKind).toBe('exact-slug');
  });

  it('matches on an alphanumeric-only key when punctuation differs', () => {
    // `jungletempo` vs canonical `jungle-tempo` — the hyphen is the only difference.
    const [record] = reconcile(
      [page({ category: 'vintage-appeal', slugCandidate: 'jungletempo', title: 'zzz' })],
      { artworks: CATALOG, media: MEDIA }
    ).records;
    expect(record.canonicalSlug).toBe('jungle-tempo');
    expect(record.matchKind).toBe('normalized-slug');
  });

  it('does not force a normalized match where the PRD seeded a divergence instead', () => {
    // `regador-5` → `regador-v` is a *renaming*, not a punctuation difference: alnum keys
    // (`regador5` vs `regadorv`) differ, so only the seed map can resolve it.
    expect(alnumKey('regador-5')).not.toBe(alnumKey('regador-v'));
    const [record] = reconcile(
      [page({ category: 'monster-paintings', slugCandidate: 'regador-5', title: 'Regador 5' })],
      { artworks: CATALOG, media: MEDIA }
    ).records;
    expect(record.canonicalSlug).toBe('regador-v');
    expect(record.matchKind).toBe('divergence-map');
  });

  it('does not guess when an alphanumeric key is ambiguous across two rows', () => {
    const ambiguous = [
      { slug: 'a-1', title: 'A One', imageUrl: null },
      { slug: 'a1', title: 'A Uno', imageUrl: null },
    ];
    const [record] = reconcile([page({ category: 'x', slugCandidate: 'a-1', title: 'zzz' })], {
      artworks: ambiguous,
      media: [],
    }).records;
    // Exact match still wins; the ambiguity only matters for the normalized fallback.
    expect(record.matchKind).toBe('exact-slug');

    const [fuzzy] = reconcile([page({ category: 'x', slugCandidate: 'a1x', title: 'zzz' })], {
      artworks: ambiguous,
      media: [],
    }).records;
    expect(fuzzy.matchKind).not.toBe('normalized-slug');
  });

  it('matches by fuzzy title at or above the PRD threshold', () => {
    const [record] = reconcile(
      [page({ category: 'x', slugCandidate: 'wisdom-cofee', title: 'Wisdom Cofee' })],
      { artworks: [{ slug: 'wisdom-coffee', title: 'Wisdom Coffee', imageUrl: null }], media: [] }
    ).records;
    expect(record.canonicalSlug).toBe('wisdom-coffee');
    expect(record.matchKind).toBe('fuzzy-title');
    expect(record.warnings.join()).toContain('verify before relying on it');
  });

  it('falls back to a shared image basename', () => {
    const [record] = reconcile(
      [
        page({
          category: 'x',
          slugCandidate: 'totally-different',
          title: 'Totally Different',
          images: [{ ref: 'wp-content/uploads/jungletempo.jpg', local: true, remote: false, archivePath: 'wp-content/uploads/jungletempo.jpg', basename: 'jungletempo' }],
        }),
      ],
      { artworks: CATALOG, media: MEDIA }
    ).records;
    expect(record.canonicalSlug).toBe('jungle-tempo');
    expect(record.matchKind).toBe('shared-image');
  });

  it('classifies an unmatched page as NEW and proposes a non-colliding slug', () => {
    const report = reconcile(
      [
        page({ category: 'business', slugCandidate: 'beerland-mural', title: 'Beerland Mural' }),
        page({ category: 'business', slugCandidate: 'beerland-mural-2', title: 'Beerland Mural 2' }),
      ],
      { artworks: CATALOG, media: MEDIA }
    );
    expect(report.records.map((r) => r.classification)).toEqual(['NEW', 'NEW']);
    expect(report.records[0].proposedSlug).toBe('beerland-mural');
    expect(report.records[1].proposedSlug).toBe('beerland-mural-2');
  });

  it('never proposes a slug that already exists in the catalog', () => {
    const [record] = reconcile(
      [page({ category: 'business', slugCandidate: 'jungle-tempo', title: 'zzz' })],
      { artworks: CATALOG, media: MEDIA }
    ).records;
    // It matches, so no proposal is made at all.
    expect(record.proposedSlug).toBeNull();
  });
});

describe('waybackReconcile — collisions', () => {
  it('flags two source pages resolving to one canonical slug, and lists both', () => {
    const report = reconcile(
      [
        page({ category: 'vintage-appeal', slugCandidate: 'jungle-tempo', title: 'Jungle Tempo' }),
        page({ category: 'vintage-appeal', slugCandidate: 'jungle-tempo-2', title: 'Jungle Tempo' }),
      ],
      { artworks: CATALOG, media: MEDIA }
    );
    expect(report.summary.COLLISION).toBe(2);
    expect(report.records[0].collidesWith).toEqual(['vintage-appeal/jungle-tempo-2']);
    expect(report.collisionGroups).toHaveLength(1);
    expect(report.collisionGroups[0].canonicalSlug).toBe('jungle-tempo');
  });

  it('marks a PRD-known dedupe pair as expected, and an unknown one as needing review', () => {
    const report = reconcile(
      [
        page({ category: 'business', slugCandidate: 'marcia-ball-cd-cover', title: 'Marcia Ball' }),
        page({ category: 'commissions-misc', slugCandidate: 'marcia-ball', title: 'Marcia Ball' }),
      ],
      {
        artworks: [{ slug: 'marcia-ball', title: 'Marcia Ball', imageUrl: null }],
        media: [],
      }
    );
    const known = report.records.filter((r) => r.knownDedupe);
    expect(known.length).toBe(2);
    expect(known[0].warnings.join()).not.toContain('unexpected collision');

    const unknown = reconcile(
      [
        page({ category: 'a', slugCandidate: 'same-a', title: 'Surprise' }),
        page({ category: 'b', slugCandidate: 'same-b', title: 'Surprise' }),
      ],
      { artworks: [{ slug: 'surprise', title: 'Surprise', imageUrl: null }], media: [] }
    );
    expect(unknown.records[0].knownDedupe).toBe(false);
    expect(unknown.records[0].warnings.join()).toContain('unexpected collision');
  });

  it('a collision is not resolved by the matcher — both rows stay unwritten', () => {
    const report = reconcile(
      [
        page({ category: 'a', slugCandidate: 'dup-1', title: 'Dup' }),
        page({ category: 'b', slugCandidate: 'dup-2', title: 'Dup' }),
      ],
      { artworks: [{ slug: 'dup', title: 'Dup', imageUrl: null }], media: [] }
    );
    // COLLISION, never EXISTS — the report is a proposal, not a verdict.
    expect(report.records.every((r) => r.classification === 'COLLISION')).toBe(true);
    expect(report.summary.EXISTS).toBe(0);
  });
});

describe('waybackReconcile — media resolution', () => {
  const localImage = (basename: string) => ({
    ref: `wp-content/uploads/${basename}.jpg`,
    local: true,
    remote: false,
    archivePath: `wp-content/uploads/${basename}.jpg`,
    basename,
  });
  const remoteImage = (basename: string) => ({
    ref: `https://i1.wp.com/x/uploads/${basename}.jpg`,
    local: false,
    remote: true,
    basename,
  });

  it('reports a registered image as exists', () => {
    const [record] = reconcile(
      [page({ category: 'x', slugCandidate: 'jungle-tempo', images: [localImage('jungletempo')] })],
      { artworks: CATALOG, media: MEDIA }
    ).records;
    expect(record.media[0]).toMatchObject({ action: 'exists', matchedPublicId: 'jungle-tempo' });
  });

  it('reports an unregistered local image as needs_upload with its archive path', () => {
    const [record] = reconcile(
      [page({ category: 'x', slugCandidate: 'new-thing', images: [localImage('brand-new')] })],
      { artworks: CATALOG, media: MEDIA }
    ).records;
    expect(record.media[0]).toMatchObject({
      action: 'needs_upload',
      archivePath: 'wp-content/uploads/brand-new.jpg',
    });
  });

  it('reports a CDN-only image as unavailable — never as needs_upload', () => {
    const [record] = reconcile(
      [page({ category: 'x', slugCandidate: 'new-thing', images: [remoteImage('gone')] })],
      { artworks: CATALOG, media: MEDIA }
    ).records;
    expect(record.media[0].action).toBe('unavailable');
    expect(record.media[0].archivePath).toBeUndefined();
  });

  it('counts a CDN-only page as having no usable image', () => {
    const report = reconcile(
      [page({ category: 'x', slugCandidate: 'new-thing', images: [remoteImage('gone')] })],
      { artworks: CATALOG, media: MEDIA }
    );
    expect(report.summary.needsUploadCount).toBe(0);
    expect(report.summary.unavailableCount).toBe(1);
    expect(report.summary.withoutImage).toBe(1);
  });

  describe('disk presence — and why the registry is checked first', () => {
    /** Referenced from a site-local path, but Wayback never captured the file. */
    const absentImage = (basename: string) => ({ ...localImage(basename), presentOnDisk: false });

    it('reports an unregistered image that is absent from disk as missing-from-archive', () => {
      const [record] = reconcile(
        [page({ category: 'x', slugCandidate: 'new-thing', images: [absentImage('brand-new')] })],
        { artworks: CATALOG, media: MEDIA }
      ).records;
      expect(record.media[0]).toMatchObject({
        action: 'unavailable',
        reason: 'missing-from-archive',
      });
      expect(record.media[0].archivePath).toBeUndefined();
    });

    it('still reports an image as exists when it is registered but absent from disk', () => {
      // The regression this pins: ten production images (Cloudinary-era assets such as
      // `normal-gods-copy`) are referenced by a page, missing from `wayback/`, and already in
      // `media_assets`. Checking the filesystem first labelled all ten "unrecoverable" — telling
      // the studio to re-supply images it already owns. A registry hit settles the question.
      const [record] = reconcile(
        [page({ category: 'x', slugCandidate: 'jungle-tempo', images: [absentImage('jungletempo')] })],
        { artworks: CATALOG, media: MEDIA }
      ).records;
      expect(record.media[0]).toMatchObject({
        action: 'exists',
        matchedPublicId: 'jungle-tempo',
      });
      expect(record.media[0].reason).toBeUndefined();
    });

    it('distinguishes the two reasons an image is unrecoverable', () => {
      const report = reconcile(
        [
          page({
            category: 'x',
            slugCandidate: 'new-thing',
            images: [absentImage('never-captured'), remoteImage('cdn-only')],
          }),
        ],
        { artworks: CATALOG, media: MEDIA }
      );
      const [record] = report.records;
      expect(record.media.find((m) => m.basename === 'never-captured')?.reason).toBe(
        'missing-from-archive'
      );
      expect(record.media.find((m) => m.basename === 'cdn-only')?.reason).toBe('cdn-only');
      // Both are unrecoverable, but only the first is a surprise worth the studio's attention.
      expect(report.summary.unavailableCount).toBe(2);
    });

    it('leaves needs_upload untouched when the file is present on disk', () => {
      const [record] = reconcile(
        [
          page({
            category: 'x',
            slugCandidate: 'new-thing',
            images: [{ ...localImage('brand-new'), presentOnDisk: true }],
          }),
        ],
        { artworks: CATALOG, media: MEDIA }
      ).records;
      expect(record.media[0].action).toBe('needs_upload');
    });
  });
});

describe('waybackReconcile — against a real page', () => {
  it('reconciles a mural page as NEW, because murals are net-new content', () => {
    const html = `<html><head><meta content="Cowboy Mural | Central Texas Murals by Rory Skagen" property=og:title></head>
      <body><div class="post-1"><h2>Cowboy Mural</h2><p>A mural.</p></div></body></html>`;
    const extracted = extractPage({
      archive: 'centraltexasmurals.com-v1',
      relPath: 'business/cowboy-mural/index.html',
      html,
    });
    expect(extracted).not.toBeNull();
    const [record] = reconcile([extracted as ExtractedPage], {
      artworks: CATALOG,
      media: MEDIA,
    }).records;
    expect(record.classification).toBe('NEW');
    expect(record.title).toBe('Cowboy Mural');
  });
});
