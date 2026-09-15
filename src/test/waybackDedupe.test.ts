/**
 * Offline tests for the v3 duplicate-detection layer.
 *
 * The central claim these tests defend: **the fuzzy matcher is blind to exactly the duplicates the
 * merge must not create.** Both PRD_V3 §2 pairs score below its 0.85 gate (0.833 and 0.710), so a
 * threshold-only approach classifies them NEW and inserts duplicate artworks (R-01). Every test
 * below is downstream of that measurement.
 *
 * Fixtures cover the logic; the final block runs against the **committed** recovered extraction, so
 * a real-corpus regression fails the suite rather than waiting for a Phase 4 run to discover it.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  NEAR_MISS_FLOOR,
  SHARED_IMAGE_FLOOR,
  applyDedupeMerges,
  canonicalToRecords,
  collapseUploadVariant,
  commonPrefixTokens,
  containmentRatio,
  findDuplicates,
  imageOverlap,
  looksLikeSeriesSiblings,
  pagesToRecords,
  partitionByDedupe,
  recordKey,
  similarityScore,
  type DedupeRecord,
} from '../../scripts/lib/waybackDedupe';
import {
  FUZZY_THRESHOLD,
  KNOWN_DEDUPE_PAIRS,
  SEED_DIVERGENCE,
  type CanonicalArtworkRef,
  type ReconciledRecord,
} from '../../scripts/lib/waybackReconcile';
import type { ExtractedPage } from '../../scripts/lib/waybackExtract';

const ROOT = path.resolve(__dirname, '../..');

function canonical(slug: string, title = slug): DedupeRecord {
  return { side: 'canonical', id: slug, title, keys: [slug], images: [] };
}

function source(id: string, title = id, extra: Partial<DedupeRecord> = {}): DedupeRecord {
  return { side: 'source', id, title, keys: [id.split('/').pop() ?? id], images: [], ...extra };
}

function artwork(slug: string, title: string, imageUrl: string | null = null): CanonicalArtworkRef {
  return { slug, title, imageUrl };
}

// --- similarity calibration --------------------------------------------------------------------

describe('similarityScore — calibrated on the pairs that matter', () => {
  it('puts BOTH PRD_V3 §2 pairs inside the review band and below the matcher gate', () => {
    // The reason this module exists. If either of these ever reaches FUZZY_THRESHOLD the matcher
    // would catch it and this layer would be redundant — but it does not, so it is not.
    const pairs: [string, string][] = [
      ['austin-postcard-mural', 'austin-postcard'],
      ['marcia-ball-cd-cover', 'marcia-ball'],
    ];
    for (const [a, b] of pairs) {
      const score = similarityScore(a, b);
      expect(score).toBeGreaterThanOrEqual(NEAR_MISS_FLOOR);
      expect(score).toBeLessThan(FUZZY_THRESHOLD);
    }
  });

  it('scores the two known pairs exactly as measured', () => {
    // Pinned so a future tweak to either measure is visible as a number change, not a silent drift.
    expect(similarityScore('austin-postcard-mural', 'austin-postcard')).toBe(0.7895);
    expect(similarityScore('marcia-ball-cd-cover', 'marcia-ball')).toBe(0.6667);
  });

  it('is symmetric', () => {
    expect(similarityScore('austin-postcard-mural', 'austin-postcard')).toBe(
      similarityScore('austin-postcard', 'austin-postcard-mural')
    );
  });

  it('scores an identical name 1 and an empty name 0', () => {
    expect(similarityScore('beerland-mural', 'beerland-mural')).toBe(1);
    expect(similarityScore('', 'anything')).toBe(0);
  });

  it('keeps unrelated mural titles below the review floor', () => {
    expect(similarityScore('beerland-mural', 'casino-el-camino-mural')).toBeLessThan(NEAR_MISS_FLOOR);
    expect(similarityScore('aztec-mural', 'mellow-mushroom-murals')).toBeLessThan(NEAR_MISS_FLOOR);
  });

  it('does not treat a bare year as a containment hit', () => {
    // `2010` IS a token of `2010-rendezvous-in-chinatown`, so a boolean subset test would fire.
    // The ratio is what keeps it out of the band: 1 token of 4 is 0.25.
    expect(containmentRatio('2010', '2010-rendezvous-in-chinatown')).toBe(0.25);
    expect(similarityScore('2010', '2010-rendezvous-in-chinatown')).toBeLessThan(NEAR_MISS_FLOOR);
    expect(similarityScore('today', 'today-atomic-sunrise')).toBeLessThan(NEAR_MISS_FLOOR);
  });

  it('fires containment when the shorter name is a whole-token subset', () => {
    expect(containmentRatio('austin-postcard', 'austin-postcard-mural')).toBeCloseTo(0.6667, 3);
    // Dice would give 0.842 here — below the gate. Containment is the measure that makes the pair
    // visible at all, and the max of the two is what lands it in the band.
    expect(containmentRatio('marcia-ball', 'marcia-ball-cd-cover')).toBe(0.5);
  });
});

describe('looksLikeSeriesSiblings', () => {
  it('is false when one name is a whole prefix of the other', () => {
    // `austin-postcard` runs out entirely — the shape of a genuine duplicate.
    expect(looksLikeSeriesSiblings('Austin Postcard', 'Austin Postcard Mural')).toBe(false);
    expect(looksLikeSeriesSiblings('Marcia Ball', 'Marcia Ball CD Cover')).toBe(false);
  });

  it('is true when both names continue past a shared run', () => {
    // The measured false-positive class: the review band scored 0/2 on this corpus and both hits
    // were `Greetings from …` siblings.
    expect(looksLikeSeriesSiblings('Greetings from 78752', 'Greetings from Texas')).toBe(true);
    expect(looksLikeSeriesSiblings('Greetings from Navasota mural', 'Greetings from Texas')).toBe(true);
  });

  it('needs a run of at least two tokens', () => {
    expect(looksLikeSeriesSiblings('Beerland Mural', 'Beerland Mural Two')).toBe(false);
    expect(looksLikeSeriesSiblings('Beerland Mural', 'Beerland Mural Two')).toBe(false);
  });

  it('reports the shared run', () => {
    expect(commonPrefixTokens('Greetings from 78752', 'Greetings from Texas')).toEqual([
      'greetings',
      'from',
    ]);
  });
});

// --- image overlap -----------------------------------------------------------------------------

describe('collapseUploadVariant', () => {
  it('collapses the WordPress duplicate-upload digit suffix', () => {
    expect(collapseUploadVariant('aztec_mural_left3')).toBe(collapseUploadVariant('aztec_mural_left1'));
    expect(collapseUploadVariant('aztec_mural_center3.jpg')).toBe(
      collapseUploadVariant('aztec_mural_center1.jpg')
    );
  });

  it('does not collapse two genuinely different stems', () => {
    expect(collapseUploadVariant('mural2')).not.toBe(collapseUploadVariant('murals1'));
  });
});

describe('imageOverlap', () => {
  it('matches the Casino El Camino pair 4 of 4', () => {
    // The corpus's one true duplicate. An exact-basename test scores this 0 of 4, which is why the
    // signal was invisible until the variants were collapsed.
    const a = ['aztec_mural_22', 'aztec_mural_center3', 'aztec_mural_left3', 'aztec_mural_right3'];
    const b = [
      'aztec_mural1',
      'aztec_mural_21',
      'aztec_mural_center1',
      'aztec_mural_left1',
      'aztec_mural_right1',
      'casino_el_camino_2_mural1',
    ];
    const { ratio, shared } = imageOverlap(a, b);
    expect(ratio).toBe(1);
    expect(shared).toHaveLength(4);
    expect(shared).toContainEqual(['aztec_mural_left3', 'aztec_mural_left1']);
  });

  it('reports 0 for disjoint sets and for an empty side', () => {
    expect(imageOverlap(['a'], ['b']).ratio).toBe(0);
    expect(imageOverlap([], ['b']).ratio).toBe(0);
    expect(imageOverlap(['a'], []).ratio).toBe(0);
  });

  it('is symmetric in ratio', () => {
    expect(imageOverlap(['x1', 'y'], ['x2']).ratio).toBe(imageOverlap(['x2'], ['x1', 'y']).ratio);
  });
});

// --- detection ---------------------------------------------------------------------------------

describe('findDuplicates', () => {
  const live = [canonical('marcia-ball', 'Marcia Ball'), canonical('austin-postcard', 'Austin Postcard')];

  it('blocks both PRD_V3 §2 pairs even though the matcher scores them below its gate', () => {
    const sources = [
      source('business/marcia-ball-cd-cover', 'Marcia Ball CD Cover'),
      source('featured/austin-postcard-mural', 'Austin Postcard Mural'),
    ];
    const report = findDuplicates(sources, live, {
      knownPairs: KNOWN_DEDUPE_PAIRS,
      seedDivergence: SEED_DIVERGENCE,
    });

    expect(report.byKind['known-pair']).toBe(2);
    expect(report.blockedSourceIds).toEqual([
      'business/marcia-ball-cd-cover',
      'featured/austin-postcard-mural',
    ]);
    expect(report.mergeInto).toEqual({
      'business/marcia-ball-cd-cover': 'marcia-ball',
      'featured/austin-postcard-mural': 'austin-postcard',
    });
    // Certain, so not a review item.
    expect(report.candidates.filter((c) => c.kind === 'known-pair').every((c) => !c.needsReview)).toBe(true);
  });

  it('resolves a known pair whose counterpart is a seeded divergence', () => {
    // `commissions-misc/today` → `today-atomic-sunrise` is not a last-segment match, so the pair
    // only resolves through SEED_DIVERGENCE.
    const sources = [source('commissions-misc/today')];
    const report = findDuplicates(sources, [canonical('today-atomic-sunrise', 'Today')], {
      knownPairs: [['commissions-misc/today', 'commissions-misc/today-atomic-sunrise']],
      seedDivergence: SEED_DIVERGENCE,
    });
    expect(report.mergeInto['commissions-misc/today']).toBe('today-atomic-sunrise');
  });

  it('warns rather than blocks when a known pair cannot be resolved', () => {
    const report = findDuplicates([source('business/marcia-ball-cd-cover')], [], {
      knownPairs: KNOWN_DEDUPE_PAIRS,
    });
    expect(report.blockedSourceIds).toEqual([]);
    expect(report.warnings.some((w) => w.includes('could not be resolved'))).toBe(true);
  });

  it('blocks a record whose _wp_old_slug is a live slug', () => {
    const sources = [
      source('featured/duluth-theater', 'Duluth Theater', { keys: ['duluth-theater', 'new-mural-for-whole-foods'] }),
    ];
    const report = findDuplicates(sources, [canonical('new-mural-for-whole-foods', 'Whole Foods Mural')]);
    expect(report.byKind['alias-match']).toBe(1);
    expect(report.mergeInto['featured/duluth-theater']).toBe('new-mural-for-whole-foods');
    expect(report.blockedSourceIds).toEqual(['featured/duluth-theater']);
  });

  it('reports a sub-threshold near-miss without blocking it', () => {
    const report = findDuplicates([source('business/austin-postcard-mural', 'Austin Postcard Mural')], live);
    const nm = report.candidates.find((c) => c.kind === 'near-miss');
    expect(nm).toBeDefined();
    expect(nm?.needsReview).toBe(true);
    expect(nm?.winner.id).toBe('austin-postcard');
    // ⚠️ Not blocked. A false merge silently destroys an artwork, so a 0.79 score is a question.
    expect(report.blockedSourceIds).toEqual([]);
  });

  it('flags a series-sibling near-miss so it can be triaged last', () => {
    const report = findDuplicates(
      [source('business/greetings-from-78752', 'Greetings from 78752')],
      [canonical('greetings-from-texas', 'Greetings from Texas')]
    );
    const nm = report.candidates.find((c) => c.kind === 'near-miss');
    expect(nm?.likelySeries).toBe(true);
    expect(report.warnings.some((w) => w.includes('series sibling'))).toBe(true);
  });

  it('detects an intra-corpus duplicate that a source-vs-canonical matcher cannot see', () => {
    // Neither of these is near anything live, so `reconcile()` classifies both NEW and both would
    // be inserted. Only an intra-corpus pass finds it.
    const sources = [
      source('restaurant/aztec-mural-for-casino-el-camino', 'Aztec Mural for Casino El Camino', {
        images: ['aztec_mural_22', 'aztec_mural_center3', 'aztec_mural_left3'],
      }),
      source('restaurant/casino-el-camino-mural', 'Casino El Camino Mural', {
        images: ['aztec_mural_21', 'aztec_mural_center1', 'aztec_mural_left1', 'extra'],
      }),
    ];
    const report = findDuplicates(sources, []);
    const intra = report.candidates.find((c) => c.kind === 'intra-source');
    expect(intra).toBeDefined();
    // The richer record survives — 4 images against 3.
    expect(intra?.winner.id).toBe('restaurant/casino-el-camino-mural');
    expect(intra?.sharedImages).toHaveLength(3);
    // ⚠️ Review, not blocked: a title resemblance alone must not merge two records.
    expect(intra?.needsReview).toBe(true);
    expect(report.blockedSourceIds).toEqual([]);
  });

  it('corroborates with image overlap only above the floor', () => {
    const thin = findDuplicates(
      [
        source('a/one', 'One', { images: ['shared', 'x', 'y', 'z'] }),
        source('a/two', 'Two', { images: ['shared'] }),
      ],
      []
    );
    // 1 of 1 in the smaller set — above the floor, so reported.
    expect(thin.byKind['shared-image']).toBe(1);
    expect(SHARED_IMAGE_FLOOR).toBe(0.5);
  });

  it('warns on a slug clash and keeps the second record insertable', () => {
    const report = findDuplicates([source('a/one', 'One'), source('b/one', 'One')], []);
    expect(report.warnings.some((w) => w.includes('slug clash'))).toBe(true);
    // A clash is a question about identity, not a proven duplicate.
    expect(report.blockedSourceIds).toEqual([]);
  });

  it('partitions source ids into merge and insert', () => {
    const sources = [
      source('business/marcia-ball-cd-cover'),
      source('business/beerland-mural'),
    ];
    const report = findDuplicates(sources, live, { knownPairs: KNOWN_DEDUPE_PAIRS });
    expect(partitionByDedupe(sources.map((s) => s.id), report)).toEqual({
      merge: ['business/marcia-ball-cd-cover'],
      insert: ['business/beerland-mural'],
    });
  });

  it('always reports the same kinds, so the record shape is stable', () => {
    expect(Object.keys(findDuplicates([], []).byKind).sort()).toEqual(
      ['alias-match', 'intra-source', 'known-pair', 'near-miss', 'shared-image', 'slug-clash'].sort()
    );
  });
});

// --- record construction -----------------------------------------------------------------------

describe('record construction', () => {
  it('gives canonical records a side-qualified key that cannot collide with a source id', () => {
    expect(recordKey(canonical('beerland-mural'))).toBe('canonical:beerland-mural');
    expect(recordKey(source('beerland-mural'))).toBe('source:beerland-mural');
  });

  it('folds aliases into a source record keys', () => {
    const page = {
      archive: 'centraltexasmuralsbyroryskagen-x',
      relPath: 'featured/duluth-theater/index.html',
      category: 'featured',
      slugCandidate: 'duluth-theater',
      title: 'Duluth Theater',
      images: [{ ref: 'a.jpg', local: true, remote: false, basename: 'a' }],
      warnings: [],
    } as unknown as ExtractedPage;
    const [record] = pagesToRecords([page], new Map([['featured/duluth-theater', ['new-mural-for-whole-foods']]]));
    expect(record.keys).toEqual(['duluth-theater', 'new-mural-for-whole-foods']);
    expect(record.images).toEqual(['a']);
  });

  it('builds canonical records from the artwork image_url only', () => {
    const [record] = canonicalToRecords([artwork('beerland-mural', 'Beerland', 'Beerland.jpg')]);
    expect(record.images).toEqual(['beerland']);
    expect(record.keys).toEqual(['beerland-mural']);
  });
});

// --- merge application -------------------------------------------------------------------------

describe('applyDedupeMerges', () => {
  function rec(partial: Partial<ReconciledRecord> & { slugCandidate: string }): ReconciledRecord {
    return {
      archive: 'a',
      relPath: `${partial.category ?? 'business'}/${partial.slugCandidate}/index.html`,
      title: partial.slugCandidate,
      category: 'business',
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

  const report = findDuplicates([source('business/marcia-ball-cd-cover')], [canonical('marcia-ball')], {
    knownPairs: KNOWN_DEDUPE_PAIRS,
  });

  it('turns a blocked NEW record into a trusted EXISTS', () => {
    const { records, applied } = applyDedupeMerges([rec({ slugCandidate: 'marcia-ball-cd-cover' })], report);
    expect(applied).toEqual(['business/marcia-ball-cd-cover']);
    expect(records[0].classification).toBe('EXISTS');
    expect(records[0].canonicalSlug).toBe('marcia-ball');
    expect(records[0].proposedSlug).toBeNull();
    // ⚠️ `known-dedupe` must be a TRUSTED kind or the image uploads unlinked — see the next test.
    expect(records[0].matchKind).toBe('known-dedupe');
    expect(records[0].warnings.some((w) => w.includes('below its gate'))).toBe(true);
  });

  it('leaves records the dedupe layer did not resolve certain', () => {
    const { records, applied } = applyDedupeMerges([rec({ slugCandidate: 'beerland-mural' })], report);
    expect(applied).toEqual([]);
    expect(records[0].classification).toBe('NEW');
  });
});

// --- against the committed recovered extraction ------------------------------------------------

describe('waybackDedupe — against the committed recovered extraction', () => {
  const extraction = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data/archive/wayback_recovered_extraction.json'), 'utf8')
  ) as {
    summary: { NEW: number; EXISTS: number; mergedByDedupe: number };
    records: ReconciledRecord[];
    mediaPlan: { items: { publicId: string }[] };
    dedupe: { blockedSourceIds: string[]; byKind: Record<string, number> };
  };

  it('reports the merge honestly: the matcher said NEW for records the dedupe layer resolved', () => {
    // The matcher alone: 62 NEW. After the dedupe knowledge is applied: 60 NEW + 2 merges.
    expect(extraction.summary.mergedByDedupe).toBe(2);
    expect(extraction.summary.EXISTS).toBe(2);
    expect(extraction.summary.NEW).toBe(60);
  });

  it('blocks exactly the two PRD_V3 §2 pairs', () => {
    expect(extraction.dedupe.blockedSourceIds).toEqual([
      'business/marcia-ball-cd-cover',
      'featured/austin-postcard-mural',
    ]);
    expect(extraction.dedupe.byKind['known-pair']).toBe(2);
  });

  it('carries the known-dedupe matchKind into the emitted records', () => {
    const merged = extraction.records.filter((r) => r.matchKind === 'known-dedupe');
    expect(merged).toHaveLength(2);
    expect(merged.every((r) => r.classification === 'EXISTS' && r.canonicalSlug)).toBe(true);
  });

  it('does NOT match a mural to an artwork on an unverifiable registry key', () => {
    // `magazine-illustration-for-life-and-letters` references `b.jpg`, and a media row with
    // `public_id='b'` declares `artwork_slug='the-end-of-austin'` — but NO artwork references
    // `b.jpg`. Matching on that declaration produced a false EXISTS at confidence 0.9.
    const record = extraction.records.find(
      (r) => r.slugCandidate === 'magazine-illustration-for-life-and-letters'
    );
    expect(record).toBeDefined();
    expect(record?.canonicalSlug).toBeNull();
    expect(record?.classification).toBe('NEW');
    expect(record?.matchKind).toBe('none');
  });

  it('plans no public_id that collides with the live registry key space', () => {
    const canonical = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data/archive/wayback_canonical_catalog.json'), 'utf8')
    ) as { media: { publicId: string; artworkSlug: string | null }[] };

    const claimed = new Map<string, string>();
    for (const m of canonical.media) {
      claimed.set(m.publicId.toLowerCase(), m.publicId);
      if (m.artworkSlug) claimed.set(m.artworkSlug.toLowerCase(), m.publicId);
    }
    const collisions = extraction.mediaPlan.items.filter((i) =>
      claimed.has(i.publicId.toLowerCase())
    );
    // Was 2 before `buildMediaPlan` learned to count the media an artwork already owns.
    expect(collisions).toEqual([]);
  });

  it('gives every merged artwork a suffixed public_id rather than reclaiming its existing key', () => {
    const marcia = extraction.mediaPlan.items.filter((i) => i.publicId.startsWith('marcia-ball'));
    expect(marcia).toHaveLength(1);
    // `marcia-ball` alone is the key the live `f` row already holds via artwork_slug.
    expect(marcia[0].publicId).not.toBe('marcia-ball');
    expect(marcia[0].publicId).toContain('--');
  });
});
