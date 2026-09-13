# Product Requirements Document (PRD): v2.9 Cleanup, Security Hardening & Architecture Optimization

**Document ID:** `PRD-2026-V2.9-CLEANUP-OPTIMIZATION`  
**Target Application:** `roryskagenart.com`  
**Current Baseline:** v2.8.0 (Supabase single source of truth for gallery & CMS, Vercel serverless Express bundle, Cloudinary data fully migrated)  
**Target Milestone:** v2.9.0 (Complete Cloudinary decommissioning, dead code & legacy mock elimination, RLS security remediation, server modularization, and bundle optimization)  
**Owner:** Rory Skagen Studio Engineering  
**Status:** Ready for Implementation  
**Date:** September 12, 2026  

---

## 1. Executive Summary & Vision

### 1.1 Context & Objective
With all catalog artwork images, renditions, and records successfully migrated to **Supabase Storage** (`artwork-images` bucket) and **Supabase PostgreSQL** (`media_assets`, `artworks`, `pages`), Cloudinary is no longer actively serving traffic. However, substantial legacy residue remains embedded across the project:
1. **Residual Cloudinary Code & Packages:** 765-line `cloudinaryMap.ts`, 4 unused `/api/cloudinary/*` endpoints, `multer` 30MB memory buffer, and the `cloudinary` npm package.
2. **Root-Level JSON Migration Dumps:** 7 legacy mapping files (~250 KB) cluttering the root directory.
3. **Massive Static Mock Arrays:** `portfolioPostsData.ts` (3,000+ lines of static JSON) and `mediaAssetsData.ts` inflating client bundle size even though Supabase is the single source of truth.
4. **Dual Authentication Systems:** A legacy file-based auth system (`authService.ts` writing to `data/auth_store.json` and rewriting `.env`) lingering alongside Supabase Auth.
5. **Security Vulnerabilities:**
   - Supabase MCP advisory: RLS is disabled on 3 public tables (`taxonomies`, `artwork_terms`, `settings`).
   - Hardcoded fallback secrets in `server.ts` (default API keys and anon JWTs).
6. **Monolithic Backend:** `server.ts` is 1,467 lines long, mixing routing, middleware, database pooling, and static file serving in a single file.

**Goal:** v2.9 will transform the repository into a clean, modern, zero-technical-debt codebase with a single external backend dependency (Supabase), modular route controllers, hardened database policies, and a lean client JavaScript bundle.

---

## 2. Deep Code Graph & Architectural Analysis

### 2.1 System Architecture Graph

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT BROWSER                                       |
|                                                                                         |
|   [ Public Fine Art Gallery ]                   [ Studio Admin CMS (/#/admin) ]         |
|   - HeroGallerySlider.tsx                       - AdminApp.tsx & AdminLayout.tsx        |
|   - GalleryGrid.tsx & ArtworkFocusView.tsx      - CatalogView.tsx (shadcn/ui DataTable) |
|   - AboutView.tsx & ContactView.tsx             - MediaPicker.tsx & MediaAdminView.tsx  |
|   - Theme Palette & PageHeader.tsx              - PagesAdminView.tsx & SettingsAdminView|
+------------------------------------+------------------------------------+---------------+
                                     |                                    |
                        Direct Read  |                       Supabase Auth| Client SDK
                        (REST / CDN) |                       & Admin APIs |
                                     v                                    v
+-----------------------------------------------------------------------------------------+
|                                  VERCEL EDGE & SERVERLESS                               |
|                                                                                         |
|   Static Assets Edge CDN (/dist)               Serverless Function (api/index.js)       |
|   - Vite production bundle                     - Express REST API (CJS bundle)          |
|   - Zero Node.js runtime for HTML/CSS/JS       - resolveCmsUser & requireRole auth      |
|                                                - Modular Controllers (Artworks, Pages,  |
|                                                  Taxonomies, Media, Settings, Inquiries)|
+-------------------------------------------------------------------------+---------------+
                                                                          |
                                                        pg Pool / REST SDK|
                                                                          v
+-----------------------------------------------------------------------------------------+
|                                     SUPABASE CLOUD                                      |
|                                                                                         |
|   [ PostgreSQL 17 Database ]                   [ Supabase Storage ]      [ Auth ]       |
|   - public.artworks (138 rows) [RLS]           - Bucket: artwork-images  - Studio Admin |
|   - public.media_assets (152 rows) [RLS]         * /thumb (640w WebP)    - RBAC Profiles|
|   - public.pages (4 rows) [RLS]                  * /hero  (1280w WebP)   - Session JWT  |
|   - public.profiles (2 rows) [RLS]               * /full  (Original WebP)               |
|   - public.taxonomies [RLS TO FIX]               * /lqip  (Base64 Blur)                 |
|   - public.artwork_terms [RLS TO FIX]                                                   |
|   - public.settings [RLS TO FIX]                                                        |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Findings & Audit Matrix

| Category | Finding | Impact / Risk | Target Resolution in v2.9 |
| :--- | :--- | :--- | :--- |
| **Security** | Supabase MCP Advisory: RLS disabled on `taxonomies`, `artwork_terms`, `settings` | Critical: Anonymous clients can read/write/delete configuration and taxonomy data. | Create SQL migration enabling RLS and applying explicit SELECT / Admin policies. |
| **Security** | Hardcoded fallback JWT and Cloudinary credentials in `server.ts` | Medium: Leaked secrets in git history; potential unauthorized fallbacks. | Remove hardcoded fallbacks; fail fast with descriptive startup error if env vars missing. |
| **Tech Debt** | Residual Cloudinary SDK, routes, and `multer` proxy in `server.ts` | Medium: Unneeded dependencies (30MB memory buffer, `cloudinary` package, dead routes). | Remove `cloudinary` & `multer` from `package.json`, delete `/api/cloudinary/*` routes. |
| **Tech Debt** | Legacy root-level JSON mapping files (`all_cloudinary_assets.json`, etc.) | Low: 250 KB of obsolete migration artifacts cluttering root directory. | Delete root JSON files or move to archived `data/archive/`. |
| **Tech Debt** | Redundant 3,000-line mock registry (`portfolioPostsData.ts`, `mediaAssetsData.ts`) | High: Bloats bundle size and causes confusion on source of truth. | Remove mock data arrays; rely on lightweight fallback skeletons during hydration. |
| **Tech Debt** | Legacy local file auth service (`authService.ts`, `data/auth_store.json`) | Medium: Dead code with dangerous file writes (`syncEnvFiles`) to `.env`. | Delete `src/server/authService.ts` and legacy `/api/auth/*` endpoints. |
| **Architecture** | Monolithic `server.ts` (1,467 lines) | Medium: Difficult to maintain, test, and trace serverless API handlers. | Refactor `server.ts` into modular controllers under `server/routes/`. |
| **Performance** | Non-code-split `/admin` suite in public bundle | Medium: First-paint bundle includes heavy shadcn tables and Lucide icon suite. | Lazy load `AdminApp` via `React.lazy()` so collectors download zero admin code. |

---

## 4. Subsystems & Detailed Scope of Work

### 4.1 Subsystem 1: Decommission Cloudinary Residue
- **Remove Packages:**
  ```bash
  npm uninstall cloudinary multer @types/multer
  ```
- **Delete Files:**
  - `src/data/cloudinaryMap.ts` (765 lines)
- **Update `src/data/assetResolver.ts`:**
  - Remove `import { resolveCloudinaryUrl } from './cloudinaryMap'`.
  - Simplify resolution chain:
    1. Supabase Storage / Asset Registry hit $\rightarrow$ serve rendition URL.
    2. External direct URL $\rightarrow$ pass-through.
    3. Fallback $\rightarrow$ SVG generator.
  - Remove obsolete `[asset-migration] cloudinary fallback` warnings.
- **Update `src/types/index.ts`:**
  - Remove `CloudinaryResource` and `CloudinaryStatus` interfaces.
  - Simplify `MediaAsset.source` to `'supabase'`.

### 4.2 Subsystem 2: Root Directory & Legacy Mock Purge
- **Delete Root-level JSON mapping artifacts:**
  - `all_cloudinary_assets.json`
  - `confirmed_image_mappings.json`
  - `precise_cloudinary_registry_mapping.json`
  - `user_media_parsed.json`
  - `user_post_to_image_map.json`
  - `user_posts_parsed.json`
  - `verified_posts_full.json`
- **Clean up Mock Data Files:**
  - `src/data/mediaAssetsData.ts` (Delete)
  - `src/data/driveFileSystem.ts` (Delete)
  - `src/components/MasterRegistryTable.tsx` & `src/components/TrashView.tsx` (Retire or replace with Admin CMS equivalents)
  - Streamline `src/data/portfolioPostsData.ts` to export only necessary types or minimal placeholder constants, eliminating 3,000 lines of static JSON.

### 4.3 Subsystem 3: Auth Consolidation & Dead Endpoint Removal
- **Delete `src/server/authService.ts`:** Completely remove local crypto hashing, `data/auth_store.json`, and `.env` writeback functions.
- **Purge Obsolete Server Routes in `server.ts`:**
  - `/api/auth/status`
  - `/api/auth/me`
  - `/api/auth/login`
  - `/api/auth/default-login`
  - `/api/auth/register`
  - `/api/auth/forgot-password`
  - `/api/auth/reset-password`
  - `/api/auth/logout`
  - `/api/auth/change-password`
  *(All authentication is handled directly by client Supabase SDK via `AuthContext.tsx` and verified on the server via `resolveCmsUser` JWT token validation).*

### 4.4 Subsystem 4: Security Remediation & RLS Migration
- **New Migration:** `supabase/migrations/2026_09_13_v2_9_security_rls_hardening.sql`:
  ```sql
  -- 1. Enable RLS on all unshielded tables
  ALTER TABLE public.taxonomies ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.artwork_terms ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

  -- 2. Public Read Policies (Showcase data)
  CREATE POLICY "Public read taxonomies"
    ON public.taxonomies FOR SELECT USING (true);

  CREATE POLICY "Public read artwork_terms"
    ON public.artwork_terms FOR SELECT USING (true);

  CREATE POLICY "Public read settings"
    ON public.settings FOR SELECT USING (true);

  -- 3. Admin / Editor Mutation Policies
  CREATE POLICY "Admins manage taxonomies"
    ON public.taxonomies FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'editor')
    ));

  CREATE POLICY "Admins manage artwork_terms"
    ON public.artwork_terms FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'editor')
    ));

  CREATE POLICY "Admins manage settings"
    ON public.settings FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));
  ```
- **Secrets Sanitization:**
  - Remove all inline fallback strings (`'eyJhbGciOiJIUzI1NiIsInR5cCI6...'`, etc.) in `server.ts` and `src/server/db.ts`. Require environment variables strictly.

### 4.5 Subsystem 5: Modularize `server.ts`
Break the monolithic `server.ts` (1,467 lines) into clean modular Express routers:
- `server/middleware/auth.ts`: `resolveCmsUser`, `requireAuth`, `requireRole`.
- `server/routes/artworks.ts`: CRUD endpoints for catalog artworks.
- `server/routes/pages.ts`: CRUD endpoints for editorial pages.
- `server/routes/taxonomies.ts`: CRUD endpoints for series/tags.
- `server/routes/settings.ts`: Key/value store endpoints.
- `server/routes/media.ts`: Direct Supabase storage upload and media asset registry endpoints.
- `server/routes/inquiries.ts`: Collector inquiries and Resend notification triggers.
- `server/routes/adminUsers.ts`: Supabase Auth user management.
- `server.ts` (Slim entrypoint ~120 lines): Mounts routers, middleware, static Vite serving, and exports `app`.

### 4.6 Subsystem 6: Client Bundle Optimization
- Code-split `AdminApp` in `src/App.tsx`:
  ```tsx
  const AdminApp = React.lazy(() => import('./components/admin/AdminApp'));
  ```
- Result: Public gallery visitors download zero admin code, zero shadcn/ui admin components, and zero administrative icons on first paint.

---

## 5. Verification & Acceptance Criteria

1. **Clean Typechecking & Linting:** `npm run lint` (`tsc --noEmit`) passes with 0 errors.
2. **Build Success:** `npm run build` runs cleanly and generates the `dist/` and `api/index.js` bundles.
3. **Database Security Audit:** Supabase MCP tool `list_tables` confirms 100% of public tables have `rls_enabled: true` with zero security advisories.
4. **No Broken Images:** Verification on public gallery and catalog confirms all images resolve directly through Supabase Storage WebP renditions.
5. **Zero Cloudinary References:** Grep for `cloudinary` across `src/` and `server/` returns 0 functional occurrences.
6. **Vercel Serverless Function:** Live deployment builds within 20s and functions normally without runtime failures.

---

## 6. Rollback Plan
All changes are tracked under git branch `feat/v2.9-cleanup-and-optimization`. If any regression occurs during testing, roll back via `git revert` or checkout `main` at commit `411138a`. Database RLS policies are non-destructive and allow immediate rollback via `DISABLE ROW LEVEL SECURITY` if needed.
