# Changelog

All notable changes to the **Rory Skagen Art** studio archive and gallery project (`roryskagenart.com`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - v2.9.0 Staged Milestone
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
