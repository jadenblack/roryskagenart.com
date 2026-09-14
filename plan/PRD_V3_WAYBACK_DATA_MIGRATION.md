# PRD: v3 — Wayback Data Migration & Mural Catalog Merge

**Document ID:** `PRD-2026-V3-WAYBACK-MIGRATION`
**Target Application:** `roryskagenart.com`
**Current Baseline:** v2.9.0 (Supabase single source of truth; Cloudinary fully removed)
**Target Milestone:** v3.0.0 (both archived predecessor sites merged into the Supabase catalog + media library)
**Owner:** Rory Skagen Studio Engineering
**Status:** 🔜 Planned — ready for implementation
**Date:** September 13, 2026

> Read [`../AGENTS.md`](../AGENTS.md) first. This PRD assumes its verified state.

---

## 0. Prerequisite (blocking) — see [ADR 0001](../docs/adr/0001-schema-as-code-before-data-migration.md)

Do **not** start Step 5 (Apply) until this is satisfied:

- [ ] **Baseline schema in version control.** `artworks`, `media_assets`, `pages`, and `inquiries`
      are not `CREATE`d anywhere in the repo — the migrations only `ALTER` them. Introspect the live
      DB and commit a baseline `CREATE TABLE IF NOT EXISTS` migration so a fresh project can be built
      from the repo. (The only existing `CREATE TABLE artworks` is a **stale** block in the
      superseded `DRAFT_FEATURE_PULL_REQUEST.md` — do not copy it.)
- [ ] **Rollback path.** Document a catalog backup/restore procedure before the first write.
- [ ] **Write-path tests.** `scripts/run-migrations.ts` idempotency is an acceptance criterion (§5.5)
      but has no test today; add one before relying on it.

Steps 0–4 (validate / extract / reconcile / media / emit) are **read-only or emit-only** and may
proceed now — Step 4's output is exactly what produces the schema-fit gap list ADR 0001 calls for.

---

## 1. Objective

Merge all entries / projects / work-product from the two archived predecessor websites into the v2
studio catalog, driving the Supabase database and media library. The two sources are:

| Source | Location | Content | index.html files |
| :--- | :--- | :--- | :--- |
| Central Texas Murals (v1) | `wayback/centraltexasmurals.com-v1/` | Mural projects — `business`, `restaurant`, `museum`, `retail`, `signage`, `event`, `featured`, `home` | 118 (incl. feeds/pagination) |
| Rory Skagen Art (v1) | `wayback/roryskagen.com-v1/` | Fine art — 11 series (`the-cocktail-hours`, `ad-lands`, `monster-paintings`, `commissions-misc`, …) | 159 (incl. feeds/pagination) |

Both are static Wayback snapshots. **`wayback/` is an immutable archive — never modify it.**

---

## 2. Critical framing: this is a MERGE, not a cold seed

The DB is **already populated** (baseline ≈ 138 `artworks`, 152 `media_assets`). The fine-art
catalog already exists; **the murals are the net-new content**. Therefore:

- Extraction output must be **reconciled against live `artworks.slug`** before writing.
- Backfills must **fill only `NULL`/`''`** fields — never overwrite authored content (the same rule
  `2026_09_13_cms_v2_source_of_truth_backfill.sql` already follows).
- New mural rows land as **`draft = true`** (the DB trigger forces `enabled = false`) so nothing
  publishes until reviewed in `#/admin`.

**Canonical slug divergence** (wayback folder → DB slug) must be resolved by matching, not by
naive kebab-casing. Known examples to seed the matcher:

| Wayback path | Canonical DB slug |
| :--- | :--- |
| `commissions-misc/today` | `today-atomic-sunrise` |
| `commissions-misc/78704` | `austin-78704-south-austin-zip` |
| `commissions-misc/austin-2019` | `austin-skyline-2019` |
| `commissions-misc/the-martian-2` | `the-martian-ii` |
| `commissions-misc/the-balloon-cats-2` | `the-balloon-cats-ii` |
| `monster-paintings/regador-5` | `regador-v` |
| `monster-paintings/kelzon-5` | `kelzon-v` |
| `ad-lands/issy` | `issy-the-atomic-companion` |
| `2010/2010` | `2010-rendezvous-in-chinatown` |
| `business/marcia-ball-cd-cover` ↔ `commissions-misc/marcia-ball` | dedupe pair |
| `featured/austin-postcard-mural` ↔ `commissions-misc/austin-postcard` | dedupe pair |

---

## 3. Pipeline

**Step 0 — Validate (read-only).**
- `rg -i cloudinary src/ server/` → expect only provenance/comment hits.
- `SELECT count(*) FROM public.artworks;` and `... FROM public.media_assets WHERE renditions IS NOT NULL;`
- `SELECT slug FROM public.artworks ORDER BY slug;` → build the canonical-slug map.

**Step 1 — Extract** (per content page; skip `feed/`, `page/`, `comments/`, `wp-json/`,
`wp-content/`, `wp-includes/`, and category-archive indexes).
Fields: `source_site`, `source_url_path`, `wp_post_id`, `title`, `description`, `narrative`,
`categories`, `series`, `published_at`/`modified_at`, `year`, `status` (`SOLD` marker),
`medium`/`dimensions` (regex from narrative), `images[]` (strip the
`//web.archive.org/web/<ts>/` prefix).

**Step 2 — Reconcile** against live DB slugs (exact → fuzzy title ≥ 0.85 → shared image public_id).
Classify **NEW / EXISTS / COLLISION**; use the divergence map in §2.

**Step 3 — Media.** Resolve each image against `media_assets` by public_id / filename basename
(case-insensitive, strip `-copy` / size suffixes). Missing → render `thumb`/`hero`/`full`/`lqip`
with `sharp`, upload to `artwork-images/{slug}/`, upsert `media_assets` (`public_id = slug`,
`artwork_slug = canonical slug`), then run `scripts/generate-asset-registry.ts`.

**Step 4 — Emit** (no live writes):
- `data/archive/wayback_extraction.json` — normalized records
- `data/archive/wayback_reconcile_report.md` — NEW / EXISTS / COLLISION counts, unresolved images, slug map
- `supabase/migrations/<date>_wayback_murals_backfill.sql` — idempotent backfill:
  `INSERT … ON CONFLICT (slug) DO NOTHING` (draft rows) + `UPDATE … WHERE col IS NULL OR col=''`
  + `taxonomies` / `artwork_terms` for mural categories; `image_url` = filename ref

**Step 5 — Apply** via `npx tsx scripts/run-migrations.ts <file>` (idempotent, tracked in
`public.schema_migrations`).

---

## 4. Agent prompt (copy-paste)

```
ROLE
Data-migration engineer for the "roryskagenart.com v2 Studio" app. Parse two local Wayback
HTML archives, reconcile them against the LIVE Supabase catalog, and emit an idempotent merge.

STACK FACTS (verified — do not use Cloudinary)
- Media + DB are Supabase-only. No `cloudinary` dependency exists (`multer` remains, but only for
  the Supabase Storage upload route — see AGENTS.md; it is not a Cloudinary leftover).
- Write path: `pg` Pool script applied via `npx tsx scripts/run-migrations.ts <file>` (idempotent,
  tracked in public.schema_migrations). Alt: `getSupabaseAdmin()` in src/server/db.ts (service role).
- Media: Supabase Storage bucket `artwork-images`; renditions thumb/hero/full/lqip via `sharp`;
  registry row in `public.media_assets`; regenerate src/data/assetRegistry.ts via
  `npx tsx scripts/generate-asset-registry.ts`.

INPUTS
- MURAL archive:  wayback/centraltexasmurals.com-v1/
- FINE-ART archive: wayback/roryskagen.com-v1/
- Canonical slugs: `SELECT slug FROM public.artworks` (DB slugs WIN)

STEP 1 — EXTRACT (skip feed/, page/, comments/, wp-json/, wp-content/, wp-includes/, and
category-archive indexes murals/<cat>/ and portfolio/<cat>/)
  source_site, source_url_path, wp_post_id, title (<h2>), description (meta|og:description),
  narrative (entry/body text, HTML stripped), categories (a[rel="category tag"]), series,
  published_at/modified_at, year, status ("SOLD" marker), medium/dimensions (regex from narrative),
  images[] (strip "//web.archive.org/web/<ts>/").

STEP 2 — RECONCILE (MERGE, not seed)
  canonical_slug = match in order: exact DB slug -> fuzzy title >= 0.85 -> shared image public_id.
  Classify NEW / EXISTS / COLLISION. Seed hints: today->today-atomic-sunrise,
  78704->austin-78704-south-austin-zip, austin-2019->austin-skyline-2019, regador-5->regador-v,
  kelzon-5->kelzon-v, the-martian-2->the-martian-ii, the-balloon-cats-2->the-balloon-cats-ii,
  isty/issy->issy-the-atomic-companion, 2010->2010-rendezvous-in-chinatown, marcia-ball &
  austin-postcard (dedupe pairs).
  NEVER overwrite non-empty DB fields — fill only NULL/''.

STEP 3 — MEDIA
  Resolve images against media_assets (public_id / filename basename, case-insensitive, strip
  "-copy"/size suffixes). Missing -> render thumb/hero/full/lqip with sharp, upload to
  artwork-images/{slug}/, upsert media_assets (public_id=slug, artwork_slug=canonical slug).
  Then re-run generate-asset-registry.ts.

STEP 4 — EMIT (no live writes)
  a) data/archive/wayback_extraction.json
  b) data/archive/wayback_reconcile_report.md
  c) supabase/migrations/<date>_wayback_murals_backfill.sql  (idempotent; INSERT ON CONFLICT DO
     NOTHING for NEW as draft=true, enabled=false; UPDATE ... WHERE col IS NULL OR col='' for
     EXISTS; taxonomies + artwork_terms for mural categories; image_url = filename ref)

QUALITY GATES
  - Mural rows land draft=true; fine-art merges never flip published rows.
  - Report NEW vs EXISTS; zero destructive writes; wayback/ untouched.
  - `npx tsx scripts/run-migrations.ts <sql>` re-runs with zero mutations.
```

---

## 5. Acceptance criteria

1. Extraction covers 100% of content pages in both archives; report lists any page with no title/image.
2. Reconcile report enumerates every NEW / EXISTS / COLLISION row with its canonical slug.
3. Mural rows are `draft = true` and invisible to anonymous API reads.
4. No non-empty `artworks` field is overwritten.
5. `npx tsx scripts/run-migrations.ts <file>` is idempotent (second run mutates nothing).
6. `npm run lint` (`tsc --noEmit`) stays clean; `wayback/` is unmodified.

---

## 6. Risks & mitigations

| Risk | Mitigation |
| :--- | :--- |
| Slug collision across the two sites | Fuzzy + image-based matching; COLLISION class routed to human review |
| Murals accidentally published | `draft = true` + DB trigger forcing `enabled = false` |
| Missing mural images (not in Cloudinary registry) | Report `needs_upload`; render + upload in Step 3 |
| Overwriting authored fine-art narratives | Fill-only-empty rule enforced in the generated SQL |
