/**
 * Offline tests for the D2 source merge — murals from the recovered export, paintings from the scrape.
 *
 * ## Why this suite exists
 *
 * D2 is described everywhere as a "source swap". It is not: the staged file covers **two** archives
 * and the recovered export covers **one**, so repointing the source drops all 136 painting records
 * while still exiting 0. It is a merge, and a merge has two halves that can each fail silently:
 *
 *   1. **The painting half moves.** Dropping or reordering a painting record changes the statement
 *      set of a file that is one `sed` away from production. The promised invariant — "the painting
 *      half did not move" — is only worth anything if it is asserted. Tests below pin the exact
 *      painting sequence *and* the slot the recovered block lands in.
 *   2. **The mural half is gutted.** `buildBackfillPlan` reads `title`/`year`/`narrative`/
 *      `description`/`categories`/`wpPostId`/`publishedAt` from `pages`, keyed by
 *      `archive\u0000relPath`. The recovered extraction originally shipped **no `pages` array**, so
 *      every authored field resolved to `undefined` and the INSERTs came out null — with a zero
 *      exit code and a plausible-looking 3,000-line file. `mergeSources` now refuses that input, and
 *      the end-to-end test below proves the fields actually arrive.
 *
 * ## The second regression: `alreadyMerged`
 *
 * `buildBackfillPlan` holds both sides of every `KNOWN_DEDUPE_PAIRS` entry by *path*, because the
 * reconciler's `knownDedupe` flag is `false` for both PRD_V3 §2 pairs (0.833 / 0.710, under the 0.85
 * gate). That hold is what stops R-01 — a duplicate INSERT of a live artwork.
 *
 * But a record the recovered path has *already merged* arrives as `EXISTS` + `known-dedupe`, where
 * the merge **is** the resolution: `applyDedupeMerges()` rewrote it to point at the live slug. Holding
 * it emits no statement at all and silently discards the merge. The hold therefore had to become
 * conditional. Both halves of that condition are tested: the merged record must produce an UPDATE, and
 * an *unmerged* record on the same hand-flagged path must still be held. Removing the hold instead of
 * conditioning it would pass the first test and fail the second — which is the whole point.
 *
 * See `V3_PHASE4_D2.md`, R-01, and R-18.
 */

import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_KIND,
  ARCHIVE_SITE,
  RECOVERED_MURAL_ARCHIVE,
  SCRAPE_MURAL_ARCHIVE,
  buildBackfillPlan,
  kindForArchive,
  mergeSources,
  renderBackfillSql,
  type CanonicalArtwork,
  type ExtractionFile,
  type ExtractionPage,
  type ExtractionRecord,
} from '../../scripts/lib/waybackBackfill';

const FINE_ART_ARCHIVE = 'roryskagen.com-v1';

function rec(partial: Partial<ExtractionRecord> & { relPath: string }): ExtractionRecord {
  const [category, slugCandidate] = partial.relPath.split('/');
  return {
    archive: FINE_ART_ARCHIVE,
    title: slugCandidate,
    category,
    slugCandidate,
    canonicalSlug: null,
    proposedSlug: null,
    classification: 'NEW',
    matchKind: 'none',
    confidence: 1,
    collidesWith: [],
    knownDedupe: false,
    media: [],
    warnings: [],
    ...partial,
  };
}

function page(partial: Partial<ExtractionPage> & { relPath: string }): ExtractionPage {
  return {
    archive: FINE_ART_ARCHIVE,
    title: partial.relPath.split('/')[1],
    description: '',
    narrative: '',
    categories: [],
    publishedAt: null,
    modifiedAt: null,
    year: null,
    wpPostId: null,
    warnings: [],
    ...partial,
  };
}

function extraction(records: ExtractionRecord[], pages: ExtractionPage[] = []): ExtractionFile {
  return {
    generatedAt: '2026-09-15T00:00:00.000Z',
    canonical: { capturedAt: '2026-09-15T00:00:00.000Z', source: 'test' },
    summary: {},
    records,
    pages,
  };
}

/**
 * The scrape, shaped like the real one: paintings either side of the mural block.
 *
 * The mural record sits in the **middle** on purpose. If `mergeSources` appended the recovered block
 * instead of injecting it at the first scrape-mural position, the painting order would still look
 * correct in a `filter(archive !== …)` assertion — the position assertion below is what catches it.
 */
const scrape = extraction(
  [
    rec({ relPath: 'ad-lands/jimmys-dilemma/index.html', proposedSlug: 'jimmys-dilemma' }),
    rec({
      relPath: 'vintage-appeal/jungle-tempo/index.html',
      classification: 'EXISTS',
      matchKind: 'exact-slug',
      canonicalSlug: 'jungle-tempo',
    }),
    rec({
      relPath: 'business/nvidia/index.html',
      archive: SCRAPE_MURAL_ARCHIVE,
      proposedSlug: 'nvidia',
    }),
    rec({ relPath: 'monster-paintings/yokai/index.html', proposedSlug: 'yokai' }),
  ],
  [
    page({ relPath: 'ad-lands/jimmys-dilemma/index.html', title: 'Jimmy’s Dilemma', year: '2011' }),
    page({
      relPath: 'business/nvidia/index.html',
      archive: SCRAPE_MURAL_ARCHIVE,
      title: 'STALE SCRAPE TITLE',
      year: '1999',
    }),
    page({ relPath: 'monster-paintings/yokai/index.html', year: '2013' }),
  ]
);

/**
 * The recovered export, shaped like the real one.
 *
 * `business/nvidia` reuses the scrape's `relPath` — deliberately. The two archives were separate
 * WordPress installs with separate numbering, so a path collision is expected, and it is exactly what
 * the `archive\u0000relPath` key in `buildBackfillPlan` exists for. The second record is a merged
 * dedupe (real shape: `featured/austin-postcard-mural` → slug `austin-postcard`).
 */
const recovered = extraction(
  [
    rec({
      relPath: 'business/nvidia/index.html',
      archive: RECOVERED_MURAL_ARCHIVE,
      title: 'NVIDIA Mural',
      proposedSlug: 'nvidia',
    }),
    rec({
      relPath: 'featured/austin-postcard-mural/index.html',
      archive: RECOVERED_MURAL_ARCHIVE,
      title: 'Austin Postcard',
      category: 'featured',
      slugCandidate: 'austin-postcard-mural',
      classification: 'EXISTS',
      matchKind: 'known-dedupe',
      canonicalSlug: 'austin-postcard',
    }),
  ],
  [
    page({
      relPath: 'business/nvidia/index.html',
      archive: RECOVERED_MURAL_ARCHIVE,
      title: 'NVIDIA Mural',
      narrative: 'These panels were created for the NVIDIA lobby.',
      description: 'A lobby commission.',
      categories: ['Business', 'Interior'],
      year: '2011',
      wpPostId: '894',
      publishedAt: '2015-02-08 14:03:16',
    }),
    page({
      relPath: 'featured/austin-postcard-mural/index.html',
      archive: RECOVERED_MURAL_ARCHIVE,
      year: '2010',
    }),
  ]
);

const OPTS = {
  generatedAt: '2026-09-15T00:00:00.000Z',
  canonicalCapturedAt: '2026-09-15T00:00:00.000Z',
  canonicalSource: 'test',
  extractionGeneratedAt: '2026-09-15T00:00:00.000Z',
};

describe('mergeSources — archive identity', () => {
  it('maps the recovered archive to the same site and kind as the scrape it supersedes', () => {
    // Without these two rows the recovered mural lands as kind 'other' under a sourceSite that is
    // the archive *directory* name. The archive field is a plain `string`, so nothing type-checks
    // this — it is only visible in the rendered SQL.
    expect(kindForArchive(RECOVERED_MURAL_ARCHIVE)).toBe('mural');
    expect(ARCHIVE_SITE[RECOVERED_MURAL_ARCHIVE]).toBe('centraltexasmurals.com');
    expect(ARCHIVE_KIND[RECOVERED_MURAL_ARCHIVE]).toBe('mural');
  });

  it('keeps the two mural archives as distinct ids', () => {
    // They are separate corpora — a scrape vs. a full WP Migrate dump — and diffing them is the
    // point of §3.D. Collapsing them into one id would make the diff meaningless and silently
    // make `mergeSources` unable to tell which records to drop.
    expect(RECOVERED_MURAL_ARCHIVE).not.toBe(SCRAPE_MURAL_ARCHIVE);
    expect(kindForArchive(SCRAPE_MURAL_ARCHIVE)).toBe('mural');
  });
});

describe('mergeSources — the painting half does not move', () => {
  it('preserves the painting records in their original relative order', () => {
    const merged = mergeSources(scrape, recovered);
    const paintings = merged.records.filter((r) => r.archive !== RECOVERED_MURAL_ARCHIVE);

    expect(paintings.map((r) => r.relPath)).toEqual([
      'ad-lands/jimmys-dilemma/index.html',
      'vintage-appeal/jungle-tempo/index.html',
      'monster-paintings/yokai/index.html',
    ]);
    // Not just the order — the objects themselves must survive unmodified.
    expect(paintings.map((r) => r.proposedSlug)).toEqual(['jimmys-dilemma', null, 'yokai']);
    expect(paintings[1].matchKind).toBe('exact-slug');
  });

  it('injects the recovered block at the first scrape-mural position, not at the end', () => {
    const merged = mergeSources(scrape, recovered);
    expect(
      merged.records.map((r) =>
        r.archive === RECOVERED_MURAL_ARCHIVE ? 'recovered' : 'scrape'
      )
    ).toEqual(['scrape', 'scrape', 'recovered', 'recovered', 'scrape']);
  });

  it('drops every scrape-mural record and keeps every painting record', () => {
    const merged = mergeSources(scrape, recovered);
    expect(merged.records.some((r) => r.archive === SCRAPE_MURAL_ARCHIVE)).toBe(false);

    const scrapePaintings = scrape.records.filter((r) => r.archive !== SCRAPE_MURAL_ARCHIVE);
    expect(merged.records).toHaveLength(scrapePaintings.length + recovered.records.length);
  });

  it('replaces the scrape mural pages and appends the recovered ones', () => {
    const merged = mergeSources(scrape, recovered);
    // The scrape's `business/nvidia` page is titled 'STALE SCRAPE TITLE'. It must not survive:
    // `pageByPath` is last-wins, so a stale page left in the array is a live shadowing risk.
    expect(merged.pages.map((p) => p.title)).toEqual([
      'Jimmy’s Dilemma',
      'yokai',
      'NVIDIA Mural',
      'austin-postcard-mural',
    ]);
    expect(merged.pages.some((p) => p.title === 'STALE SCRAPE TITLE')).toBe(false);
  });

  it('carries a provenance summary that names both sources', () => {
    const merged = mergeSources(scrape, recovered);
    expect(merged.generatedAt).toContain('(paintings)');
    expect(merged.generatedAt).toContain('(murals)');
    expect(merged.summary.fromRecovered).toBe(recovered.records.length);
    expect(merged.summary.total).toBe(merged.records.length);
  });
});

describe('mergeSources — refuses an input that would stage a gutted file', () => {
  it('throws when the recovered extraction has no pages at all', () => {
    // This is the exact defect that motivated the guard: the pre-D2 artifact had no `pages` array,
    // so every authored field resolved to `undefined` and the file still rendered and exited 0.
    const noPages = {
      ...recovered,
      pages: undefined as unknown as ExtractionPage[],
    };
    expect(() => mergeSources(scrape, noPages)).toThrow(/no `pages` array/i);
  });

  it('throws when the recovered extraction has an empty pages array', () => {
    expect(() => mergeSources(scrape, { ...recovered, pages: [] })).toThrow(/no `pages` array/i);
  });

  it('throws when the scrape carries no mural record to replace', () => {
    const paintingsOnly = extraction([
      rec({ relPath: 'ad-lands/jimmys-dilemma/index.html', proposedSlug: 'jimmys-dilemma' }),
    ]);
    expect(() => mergeSources(paintingsOnly, recovered)).toThrow(/refusing to stage/i);
  });
});

describe('D2 end to end — the mural INSERT is not null-gutted', () => {
  const artworks: CanonicalArtwork[] = [
    { slug: 'jungle-tempo', title: 'Jungle Tempo', year: null },
    { slug: 'austin-postcard', title: 'Austin Postcard', year: null },
  ];

  function plan() {
    return buildBackfillPlan(mergeSources(scrape, recovered), { artworks });
  }

  it('fills every authored field on a recovered mural from its page record', () => {
    const nvidia = plan().inserts.find((i) => i.slug === 'nvidia');
    expect(nvidia).toBeDefined();
    expect(nvidia?.year).toBe('2011');
    expect(nvidia?.narrative).toBe('These panels were created for the NVIDIA lobby.');
    expect(nvidia?.description).toBe('A lobby commission.');
    expect(nvidia?.categories).toEqual(['Business', 'Interior']);
    expect(nvidia?.wpPostId).toBe('894');
    expect(nvidia?.publishedAt).toBe('2015-02-08 14:03:16');
  });

  it('resolves the recovered mural to kind=mural and the live source site', () => {
    const nvidia = plan().inserts.find((i) => i.slug === 'nvidia');
    expect(nvidia?.kind).toBe('mural');
    expect(nvidia?.sourceSite).toBe('centraltexasmurals.com');
    expect(nvidia?.sourceArchivePath).toBe(RECOVERED_MURAL_ARCHIVE);
  });

  it('picks the recovered page, not the stale scrape page, for a colliding relPath', () => {
    // Both archives hold `business/nvidia/index.html`. If the stale scrape page won, the year would
    // be '1999' — the assertion is on the value, not just on presence.
    const nvidia = plan().inserts.find((i) => i.slug === 'nvidia');
    expect(nvidia?.year).not.toBe('1999');
  });
});

describe('the dedupe hold is conditional — a merged record is written, an unmerged one is held', () => {
  const artworks: CanonicalArtwork[] = [
    { slug: 'austin-postcard', title: 'Austin Postcard', year: null },
  ];

  it('emits an UPDATE for a record the recovered path has already merged', () => {
    // EXISTS + known-dedupe means `applyDedupeMerges()` resolved the pair: the record now points at
    // the live slug, so the merge IS the resolution and holding it would emit nothing at all.
    const p = buildBackfillPlan(mergeSources(scrape, recovered), { artworks });

    // `jungle-tempo` is the scrape painting; `austin-postcard` follows it because the recovered block
    // lands in the mural slot, which sits after that painting in the scrape order.
    expect(p.updates.map((u) => u.slug)).toEqual(['jungle-tempo', 'austin-postcard']);
    expect(p.held.some((h) => h.reason === 'KNOWN-DEDUPE')).toBe(false);

    const sql = renderBackfillSql(p, OPTS);
    expect(sql).toContain("WHERE slug = 'austin-postcard'");
    // Provenance only — an authored value must still win over the archive's.
    expect(sql).toContain('AND (source_site IS NULL');
  });

  it('still holds an unmerged NEW record on the same hand-flagged path (R-01 intact)', () => {
    // The scrape never produces EXISTS + known-dedupe for these pairs — there the same two records
    // are still NEW, which is precisely why the path-based hold exists. Removing the hold rather
    // than conditioning it would pass the test above and fail this one.
    const scrapeSide = extraction([
      rec({
        relPath: 'featured/austin-postcard-mural/index.html',
        category: 'featured',
        slugCandidate: 'austin-postcard-mural',
        proposedSlug: 'austin-postcard-mural',
        knownDedupe: false,
      }),
    ]);

    const p = buildBackfillPlan(scrapeSide, { artworks });
    expect(p.inserts).toHaveLength(0);
    expect(p.updates).toHaveLength(0);
    expect(p.held.map((h) => h.reason)).toEqual(['KNOWN-DEDUPE']);

    const sql = renderBackfillSql(p, OPTS);
    expect(sql).not.toContain('INSERT INTO public.artworks');
  });

  it('does not weaken the hold for a record flagged knownDedupe without a trusted match kind', () => {
    // `alreadyMerged` requires BOTH halves. A NEW record that merely carries the flag is still held.
    const flagged = extraction([
      rec({
        relPath: 'business/marcia-ball-cd-cover/index.html',
        proposedSlug: 'marcia-ball-cd-cover',
        knownDedupe: true,
      }),
    ]);

    const p = buildBackfillPlan(flagged, { artworks });
    expect(p.inserts).toHaveLength(0);
    expect(p.held.map((h) => h.reason)).toEqual(['KNOWN-DEDUPE']);
  });
});
