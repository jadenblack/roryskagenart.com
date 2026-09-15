/**
 * Phase 4 step 4 — the taxonomy and `artwork_terms` plan (D5 / Q6, R-09).
 *
 * WHY THIS IS TREATED AS NEW CODE
 * `public.artwork_terms` has existed since the baseline and has **always been empty**, so the
 * many-to-many path it feeds has never once been exercised. R-09 says exactly this: an untested path
 * becoming load-bearing in the highest-risk release. So the whole decision is pure, here, and tested
 * offline against fixtures.
 *
 * THE TWO DIMENSIONS (owner D5 / Q6)
 * The recovered export carries 10 categories. Eight describe *what the work is* — `interior`,
 * `business`, `exterior`, `restaurant`, `event`, `retail`, `signage`, `museum` — and two describe
 * *where it is shown* — `featured`, `home`. Filing a mural under both `interior` and `featured` as
 * the same kind of thing would put it in two contradictory buckets, so they are separate
 * `taxonomies.type` values: `project_type` and `curation`.
 *
 * ⚠️ This is why `2026_09_15_v3_phase4_schema_extension.sql` had to widen
 *    `taxonomies_type_check` first — the original CHECK allowed only series/tag/medium/location, so
 *    neither type could be filed at all.
 *
 * NOTHING IS INVENTED. Every term comes from the export's own category list; a category that does
 * not resolve to a known taxonomy is reported, never guessed at.
 */

/** The `taxonomies.type` a role maps to. `role` is the export's own vocabulary. */
export const TYPE_FOR_ROLE: Record<string, string> = {
  'project-type': 'project_type',
  curation: 'curation',
};

export interface ExtractionTaxonomy {
  slug: string;
  name: string;
  role: string;
  postCount?: number;
}

export interface ExtractionPage {
  relPath: string;
  categories?: string[];
}

export interface ExtractionRecord {
  relPath: string;
  canonicalSlug?: string | null;
  proposedSlug?: string | null;
  classification?: string;
}

export interface TaxonomyRow {
  type: string;
  slug: string;
  name: string;
  /** Display order. The export lists categories most-used first, which is a sensible default. */
  sortOrder: number;
}

export interface TermAssignment {
  artworkSlug: string;
  taxonomyType: string;
  taxonomySlug: string;
}

export interface TaxonomyPlan {
  taxonomyRows: TaxonomyRow[];
  terms: TermAssignment[];
  /** Categories in a page that resolve to no known taxonomy — refused, never guessed. */
  unknownCategories: string[];
  /** Records whose artwork slug the backfill did not create. */
  unknownArtworks: string[];
  /** Distinct `(artwork, term)` pairs — the number of `artwork_terms` rows expected. */
  distinctTerms: number;
}

/**
 * Normalise a display category to a taxonomy slug.
 *
 * The export's taxonomy block already carries the slug (`Interior` → `interior`), so this is only
 * the fallback for a page naming a category the block does not list — which is reported rather
 * than silently slugified into existence.
 */
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The artwork slug a record resolves to: the live slug for EXISTS, the proposed one for NEW. */
export function artworkSlugFor(record: ExtractionRecord): string | null {
  return record.canonicalSlug || record.proposedSlug || null;
}

export function buildTaxonomyRows(taxonomies: readonly ExtractionTaxonomy[]): TaxonomyRow[] {
  const rows: TaxonomyRow[] = [];
  taxonomies.forEach((t, index) => {
    const type = TYPE_FOR_ROLE[t.role];
    if (!type) return; // an unknown role is not a dimension this release defines
    rows.push({ type, slug: t.slug, name: t.name, sortOrder: index });
  });
  return rows;
}

/**
 * Build the plan.
 *
 * `existingArtworkSlugs` is what the backfill actually created — a term assignment naming an
 * artwork that does not exist would violate `artwork_terms.artwork_id_fkey`, and would mean the
 * backfill and the extraction disagree.
 */
export function planTaxonomies(
  taxonomies: readonly ExtractionTaxonomy[],
  pages: readonly ExtractionPage[],
  records: readonly ExtractionRecord[],
  existingArtworkSlugs: Iterable<string>
): TaxonomyPlan {
  const rows = buildTaxonomyRows(taxonomies);

  // Both a name→slug and a slug→slug map: a page may write either "Featured" or "featured".
  const byName = new Map<string, TaxonomyRow>();
  for (const r of rows) {
    byName.set(slugify(r.name), r);
    byName.set(r.slug, r);
  }

  const pageByPath = new Map(pages.map((p) => [p.relPath, p]));
  const artworkSlugs = new Set(existingArtworkSlugs);

  const terms: TermAssignment[] = [];
  const unknownCategories = new Set<string>();
  const unknownArtworks = new Set<string>();
  const seenPairs = new Set<string>();

  for (const record of records) {
    const slug = artworkSlugFor(record);
    if (!slug) continue;

    const page = pageByPath.get(record.relPath);
    if (!page) continue;

    if (!artworkSlugs.has(slug)) {
      unknownArtworks.add(slug);
      continue;
    }

    for (const raw of page.categories ?? []) {
      const row = byName.get(slugify(raw)) ?? byName.get(raw.trim().toLowerCase());
      if (!row) {
        unknownCategories.add(raw);
        continue;
      }
      // `artwork_terms` is keyed (artwork_id, term_id), so a repeated pair would collapse anyway.
      const key = `${slug}\u0000${row.type}\u0000${row.slug}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      terms.push({ artworkSlug: slug, taxonomyType: row.type, taxonomySlug: row.slug });
    }
  }

  terms.sort(
    (a, b) =>
      a.artworkSlug.localeCompare(b.artworkSlug) ||
      a.taxonomyType.localeCompare(b.taxonomyType) ||
      a.taxonomySlug.localeCompare(b.taxonomySlug)
  );

  return {
    taxonomyRows: rows,
    terms,
    unknownCategories: [...unknownCategories].sort(),
    unknownArtworks: [...unknownArtworks].sort(),
    distinctTerms: seenPairs.size,
  };
}

export function isWritable(plan: TaxonomyPlan): boolean {
  return plan.unknownCategories.length === 0 && plan.unknownArtworks.length === 0;
}
