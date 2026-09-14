# AGENTS.md — Project Context for AI Agents

> **Purpose:** the single, verified source of truth for anyone (human or agent) working in this
> repo. Read this **first** — it supersedes the historical specs in `/plan`, which contain
> stale assumptions from earlier Cloudinary-era work.
>
> **Verified against:** commit `8e14fda` (2026-09-13), release `v2.9.0`.

---

## 1. What this project is

Official digital gallery, catalog raisonné, and studio CMS for Austin artist **Rory Skagen**
(`roryskagenart.com`). Full-stack SPA: public collector gallery + `#/admin` studio CMS.

The v3 objective is to **merge the two archived predecessor websites** (mural projects + fine
art) into this app's Supabase catalog. See `plan/PRD_V3_WAYBACK_DATA_MIGRATION.md`.

---

## 2. Verified stack (do not assume otherwise)

| Layer | Actual | Notes |
| :--- | :--- | :--- |
| Client | **React 19**, Vite 6, Tailwind **v4**, shadcn/ui (Radix) | `AdminApp` is `React.lazy`-loaded (`src/App.tsx`) |
| Backend | Express 4, **modularized** under `server/` | `server.ts` is a slim entrypoint |
| Database | **Supabase PostgreSQL** (`orphcusijzkxpxkzapjp`) | single source of truth |
| Auth | **Supabase Auth** + `public.profiles` roles | admin / editor / viewer |
| Media | **Supabase Storage** bucket `artwork-images` | thumb/hero/full/lqip WebP renditions |
| Email | Resend | inquiry notifications |
| **Cloudinary** | **REMOVED** | no package, no routes, no resolution step |

⚠️ **Cloudinary is fully decommissioned.** `package.json` has **no `cloudinary` dependency**;
`server.ts` and all of `server/routes/*` have zero Cloudinary references; the image resolution chain
is `external URL → Supabase asset registry → SVG fallback` (`src/lib/markdown.ts`).
Historical mentions in `/plan`, `data/archive/`, and a frozen fallback string in
`src/components/AboutView.tsx` are **provenance only** — do not reintroduce the vendor.

> **Note:** `multer` is **still a dependency** and is *not* a Cloudinary leftover — it is used by
> `POST /api/media/upload` (`server/routes/media.ts`) to receive an image and stream it into the
> Supabase Storage `artwork-images` bucket. Keep it.

---

## 3. Authoritative environment variables

The code reads these names (see `.env.example`). Do **not** use the generic
`SUPABASE_URL` / `POSTGRES_URL` names from the old README.

```bash
# Supabase / PostgreSQL (Vercel integration naming)
NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL=
NEXT_PUBLIC_VRCL_SUPA_SUPABASE_PUBLISHABLE_KEY=
VRCL_SUPA_SUPABASE_ANON_KEY=
VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY=
VRCL_SUPA_POSTGRES_PRISMA_URL=          # preferred connection string
VRCL_SUPA_POSTGRES_URL_NON_POOLING=
VRCL_SUPA_SUPABASE_JWT_SECRET=

# Email
RESEND_API_KEY=
RESEND_EMAIL_DOMAIN=
```

Local `.env` and `.env.local` exist (gitignored). **Never print or commit their contents.**

---

## 4. How to write to the database (the established path)

Two supported routes — prefer the first (it is already wired and idempotent):

1. **SQL migration via the runner** (best practice for schema + bulk data):
   ```bash
   npx tsx scripts/run-migrations.ts            # apply all pending
   npx tsx scripts/run-migrations.ts <file>.sql # apply specific files
   ```
   Files live in `supabase/migrations/`, are applied in filename order, and are tracked in
   `public.schema_migrations` (safe to re-run). Connection string comes from the env vars above
   (`scripts/run-migrations.ts`).

2. **Supabase admin client** (programmatic upserts, bypasses RLS):
   `getSupabaseAdmin()` in `src/server/db.ts` uses `VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY`.

Regenerating the client asset map after media changes:
```bash
npx tsx scripts/generate-asset-registry.ts   # rewrites src/data/assetRegistry.ts from media_assets
```

> **No Supabase MCP server is configured in this repo.** Do not assume one exists.

---

## 5. Database schema (after all 8 migrations)

Core tables: `artworks`, `pages`, `inquiries`, `profiles`, `taxonomies`, `artwork_terms`,
`settings`, `media_assets`.

Key facts:
- `artworks` carries lifecycle flags `enabled / archived / trashed / draft` and `hero_slider`.
  A DB trigger (`trg_artworks_draft_guard`) forces `enabled = false` whenever `draft = true`.
- `artworks.image_url` stores a **filename ref** (e.g. `gianondor.jpg`), not a full URL — the
  client resolves it through the asset registry.
- `taxonomies` (`type ∈ series|tag|medium|location`) + `artwork_terms` (M2M) back the filters.
- `media_assets` is the media registry of record: `public_id`, `url`, `thumbnail_url`,
  `lqip`, `renditions` (jsonb), `artwork_slug`.
- RLS is enabled on all public tables (hardened in `2026_09_13_v2_9_security_rls_hardening.sql`).

**Baseline row counts** (as documented in `plan/PRD_V2.9_CLEANUP_AND_OPTIMIZATION.md`, 2026-09-12):
`artworks` ≈ 138 · `media_assets` = 152 · `pages` = 4 · `profiles` = 2.
`src/data/assetRegistry.ts` currently exposes **457 registry keys** for those assets.
*Re-verify with a live count before relying on these numbers.*

---

## 6. Repository map (what lives where)

```
├── server.ts               # slim Express entrypoint (mounts routers, exports app)
├── server/
│   ├── middleware/auth.ts  # resolveCmsUser / requireAuth / requireRole
│   ├── routes/*.ts         # artworks, pages, taxonomies, settings, media, inquiries, adminUsers
│   └── emailService.ts     # Resend integration
├── api/                    # Vercel serverless entry (CommonJS — see api/package.json)
├── src/
│   ├── components/         # public views + admin/ CMS + ui/ primitives
│   ├── engine/             # galleryStateEngine.ts (DB-backed reactive store)
│   ├── data/               # assetRegistry.ts (generated), assetResolver.ts, registries
│   ├── lib/                # supabase.ts, adminApi.ts, markdown.ts
│   └── server/db.ts        # pg Pool + Supabase admin client
├── supabase/migrations/    # 8 idempotent SQL migrations
├── scripts/                # run-migrations, generate-asset-registry, migrate-cloudinary-to-supabase
├── data/archive/           # historical Cloudinary manifests + parsed posts (provenance)
├── wayback/                # archived predecessor sites (v3 migration source — see §7)
├── docs/PRD.md             # Admin UI reliability PRD (implemented)
└── plan/                   # see plan/README.md for status of every spec
```

---

## 7. The v3 migration source (read before touching `wayback/`)

`wayback/` holds two static Wayback snapshots:

| Archive | Content | index.html files |
| :--- | :--- | :--- |
| `wayback/centraltexasmurals.com-v1/` | Mural projects (WordPress "Modularity") | 118 (incl. feeds/pagination) |
| `wayback/roryskagen.com-v1/` | Fine-art portfolio (WordPress "Berlin") | 159 (incl. feeds/pagination) |

**This is a MERGE, not a cold seed** — the fine-art catalog is already in the DB; the murals are
the net-new content. DB slugs are canonical and diverge from wayback folder names (e.g.
`today` → `today-atomic-sunrise`). The full extraction + reconciliation plan and a
copy-paste agent prompt are in **`plan/PRD_V3_WAYBACK_DATA_MIGRATION.md`**.

Do **not** modify anything inside `wayback/` — it is an immutable archive.

---

## 8. Conventions & guardrails

- **Conventional Commits.** Release notes in `CHANGELOG.md` (Keep a Changelog + SemVer).
- **Migrations are additive and idempotent** — `IF NOT EXISTS` / `OR REPLACE` / guarded triggers.
- **Never overwrite non-empty DB fields during backfills** — fill only `NULL`/`''`.
- **Media is Supabase Storage only** — never reference Cloudinary in new code.
- **`tsc --noEmit` must stay clean** (`npm run lint`); `npm test` (vitest) is offline/zero-token.
- Verify a claim against the code before documenting it. Stale docs were this repo's largest
  liability before `v2.9.0`.
