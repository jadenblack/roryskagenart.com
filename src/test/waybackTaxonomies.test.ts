/**
 * Phase 4 step 4 — the taxonomy / `artwork_terms` plan (D5 / Q6, R-09).
 *
 * R-09 is why this file exists at all: `public.artwork_terms` has existed since the baseline and
 * has **always been empty**, so this many-to-many path has never once run in production. An
 * untested path becoming load-bearing in the highest-risk release is the exact shape of R-09, so
 * the decision logic is pure and pinned here, and the committed extraction is asserted against
 * golden counts.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  artworkSlugFor,
  buildTaxonomyRows,
  isWritable,
  planTaxonomies,
  TYPE_FOR_ROLE,
  type ExtractionPage,
  type ExtractionRecord,
  type ExtractionTaxonomy,
} from '../../scripts/lib/waybackTaxonomies';

const TAXONOMIES: ExtractionTaxonomy[] = [
  { slug: 'interior', name: 'Interior', role: 'project-type' },
  { slug: 'featured', name: 'Featured', role: 'curation' },
  { slug: 'museum', name: 'Museum', role: 'project-type' },
];

const page = (relPath: string, categories: string[]): ExtractionPage => ({ relPath, categories });
const record = (
  relPath: string,
  canonicalSlug: string | null,
  proposedSlug: string | null
): ExtractionRecord => ({ relPath, canonicalSlug, proposedSlug });

describe('buildTaxonomyRows', () => {
  it('maps the export role vocabulary onto taxonomies.type', () => {
    const rows = buildTaxonomyRows(TAXONOMIES);
    expect(rows.map((r) => r.type)).toEqual(['project_type', 'curation', 'project_type']);
    expect(rows.map((r) => r.slug)).toEqual(['interior', 'featured', 'museum']);
  });

  it('keeps the export order as sort_order, because it is most-used-first', () => {
    expect(buildTaxonomyRows(TAXONOMIES).map((r) => r.sortOrder)).toEqual([0, 1, 2]);
  });

  it('drops a role this release defines no dimension for, rather than guessing one', () => {
    const rows = buildTaxonomyRows([
      { slug: 'interior', name: 'Interior', role: 'project-type' },
      { slug: 'mystery', name: 'Mystery', role: 'something-new' },
    ]);
    expect(rows.map((r) => r.slug)).toEqual(['interior']);
  });

  it('maps both roles and only those roles', () => {
    expect(TYPE_FOR_ROLE).toEqual({ 'project-type': 'project_type', curation: 'curation' });
  });
});

describe('artworkSlugFor', () => {
  it('prefers the live canonical slug over the proposed one', () => {
    expect(artworkSlugFor(record('p', 'live-slug', 'proposed-slug'))).toBe('live-slug');
  });

  it('falls back to the proposed slug for a NEW record', () => {
    expect(artworkSlugFor(record('p', null, 'proposed-slug'))).toBe('proposed-slug');
  });

  it('returns null when neither is present', () => {
    expect(artworkSlugFor(record('p', null, null))).toBeNull();
  });
});

describe('planTaxonomies', () => {
  it('files each page category as a term on that artwork', () => {
    const plan = planTaxonomies(
      TAXONOMIES,
      [page('a', ['Interior', 'Featured'])],
      [record('a', null, 'mural-a')],
      ['mural-a']
    );
    expect(plan.terms).toEqual([
      { artworkSlug: 'mural-a', taxonomyType: 'curation', taxonomySlug: 'featured' },
      { artworkSlug: 'mural-a', taxonomyType: 'project_type', taxonomySlug: 'interior' },
    ]);
    expect(plan.distinctTerms).toBe(2);
    expect(isWritable(plan)).toBe(true);
  });

  it('matches a category by name or by slug, case-insensitively', () => {
    const plan = planTaxonomies(
      TAXONOMIES,
      [page('a', ['INTERIOR', 'featured'])],
      [record('a', null, 'mural-a')],
      ['mural-a']
    );
    expect(plan.unknownCategories).toEqual([]);
    expect(plan.distinctTerms).toBe(2);
  });

  it('reports a category the taxonomy block does not define, and refuses to write', () => {
    const plan = planTaxonomies(
      TAXONOMIES,
      [page('a', ['Interior', 'NotAThing'])],
      [record('a', null, 'mural-a')],
      ['mural-a']
    );
    expect(plan.unknownCategories).toEqual(['NotAThing']);
    expect(isWritable(plan)).toBe(false);
  });

  it('reports an artwork the backfill did not create, and refuses to write', () => {
    const plan = planTaxonomies(
      TAXONOMIES,
      [page('a', ['Interior'])],
      [record('a', null, 'ghost-mural')],
      ['mural-a']
    );
    expect(plan.unknownArtworks).toEqual(['ghost-mural']);
    expect(isWritable(plan)).toBe(false);
  });

  it('collapses a repeated category, because (artwork, term) is the identity', () => {
    const plan = planTaxonomies(
      TAXONOMIES,
      [page('a', ['Interior', 'interior', 'Interior'])],
      [record('a', null, 'mural-a')],
      ['mural-a']
    );
    expect(plan.terms).toHaveLength(1);
    expect(plan.distinctTerms).toBe(1);
  });

  it('skips a record with no resolvable slug and a record with no page, but keeps the good one', () => {
    const plan = planTaxonomies(
      TAXONOMIES,
      [page('a', ['Interior'])],
      [
        record('a', null, 'mural-a'), // resolvable, has a page → 1 term
        record('b', null, null), // no slug at all → skipped
        record('ghost', null, 'mural-b'), // slug resolves, but no page for it → skipped
      ],
      ['mural-a', 'mural-b']
    );
    expect(plan.terms.map((t) => t.artworkSlug)).toEqual(['mural-a']);
    // Neither skip is a *failure* — a record with nothing to file is not an unknown artwork.
    expect(plan.unknownArtworks).toEqual([]);
    expect(plan.unknownCategories).toEqual([]);
    expect(isWritable(plan)).toBe(true);
  });

  it('handles a page with no categories without throwing', () => {
    const plan = planTaxonomies(TAXONOMIES, [{ relPath: 'a' }], [record('a', null, 'mural-a')], [
      'mural-a',
    ]);
    expect(plan.terms).toEqual([]);
    expect(isWritable(plan)).toBe(true);
  });

  it('is empty and writable for empty inputs', () => {
    const plan = planTaxonomies([], [], [], []);
    expect(plan.taxonomyRows).toEqual([]);
    expect(plan.distinctTerms).toBe(0);
    expect(isWritable(plan)).toBe(true);
  });
});

/**
 * Golden counts against the committed extraction. These are the numbers the production write
 * actually produced, so a change to the extraction, the taxonomy block, or this planner that
 * silently reshapes the dimension fails here rather than in the database.
 */
describe('planTaxonomies — against the committed extraction', () => {
  const extraction = JSON.parse(
    fs.readFileSync(path.resolve('data/archive/wayback_recovered_extraction.json'), 'utf8')
  ) as {
    taxonomy: ExtractionTaxonomy[];
    pages: ExtractionPage[];
    records: ExtractionRecord[];
  };

  const existing = extraction.records
    .map((r) => artworkSlugFor(r))
    .filter((s): s is string => Boolean(s));

  const plan = planTaxonomies(extraction.taxonomy, extraction.pages, extraction.records, existing);

  it('defines exactly 10 taxonomies: 8 project_type and 2 curation', () => {
    expect(plan.taxonomyRows).toHaveLength(10);
    expect(plan.taxonomyRows.filter((r) => r.type === 'project_type')).toHaveLength(8);
    expect(plan.taxonomyRows.filter((r) => r.type === 'curation')).toHaveLength(2);
    expect(plan.taxonomyRows.filter((r) => r.type === 'curation').map((r) => r.slug)).toEqual([
      'featured',
      'home',
    ]);
  });

  it('resolves every category and every artwork — nothing is guessed at', () => {
    expect(plan.unknownCategories).toEqual([]);
    expect(plan.unknownArtworks).toEqual([]);
    expect(isWritable(plan)).toBe(true);
  });

  it('writes 142 terms across 62 artworks (the brief said 144; measurement says 142)', () => {
    expect(plan.distinctTerms).toBe(142);
    expect(plan.terms).toHaveLength(142);
    expect(new Set(plan.terms.map((t) => t.artworkSlug)).size).toBe(62);
  });

  it('matches the per-taxonomy distribution the production write produced', () => {
    const counts: Record<string, number> = {};
    for (const t of plan.terms) counts[t.taxonomySlug] = (counts[t.taxonomySlug] ?? 0) + 1;
    expect(counts).toEqual({
      interior: 40,
      business: 32,
      exterior: 20,
      restaurant: 13,
      event: 12,
      retail: 8,
      featured: 6,
      signage: 5,
      home: 3,
      museum: 3,
    });
  });

  it('never assigns the same (artwork, type, slug) twice', () => {
    const keys = plan.terms.map((t) => `${t.artworkSlug}\u0000${t.taxonomyType}\u0000${t.taxonomySlug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
