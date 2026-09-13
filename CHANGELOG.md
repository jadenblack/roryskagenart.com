# Changelog

All notable changes to the **Rory Skagen Art** studio archive and gallery project (`roryskagenart.com`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
### Added — Draft Workflow, Auto-Save & Sticky Modals (PRD Phase 3+, per `docs/PRD.md`)
- **Artwork Drafts:** New `draft` column (migration `2026_09_13_cms_v2_1_artwork_drafts.sql`) with partial indexes and a DB trigger enforcing that a draft can never be publicly enabled. Save-as-draft / Publish in the artwork editor, Draft badge, Drafts filter tab with count, Publish/Unpublish row-menu actions, and a dashboard Drafts stat.
- **Draft Privacy End to End:** Anonymous API reads never receive draft rows (list filter + per-slug 404); the state engine gates drafts at its single `rowToRecord` choke point (`enabled=false`), so hero, gallery, catalog counts, and slug lookups all exclude them with no per-view special cases.
- **Draft Auto-Save:** Persisted drafts save automatically ~1.2 s after typing pauses (snapshot-diffed, keystrokes batched); live status indicator (Unsaved… / Saving… / ✓ Saved / Save failed); closing the dialog flushes unsaved draft edits; create mode requires an explicit first Save-as-draft; published works are never silently auto-saved.
- **Sticky Modal Headers:** `DialogHeader` is now sticky inside the scrolling `DialogContent` across all modals — titles and the close X stay pinned while long forms scroll.
- **Actions at the Top of CRUD Modals:** Action buttons relocated from the bottom footer into the sticky header row of every admin modal — artwork editor (Cancel / Save draft / Publish·Save changes, with the autosave indicator), trash & permanent-delete confirms, user delete-confirm and invite, taxonomy delete-confirm and create, and both page dialogs. Primary buttons submit via `requestSubmit()` so keyboard and pointer share one path.
- **Zero-Token Tests for Drafts & Autosave:** 11 new contracts covering the draft lifecycle (hidden publicly, badge, publish/unpublish fire once), autosave debouncing/batching/gating, close-flush, and sticky-header rendering (55 tests total).
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

### Planned & Staged (per `PRD_V2.1_CLOUDINARY_EXIT.md`)
- **Cloudinary Deletion Pass:**
  - Remove legacy `cloudinaryMap.ts` (765 lines) and frozen fallback resolution.
  - Delete `/api/cloudinary/*` routes (`status`, `resources`, `upload`, `delete`) and multer proxy.
  - Uninstall `cloudinary` npm dependency.
  - Clean up root mapping JSON files (`all_cloudinary_assets.json`, `precise_cloudinary_registry_mapping.json`, etc.).
- **Database & Security Hardening:**
  - Enable Row Level Security (RLS) on `public.taxonomies`, `public.artwork_terms`, and `public.settings` with explicit public-read and admin-write policies.

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
- Added `.wayback` archive references for historical portfolio integrity verification.

---

## [2.0.0] - 2026-09-10
### Added
- **Production Baseline Tag (`v2.0.0`):**
  - Integrated Supabase PostgreSQL database client and schema definitions (`47dc025`).
  - Integrated Resend email service for collector inquiry notifications (`908d105`).
  - Architectural PRD roadmap documentation (`plan/DRAFT_PRD_V2_MIGRATION.md`, `plan/PRD_V2.1_CLOUDINARY_EXIT.md`).
- **Historical Pre-Release Features (v2.0.0-alpha / v1.x Consolidation):**
  - Native admin authentication & session vault (`105bd5d`, `b77846b`).
  - Hero slider carousel management (`fbaeccf`).
  - Studio archive rebranding & inquiry terminology unification (`2ba865c`, `72a4a75`, `86a9677`).
  - Gallery filter persistence, hidden artwork status, and trash/restore lifecycle (`40614c2`, `7789398`, `dc98365`).
  - Baseline initialization from venturepilot repository (`4a159ca`, `faa6d37`).
