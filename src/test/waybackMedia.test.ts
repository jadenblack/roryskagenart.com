/**
 * Offline tests for the Wayback media planner.
 *
 * The planner decides what gets rendered, uploaded and registered before Phase 4 runs, so its
 * mistakes are expensive in two directions: too permissive and it creates duplicate registry rows
 * for one photograph, or links an image to the wrong artwork (R-18); too strict and it silently
 * drops an image that only exists in the archive.
 *
 * The unit tests use fixtures. The last block runs the planner over the **committed extraction** —
 * that is the one that catches a real corpus surprise, and it also proves every planned source file
 * is actually on disk, which is the precondition the render stage depends on.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  buildMediaPlan,
  derivePublicId,
  findRegistryCollisions,
  isWordPressDerivative,
  parseWordPressDerivative,
} from '../../scripts/lib/waybackMedia';
import type {
  MediaResolution,
  ReconciledRecord,
} from '../../scripts/lib/waybackReconcile';

const ROOT = path.resolve(__dirname, '../..');

function media(partial: Partial<MediaResolution> & { basename: string }): MediaResolution {
  return { ref: partial.basename, action: 'needs_upload', ...partial } as MediaResolution;
}

function record(partial: Partial<ReconciledRecord> & { slugCandidate: string; category: string }): ReconciledRecord {
  return {
    archive: 'roryskagen.com-v1',
    relPath: `${partial.category}/${partial.slugCandidate}/index.html`,
    title: partial.slugCandidate,
    canonicalSlug: null,
    proposedSlug: partial.slugCandidate,
    classification: 'NEW',
    matchKind: 'none',
    confidence: 0,
    collidesWith: [],
    knownDedupe: false,
    media: [],
    warnings: [],
    ...partial,
  } as ReconciledRecord;
}

/** An EXISTS record whose image is a brand-new upload, matched with the given confidence. */
function exists(
  slugCandidate: string,
  canonicalSlug: string,
  matchKind: ReconciledRecord['matchKind'],
  images: MediaResolution[]
): ReconciledRecord {
  return record({
    category: 'x',
    slugCandidate,
    canonicalSlug,
    proposedSlug: null,
    classification: 'EXISTS',
    matchKind,
    confidence: 1,
    media: images,
  });
}

describe('waybackMedia — derivative detection', () => {
  it('recognises a WordPress resize and splits off the original stem', () => {
    expect(parseWordPressDerivative('e1-590x410')).toEqual({ stem: 'e1', width: 590, height: 410 });
    expect(parseWordPressDerivative('austin-590x412')).toEqual({
      stem: 'austin',
      width: 590,
      height: 412,
    });
    expect(parseWordPressDerivative('MESHU-TORA-590x409')).toEqual({
      stem: 'MESHU-TORA',
      width: 590,
      height: 409,
    });
  });

  it('does not mistake a real filename for a resize', () => {
    // `square-eggs-16x13-copy` ends in `-copy`, and the real corpus contains it.
    for (const name of ['austin', 'square-eggs-16x13-copy', 'jungle-tempo-copy1', 'full', 'hack']) {
      expect(parseWordPressDerivative(name), name).toBeNull();
      expect(isWordPressDerivative(name), name).toBe(false);
    }
  });
});

describe('waybackMedia — public_id derivation', () => {
  it('keeps public_id = slug for a single-image artwork, matching all 152 existing rows', () => {
    expect(derivePublicId('jungle-tempo', 'jungletempo', 1)).toBe('jungle-tempo');
  });

  it('suffixes by source basename for a multi-image artwork, so the folder cannot collide', () => {
    // `public_id` is the bucket folder, so `slug` alone would have these three overwrite each other.
    expect(derivePublicId('facebook-2', 'full', 3)).toBe('facebook-2--full');
    expect(derivePublicId('facebook-2', 'hack', 3)).toBe('facebook-2--hack');
  });
});

describe('waybackMedia — derivative handling', () => {
  it('drops a resize when the original is already registered', () => {
    // The real `commissions-misc/austin-carnival`: `austin` is registered, `austin-590x412` is not.
    const plan = buildMediaPlan([
      exists('austin-carnival', 'austin-carnival', 'exact-slug', [
        media({ basename: 'austin', action: 'exists', matchedPublicId: 'austin' }),
        media({ basename: 'austin-590x412', archivePath: 'art/uploads/austin-590x412.jpg' }),
      ]),
    ]);
    expect(plan.items).toHaveLength(0);
    expect(plan.skipped).toEqual([
      expect.objectContaining({
        basename: 'austin-590x412',
        reason: 'derivative-of-available-original',
      }),
    ]);
  });

  it('drops a resize when the original is a sibling upload in the same batch', () => {
    // The real `commissions-misc/the-balloon-cats-2`: both `e1` and `e1-590x410` were captured.
    const plan = buildMediaPlan([
      exists('the-balloon-cats-2', 'the-balloon-cats-ii', 'divergence-map', [
        media({ basename: 'e1', archivePath: 'art/uploads/e1.jpg' }),
        media({ basename: 'e1-590x410', archivePath: 'art/uploads/e1-590x410.jpg' }),
      ]),
    ]);
    expect(plan.items.map((i) => i.basename)).toEqual(['e1']);
    expect(plan.items[0].kind).toBe('original');
  });

  it('keeps a resize when no original survives, and marks it as the quality ceiling', () => {
    // The real `monster-paintings/meshu-tora`: only `MESHU-TORA-590x409.jpg` was ever captured.
    const plan = buildMediaPlan([
      exists('meshu-tora', 'hatari-angani', 'fuzzy-title', [
        media({ basename: 'meshu-tora-590x409', archivePath: 'art/uploads/MESHU-TORA-590x409.jpg' }),
      ]),
    ]);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({
      kind: 'derivative-only',
      derivativeOf: 'meshu-tora',
    });
  });

  it('keeps only the largest resize when several derive from one uncaptured original', () => {
    const plan = buildMediaPlan([
      record({
        category: 'x',
        slugCandidate: 'thing',
        media: [
          media({ basename: 'thing-150x150', archivePath: 'a/thing-150x150.jpg' }),
          media({ basename: 'thing-590x410', archivePath: 'a/thing-590x410.jpg' }),
        ],
      }),
    ]);
    expect(plan.items.map((i) => i.basename)).toEqual(['thing-590x410']);
    expect(plan.skipped.map((s) => s.basename)).toEqual(['thing-150x150']);
  });
});

describe('waybackMedia — linkage safety (R-18)', () => {
  it('links a trusted match', () => {
    for (const kind of ['exact-slug', 'divergence-map'] as const) {
      const plan = buildMediaPlan([
        exists('a-page', 'canonical-slug', kind, [media({ basename: 'pic', archivePath: 'a/pic.jpg' })]),
      ]);
      expect(plan.items[0].linkable, kind).toBe(true);
      expect(plan.linkableCount).toBe(1);
    }
  });

  it('refuses to link a fuzzy match — the registry generator is first-wins, so a wrong slug steals a live image', () => {
    const plan = buildMediaPlan([
      exists('meshu-tora', 'hatari-angani', 'fuzzy-title', [
        media({ basename: 'pic', archivePath: 'a/pic.jpg' }),
      ]),
    ]);
    expect(plan.items[0].linkable).toBe(false);
    expect(plan.items[0].artworkSlug).toBe('hatari-angani');
    expect(plan.linkableCount).toBe(0);
  });

  it('refuses to link a NEW row, because the artwork does not exist until Phase 4 creates it', () => {
    const plan = buildMediaPlan([
      record({ category: 'x', slugCandidate: 'facebook-2', media: [media({ basename: 'full', archivePath: 'a/full.jpg' })] }),
    ]);
    expect(plan.items[0].linkable).toBe(false);
    expect(plan.items[0].publicId).toBe('facebook-2');
  });
});

describe('waybackMedia — unresolved identity', () => {
  it('holds a COLLISION out of the plan, because its slug is not yet the artwork it names', () => {
    // The real `vintage-appeal/jungle-tempo-2`. `jungle-tempo` is already the `artwork_slug` of a
    // live media row (`boyhood-explorers-6`), so minting `public_id = 'jungle-tempo'` would collide
    // in the registry generator's key space and steal that artwork's gallery image.
    const plan = buildMediaPlan([
      record({
        category: 'vintage-appeal',
        slugCandidate: 'jungle-tempo-2',
        canonicalSlug: 'jungle-tempo',
        proposedSlug: null,
        classification: 'COLLISION',
        matchKind: 'fuzzy-title',
        confidence: 1,
        collidesWith: ['vintage-appeal/jungle-tempo'],
        media: [media({ basename: 'jungle-tempo-copy1', archivePath: 'a/jtc1.jpg' })],
      }),
    ]);
    expect(plan.items).toHaveLength(0);
    expect(plan.skipped).toEqual([
      expect.objectContaining({ basename: 'jungle-tempo-copy1', reason: 'artwork-collision' }),
    ]);
    expect(plan.skipped[0].detail).toContain('vintage-appeal/jungle-tempo');
  });
});

describe('waybackMedia — duplicate basenames', () => {
  it('dedupes silently when the same image is referenced by two pages of one artwork', () => {
    const plan = buildMediaPlan([
      exists('page-a', 'shared-slug', 'exact-slug', [media({ basename: 'pic', archivePath: 'a/pic.jpg' })]),
      exists('page-b', 'shared-slug', 'exact-slug', [media({ basename: 'pic', archivePath: 'b/pic.jpg' })]),
    ]);
    expect(plan.items).toHaveLength(1);
    expect(plan.skipped).toHaveLength(0);
  });

  it('reports a duplicate basename that belongs to two different artworks, rather than aborting the upsert', () => {
    const plan = buildMediaPlan([
      exists('page-a', 'slug-one', 'exact-slug', [media({ basename: 'pic', archivePath: 'a/pic.jpg' })]),
      exists('page-b', 'slug-two', 'exact-slug', [media({ basename: 'pic', archivePath: 'b/pic.jpg' })]),
    ]);
    expect(plan.items).toHaveLength(1);
    expect(plan.skipped).toEqual([
      expect.objectContaining({ basename: 'pic', reason: 'duplicate-basename' }),
    ]);
  });

  it('never emits the same public_id twice — it is the table primary key', () => {
    const plan = buildMediaPlan([
      record({
        category: 'x',
        slugCandidate: 'facebook-2',
        media: [
          media({ basename: 'full', archivePath: 'a/full.jpg' }),
          media({ basename: 'hack', archivePath: 'a/hack.jpg' }),
          media({ basename: 'saucer', archivePath: 'a/saucer.jpg' }),
        ],
      }),
    ]);
    const ids = plan.items.map((i) => i.publicId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['facebook-2--full', 'facebook-2--hack', 'facebook-2--saucer']);
  });
});

describe('waybackMedia — registry collision guard (R-18)', () => {
  const live = [
    { public_id: 'boyhood-explorers-6', artwork_slug: 'jungle-tempo' },
    { public_id: 'austin', artwork_slug: 'austin-carnival' },
    { public_id: 'GreetingsfromAustin', artwork_slug: null },
  ];

  it('passes a free public_id', () => {
    expect(findRegistryCollisions(['square-eggs', 'facebook-2--full'], live)).toEqual([]);
  });

  it('catches a public_id that matches an existing public_id', () => {
    expect(findRegistryCollisions(['austin'], live)).toHaveLength(1);
  });

  it('catches a public_id that matches an existing artwork_slug', () => {
    // The reason `vintage-appeal/jungle-tempo-2` cannot be filed as `jungle-tempo`: that key
    // already belongs to the `boyhood-explorers-6` row, and the registry generator is first-wins.
    const collisions = findRegistryCollisions(['jungle-tempo'], live);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toContain("boyhood-explorers-6");
  });

  it('is case-insensitive, because the registry lowercases its keys', () => {
    expect(findRegistryCollisions(['greetingsfromaustin'], live)).toHaveLength(1);
  });

  it('reports every collision rather than only the first', () => {
    expect(findRegistryCollisions(['jungle-tempo', 'austin', 'ok'], live)).toHaveLength(2);
  });

  it('the committed plan passes the guard against the real registry', () => {
    const canonical = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data/archive/wayback_canonical_catalog.json'), 'utf8')
    ) as { media: { publicId: string; artworkSlug: string | null }[] };
    const extraction = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data/archive/wayback_extraction.json'), 'utf8')
    ) as { records: ReconciledRecord[] };
    const plan = buildMediaPlan(extraction.records);
    const existing = canonical.media.map((m) => ({
      public_id: m.publicId,
      artwork_slug: m.artworkSlug,
    }));
    expect(findRegistryCollisions(plan.items.map((i) => i.publicId), existing)).toEqual([]);
  });
});

describe('waybackMedia — against the committed extraction', () => {
  const extraction = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data/archive/wayback_extraction.json'), 'utf8')
  ) as { records: ReconciledRecord[] };

  const plan = buildMediaPlan(extraction.records);

  it('plans the whole upload set and nothing more', () => {
    // 14 reconciler `needs_upload` rows, minus two redundant derivatives and one held COLLISION.
    // 11 images across 8 artworks — not the 10 pages that carry an upload: `austin-carnival`'s only
    // image was one of the drops, and the held COLLISION was `vintage-appeal/jungle-tempo-2`.
    expect(plan.items).toHaveLength(11);
    expect(plan.artworkCount).toBe(8);
    expect(plan.skipped.map((s) => s.basename).sort()).toEqual([
      'austin-590x412',
      'e1-590x410',
      'jungle-tempo-copy1',
    ]);
  });

  it('never derives a public_id that collides with the live registry key space', () => {
    // The guard that matters: `generate-asset-registry.ts` indexes each row under its `public_id`
    // AND its `artwork_slug`, first-wins. A planned id that equals an existing artwork slug would
    // take that artwork's key away from it.
    const canonical = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data/archive/wayback_canonical_catalog.json'), 'utf8')
    ) as { media: { publicId: string; artworkSlug: string | null }[] };
    const claimed = new Set<string>();
    for (const m of canonical.media) {
      claimed.add(m.publicId.toLowerCase());
      if (m.artworkSlug) claimed.add(m.artworkSlug.toLowerCase());
    }
    for (const item of plan.items) {
      expect(claimed.has(item.publicId.toLowerCase()), item.publicId).toBe(false);
    }
  });

  it('every planned source file exists on disk — the precondition the render stage needs', () => {
    for (const item of plan.items) {
      const abs = path.join(ROOT, 'wayback', item.archive, item.archivePath);
      expect(fs.existsSync(abs), `${item.basename} → ${item.archivePath}`).toBe(true);
    }
  });

  it('emits a unique public_id per item', () => {
    const ids = plan.items.map((i) => i.publicId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links only the artworks whose match is trusted', () => {
    // `square-eggs` and `the-balloon-cats-ii` (divergence-map). `austin-carnival` matches by
    // exact-slug but contributes no item — its one image was a dropped derivative — and the rest
    // are NEW rows or fuzzy matches that must wait for adjudication.
    expect(plan.items.filter((i) => i.linkable).map((i) => i.artworkSlug).sort()).toEqual([
      'square-eggs',
      'the-balloon-cats-ii',
    ]);
  });
});
