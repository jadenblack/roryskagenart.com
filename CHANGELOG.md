# Changelog

All notable changes to the **Rory Skagen Art** studio archive and gallery project (`roryskagenart.com`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.10.0] - 2026-09-14

> **Phase A of [ADR 0001](docs/adr/0001-schema-as-code-before-data-migration.md)** — the blocking
> prerequisite set for the v3 data migration. The database becomes reproducible from version
> control, a rollback path exists, and the migration runner's highest-consequence decisions gain
> test coverage. Baseline: `v2.9.0` (`de294d0`).
>
> **No runtime, API, or UI changes.** The one schema-touching artifact is written to be a verified
> no-op against the live database.

### Added — Reproducible Schema
- **Baseline schema migration (`supabase/migrations/2026_09_01_baseline_core_tables.sql`):** the four
  core domain tables — `artworks`, `media_assets`, `pages`, `inquiries` — were created directly in
  the Supabase project and were **never `CREATE`d anywhere in the repo**; every other migration only
  `ALTER`ed them. This baseline captures them with all indexes, `ENABLE ROW LEVEL SECURITY`, and every
  RLS policy. It is dated `2026_09_01` so the runner's lexicographic ordering applies it **before**
  the `2026_09_12+` migrations that depend on it, and is `IF NOT EXISTS` /
  `DROP POLICY IF EXISTS` throughout so it is a no-op against the existing database. Without it,
  `run-migrations.ts` failed on a fresh project at the first `ALTER TABLE public.artworks`.
- **Live schema introspection (`scripts/introspect-schema.ts`):** read-only dump of the `public`
  schema — tables, columns, constraints, indexes, triggers, functions, RLS status, policies, row
  counts, and the applied-migration ledger — written to `data/archive/schema_introspection.md`. The
  baseline migration above is derived from this output rather than from the stale superseded draft.
- **Catalog backup (`scripts/backup-catalog.ts`):** strictly read-only (`SELECT`-only) per-table JSON
  snapshot of all 8 `public` tables plus a self-describing `manifest.json` (row counts, byte sizes,
  target, Postgres version, recorded migrations). Output lands in the gitignored `data/backups/`.
- **Backup & restore runbook (`docs/runbooks/database-backup-restore.md`):** the rollback path ADR
  0001 found missing — Supabase platform backup tiers and retention, the PITR add-on, both restore
  procedures, a pre-migration checklist, and an explicit list of known gaps.
- **Write-path test coverage (`src/test/migrationPlan.test.ts`, `src/test/migrationSafety.test.ts`):**
  23 new tests. `migrationPlan` locks down the runner's ordering and skip-if-tracked decisions;
  `migrationSafety` asserts the idempotency and reproducibility invariants across every migration
  file — including the invariant that would have caught this release's core bug: *RLS may only be
  enabled on tables that some migration actually creates.* **Suite: 64 → 87 tests.**

### Changed
- **Migration runner refactor (`scripts/run-migrations.ts`):** the pure ordering/skip logic moved to
  `scripts/lib/migrationPlan.ts` so it is unit-testable offline — the runner previously had zero
  coverage because it opens a `pg` Pool at import. It now reads the `schema_migrations` ledger once
  instead of per file. **Behaviour is unchanged**, including all console output.

### Fixed — Documentation Accuracy
- **ADR 0001 contained two unverified claims**, caught by re-reading the code against the live
  introspection and corrected: the superseded draft's `CREATE TABLE` was said to use a column name
  the code no longer uses (`series`), but `gallery_series` is in fact correct in both the live
  database and `src/`; and `sort_order` was attributed to `artworks` when it belongs to `taxonomies`.
  The stale doc's real defect is narrower and now stated precisely: it is missing exactly one column
  (`draft`), every index, and all RLS objects.

### Docs
- **`AGENTS.md`:** §5 now records that the schema *is* reproducible (replacing the warning that it was
  not), documents the new **ledger drift** finding, and corrects row counts to verified live values
  (`profiles` 2 → 3; `inquiries`/`settings`/`taxonomies` added; `artwork_terms` is **empty**). §4
  documents the introspection and backup commands; §6 adds `docs/runbooks/`, `scripts/lib/`, and
  `src/test/`; §8 adds the baseline-ordering and back-up-before-you-write rules.
- **`plan/PRD_V3_WAYBACK_DATA_MIGRATION.md`:** all three §0 blocking prerequisites ticked with
  evidence; status advanced to *prerequisites satisfied, ready for read-only Steps 0–4*.
- **`.gitignore`:** `data/backups/` ignored — logical dumps contain production data and studio
  member email addresses, and must never be committed.

### Findings recorded (not fixed in this release)
- **The `artworks` public SELECT policy does not exclude drafts.** `USING (trashed = false)` would
  expose draft rows to any holder of the anon key. It is not currently exploitable because the client
  reads through the server API (`/api/artworks`), which filters drafts — but the policy is one
  direct-PostgREST query away from leaking unpublished work. Deferred to the Phase A follow-up rather
  than changed silently here.
- **Storage objects are not covered by database backups** (Supabase backs up metadata only), and the
  project's plan tier — which determines whether automatic backups exist at all — is unverified.
  Tracked in the runbook's known-gaps table.

### Validation
- `npm run lint` (`tsc --noEmit`) clean. `npm test` — **87/87 passing across 11 files**, offline.
- **Baseline migration proven to be a production no-op.** A read-only catalog backup was taken first
  (`scripts/backup-catalog.ts` — 8 tables, 306 rows), the migration was applied to the live database,
  and the schema was re-introspected and diffed against the pre-change report. The **only** deltas
  were the migration's own ledger row and the report's generation timestamp — no column, index,
  trigger, function, RLS, or policy difference.
- **Ledger drift reconciled.** Re-running the runner then applied the two previously out-of-band
  migrations and recorded them, so `public.schema_migrations` now holds **9 of 9** files. The same
  introspection diff confirmed those re-applications changed nothing but the ledger — the drift was
  bookkeeping, not schema.

---

## [2.9.0] - 2026-09-13

> **Delivered by commits:** `406def2` (Cloudinary residue cleanup, Supabase RLS hardening, server
> modularization) · `a43fe40` (artwork drafts, autosave, shadcn/ui primitives, test suite) ·
> `8e14fda` (full-bleed home hero, profiles RLS 500 fix) · docs reconciliation (this release).
> Baseline: `v2.8.0` (`411138a`).

### Added — Home Hero Rework & Profiles RLS Fix
- **Full-Bleed Hero Backdrop Slider:** The home masthead now overlays a single full-bleed artwork slider — the active piece cover-crops the entire canvas (no letterboxing for any aspect ratio), blurred and brightness-tuned per theme with a slow settle animation. The artwork meta card is gone; the only chrome is hover ghost-arrows, an interior active-slide name pill beside progress dots (bottom-right), and pause/play. `PageHeader` remains the standard header for all other public pages (the transient `bleed`/`inset` experiment was reverted).
- **Uniform Section Rhythm:** Sections below the hero live in one inset content frame whose `space-y` owns the vertical spacing — measured 64px between every section, fixing the padding gaps introduced by earlier full-width edits.
- **Profiles RLS Recursion Fix (migration `2026_09_13_cms_v2_2_profiles_rls_recursion_fix.sql`):** `profiles_select_admin` subqueried `public.profiles` inside a policy on `profiles`, so every client profile lookup aborted with Postgres 42P17 ("infinite recursion detected in policy") and PostgREST returned HTTP 500 on session refresh. The admin/editor checks moved into `SECURITY DEFINER` helper functions (`is_admin()`, `is_admin_or_editor()`); profile queries now return 200.
### Added — Draft Workflow, Auto-Save & Sticky Modals (PRD Phase 3+, per `docs/PRD.md`)
- **Artwork Drafts:** New `draft` column (migration `2026_09_13_cms_v2_1_artwork_drafts.sql`) with partial indexes and a DB trigger enforcing that a draft can never be publicly enabled. Save-as-draft / Publish in the artwork editor, Draft badge, Drafts filter tab with count, Publish/Unpublish row-menu actions, and a dashboard Drafts stat.
- **Draft Privacy End to End:** Anonymous API reads never receive draft rows (list filter + per-slug 404); the state engine gates drafts at its single `rowToRecord` choke point (`enabled=false`), so hero, gallery, catalog counts, and slug lookups all exclude them with no per-view special cases.
- **Draft Auto-Save:** Persisted drafts save automatically ~1.2 s after typing pauses (snapshot-diffed, keystrokes batched); live status indicator (Unsaved… / Saving… / ✓ Saved / Save failed); closing the dialog flushes unsaved draft edits; create mode requires an explicit first Save-as-draft; published works are never silently auto-saved.
- **Sticky Modal Headers:** `DialogHeader` is now sticky inside the scrolling `DialogContent` across all modals — titles and the close X stay pinned while long forms scroll.
- **Actions at the Top of CRUD Modals:** Action buttons relocated from the bottom footer into the sticky header row of every admin modal — artwork editor (Cancel / Save draft / Publish·Save changes, with the autosave indicator), trash & permanent-delete confirms, user delete-confirm and invite, taxonomy delete-confirm and create, and both page dialogs. Primary buttons submit via `requestSubmit()` so keyboard and pointer share one path.
- **Zero-Token Tests for Drafts & Autosave:** 11 new contracts covering the draft lifecycle (hidden publicly, badge, publish/unpublish fire once), autosave debouncing/batching/gating, close-flush, and sticky-header rendering. Suite total as of this release: **64 tests across 9 files** (`npm test`, offline).
### Fixed
- **Unsaved-Changes Protection:** Closing a dirty non-draft edit (X, Cancel, Esc, overlay) now asks "Discard unsaved changes?" instead of silently dropping edits; drafts flush automatically; `beforeunload` covers browser/tab closes; in-app navigation reporting via `onDirtyChange`.
- **Form-Reset Race:** The artwork editor's form previously reset whenever the engine refreshed (new record object identity), wiping in-progress edits; reset is now keyed on dialog-open/slug change only.
- **Duplicate Drafts on Create:** Creating a draft then continuing to type POSTed again on save; the dialog now switches to PATCH the created record (server returns the slug; engine refresh precedes the switch).
- **Catalog Row-Click View:** Clicking anywhere on a data row opens the artwork dossier; `navigateTo` gained the missing `/artwork/<slug>` branch (previously both row-click and the View menu item were silent no-ops); row-interior switches/menus no longer double-fire.
- **Modal (X) Close Button:** Now wired to `onOpenChange` via Radix context — previously dispatched a `dialog-close-request` CustomEvent that nothing in the codebase handled, so the button was guaranteed dead.
- **Modal Scroll on Short Viewports:** Dialog content owns `max-h` + `overflow-y-auto` (upstream pattern), ending the flex-centering top-clipping geometry; per-call-site `max-h-[85vh]` patches removed from `ArtworkEditDialog` and `PagesAdminView`.
- **Row Action (Dot) Menus:** Radix portal rendering with collision detection ends menu clipping inside the table's overflow container (the real mechanism behind "menu choices don't work"); items now carry `menu`/`menuitem` roles, arrow-key navigation, typeahead, and Esc/outside dismiss with focus restore.
- **Unconfirmed Trash:** "Move to trash" now routes through a confirmation dialog (matching permanent delete) instead of deleting immediately.
- **Native Browser Dialogs:** `window.confirm`/`alert` in Users and Taxonomies admin views replaced with standard themed confirm Dialogs; no native dialogs remain in `src/`.
- **InquiryModal Stale State:** Reopening after a submit showed the "Message Sent" screen instead of the form; transient state now resets on open.
### Changed
- **shadcn/ui Registry Adoption:** `ui/dialog`, `ui/dropdown-menu`, `ui/switch`, and `ui/label` regenerated from the official Tailwind v4 registry source on Radix — replacing the hand-rolled imitations; public API of call sites kept (additive `variant`/`onSelect` migration).
- **Bespoke Overlays Retired:** `ArtworkQuickViewModal` and `InquiryModal` migrated onto the shared `ui/Dialog` (portal, focus trap, scroll lock, working close); designs preserved and hardcoded hex colors tokenized.
- **Dropdown API Canonicalized:** Call sites (`CatalogView`, `UsersAdminView`) migrated from the custom `trigger` prop to `DropdownMenuTrigger asChild` + `DropdownMenuContent`, with `onSelect` handlers and per-row `aria-label`s.

### Docs — Documentation & Context Reconciliation
- **`AGENTS.md` (new):** single verified project-context document — authoritative stack, env var
  names, DB write path, post-migration schema, and guardrails — so future contributors and agents
  stop re-deriving state from contradictory specs.
- **`plan/README.md` (new):** status index for every specification (Implemented / Superseded / Planned).
- **Spec status corrections:** `plan/PRD_V2.9_CLEANUP_AND_OPTIMIZATION.md` marked **Implemented** with
  a per-subsystem delivery map; `plan/PRD_V2.1_CLOUDINARY_EXIT.md` marked **Implemented** with a
  delivery record; `plan/DRAFT_FEATURE_PULL_REQUEST.md` marked **Superseded** (Cloudinary-era
  assumptions).
- **`plan/PRD_V3_WAYBACK_DATA_MIGRATION.md` (new):** the v3 plan for merging both archived
  predecessor sites into the Supabase catalog + media library.
- **`README.md` reconciliation:** removed the obsolete Cloudinary badge, endpoint row, and env vars
  (including the legacy `CLOUDINARY_URL` line); corrected React 18→19 and Tailwind 3→4 badges; env
  block now matches `.env.example` (`VRCL_SUPA_*`); migration list completed to 8/8; directory tree
  refreshed; `/plan` links repaired; corrected the serverless entrypoint name to `api/index.js` and
  re-scoped the payload-limit note off the retired vendor.
- **Housekeeping:** quarantined the unimported `src/data/portfolioPostsData.updated.json` to
  `data/archive/` (provenance only; no importers — verified by repo-wide search).
- **Validation:** `npm run lint` (`tsc --noEmit`) clean; `npm test` — **64/64 passing across 9 files**;
  all internal documentation links verified to resolve (two pre-existing README links repaired:
  `/plan/FEATURE_PULL_REQUEST.md` → `plan/DRAFT_FEATURE_PULL_REQUEST.md`, and a `LICENSE` link with
  no target file). Documentation-only release: no runtime, schema, or API changes.

### Chore — Repository Hygiene & Decision Records
- **Package renamed off the scaffold name:** `"react-example"` → `"roryskagenart"` in `package.json`
  and `package-lock.json` (both the root and `packages[""]` entries, so `npm ci` stays valid).
  `.workbuddy-ai/` added to `.gitignore` so local agent workspace data stays out of `git status`.
- **ADR convention introduced (`docs/adr/`):** numbered Architecture Decision Records, immutable once
  accepted. **ADR 0001** records the sequencing decision for the v3 data migration, plus the finding
  that `artworks`, `media_assets`, `pages`, and `inquiries` have **no `CREATE TABLE` anywhere in the
  repo** — the database is therefore not reproducible from version control and `run-migrations.ts`
  would fail against a fresh project. It also corrects the v3 PRD's claim that no `multer` dependency
  exists.

### Completed (previously listed under "Planned & Staged")
- **Cloudinary deletion pass — done** (`406def2`): `cloudinaryMap.ts` deleted, the `/api/cloudinary/*`
  routes and the Cloudinary upload proxy removed, the `cloudinary` npm dependency uninstalled, and the
  image resolution chain is now Supabase-only (`external URL → asset registry → SVG fallback`). Root
  mapping JSONs relocated to `data/archive/`. (`multer` is retained — it powers the Supabase Storage
  upload route, not Cloudinary; see `AGENTS.md`.)
- **Database & security hardening — done** (`2026_09_13_v2_9_security_rls_hardening.sql`): RLS enabled
  on `taxonomies`, `artwork_terms`, and `settings` with public-read and admin/editor-write policies.

---

## [2.8.0] - 2026-09-12
### Added
- **Design System & Theme Palette:** Comprehensive CSS theme token system with rich light/dark mode styling for the fine art editorial gallery.
- **Dynamic PageHeader Component:** Unified header component across public views with subtitle metadata, stats counters, and breadcrumb indicators.
- **Design Administration View:** Studio dashboard controls for live theme preview and layout preferences.
### Deployment
- **Vercel Production:** [`roryskagen-5ugjqo1bo-ventureio.vercel.app`](https://roryskagen-5ugjqo1bo-ventureio.vercel.app) (Aliased to `roryskagenart.com`, `www.roryskagenart.com`)

---

## [2.7.0] - 2026-09-12
### Fixed
- **CI/CD Build Pipeline Hardening:** Added explicit git tracking for `api/index.js` so remote Vercel CI build containers find and deploy the serverless Express backend without missing artifacts (`b5e6c3b`).

---

## [2.6.0] - 2026-09-12
### Added
- **Studio Media Library Picker:** In-modal asset browser directly querying Supabase `media_assets`.
- **Drag-and-Drop Image Uploader:** Direct-to-storage upload component for studio admins creating or updating artwork catalog entries (`8db6c44`).

---

## [2.5.0] - 2026-09-12
### Changed
- **Single Source of Truth Cutover:** Migrated the public fine art gallery and catalog views to query directly from live Supabase PostgreSQL tables (`public.artworks`, `public.pages`) rather than static mock files (`7f040c4`).
### Fixed
- Artwork slug resolution fallback for legacy numeric IDs.

---

## [2.4.0] - 2026-09-12
### Fixed
- **Vercel Serverless CommonJS Scoping:** Emitted serverless bundle as CommonJS (`.cjs`) and configured `api/package.json` with `{"type": "commonjs"}` to prevent Node.js ESM loader errors on Vercel runtime (`86d91be`, `b640e59`).
- **Routing Configuration:** Corrected `vercel.json` rewrite escapes and explicitly declared the serverless function handler (`8a165b6`).
- **Database Backfill:** Migrated legacy numeric artwork identifiers to canonical URL slugs.

---

## [2.3.0] - 2026-09-12
### Added
- **Studio Admin CMS Dashboard:** Modern administration portal (`/#/admin`) built with **shadcn/ui** primitives, Lucide icons, and Tailwind CSS (`b68b523`).
- **Studio Brand Identity:** Custom Studio Brand Icon (`R`) and streamlined header navigation.
- **Database Migrations Engine:** Idempotent migration runner (`scripts/run-migrations.ts`) and applied CMS baseline migrations in `supabase/migrations/` (`0285ce5`).
- Pull Request [#1](https://github.com/jadenblack/roryskagenart.com/pull/1) merged to `main`.

---

## [2.2.0] - 2026-09-11
### Added
- **Vercel Serverless Express Bridge:** Bundled full Express REST API using `esbuild` to run serverlessly under Vercel (`api/index.js` / `dist/server.cjs`) (`1152f18`, `ceb0674`).
- **Catalog Telemetry:** Added live catalog artwork counter and hero slider excerpt typography.
### Removed
- Removed legacy Cloudinary UI manager and client-side upload dependencies (`7be31a5`).

---

## [2.1.0] - 2026-09-11
### Added
- **Cloudinary Exit Phase 1 (Migration Pipeline):**
  - Standalone tsx migration script `scripts/migrate-cloudinary-to-supabase.ts`.
  - Automated `sharp` image pipeline pre-generating 4 standard renditions per artwork:
    - `thumb` (640w WebP, q82)
    - `hero` (1280w WebP, q85)
    - `full` (original resolution WebP, q88)
    - `lqip` (20w Base64 blur placeholder)
  - Supabase Storage bucket `artwork-images` configuration with public read access.
  - Automated ingestion into `public.media_assets` registry (152 assets migrated).
- Added the `wayback/` archive — static snapshots of the two predecessor sites (Central Texas Murals and the earlier Rory Skagen Art portfolio) — for historical portfolio integrity verification (`16f6fb2`, `9be1222`).

---

## [2.0.0] - 2026-09-10
### Added
- **Production Baseline Tag (`v2.0.0`):**
  - Integrated Supabase PostgreSQL database client and schema definitions (`47dc025`).
  - Integrated Resend email service for collector inquiry notifications (`908d105`).
  - Architectural PRD roadmap documentation (`plan/PRD_V2.1_CLOUDINARY_EXIT.md`).
- **Historical Pre-Release Features (v2.0.0-alpha / v1.x Consolidation):**
  - Native admin authentication & session vault (`105bd5d`, `b77846b`).
  - Hero slider carousel management (`fbaeccf`).
  - Studio archive rebranding & inquiry terminology unification (`2ba865c`, `72a4a75`, `86a9677`).
  - Gallery filter persistence, hidden artwork status, and trash/restore lifecycle (`40614c2`, `7789398`, `dc98365`).
  - Baseline initialization from venturepilot repository (`4a159ca`, `faa6d37`).
