# Product Requirements Document (PRD): Cloudinary Exit — Consolidation onto Supabase Storage (v3.1 – v3.4)

**Document ID:** `PRD-2026-V3-CLOUDINARY-EXIT`
**Target Application:** `roryskagenart.com`
**Current Baseline:** v2.x (Monolithic SPA, Hybrid Express/Vite, Supabase PostgreSQL + Cloudinary CDN)
**Target Milestone:** v3.4.0 (Single-vendor media stack: Supabase Storage + PostgreSQL, Cloudinary fully removed)
**Owner:** Rory Skagen Studio Engineering
**Status:** Approved / Ready for Staging
**Last Updated:** September 11, 2026
**Supersedes (media scope only):** `PRD-2026-V2-MIGRATION` asset-management assumptions

---

## 1. Executive Summary & Vision

### 1.1 Objective

Exit Cloudinary entirely and consolidate all media serving, storage, and upload onto the Supabase project the application already depends on for its database and authentication. After v3.4 the application has exactly **one external vendor dependency** (Supabase) for data, auth, and media.

This is not a lift-and-shift. A naive mirror of Cloudinary onto Supabase Storage would either (a) pay Supabase's runtime image-transformation fee forever on images that never change, or (b) reproduce the current worst defect — a catalog that ships megabytes of un-resized originals to the browser. The strategy below avoids both: **pre-generated renditions**, produced once at migration time and at every future upload, replace runtime transformations outright.

### 1.2 Why this is the right architecture for this specific catalog

The product reality drives the design:

- The catalog is **static art photography**. An image is uploaded once per artwork and never re-rendered. There is no user-generated content, no on-the-fly crop matrix, no per-device art direction. Runtime transformation services bill monthly (Supabase: $5 per 1,000 origin images/month) for capability this catalog will never use.
- The application is already **Supabase-native** for every other concern. A second media vendor buys nothing except a second bill, a second SDK, a second failure mode, and — as the current code demonstrates — a second source of truth.
- The catalog is **small**. Verified inventory: 151 images, 32.8 MB total. Pre-generating three renditions each (~2,300 files, roughly 100 MB stored) is trivially cheap and removes all per-request transformation cost and latency.

### 1.3 Guiding Principles

* **Zero broken images at any point.** Every stage ships with a fallback path; Cloudinary is not turned off until Supabase has served 100% of traffic for a full week.
* **No runtime transformation billing.** Renditions are generated with `sharp` at write time, never at request time.
* **One owner for asset identity.** Postgres (`media_assets`) becomes the single registry; the hand-maintained client-side alias map is deleted, not ported.
* **Delete as you go.** Each stage removes the vendor surface it replaces; the final stage is a pure deletion stage.

---

## 2. Verified Baseline (as of September 11, 2026)

All figures measured against the live app, database, and repository — not estimated.

| # | Fact | Evidence |
| :-- | :--- | :--- |
| B1 | **151 Cloudinary assets, 32.8 MB total**, largest ~1 MB | `all_cloudinary_assets.json` (publicId, format, version, width, height, bytes, url per asset) |
| B2 | **Zero** `artworks` rows store a Cloudinary URL in `image_url` | Direct SQL: 0 rows match `%cloudinary%` |
| B3 | 100% of image resolution is **client-side**, via `src/data/cloudinaryMap.ts` — a **765-line hand-maintained alias map** averaging ~5 aliases per image (e.g. `"Tuffy-and-the-imaginary-fly-cat-head-copy"`, `"...-copy.jpg"`, and `"tuffyandtheimaginaryflycatheadcopy"` → one URL) | `CLOUDINARY_ASSETS_MAP` + `resolveCloudinaryUrl()` |
| B4 | `resolveCloudinaryUrl` has exactly **4 call sites**: `galleryStateEngine.resolveImagePath`, `HomeLandingView.resolveImageUrl`, `AboutView`, `driveFileSystem` | Code search |
| B5 | Supabase project `orphcusijzkxpxkzapjp` has **Storage API live with zero buckets** | `storage.listBuckets()` → `[]` |
| B6 | `public.media_assets` table **exists and is empty of consumers** — 12 columns incl. `public_id, url, thumbnail_url, bytes, width, height, folder, artwork_slug`; no code path reads it | information_schema; zero code references |
| B7 | User-facing symptom: **122 of 137 catalog images still pending after 12+ seconds** — every card requests its full-resolution original, ~70 MB per catalog view, no transforms, no pagination | Live browser probe, network log |
| B8 | A parallel stale seed exists (`src/data/mediaAssetsData.ts`, 175 records) that nothing reads | Code search |
| B9 | Upload path today: browser → Express (multer, 30 MB limit) → Cloudinary SDK, plus env-sanitization shims for Cloudinary quirks in `server.ts` | `server.ts` lines 30–160, `/api/cloudinary/upload` |

**Scope of Cloudinary surface to remove by v3.4:** `cloudinaryMap.ts` (765 lines), `/api/cloudinary/*` routes (status, resources, upload, delete), `cloudinary` npm dependency, `multer` memory-upload proxy, `sanitizeCloudinaryEnv()` shim, `CloudinaryManager` view, and the root-level mapping JSON files (`all_cloudinary_assets.json`, `confirmed_image_mappings.json`, `precise_cloudinary_registry_mapping.json`, `user_*_parsed.json`, `user_post_to_image_map.json`, `verified_posts_full.json`).

---

## 3. Strategy: Pre-Generated Renditions, Strangler Cutover

### 3.1 Rendition contract (replaces runtime transformations)

Every migrated image gets exactly three renditions plus one placeholder, all generated at write time with `sharp`, stored in the same bucket:

| Rendition | Spec | Consumed by |
| :--- | :--- | :--- |
| `thumb.webp` | width 640, `q 80`, `f auto`-equivalent (webp) | Catalog grid cards, search results |
| `hero.webp` | width 1280, `q 82` | Home hero slider, artwork detail page |
| `full.webp` | width 2048 (upscale never), `q 85` | Lightbox / zoom inspector only |
| `lqip.webp` | width 20, base64 data-URI stored in `media_assets.lqip` | Aspect-ratio blur-up placeholder before load |

Originals are archived in the bucket under `{slug}/original.{ext}` for provenance and future re-rendering. Rendition sizes are code constants in one module (`src/data/renditions.ts`); changing a size is a re-run of the batch script, not a code hunt.

**Expected effect (from B7):** catalog grid payload drops from ~70 MB of originals to roughly 640px thumbs ≈ **5–8 MB total, first paint within ~1–2 s on broadband**.

### 3.2 Storage layout and access model

```
bucket: artwork-images            (public read, service-role-only write)
  {slug}/original.{ext}           archival original, untouched bytes
  {slug}/thumb.webp
  {slug}/hero.webp
  {slug}/full.webp
```

- Public bucket — these images are the public gallery; there is nothing to gate.
- Write operations (upload, overwrite, delete) go through service-role server code only, behind the admin auth middleware from the v2 audit remediation (dependency, see §6).
- `media_assets` is the registry of record: one row per source image, keyed on `public_id = slug`, holding rendition paths, dimensions, bytes, lqip, and `artwork_slug` linkage.

### 3.3 Dual-read cutover (no broken images, ever)

`resolveImagePath` (the single choke point, B4) is rewired to a resolution chain, not a swap:

1. `assetRegistry` hit → serve Supabase rendition URLs.
2. Miss → existing Cloudinary resolution (frozen, unedited) → log a warning with the slug (telemetry for migration completeness).
3. Miss → existing SVG fallback.

Cloudinary is deleted only after the stage-3.4 gate: **zero registry misses for 7 consecutive days** in production logs.

---

## 4. Staged Plan

| Stage | Version | Deliverable | Removes | Dependency |
| :--- | :--- | :--- | :--- | :--- |
| 1 | v3.1 | Migration script + bucket + `media_assets` registry populated | — (additive) | none |
| 2 | v3.2 | `assetRegistry.ts` + resolution-chain swap + rendition wiring in UI | nothing yet (dual-read) | v3.1 |
| 3 | v3.3 | Direct browser→Storage uploads + Studio Media Manager view | `/api/cloudinary/upload` proxy | v3.2, admin auth middleware |
| 4 | v3.4 | Cloudinary deletion pass | everything in §2 scope list | v3.3 + 7-day serving gate |

---

## 5. Stage Detail

### v3.1 — Migration Script, Bucket, and Registry Population

**Builds:**

- `artwork-images` public bucket (idempotent setup in the script itself).
- `scripts/migrate-cloudinary-to-supabase.ts` (~200 lines, tsx-runnable):
  1. Read `all_cloudinary_assets.json` (authoritative manifest, B1).
  2. Derive canonical `slug` from `publicId` (lowercase, trim `-copy` suffixes, strip extensions — the same normalization `resolveCloudinaryUrl` already applies).
  3. Download original → `sharp` render the four renditions (§3.1).
  4. Upload to the bucket layout (§3.2).
  5. Upsert `media_assets` row: `public_id` (slug), `url` (hero path), `thumbnail_url` (thumb path), `width`/`height` from original, `bytes` (original), `folder` (`artwork-images`), `artwork_slug` (linked when an artwork matches), plus `lqip` and per-rendition metadata via `metadata jsonb`.
  6. **Dry-run mode** (`--dry-run` prints the full plan, writes nothing) and **idempotent re-run** (upsert on `public_id`; skip download when all four renditions already exist and bytes match).
- SQL migration file `supabase/migrations/2026_09_v3_media_assets_extend.sql`: add `lqip text`, `renditions jsonb`, `updated_at` trigger if absent.

**Acceptance:**

- 151/151 assets migrated, verified by count query + spot-check of 5 images across renditions.
- Re-running the script with no manifest change performs zero mutations (idempotency test).
- `--dry-run` output reviewed before first real run.

### v3.2 — Registry Swap and Rendition Wiring

**Builds:**

- `src/data/assetRegistry.ts`: `slug → { thumb, hero, full, lqip, width, height }` map. Generated at build time from `media_assets` by a small `scripts/generate-asset-registry.ts` (keeps the client bundle free of a network fetch on cold start; the map is ~151 entries).
- Rewire the exact 4 call sites (B4) to consume `assetRegistry` first, then the frozen Cloudinary path, then SVG fallback — per §3.3.
- UI wiring: catalog cards → `thumb`; hero slider + artwork focus → `hero`; lightbox/zoom → `full`; every `<img>` gains `width`/`height` (from the registry) and an LQIP blur-up background.
- Miss-logging shim (`console.warn('[asset-migration] cloudinary fallback:', slug)`) behind a flag, grep-able for the v3.4 gate.

**Acceptance:**

- Catalog grid: all 137 cards load their images in **< 3 s** on broadband (measured, not assumed — same probe method as B7).
- Zero broken images across home / catalog / detail / lightbox / about.
- `tsc --noEmit` clean; visual parity confirmed on light + dark themes.

### v3.3 — Direct Uploads and Studio Media Manager

**Builds:**

- Storage IAM: public-read, service-role-write policies on `artwork-images` (SQL migration).
- Upload flow: browser requests a short-TTL signed upload URL from a new `POST /api/media/upload-ticket` (admin-authenticated), then PUTs the file **directly to Storage**; the server registers metadata in `media_assets` and triggers the same `sharp` rendition pipeline (moved into `server/renderRenditions.ts`, shared with the v3.1 script).
- New `MediaManagerView` (replaces `CloudinaryManager`): grid of `media_assets` with upload, re-render-renditions, and delete (delete removes all renditions + row).
- Delete `/api/cloudinary/upload` and the multer pipeline; drop the 30 MB server hop.

**Acceptance:**

- Admin upload of a 15 MB original completes with renditions present and registered; non-admin request to `/api/media/*` is rejected 401.
- Old Cloudinary uploads are no longer possible anywhere in the app.

### v3.4 — Cloudinary Deletion Pass

**Gate (all must hold):**

1. ≥ 7 consecutive days of production logs with **zero** `[asset-migration] cloudinary fallback` warnings.
2. `MediaManagerView` in daily use; no open complaints of missing images.

**Deletes:**

- `src/data/cloudinaryMap.ts`, `CloudinaryManager.tsx`, `/api/cloudinary/*` routes, `sanitizeCloudinaryEnv()`, `cloudinary` + `multer` dependencies, root mapping JSONs (B8/B9 scope list), and `.env` Cloudinary variables from `.env.example`.

**Acceptance:**

- `rg -i cloudinary src/ server/` → zero hits; `package.json` free of `cloudinary`/`multer`.
- Bundle-size delta recorded (expect the removal of the ~30 KB alias map plus SDK surface).
- `public.media_assets` count query remains 151+ and healthy.

---

## 6. Dependencies & Sequencing Notes

- **Admin auth middleware (v2 audit finding #1) must land before v3.3** — media mutation endpoints must never be anonymous. v3.1 and v3.2 are safe without it (read-only serving + script-time service-role writes).
- The Vercel-vs-Express deployment reconciliation (v2 PRD) is **not** a dependency of this PRD; the migration script and rendition pipeline run in the existing Express/tsx environment.
- `src/data/mediaAssetsData.ts` (B8) is deleted in v3.2 when `assetRegistry` replaces it — no migration of its stale content.
- One intentional follow-up to scope in stage v3.2: `tsc --noEmit` flags an existing unused-variable error in `CloudinaryManager.tsx` that predates this PRD; the v3.3 replacement of that view resolves it naturally, so stages v3.1–v3.2 should ship with that known finding unless an earlier cleanup pass prefers to fix it.

## 7. Risks & Rollback

| Risk | Mitigation |
| :--- | :--- |
| Slug normalization mismatches an alias the UI still requests | Dual-read chain keeps Cloudinary serving; miss log surfaces every gap before deletion gate |
| Supabase egress on Pro (250 GB/mo) | Post-migration catalog traffic ≈ 6–8 MB/visit; would need ~30k catalog views/mo to approach limits — monitor in stage 2 |
| sharp rendering anomalies on odd sources | Originals archived in-bucket; re-render is a script re-run with adjusted constants |
| Broken image during cutover window | Impossible by construction: resolution chain never removes a working source |
| Full rollback | Stage 2 is a resolution-order change — reverting one import restores Cloudinary-first behavior; nothing is deleted until v3.4 |

## 8. Out of Scope

- Runtime on-the-fly transforms (rejected deliberately — see §1.2).
- Video/media other than static images (catalog has none).
- Admin authentication (separate remediation PRD, hard dependency only for v3.3).
- Database schema changes beyond `media_assets` extensions.
- Any change to inquiries, auth, or page content systems.
