/**
 * Wayback backfill planning — pure, offline, no `fs`, no `pg`, no `sharp`.
 *
 * `plan/ROADMAP_V3.md` §3.A Step 4 requires the reconcile pass to emit a **draft backfill script**.
 * This module turns `data/archive/wayback_extraction.json` into that plan; `scripts/wayback-stage-sql.ts`
 * renders it into `supabase/staged/`.
 *
 * WHY THE SQL IS STAGED AND NOT COMMITTED TO `supabase/migrations/`
 * `scripts/lib/migrationPlan.ts` applies **every** `.sql` in `supabase/migrations/` that is not yet in
 * `public.schema_migrations`. Committing the backfill there would make the next routine
 * `npx tsx scripts/run-migrations.ts` apply it — against production — long before its Phase 4 gate.
 * The staged file is inert until a human promotes it in the Phase 4 PR.
 *
 * THREE RULES, all load-bearing:
 *
 *   1. **A row no human has adjudicated is HELD, never guessed.** Every COLLISION, every
 *      known-dedupe pair, and every fuzzy-title match is excluded from the executable sections and
 *      emitted as a commented review block instead.
 *   2. **EXISTS rows are fill-only-empty.** The guard is enforced twice — the plan is computed
 *      against the canonical snapshot so an already-authored value is never even emitted, and the
 *      SQL carries a `WHERE` guard so it stays correct even if the database has moved on.
 *   3. **NEW rows land `draft = true` AND `enabled = false`.** R-02: unreviewed client work must not
 *      reach the public gallery through any path, including a direct PostgREST read.
 *
 * This module deliberately does **not** plan `taxonomies` / `artwork_terms`. R-09: `artwork_terms`
 * is empty, so the M2M path has never been exercised and must be treated as new code in its own
 * Phase 4 step. The extracted category names are preserved in `metadata.wayback.categories` so
 * nothing is lost in the meantime.
 */

export type ArtworkKind = 'painting' | 'mural' | 'other';

/**
 * Re-exported from the reconciler so the pair list has exactly one definition. Importing the
 * constant (not duplicating it) is what stops the two files drifting apart.
 */
export { KNOWN_DEDUPE_PAIRS } from './waybackReconcile';
import { KNOWN_DEDUPE_PAIRS } from './waybackReconcile';

export interface ExtractionMediaRef {
  basename: string;
  action: 'exists' | 'needs_upload' | 'unavailable';
  matchedPublicId?: string | null;
}

export interface ExtractionRecord {
  archive: string;
  relPath: string;
  title: string;
  category: string;
  slugCandidate: string;
  canonicalSlug: string | null;
  proposedSlug: string | null;
  classification: 'NEW' | 'EXISTS' | 'COLLISION';
  matchKind: string;
  confidence: number;
  collidesWith: string[];
  knownDedupe: boolean;
  media: ExtractionMediaRef[];
  warnings: string[];
}

export interface ExtractionPage {
  archive: string;
  relPath: string;
  title: string;
  description: string;
  narrative: string;
  categories: string[];
  publishedAt: string | null;
  modifiedAt: string | null;
  year: string | null;
  wpPostId: string | null;
  warnings: string[];
}

export interface ExtractionFile {
  generatedAt: string;
  canonical: { capturedAt: string; source: string };
  summary: Record<string, number>;
  records: ExtractionRecord[];
  pages: ExtractionPage[];
}

/** The subset of the canonical snapshot this planner needs. */
export interface CanonicalArtwork {
  slug: string;
  title: string;
  year?: string | null;
}

/** Source site + default `kind` per archive. The two archives are categorically different work. */
export const ARCHIVE_SITE: Record<string, string> = {
  'centraltexasmurals.com-v1': 'centraltexasmurals.com',
  'roryskagen.com-v1': 'roryskagen.com',
};

export const ARCHIVE_KIND: Record<string, ArtworkKind> = {
  'centraltexasmurals.com-v1': 'mural',
  'roryskagen.com-v1': 'painting',
};

/**
 * Match kinds trusted enough to act on without a human.
 *
 * `exact-slug` is a string equality against a live slug. `divergence-map` is hand-seeded from
 * `PRD_V3` §2 — a human already decided it. `known-dedupe` is the same kind of knowledge arriving
 * by the other route: PRD_V3 §2 *names* the duplicate pair, and `waybackDedupe.ts` applies it
 * explicitly because both pairs score below the fuzzy gate (0.833 / 0.710) and the matcher
 * therefore cannot see them. `fuzzy-title` is a similarity score and is NOT here: at Dice 0.875
 * "two different paintings with similar names" and "the same painting" are indistinguishable, and
 * acting on it would fill the wrong row's empty fields.
 *
 * ⚠️ DUPLICATED IN `waybackMedia.ts` — the two lists must be changed together.
 */
export const TRUSTED_MATCH_KINDS = ['exact-slug', 'divergence-map', 'known-dedupe'] as const;

export interface InsertRow {
  slug: string;
  title: string;
  year: string | null;
  kind: ArtworkKind;
  narrative: string | null;
  sourceSite: string;
  sourceUrlPath: string;
  sourceArchivePath: string;
  relPath: string;
  description: string;
  categories: string[];
  wpPostId: string | null;
  publishedAt: string | null;
}

export interface UpdateRow {
  slug: string;
  kind: ArtworkKind;
  /** Present only when the snapshot shows the column empty AND the archive yielded a year. */
  year: string | null;
  sourceSite: string;
  sourceUrlPath: string;
  sourceArchivePath: string;
  relPath: string;
}

export interface HeldRow {
  reason: string;
  archive: string;
  relPath: string;
  slug: string | null;
  title: string;
  detail: string;
}

/**
 * An EXISTS row whose stored `year` disagrees with the year the archive published it under.
 *
 * This is a *diagnostic*, not a planned change. Every one of the 138 catalog rows carries
 * `year = '2024'` — the hardcoded default in `POST /api/artworks` (`server/routes/artworks.ts:116`)
 * — so fill-only-empty can never correct them: the column is not empty, it is wrong. Correcting it
 * would mean overwriting a stored value, which R-04 forbids without an explicit owner decision.
 * These are listed in the generated file so the problem is visible rather than silently skipped.
 */
export interface YearMismatch {
  slug: string;
  storedYear: string;
  archiveYear: string;
}

export interface BackfillPlan {
  inserts: InsertRow[];
  updates: UpdateRow[];
  held: HeldRow[];
  yearMismatches: YearMismatch[];
  stats: {
    records: number;
    inserted: number;
    updated: number;
    held: number;
    heldCollision: number;
    heldDedupe: number;
    heldFuzzy: number;
    yearFills: number;
    yearMismatches: number;
    newWithUploadableImage: number;
  };
}

/** `/2010/2010/` for `2010/2010/index.html` — the canonical path on the predecessor site. */
export function urlPathFor(relPath: string): string {
  const withoutIndex = relPath.replace(/index\.html?$/i, '');
  const trimmed = withoutIndex.replace(/\/+$/, '');
  return `/${trimmed}/`;
}

export function kindForArchive(archive: string): ArtworkKind {
  return ARCHIVE_KIND[archive] ?? 'other';
}

function isEmpty(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim() === '';
}

/**
 * Build the backfill plan.
 *
 * `pages` is keyed by `archive + relPath` because the same relative path can exist in both
 * archives — they were separate WordPress installs with separate numbering.
 */
export function buildBackfillPlan(
  extraction: ExtractionFile,
  canonical: { artworks: CanonicalArtwork[] }
): BackfillPlan {
  const pageByPath = new Map<string, ExtractionPage>();
  for (const p of extraction.pages) pageByPath.set(`${p.archive}\u0000${p.relPath}`, p);

  const canonicalBySlug = new Map<string, CanonicalArtwork>();
  for (const a of canonical.artworks) canonicalBySlug.set(a.slug, a);

  const inserts: InsertRow[] = [];
  const updates: UpdateRow[] = [];
  const held: HeldRow[] = [];
  const yearMismatches: YearMismatch[] = [];

  const seenSlugs = new Set<string>();

  /**
   * Both sides of every hand-verified duplicate pair, as `category/slugCandidate`.
   *
   * ⚠️ The reconciler's own `knownDedupe` field cannot be used for this. It is only set when *both*
   * sides of a pair resolve to the same canonical slug, i.e. only for a *detected* collision. When
   * the matcher cannot see the link — which is exactly the case for both pairs in PRD_V3 §2, where
   * one side is NEW and the other EXISTS under a different slug — it reports `knownDedupe: false`
   * for both. Trusting that field would emit an INSERT that duplicates a live artwork (R-01).
   * The pair list is authoritative; collision detection is not a precondition for holding.
   */
  const dedupePaths = new Set<string>();
  for (const [a, b] of KNOWN_DEDUPE_PAIRS) {
    dedupePaths.add(a);
    dedupePaths.add(b);
  }

  for (const r of extraction.records) {
    const page = pageByPath.get(`${r.archive}\u0000${r.relPath}`);
    const sourceSite = ARCHIVE_SITE[r.archive] ?? r.archive;
    const sourceUrlPath = urlPathFor(r.relPath);
    const kind = kindForArchive(r.archive);
    const sourcePath = `${r.category}/${r.slugCandidate}`;

    if (r.classification === 'COLLISION') {
      held.push({
        reason: 'COLLISION',
        archive: r.archive,
        relPath: r.relPath,
        slug: r.canonicalSlug,
        title: r.title,
        detail: `resolves to the same slug as ${r.collidesWith.join(', ') || 'another source page'}`,
      });
      continue;
    }

    if (r.knownDedupe || dedupePaths.has(sourcePath)) {
      held.push({
        reason: 'KNOWN-DEDUPE',
        archive: r.archive,
        relPath: r.relPath,
        slug: r.proposedSlug ?? r.canonicalSlug,
        title: r.title,
        detail: 'hand-flagged in PRD_V3 §2 as the same work published under two archive paths',
      });
      continue;
    }

    if (r.classification === 'NEW') {
      // A NEW row whose slug already appears earlier in this run would collide with itself.
      if (isEmpty(r.proposedSlug) || seenSlugs.has(r.proposedSlug as string)) {
        held.push({
          reason: 'DUPLICATE-SLUG',
          archive: r.archive,
          relPath: r.relPath,
          slug: r.proposedSlug,
          title: r.title,
          detail: isEmpty(r.proposedSlug)
            ? 'no proposed slug could be derived'
            : 'a previous source page in this run already claimed this slug',
        });
        continue;
      }
      const slug = r.proposedSlug as string;
      seenSlugs.add(slug);

      inserts.push({
        slug,
        title: page?.title ?? r.title,
        year: isEmpty(page?.year) ? null : (page?.year as string),
        kind,
        // The archive's post body is the only catalogue text that exists for these records. It is
        // scraped post meta, not authored prose — the row lands as a draft precisely so the studio
        // reviews it. See the warning in the rendered file header.
        narrative: isEmpty(page?.narrative) ? null : (page?.narrative as string),
        sourceSite,
        sourceUrlPath,
        sourceArchivePath: r.archive,
        relPath: r.relPath,
        description: page?.description ?? '',
        categories: page?.categories ?? [],
        wpPostId: page?.wpPostId ?? null,
        publishedAt: page?.publishedAt ?? null,
      });
      continue;
    }

    // EXISTS
    if (!TRUSTED_MATCH_KINDS.includes(r.matchKind as (typeof TRUSTED_MATCH_KINDS)[number])) {
      held.push({
        reason: 'FUZZY-MATCH',
        archive: r.archive,
        relPath: r.relPath,
        slug: r.canonicalSlug,
        title: r.title,
        detail: `matched by ${r.matchKind} at ${r.confidence.toFixed(3)} — verify before filling`,
      });
      continue;
    }

    const slug = r.canonicalSlug;
    if (isEmpty(slug)) {
      held.push({
        reason: 'NO-CANONICAL-SLUG',
        archive: r.archive,
        relPath: r.relPath,
        slug: null,
        title: r.title,
        detail: 'classified EXISTS but carries no canonical slug',
      });
      continue;
    }

    // Rule 2, computed at plan time: only offer a year fill when the snapshot shows the column
    // genuinely empty. The rendered SQL guards again, so a concurrent author edit still wins.
    const existing = canonicalBySlug.get(slug as string);
    const yearFill =
      !isEmpty(page?.year) && isEmpty(existing?.year) ? (page?.year as string) : null;

    updates.push({
      slug: slug as string,
      kind,
      year: yearFill,
      sourceSite,
      sourceUrlPath,
      sourceArchivePath: r.archive,
      relPath: r.relPath,
    });
  }

  const newWithUploadableImage = extraction.records.filter(
    (r) =>
      r.classification === 'NEW' && r.media.some((m) => m.action === 'needs_upload')
  ).length;

  /**
   * Computed in its own pass, deliberately independent of the hold decisions above.
   *
   * The diagnostic describes the CATALOG, not this file's plan. Scoping it to the rows that
   * happened to survive adjudication would understate a catalog-wide problem by exactly the number
   * of rows a human is currently reviewing — which is the opposite of what a diagnostic is for.
   */
  for (const r of extraction.records) {
    if (r.classification !== 'EXISTS' || isEmpty(r.canonicalSlug)) continue;
    const page = pageByPath.get(`${r.archive}\u0000${r.relPath}`);
    const existing = canonicalBySlug.get(r.canonicalSlug as string);
    if (isEmpty(page?.year) || isEmpty(existing?.year)) continue;
    if (existing?.year === page?.year) continue;
    yearMismatches.push({
      slug: r.canonicalSlug as string,
      storedYear: existing?.year as string,
      archiveYear: page?.year as string,
    });
  }
  yearMismatches.sort((a, b) => a.slug.localeCompare(b.slug));

  return {
    inserts,
    updates,
    held,
    yearMismatches,
    stats: {
      records: extraction.records.length,
      inserted: inserts.length,
      updated: updates.length,
      held: held.length,
      heldCollision: held.filter((h) => h.reason === 'COLLISION').length,
      heldDedupe: held.filter((h) => h.reason === 'KNOWN-DEDUPE').length,
      heldFuzzy: held.filter((h) => h.reason === 'FUZZY-MATCH').length,
      yearFills: updates.filter((u) => u.year !== null).length,
      yearMismatches: yearMismatches.length,
      newWithUploadableImage,
    },
  };
}

/** Single-quoted SQL literal. Doubles embedded quotes; `null` and `undefined` become `NULL`. */
export function sqlLiteral(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

/** A `jsonb_build_object` call built from already-safe `jsonb_build_*` fragments. */
function jsonbObject(entries: [string, string][], indent = 2): string {
  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 2);
  const body = entries.map(([k, v]) => `${inner}${sqlLiteral(k)}, ${v}`).join(',\n');
  return `jsonb_build_object(\n${body}\n${pad})`;
}

function jsonbArray(values: string[]): string {
  if (values.length === 0) return `'[]'::jsonb`;
  return `jsonb_build_array(${values.map((v) => sqlLiteral(v)).join(', ')})`;
}

export interface RenderOptions {
  generatedAt: string;
  canonicalCapturedAt: string;
  canonicalSource: string;
  extractionGeneratedAt: string;
}

/**
 * Render the plan as the staged SQL file.
 *
 * Every executable statement is idempotent: `INSERT … ON CONFLICT (slug) DO NOTHING`, and
 * `UPDATE … WHERE` guarded on the columns it touches being empty. Re-running the whole file must
 * mutate nothing — that is a Phase 4 exit criterion, and the guards are how it is met.
 */
export function renderBackfillSql(plan: BackfillPlan, opts: RenderOptions): string {
  const L: string[] = [];
  const s = plan.stats;

  L.push(
    '-- v3.0.0 — Wayback backfill (STAGED — NOT APPLIED BY THE MIGRATION RUNNER)',
    '--',
    '-- Generated by scripts/wayback-stage-sql.ts from data/archive/wayback_extraction.json.',
    '-- Regenerate with:  npx tsx scripts/wayback-stage-sql.ts',
    '--',
    '-- WHY THIS FILE LIVES IN supabase/staged/ AND NOT supabase/migrations/',
    '--   scripts/lib/migrationPlan.ts applies EVERY .sql in supabase/migrations/ that is not yet',
    '--   recorded in public.schema_migrations. A file placed there is applied by the next routine',
    '--   `npx tsx scripts/run-migrations.ts` — against production — with no further gate. This',
    '--   backfill must not run until the Phase 4 checklist in plan/ROADMAP_V3.md §4 is satisfied.',
    '--   It is inert here. Promote it in the Phase 4 PR, and only then.',
    '--',
    `-- Generated          : ${opts.generatedAt}`,
    `-- Extraction         : ${opts.extractionGeneratedAt}`,
    `-- Canonical snapshot : ${opts.canonicalCapturedAt} from ${opts.canonicalSource}`,
    '--',
    '-- WHAT IT DOES',
    `--   Section 1  ${String(s.inserted).padStart(3)} INSERTs — NEW records, draft = true AND enabled = false`,
    `--   Section 2  ${String(s.updated).padStart(3)} UPDATEs — EXISTS records, fill-only-empty`,
    `--   Section 2b   0 statements — ${s.yearMismatches} rows listed as a data-quality diagnostic`,
    `--   Section 3  ${String(s.held).padStart(3)} rows HELD for human adjudication (no statements emitted)`,
    '--',
    '-- PRECONDITIONS — this file will not run until all three hold',
    '--   1. The Phase 4 schema extension has been applied, adding:',
    '--        artworks.kind                 text',
    '--        artworks.source_site          text',
    '--        artworks.source_url_path      text',
    '--        artworks.source_archive_path  text',
    '--      (plan/ROADMAP_V3.md Phase 4 step 2; the gap list is G1/G2/G3)',
    '--   2. A verified dump exists and its restore has been proven on a scratch database',
    '--      (docs/runbooks/database-backup-restore.md §5).',
    '--   3. Every row in Section 3 has been adjudicated. Re-run the generator afterwards.',
    '--',
    '-- IDEMPOTENCY',
    '--   Section 1: ON CONFLICT (slug) DO NOTHING.',
    '--   Section 2: every UPDATE is guarded on the columns it sets being NULL or empty.',
    '--   Running this file twice must mutate nothing on the second pass.',
    '--',
    '-- WHAT IT DELIBERATELY DOES NOT DO',
    '--   * No media rows. Images are registered by scripts/wayback-register.ts (Phase 3.B) before',
    '--     this file runs; artworks.image_url is left NULL here and set in the Phase 4 media step.',
    '--   * No taxonomies / artwork_terms. R-09: artwork_terms is empty, so the M2M path has never',
    '--     been exercised and must be treated as new code. Categories are preserved in',
    '--     metadata.wayback.categories so nothing is lost in the meantime.',
    '--   * No change to any authored field on an EXISTS row other than filling it when empty.',
    '--   * No DELETE, no TRUNCATE, no schema change.',
    '--',
    '-- ⚠️  artworks.narrative ON NEW ROWS IS SCRAPED POST META, NOT AUTHORED PROSE.',
    '--     The predecessor themes emit the post body as "Title <date> | Published in <category>',
    '--     <dimensions> <medium> - <price>". It is the only catalogue text that exists for these',
    '--     records, so it is carried as a starting point — but it must be rewritten by the studio',
    '--     before any row is published. That is what Q17 / the review queue is for.',
    '',
    'BEGIN;',
    '',
    '-- ---------------------------------------------------------------------------',
    '-- Section 1 — NEW records',
    `-- ${s.inserted} rows. Each lands draft = true AND enabled = false (R-02), so neither the`,
    '-- public API nor a direct anon PostgREST read can surface it before review.',
    '--',
    `-- ${s.newWithUploadableImage} of these have an image awaiting registration in Phase 3.B; image_url is`,
    '-- intentionally NULL here and set once the media step has run.',
    '-- ---------------------------------------------------------------------------',
    ''
  );

  for (const row of plan.inserts) {
    const metaEntries: [string, string][] = [
      ['archive', sqlLiteral(row.sourceArchivePath)],
      ['relPath', sqlLiteral(row.relPath)],
      ['categories', jsonbArray(row.categories)],
      ['description', sqlLiteral(row.description)],
      ['wpPostId', sqlLiteral(row.wpPostId)],
      ['publishedAt', sqlLiteral(row.publishedAt)],
    ];
    L.push(
      `-- ${row.title}`,
      `-- ${row.sourceArchivePath} · ${row.relPath} · kind=${row.kind}`,
      'INSERT INTO public.artworks (',
      '  slug, title, year, kind, narrative,',
      '  draft, enabled, archived, trashed,',
      '  source_site, source_url_path, source_archive_path,',
      '  metadata',
      ') VALUES (',
      `  ${sqlLiteral(row.slug)},`,
      `  ${sqlLiteral(row.title)},`,
      `  ${sqlLiteral(row.year)},`,
      `  ${sqlLiteral(row.kind)},`,
      `  ${sqlLiteral(row.narrative)},`,
      '  true,   -- draft: unreviewed client work (R-02)',
      '  false,  -- enabled: must not render anywhere',
      '  false,',
      '  false,',
      `  ${sqlLiteral(row.sourceSite)},`,
      `  ${sqlLiteral(row.sourceUrlPath)},`,
      `  ${sqlLiteral(row.sourceArchivePath)},`,
      `  ${jsonbObject([['wayback', jsonbObject(metaEntries, 4)]], 2)}`,
      ')',
      'ON CONFLICT (slug) DO NOTHING;',
      ''
    );
  }

  L.push(
    '-- ---------------------------------------------------------------------------',
    '-- Section 2 — EXISTS records, fill-only-empty',
    `-- ${s.updated} rows. Only ${s.yearFills} carry a year fill; the rest set provenance alone.`,
    '--',
    '-- The guard is the whole safety story (R-04). `kind` and `year` are assigned through CASE',
    '-- expressions that return the existing value when it is already set, and the WHERE clause',
    '-- skips the row entirely once provenance is recorded. An authored value cannot be overwritten',
    '-- by this file, on the first run or any run after it.',
    '-- ---------------------------------------------------------------------------',
    ''
  );

  for (const row of plan.updates) {
    const sets: string[] = [];
    if (row.year !== null) {
      sets.push(
        `  year = CASE WHEN year IS NULL OR year = '' THEN ${sqlLiteral(row.year)} ELSE year END,`
      );
    }
    sets.push(
      `  kind = CASE WHEN kind IS NULL OR kind = '' THEN ${sqlLiteral(row.kind)} ELSE kind END,`,
      `  source_site = ${sqlLiteral(row.sourceSite)},`,
      `  source_url_path = ${sqlLiteral(row.sourceUrlPath)},`,
      `  source_archive_path = ${sqlLiteral(row.sourceArchivePath)}`
    );

    const guards = ['source_site IS NULL'];
    if (row.year !== null) guards.push("(year IS NULL OR year = '')");

    L.push(
      `UPDATE public.artworks SET`,
      ...sets,
      `WHERE slug = ${sqlLiteral(row.slug)}`,
      `  AND (${guards.join(' OR ')});`,
      ''
    );
  }

  L.push(
    '-- ---------------------------------------------------------------------------',
    '-- Section 2b — KNOWN DATA-QUALITY ISSUE: stored `year` is a placeholder',
    '--',
    '-- No statements are emitted here. This section exists so the problem is visible.',
    '--',
    `-- ${s.yearMismatches} EXISTS rows carry an archive year that disagrees with the value stored in`,
    "-- artworks.year. Every one of the 138 catalog rows stores '2024' — the hardcoded default in",
    '-- POST /api/artworks (server/routes/artworks.ts:116) — so fill-only-empty cannot correct them:',
    '-- the column is not empty, it is wrong.',
    '--',
    '-- Correcting it means OVERWRITING a stored value, which R-04 forbids without an explicit owner',
    '-- decision. Nothing is planned for it here. If the owner confirms the archive year is',
    '-- authoritative, that becomes its own reviewed migration with its own dump — not a line in this',
    '-- file.',
    '--',
    '--   slug                                          stored    archive',
    '-- ---------------------------------------------------------------------------'
  );

  for (const m of plan.yearMismatches) {
    L.push(`--   ${m.slug.padEnd(44)}  ${m.storedYear.padEnd(8)}  ${m.archiveYear}`);
  }

  L.push('', '');

  L.push(
    '-- ---------------------------------------------------------------------------',
    '-- Section 3 — HELD for human adjudication (NO STATEMENTS EMITTED)',
    '--',
    '-- These rows are deliberately not acted on. The matcher output is a proposal, not a verdict',
    '-- (Q10). Adjudicate each one, then re-run `npx tsx scripts/wayback-stage-sql.ts` so the',
    '-- decision is captured in a regenerated file rather than hand-edited into this one.',
    '-- ---------------------------------------------------------------------------',
    ''
  );

  const byReason = new Map<string, HeldRow[]>();
  for (const h of plan.held) {
    const list = byReason.get(h.reason) ?? [];
    list.push(h);
    byReason.set(h.reason, list);
  }

  const reasonNotes: Record<string, string> = {
    COLLISION: 'Two source pages resolve to one canonical slug. Decide merge or distinct.',
    'KNOWN-DEDUPE':
      'Hand-flagged in PRD_V3 §2. Confirm whether this is the same work as the existing record.',
    'FUZZY-MATCH':
      'Title similarity only. Confirm the match before filling anything on the target row.',
    'DUPLICATE-SLUG': 'Two source pages in this run claimed one slug.',
    'NO-CANONICAL-SLUG': 'Classified EXISTS but carries no canonical slug — matcher defect.',
  };

  for (const [reason, rows] of byReason) {
    L.push(`-- ${reason} (${rows.length}) — ${reasonNotes[reason] ?? ''}`, '--');
    for (const h of rows) {
      L.push(
        `--   ${h.slug ?? '(no slug)'}`,
        `--     source : ${h.archive} · ${h.relPath}`,
        `--     title  : ${h.title}`,
        `--     why    : ${h.detail}`
      );
    }
    L.push('');
  }

  L.push(
    '-- ---------------------------------------------------------------------------',
    '-- Section 4 — post-conditions to verify after applying',
    '--',
    '--   SELECT count(*) FROM public.artworks WHERE draft = true AND enabled = true;',
    '--     → must be 0. The trg_artworks_draft_guard trigger also enforces this.',
    '--',
    '--   SELECT count(*) FROM public.artworks WHERE source_archive_path IS NOT NULL;',
    `--     → must be ${s.inserted + s.updated} after the first run, and unchanged on the second.`,
    '--',
    '--   Re-run this file and confirm zero rows are affected.',
    '--',
    '--   Then regenerate the client asset map and diff it in its own commit (R-11):',
    '--     npx tsx scripts/generate-asset-registry.ts',
    '-- ---------------------------------------------------------------------------',
    '',
    'COMMIT;',
    ''
  );

  return L.join('\n');
}
