/**
 * Offline tests for the Wayback backfill planner.
 *
 * The staged SQL is the first artifact in this program that is *shaped like a write* — it is one
 * `sed` away from production. The properties these tests pin are the ones that make that safe:
 *
 *   1. Nothing is emitted for a row a human has not adjudicated — including the two pairs in
 *      PRD_V3 §2, which the reconciler's own `knownDedupe` flag reports as `false` because it only
 *      fires on a *detected* collision. Trusting that flag would emit an INSERT that duplicates a
 *      live artwork (R-01).
 *   2. Every statement is idempotent, and every UPDATE is guarded so an authored value wins.
 *   3. NEW rows can never be publicly visible — `draft = true` AND `enabled = false` (R-02).
 *
 * The tests assert on the rendered SQL, not just the plan object, because the plan being right and
 * the file being wrong is precisely the failure mode a reviewer would miss.
 */

import { describe, expect, it } from 'vitest';
import {
  buildBackfillPlan,
  kindForArchive,
  renderBackfillSql,
  sqlLiteral,
  urlPathFor,
  type CanonicalArtwork,
  type ExtractionFile,
  type ExtractionPage,
  type ExtractionRecord,
} from '../../scripts/lib/waybackBackfill';

const MURAL_ARCHIVE = 'centraltexasmurals.com-v1';
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
  } as ExtractionPage;
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

const OPTS = {
  generatedAt: '2026-09-15T00:00:00.000Z',
  canonicalCapturedAt: '2026-09-15T00:00:00.000Z',
  canonicalSource: 'test',
  extractionGeneratedAt: '2026-09-15T00:00:00.000Z',
};

function render(records: ExtractionRecord[], pages: ExtractionPage[], artworks: CanonicalArtwork[]) {
  const plan = buildBackfillPlan(extraction(records, pages), { artworks });
  return { plan, sql: renderBackfillSql(plan, OPTS) };
}

/**
 * Only the lines the database will actually execute.
 *
 * Assertions about what the file *does* must not run against the header prose — the header
 * legitimately contains the words "no DELETE, no TRUNCATE, no schema change", and a naive
 * `not.toMatch(/\bDELETE\b/)` against the whole file fails on its own documentation.
 */
function executableLines(sql: string): string {
  return sql
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--') && l.trim() !== '')
    .join('\n');
}

describe('urlPathFor', () => {
  it('turns an archive relPath into the predecessor site path', () => {
    expect(urlPathFor('2010/2010/index.html')).toBe('/2010/2010/');
    expect(urlPathFor('vintage-appeal/jungle-tempo/index.htm')).toBe('/vintage-appeal/jungle-tempo/');
  });

  it('is stable when the path has no index document or trailing slash', () => {
    expect(urlPathFor('business/nvidia')).toBe('/business/nvidia/');
    expect(urlPathFor('business/nvidia/')).toBe('/business/nvidia/');
  });
});

describe('sqlLiteral', () => {
  it('escapes embedded single quotes by doubling them', () => {
    expect(sqlLiteral("Jimmy's Dilemma")).toBe("'Jimmy''s Dilemma'");
  });

  it('maps null and undefined to NULL', () => {
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(undefined)).toBe('NULL');
  });

  it('keeps an empty string distinct from NULL', () => {
    expect(sqlLiteral('')).toBe("''");
  });
});

describe('kindForArchive', () => {
  it('separates the mural archive from the fine-art archive', () => {
    expect(kindForArchive(MURAL_ARCHIVE)).toBe('mural');
    expect(kindForArchive(FINE_ART_ARCHIVE)).toBe('painting');
  });

  it('falls back to other rather than guessing for an unknown archive', () => {
    expect(kindForArchive('something-else-v1')).toBe('other');
  });
});

describe('hold rules — a row no human has adjudicated is never written', () => {
  it('holds a COLLISION on both sides', () => {
    const { plan } = render(
      [
        rec({
          relPath: 'vintage-appeal/jungle-tempo/index.html',
          classification: 'COLLISION',
          canonicalSlug: 'jungle-tempo',
          collidesWith: ['vintage-appeal/jungle-tempo-2'],
        }),
        rec({
          relPath: 'vintage-appeal/jungle-tempo-2/index.html',
          classification: 'COLLISION',
          canonicalSlug: 'jungle-tempo',
          collidesWith: ['vintage-appeal/jungle-tempo'],
        }),
      ],
      [],
      [{ slug: 'jungle-tempo', title: 'Jungle Tempo', year: '2011' }]
    );

    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
    expect(plan.held.map((h) => h.reason)).toEqual(['COLLISION', 'COLLISION']);
  });

  it('holds BOTH sides of a PRD_V3 §2 dedupe pair even though the reconciler reports knownDedupe false', () => {
    // This is the regression this suite exists for. The reconciler only sets `knownDedupe` when
    // both sides resolve to one canonical slug; for these pairs one side is NEW and the other
    // EXISTS under a different slug, so the flag is false on both. The pair list must still win.
    const { plan, sql } = render(
      [
        rec({
          relPath: 'business/marcia-ball-cd-cover/index.html',
          proposedSlug: 'marcia-ball-cd-cover',
          knownDedupe: false,
        }),
        rec({
          relPath: 'commissions-misc/marcia-ball/index.html',
          classification: 'EXISTS',
          matchKind: 'exact-slug',
          canonicalSlug: 'marcia-ball',
          knownDedupe: false,
        }),
      ],
      [],
      [{ slug: 'marcia-ball', title: 'Marcia Ball', year: '2024' }]
    );

    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
    expect(plan.held.every((h) => h.reason === 'KNOWN-DEDUPE')).toBe(true);

    // The duplicate slug must not appear as an executable statement anywhere.
    expect(sql).not.toContain('INSERT INTO public.artworks');
    expect(sql).not.toContain('UPDATE public.artworks');
    expect(sql).toContain('marcia-ball-cd-cover');
  });

  it('holds a fuzzy-title match rather than filling the row it guessed at', () => {
    const { plan, sql } = render(
      [
        rec({
          relPath: 'monster-paintings/yokai/index.html',
          classification: 'EXISTS',
          matchKind: 'fuzzy-title',
          canonicalSlug: 'ocamehocta',
          confidence: 1,
        }),
      ],
      [],
      [{ slug: 'ocamehocta', title: 'Ocamehocta', year: '2024' }]
    );

    expect(plan.updates).toHaveLength(0);
    expect(plan.held).toHaveLength(1);
    expect(plan.held[0].reason).toBe('FUZZY-MATCH');
    expect(plan.held[0].detail).toContain('1.000');
    expect(sql).not.toContain('UPDATE public.artworks SET');
  });

  it('holds a second NEW row that claims a slug an earlier row already took', () => {
    const { plan } = render(
      [
        rec({ relPath: 'a/first/index.html', proposedSlug: 'twin' }),
        rec({ relPath: 'a/second/index.html', proposedSlug: 'twin' }),
      ],
      [],
      []
    );

    expect(plan.inserts).toHaveLength(1);
    expect(plan.held.map((h) => h.reason)).toEqual(['DUPLICATE-SLUG']);
  });
});

describe('fill-only-empty', () => {
  it('offers a year fill only when the stored year is genuinely empty', () => {
    const { plan } = render(
      [rec({ relPath: 'a/one/index.html', classification: 'EXISTS', matchKind: 'exact-slug', canonicalSlug: 'one' })],
      [page({ relPath: 'a/one/index.html', year: '2011' })],
      [{ slug: 'one', title: 'One', year: null }]
    );

    expect(plan.updates[0].year).toBe('2011');
    expect(plan.stats.yearFills).toBe(1);
  });

  it('never offers a year fill over a stored value, and records the disagreement instead', () => {
    const { plan } = render(
      [rec({ relPath: 'a/one/index.html', classification: 'EXISTS', matchKind: 'exact-slug', canonicalSlug: 'one' })],
      [page({ relPath: 'a/one/index.html', year: '2011' })],
      [{ slug: 'one', title: 'One', year: '2024' }]
    );

    expect(plan.updates[0].year).toBeNull();
    expect(plan.stats.yearFills).toBe(0);
    expect(plan.yearMismatches).toEqual([
      { slug: 'one', storedYear: '2024', archiveYear: '2011' },
    ]);
  });

  it('reports year mismatches across the whole catalog, not only the rows it will write', () => {
    // A held row is still part of the catalog-wide problem. Scoping the diagnostic to the plan
    // would understate it by exactly the number of rows under review.
    const { plan } = render(
      [
        rec({
          relPath: 'a/held/index.html',
          classification: 'EXISTS',
          matchKind: 'fuzzy-title',
          canonicalSlug: 'held',
          confidence: 0.9,
        }),
      ],
      [page({ relPath: 'a/held/index.html', year: '2011' })],
      [{ slug: 'held', title: 'Held', year: '2024' }]
    );

    expect(plan.updates).toHaveLength(0);
    expect(plan.held).toHaveLength(1);
    expect(plan.yearMismatches).toHaveLength(1);
  });
});

describe('rendered SQL', () => {
  const records = [
    rec({ relPath: 'ad-lands/jimmys-dilemma/index.html', proposedSlug: 'jimmys-dilemma' }),
    rec({
      relPath: 'a/existing/index.html',
      classification: 'EXISTS',
      matchKind: 'exact-slug',
      canonicalSlug: 'existing',
    }),
  ];
  const pages = [
    page({ relPath: 'ad-lands/jimmys-dilemma/index.html', title: 'Jimmy’s Dilemma', year: '2011' }),
    page({ relPath: 'a/existing/index.html', year: '2011' }),
  ];
  const artworks = [{ slug: 'existing', title: 'Existing', year: null }];

  it('is wrapped in a single transaction', () => {
    const { sql } = render(records, pages, artworks);
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
    expect(sql).toContain('\nBEGIN;\n');
  });

  it('makes every INSERT idempotent and invisible by default', () => {
    const { sql } = render(records, pages, artworks);
    expect(sql).toContain('ON CONFLICT (slug) DO NOTHING;');
    expect(sql).toContain('  true,   -- draft: unreviewed client work (R-02)');
    expect(sql).toContain('  false,  -- enabled: must not render anywhere');
  });

  it('guards every UPDATE so an authored value wins', () => {
    const { sql } = render(records, pages, artworks);
    expect(sql).toContain('WHERE slug = \'existing\'');
    expect(sql).toContain('AND (source_site IS NULL OR (year IS NULL OR year = \'\'));');
  });

  it('assigns kind and year through CASE so an existing value is preserved', () => {
    const { sql } = render(records, pages, artworks);
    expect(sql).toContain(
      "kind = CASE WHEN kind IS NULL OR kind = '' THEN 'painting' ELSE kind END,"
    );
    expect(sql).toContain("year = CASE WHEN year IS NULL OR year = '' THEN '2011' ELSE year END,");
  });

  it('contains no destructive statement of any kind', () => {
    const { sql } = render(records, pages, artworks);
    const body = executableLines(sql);
    expect(body).not.toMatch(/\bDELETE\b/);
    expect(body).not.toMatch(/\bTRUNCATE\b/);
    expect(body).not.toMatch(/\bDROP\b/);
    expect(body).not.toMatch(/\bALTER\b/);
  });

  it('never writes an original.* object reference (Q4 / S1)', () => {
    const { sql } = render(records, pages, artworks);
    expect(sql).not.toContain('original.');
  });

  it('records provenance for both new and existing rows', () => {
    const { sql } = render(records, pages, artworks);
    // EXISTS: provenance columns are set directly.
    expect(sql).toContain("source_archive_path = 'roryskagen.com-v1'");
    // NEW: the same facts are preserved inside metadata.wayback.
    expect(sql).toContain("'archive', 'roryskagen.com-v1'");
    expect(sql).toContain("'relPath', 'ad-lands/jimmys-dilemma/index.html'");
  });

  it('carries the mural archive through as kind=mural', () => {
    const { sql } = render(
      [rec({ relPath: 'business/nvidia/index.html', archive: MURAL_ARCHIVE, proposedSlug: 'nvidia' })],
      [],
      []
    );
    expect(sql).toContain("'mural',");
    expect(sql).toContain("'centraltexasmurals.com',");
  });
});
