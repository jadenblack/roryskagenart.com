# Rory Skagen Studio — Official Web Application & Fine Art Catalog

[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Backend-Express.js-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase_(DB_%2B_Storage_%2B_Auth)-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

Official digital gallery, catalog raisonné, and studio management application for celebrated Austin artist **Rory Skagen** ([roryskagenart.com](https://roryskagenart.com)). Renowned for defining Austin’s visual landscape—including the iconic *"Greetings from Austin"* South 1st Street mural—Rory Skagen's fine art oeuvre spans pop surrealism, neon Americana, retro-futurism, monumental public murals, and original acrylic and mixed-media canvases.

This full-stack application provides both an elegant, collector-grade public presentation and a powerful virtual studio inventory engine.

> **Current release:** `v2.9.0` · **Single vendor:** Supabase (database + storage + auth). Cloudinary has been fully decommissioned.
> **Working in this repo (human or AI)?** Read [`AGENTS.md`](./AGENTS.md) first — it is the verified source of truth for the stack, schema, env vars, and write path. See [`plan/README.md`](./plan/README.md) for the status of every planning document.

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Key Features](#key-features)
- [Admin Dashboard & CMS](#admin-dashboard--cms)
- [Authentication & Roles](#authentication--roles)
- [Data Engine & Storage Architecture](#data-engine--storage-architecture)
- [Directory Structure](#directory-structure)
- [API Endpoints](#api-endpoints)
- [Database Schema & Migrations (Supabase / PostgreSQL)](#database-schema--migrations-supabase--postgresql)
- [Environment Variables](#environment-variables)
- [Installation & Local Development](#installation--local-development)
- [Deployment](#deployment)
- [Pull Request & Development Plans](#pull-request--development-plans)
- [License & Credits](#license--credits)

---

## Overview & Architecture

The application is architected as a modern full-stack application combining a high-performance React 19 client with a modular Express.js backend and a PostgreSQL database on Supabase:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Rory Skagen Studio App                          │
├────────────────────────────────────────────────────────────────────────┤
│  Client Tier (React 19 + Vite + Tailwind v4 + shadcn-style UI)         │
│  ├── Collector Front: Landing, Curated Gallery Grid, Lightbox Focus    │
│  ├── Inquiries: Direct Art Acquisition & Commission Forms              │
│  ├── Studio Admin Dashboard (#/admin): shadcn-style CMS workspace      │
│  │   └── Dashboard · Catalog · Pages · Inquiries · Media ·             │
│  │       Taxonomies · Users · Settings · Trash                         │
│  └── GalleryStateEngine: Reactive store over the Supabase API        │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Backend Tier (Express.js)       │  Asset & Database Services          │
│  ├── /api/artworks CRUD          │  ├── Supabase Auth (identity+roles) │
│  ├── /api/admin/users (RBAC)     │  ├── Supabase PostgreSQL DB         │
│  ├── /api/taxonomies, /settings  │  ├── Supabase Storage (artwork-     │
│  ├── /api/inquiries capture      │  │   images bucket, renditions)     │
│  └── /api/media (registry)       │  └── Resend (transactional email)   │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## Key Features

### 1. Collector & Visitor Experience
- **Dynamic Hero Showcase**: A full-bleed masthead backdrop — the featured artwork cover-crops the entire hero canvas (blurred ambience, theme-tuned brightness) behind the overlaid studio statement, with an interior active-slide name pill, progress dots, hover arrows, and autoplay. Any aspect ratio fills edge-to-edge, portrait or landscape.
- **Curated Gallery Grid**: Multi-dimensional filtering by gallery series (*Neon Americana*, *Pop Surrealism*, *Murals & Public Works*, etc.), medium, availability status (*Available*, *Reserved*, *Sold*), and size scale.
- **Artwork Focus & Lightbox View**: High-definition zoom imagery, physical metrics in both imperial and metric units, background narratives, provenance notes, and live pricing.
- **Acquisition Inquiry System**: Direct lead capture modal allowing serious collectors and gallery curators to inquire about individual works or commission custom pieces.
- **Ambient Lighting Themes**: Handcrafted dark/light studio aesthetics with seamless state persistence.

### 2. Studio Inventory & Asset Management (Admin Dashboard — `#/admin`)
- **Dashboard Home**: Catalog stats (total/available/sold/archived), series breakdown, latest inquiries, and live database health.
- **Catalog Manager**: Filterable data table for all 130+ works with inline hero/enabled toggles, archive, trash/restore, admin-only permanent delete, and a full create/edit form dialog (title, year, medium, dimensions, price, status, series, edition, location, image, narrative).
- **Pages Manager**: Database-backed page list with markdown editor, live preview, and instant publish.
- **Inquiries Inbox**: Collector lead pipeline with New → Contacted → Closed status workflow.
- **Media Library**: Grid over the `media_assets` registry (Supabase Storage `artwork-images` bucket) with rendition previews and copy-URL.
- **Taxonomies**: CRUD and ordering for gallery series / tags / mediums / locations; feeds the catalog filters and artwork form.
- **User Management** (admin-only): Supabase email invites, role assignment (admin/editor/viewer), deactivation, deletion.
- **Settings** (admin-only): Site identity, inquiry notification routing, hero slider behaviour (JSONB key/value store).
- **Two-Stage Trash Vault**: Non-destructive inventory lifecycle allowing works to be staged in trash, restored, or permanently expunged.

---

## Admin Dashboard & CMS

The admin surface is a full-screen takeover at `#/admin` built from dependency-free shadcn-style primitives (Button, Card, Dialog, Table, Select, Switch, Badge, Dropdown, Input, Textarea, Skeleton) on Tailwind v4 design tokens. It shares the existing hash router with the public site and takes over the viewport when active.

| Route | View | Min. role |
| :--- | :--- | :--- |
| `#/admin` | Dashboard home (stats, series, inquiries, health) | viewer |
| `#/admin/catalog` | Catalog data table + artwork create/edit dialog | viewer (edit: editor) |
| `#/admin/pages` | Pages list + markdown editor | editor |
| `#/admin/inquiries` | Inquiry inbox with status workflow | editor |
| `#/admin/media` | Media asset registry grid | editor |
| `#/admin/taxonomies` | Series/tag/medium/location CRUD + ordering | editor |
| `#/admin/users` | Invite, roles, deactivate, delete | admin |
| `#/admin/settings` | Site identity, inquiry + hero settings | admin |
| `#/admin/trash` | Trash management (restore / purge) | editor (purge: admin) |

Sign in at `#/admin` (redirects to the login page when unauthenticated). Password resets are delivered by Supabase Auth email.

---

## Authentication & Roles

Identity is **Supabase Auth only** (email + password). The legacy localStorage credential vault has been removed entirely.

- Sessions are real Supabase JWTs; every API call attaches `Authorization: Bearer <jwt>` (`src/lib/adminApi.ts`).
- Server middleware (`requireAuth`, `requireRole`) in `server.ts` verifies the JWT via `supabaseAdmin.auth.getUser()` and resolves the caller's role from `public.profiles`.
- Roles: **admin** (full control incl. users, settings, permanent delete), **editor** (catalog, pages, media, inquiries, taxonomies), **viewer** (read-only dashboard).
- All mutating and admin-read endpoints are protected; public reads (`GET /api/artworks`, `GET /api/pages/:slug`, `POST /api/inquiries`, `GET /api/taxonomies`, `GET /api/settings`) stay open.
- New signups receive a `profiles` row via the `on_auth_user_created` trigger; the Users screen (admin) manages invites and role changes.

---

## Data Engine & Storage Architecture

The application treats **Supabase as the single source of truth**:

1. **`GalleryStateEngine`** (thin reactive store):
   - Loads artworks and pages from `/api/artworks` and `/api/pages` on boot and after every mutation; DB rows fully replace local state.
   - The bundled catalog registry (`src/data/portfolioPostsData`) exists only as a synchronous bootstrap cache for first paint and offline fallback — it never persists and never merges back.
   - Mutations are async API wrappers: optimistic local update → authenticated PATCH/DELETE → authoritative reload.
   - Provides reactive event subscription (`subscribe()`) so all views re-render on state changes.

2. **Supabase PostgreSQL Database**:
   - Stores authoritative records for artworks (including narrative markdown and image refs), pages, inquiries, profiles (roles), taxonomies, settings, and media asset logs.
   - `GET /api/pages` is public (slug/title/content) so the public site renders pages directly from the DB; writes stay editor-gated.
   - Accessed via server-side `/api/` endpoints to enforce security; schema changes ship as versioned SQL files in `/supabase/migrations` (applied via `scripts/run-migrations.ts`).

3. **Supabase Storage Asset Pipeline**:
   - The `artwork-images` bucket delivers responsive renditions (thumb/hero/full + LQIP blur-up) tracked in `public.media_assets`; the client resolves image refs through the generated `src/data/assetRegistry.ts`.
   - Image resolution is `external URL → Supabase asset registry → SVG fallback`. Cloudinary has been fully decommissioned — no package, no routes, no resolution step.

---

## Directory Structure

```
├── .env.example              # Sample environment variable declarations
├── AGENTS.md                 # Verified project context for humans & AI agents (read first)
├── README.md                 # Project documentation (this file)
├── CHANGELOG.md              # Release notes (Keep a Changelog / SemVer)
├── DEPLOYMENT_LOG.md         # Vercel production & preview deployment history
├── package.json              # Dependency manifests and run scripts
├── server.ts                 # Slim Express entrypoint (mounts routers, exports app)
├── vite.config.ts            # Vite build configuration with Tailwind support
├── vercel.json               # Vercel routing / serverless function declaration
├── /api                      # Vercel serverless entry (CommonJS)
├── /server                   # Modular backend
│   ├── middleware/auth.ts    # resolveCmsUser / requireAuth / requireRole
│   ├── routes/*.ts           # artworks, pages, taxonomies, settings, media, inquiries, adminUsers
│   └── emailService.ts       # Resend integration
├── /plan                     # Specifications — see plan/README.md for the status of each
├── /docs                     # Admin UI reliability PRD
├── /public                   # Static assets served verbatim (favicons, manifest)
├── /scripts                  # Maintenance scripts (migration runner, asset registry, media migration)
├── /supabase/migrations      # Versioned, idempotent SQL schema migrations
├── /data/archive             # Historical Cloudinary manifests & parsed posts (provenance only)
├── /wayback                  # Archived predecessor sites (v3 migration source — read-only)
├── /src
│   ├── App.tsx               # Root application router (public routes + lazy #/admin)
│   ├── main.tsx              # React DOM entry point
│   ├── /types                # TypeScript interfaces (artworks, auth, taxonomy)
│   ├── /components           # Public site views (navbar, gallery, hero, contact…)
│   ├── /components/admin     # CMS dashboard (AdminApp router, layout, views)
│   ├── /components/ui        # shadcn/ui (Radix) primitives
│   ├── /context              # React context providers (AuthContext, ThemeContext)
│   ├── /data                 # assetRegistry.ts (generated), assetResolver.ts, registries
│   ├── /engine
│   │   └── galleryStateEngine.ts # DB-backed reactive store (API → state → UI)
│   ├── /lib
│   │   ├── supabase.ts       # Supabase client setup & environment loader
│   │   ├── adminApi.ts       # Authenticated fetch wrapper (Bearer JWT attach)
│   │   ├── markdown.ts       # Wiki-link renderer + image resolution chain
│   │   └── utils.ts          # cn() class-merge utility
│   └── /server/db.ts         # pg Pool + Supabase admin client
```

---

## API Endpoints

The Express server exposes the following RESTful endpoints on port `3000`:

🔒 = requires `Authorization: Bearer <supabase-jwt>`; role noted where relevant.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Server health check and timestamp |
| `GET` | `/api/artworks` | Query all artworks (supports `?include_trashed=true`) |
| `GET` | `/api/artworks/:slug` | Retrieve single artwork details by slug |
| `POST` | `/api/artworks` | 🔒 Create artwork (editor+) |
| `PATCH` | `/api/artworks/:slug` | 🔒 Update metadata, pricing, hero status, or flags (editor+) |
| `DELETE` | `/api/artworks/:slug` | 🔒 Soft trash or permanent purge with `?permanent=true` (editor+) |
| `GET` | `/api/pages/:slug` | Get markdown content for specific page |
| `PUT` | `/api/pages/:slug` | 🔒 Upsert page title/content (editor+) |
| `GET` | `/api/pages` | List pages (slug/title/content) — public |
| `POST` | `/api/inquiries` | Submit buyer/collector inquiry (public; triggers Resend notifications) |
| `GET` | `/api/inquiries` | 🔒 List submitted inquiries (editor+) |
| `PATCH` | `/api/inquiries/:id/status` | 🔒 Update inquiry status: New / Contacted / Closed (editor+) |
| `GET` | `/api/taxonomies` | List taxonomy terms (optional `?type=series\|tag\|medium\|location`) |
| `POST` | `/api/taxonomies` | 🔒 Create term (editor+) |
| `PATCH` | `/api/taxonomies/:id` | 🔒 Rename / reorder term (editor+) |
| `DELETE` | `/api/taxonomies/:id` | 🔒 Delete term (admin) |
| `GET` | `/api/settings` | Public site settings key/value map |
| `PUT` | `/api/settings` | 🔒 Upsert settings groups (admin) |
| `GET` | `/api/admin/users` | 🔒 List auth users with profile roles (admin) |
| `POST` | `/api/admin/users/invite` | 🔒 Send Supabase invite email (admin) |
| `PATCH` | `/api/admin/users/:id` | 🔒 Change role / deactivate (ban) / rename (admin) |
| `DELETE` | `/api/admin/users/:id` | 🔒 Delete user permanently (admin) |
| `GET` | `/api/media` | 🔒 List media_assets registry with renditions (editor+) |
| `POST` | `/api/media/upload` | 🔒 Upload image to Supabase Storage `artwork-images` + register in media_assets (editor+) |
| `GET` | `/api/database/status` | 🔒 PostgreSQL connectivity check (editor+) |
| `GET` | `/api/email/status` | Check Resend email domain configuration and API status |
| `POST` | `/api/email/send-test` | 🔒 Dispatch test verification email (admin) |

---

## Database Schema & Migrations (Supabase / PostgreSQL)

### Migrations workflow

Schema lives in `/supabase/migrations` as versioned, idempotent SQL files. Apply them with the bundled runner (tracks applied files in `public.schema_migrations`, safe to re-run):

```bash
npx tsx scripts/run-migrations.ts          # apply all pending
npx tsx scripts/run-migrations.ts <file>.sql   # apply specific files
```

All migrations (applied in filename order):

- `2026_09_v3_media_assets_extend.sql` — extends `media_assets` with `lqip` + `renditions` (jsonb) and an `updated_at` trigger for idempotent upserts.
- `2026_09_12_cms_v1_profiles_roles.sql` — `public.profiles` (role/is_active keyed to `auth.users`), `on_auth_user_created` signup trigger, admin backfill for existing users, owner/admin RLS policies.
- `2026_09_12_cms_v1_taxonomies_settings.sql` — `taxonomies` (+ `artwork_terms` join), `settings` JSONB key/value store, `gallery_series` backfill into series terms, default settings seeds.
- `2026_09_12_cms_v1_1_slug_backfill.sql` — rewrites numeric import-index slugs (`0`..`136`) to title-derived slugs and remaps `media_assets.artwork_slug`.
- `2026_09_13_cms_v2_source_of_truth_backfill.sql` — fills empty `narratives`, replaces placeholder `/images/*.svg` refs with real filenames, restores hero defaults, and seeds bundled `pages`.
- `2026_09_13_cms_v2_1_artwork_drafts.sql` — `artworks.draft` flag with partial indexes and a DB trigger preventing drafts from being publicly enabled.
- `2026_09_13_cms_v2_2_profiles_rls_recursion_fix.sql` — replaces the self-referencing `profiles_select_admin` RLS policy (Postgres 42P17 "infinite recursion" → HTTP 500) with `SECURITY DEFINER` helpers `is_admin()` / `is_admin_or_editor()`.
- `2026_09_13_v2_9_security_rls_hardening.sql` — enables RLS on `taxonomies`, `artwork_terms`, `settings` with public-read + admin/editor-write policies.

### Core tables

| Table | Purpose |
| :--- | :--- |
| `artworks` | Master catalog: slug, title, year, medium, dimensions, price, status, gallery_series, edition, location, image_url, hero_slider, enabled/archived/trashed flags, narrative, metadata |
| `inquiries` | Collector leads: artwork ref, name, email, phone, message, status (New/Contacted/Closed) |
| `profiles` | Per-user role & activation state keyed to `auth.users` (admin/editor/viewer) |
| `taxonomies` | Controlled vocabularies: series, tag, medium, location with slug + sort order |
| `artwork_terms` | Many-to-many artwork ↔ taxonomy term links |
| `settings` | JSONB key/value store (site identity, inquiries, hero) with updated_by audit |
| `media_assets` | Supabase Storage registry: public_id, url, renditions (thumb/hero/full), lqip, artwork_slug |
| `pages` | CMS pages: slug, title, markdown content |

Full column definitions for `artworks` and `inquiries` are documented in the migration files and the v2 PRD under `/plan`.

---

## Environment Variables

Configure the following variables in `.env` (refer to `.env.example`):

```bash
# Supabase / PostgreSQL (Vercel integration naming — these are the names the code reads)
NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL=
NEXT_PUBLIC_VRCL_SUPA_SUPABASE_PUBLISHABLE_KEY=
VRCL_SUPA_SUPABASE_ANON_KEY=
VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY=
VRCL_SUPA_POSTGRES_PRISMA_URL=          # preferred connection string
VRCL_SUPA_POSTGRES_URL_NON_POOLING=
VRCL_SUPA_SUPABASE_JWT_SECRET=

# Studio admin bootstrap (optional — the first admin is created by the
# profiles migration backfill; additional admins are invited from #/admin/users)
ADMIN_EMAIL=
ADMIN_INITIAL_PASSWORD=

# Resend Email Integration
RESEND_API_KEY=
RESEND_EMAIL_DOMAIN=
```

---

## Installation & Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/roryskagen/roryskagenart.git
   cd roryskagenart
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

4. **Run TypeScript verification & linter**:
   ```bash
   npm run lint
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```
   Compiles static client assets to `dist/` and bundles `server.ts` to `dist/server.cjs`.

6. **Start production server**:
   ```bash
   npm start
   ```

---

## Deployment

The application deploys as a **documented hybrid** on Vercel: a static SPA on the edge CDN plus one Node.js serverless function that runs the full Express API.

### Architecture

```
                      Vercel Edge CDN (static)
  Browser ──────────► / , /assets/*          ← vite build output (dist/)
      │
      └── /api/* ──────► api/index.js (Node.js serverless function)
                              └── imports server.ts  (the SAME Express app
                                  that runs `npm run dev` / `npm start`)
                                      ├── PostgreSQL (pg Pool → Supabase)
                                      ├── Supabase Auth (admin sessions)
                                      ├── Supabase Storage (media renditions)
                                      └── Resend (inquiry emails)
```

One Express app, two boot modes:

| Mode | Trigger | Behavior |
| :--- | :--- | :--- |
| **Standalone** | `npm run dev` / `npm start` (no `VERCEL` env) | Attaches Vite middleware (dev) or serves `dist/` (prod), listens on `PORT` |
| **Serverless** | `VERCEL=1` (set automatically by Vercel) | `server.ts` only exports the configured `app`; no Vite import, no `app.listen()`. `api/index.js` hands platform requests to it |

### Required environment variables (Vercel project settings)

```bash
# Database — required for /api/artworks, /api/pages, /api/inquiries
VRCL_SUPA_POSTGRES_PRISMA_URL=postgres://...      # or VRCL_SUPA_POSTGRES_URL
VRCL_SUPA_SUPABASE_URL=https://<ref>.supabase.co
VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY=eyJ...        # server-side auth + DB admin

# Email — required for /api/inquiries notifications
RESEND_API_KEY=re_...

# Optional (admin bootstrap; Supabase Auth is the primary path)
ADMIN_EMAIL=
ADMIN_INITIAL_PASSWORD=
```

### First-time setup checklist

1. Apply migrations: `npx tsx scripts/run-migrations.ts` (creates `profiles`, `taxonomies`, `settings`; backfills admins & series).
2. Existing `auth.users` are backfilled as **admin** — verify/tweak roles from `#/admin/users` after first sign-in.
3. Ensure Supabase Auth email templates (invite / password reset) point at your deployed domain for `#/admin` flows.

### Serverless constraints & mitigations

* **Read-only filesystem** — file-based admin session persistence (`data/auth_store.json`) is redirected to `/tmp` per instance and degrades gracefully; Supabase Auth is the authoritative identity path. Sessions do not survive instance recycling.
* **No long-lived state** — the pg `Pool` is module-scoped and reused across warm invocations; cold starts pay one connection setup.
* **Payload limits** — serverless request bodies cap around 4.5 MB; the 50 MB JSON body limit and the 30 MB media-upload limit (`server/routes/media.ts`) only apply in standalone mode.
* **Function timeout** — `maxDuration: 30` in `vercel.json`; all current endpoints complete well under this.
* **CJS bundle requirement** — the repo's root `package.json` declares `"type": "module"`, which would make Vercel load an `api/index.js` bundle as ESM and crash (`module is not defined`). The fix is `api/package.json` declaring `{ "type": "commonjs" }`, scoping only the serverless directory to CommonJS while the Vite client stays ESM.

### Deploying

```bash
vercel --prod
```

Pushes to `main` also trigger automatic production deployments (project `roryskagen`).

### When to use standalone hosting instead

The standalone Express server (`npm start` on a Node host) remains fully supported and is the right choice if you need: large admin uploads (>4 MB), long-lived in-process sessions, or WebSocket-style features later. Both modes share the identical route layer.

---

## Pull Request & Development Plans

All major architectural proposals and feature branches are documented in the `/plan` directory:

- [`plan/DRAFT_FEATURE_PULL_REQUEST.md`](./plan/DRAFT_FEATURE_PULL_REQUEST.md): historical **Supabase Database Synchronization & Engine Integration** proposal — **superseded** by the current modular architecture. See [`plan/README.md`](./plan/README.md) for the status of every spec.

---

## License & Credits

- **Artwork & Imagery**: © Rory Skagen. All rights reserved. Reproduction or distribution without prior written permission is strictly prohibited.
- **Application Code**: Licensed under the Apache-2.0 License. *(No `LICENSE` file is currently present in the repository — add one to make this claim verifiable.)*
