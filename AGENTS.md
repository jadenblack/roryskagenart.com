# AGENTS.md — Project Context for AI Agents

> **Purpose:** the single, verified source of truth for anyone (human or agent) working in this
> repo. Read this **first** — it supersedes the historical specs in `/plan`, which contain
> stale assumptions from earlier Cloudinary-era work.
>
> **Verified against:** release `v2.11.0` (2026-09-14). The schema section was re-verified by live
> introspection — see `data/archive/schema_introspection.md`. `v2.11.0` was a studio-operations
> release (user administration, branded email, catalog dossier and scale drawing) with **no schema
> change**, so the schema facts below still carry the `v2.10.0` verification.

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
| Email | Resend | studio-owned mailer: inquiries **and** all staff invites / password resets |
| **Cloudinary** | **REMOVED** | no package, no routes, no resolution step |

⚠️ **Cloudinary is fully decommissioned.** `package.json` has **no `cloudinary` dependency**;
`server.ts` and all of `server/routes/*` have zero Cloudinary references; the image resolution chain
is `external URL → Supabase asset registry → SVG fallback` (`src/lib/markdown.ts`).
Historical mentions in `/plan`, `data/archive/`, and a frozen fallback string in
`src/components/AboutView.tsx` are **provenance only** — do not reintroduce the vendor.

> **Note:** `multer` is **still a dependency** and is *not* a Cloudinary leftover — it is used by
> `POST /api/media/upload` (`server/routes/media.ts`) to receive an image and stream it into the
> Supabase Storage `artwork-images` bucket. Keep it.

### Email: there are TWO mailers (do not conflate them)

| Mailer | Owns | Controlled by |
| :--- | :--- | :--- |
| **Resend** | inquiries, staff invites, admin-issued password resets, access/email-change notices, test send | this repo — `server/emailService.ts` + `server/emailTemplates.ts` |
| **Supabase Auth** | sign-up confirmation, magic link, reauthentication, and the *dashboard* fallbacks | the Supabase dashboard only — **not** the repo |

Branding one does **not** brand the other. All studio-visible mail is rendered from the single
branded shell in `server/emailTemplates.ts` (`BRAND`, `renderBrandedEmail()`); the studio routes its
own invites and resets through Resend precisely so the copy and the logo are code-controlled.
The Supabase Auth mailer is branded separately by pasting the generated files in
`supabase/email-templates/` into the dashboard — regenerate them with
`npx tsx scripts/generate-auth-email-templates.ts`. See
[`docs/runbooks/supabase-email-branding.md`](docs/runbooks/supabase-email-branding.md).

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
ADMIN_EMAIL=                            # inquiry + studio notification recipient
SITE_URL=                               # public origin used in email links (falls back to the live site)
BRAND_LOGO_URL=                         # optional absolute brand-mark URL; defaults to ${SITE_URL}/android-chrome-192x192.png
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

Inspecting and backing up the live database (**read-only** — run the backup before any write):
```bash
npx tsx scripts/introspect-schema.ts         # dumps live schema + policies → data/archive/schema_introspection.md
npx tsx scripts/backup-catalog.ts            # per-table JSON snapshot → data/backups/<timestamp>/
```
See [`docs/runbooks/database-backup-restore.md`](docs/runbooks/database-backup-restore.md) for the
rollback procedure and the pre-migration checklist.

> **No Supabase MCP server is configured in this repo.** Do not assume one exists.

---

## 5. Database schema (after all 9 migrations)

Core tables: `artworks`, `pages`, `inquiries`, `profiles`, `taxonomies`, `artwork_terms`,
`settings`, `media_assets`.

> ✅ **The schema is now reproducible from version control.** The four core domain tables
> (`artworks`, `media_assets`, `pages`, `inquiries`) were created directly in the Supabase project
> and were never captured by a migration. `supabase/migrations/2026_09_01_baseline_core_tables.sql`
> now `CREATE`s them along with their indexes, RLS enablement, and policies. It is dated to sort
> **before** every migration that `ALTER`s them (the runner applies files in lexicographic filename
> order) and is `IF NOT EXISTS` / `DROP POLICY IF EXISTS` throughout, so it is a no-op against the
> existing database. That invariant is enforced by `src/test/migrationSafety.test.ts`.
> See [`docs/adr/0001`](docs/adr/0001-schema-as-code-before-data-migration.md).

> ℹ️ **The migration ledger was reconciled in `v2.10.0`.** `public.schema_migrations` had recorded
> only 6 of the 9 files, while the effects of the two unrecorded ones
> (`2026_09_13_v2_9_security_rls_hardening.sql` and `2026_09_v3_media_assets_extend.sql`) were
> already live — they had been applied out-of-band. Re-running the runner recorded them, so the
> ledger now holds **9 of 9**, and an introspection diff confirmed nothing but the ledger changed.
> The lesson stands: the ledger is only as trustworthy as the discipline around it — always apply
> migrations through `scripts/run-migrations.ts`, never by pasting SQL into the dashboard.

Key facts:
- `artworks` carries lifecycle flags `enabled / archived / trashed / draft` and `hero_slider`.
  A DB trigger (`trg_artworks_draft_guard`) forces `enabled = false` whenever `draft = true`.
- `artworks.image_url` stores a **filename ref** (e.g. `gianondor.jpg`), not a full URL — the
  client resolves it through the asset registry.
- `taxonomies` (`type ∈ series|tag|medium|location`) + `artwork_terms` (M2M) back the filters.
- `media_assets` is the media registry of record: `public_id`, `url`, `thumbnail_url`,
  `lqip`, `renditions` (jsonb), `artwork_slug`.
- RLS is enabled on all public tables (hardened in `2026_09_13_v2_9_security_rls_hardening.sql`).
- ⚠️ **The `artworks` public SELECT policy does not exclude drafts** — it is `USING (trashed = false)`,
  so draft rows are reachable with the anon key via a direct PostgREST query. It is not currently
  exploitable because the client reads through `/api/artworks`, which filters drafts server-side —
  **do not remove that filter**, and do not add a direct client-side Supabase read of `artworks`.
  Tightening the policy is a tracked follow-up (see `CHANGELOG.md`, v2.10.0).

**Live row counts** (verified by introspection, 2026-09-14):
`artworks` = 138 · `media_assets` = 152 · `pages` = 4 · `inquiries` = 1 · `settings` = 5 ·
`profiles` = 3 · `taxonomies` = 3 · `artwork_terms` = **0**.
`src/data/assetRegistry.ts` currently exposes **457 registry keys** for those assets.

⚠️ `artwork_terms` is **empty** — the taxonomy rows exist but nothing is linked to them, so the
M2M filter path is currently unexercised. Re-verify any of these with
`npx tsx scripts/introspect-schema.ts` before relying on them.

---

## 6. Repository map (what lives where)

```
├── server.ts               # slim Express entrypoint (mounts routers, exports app)
├── server/
│   ├── middleware/auth.ts  # resolveCmsUser / requireAuth / requireRole
│   ├── routes/*.ts         # artworks, pages, taxonomies, settings, media, inquiries, adminUsers
│   ├── lib/userAdmin.ts    # pure user-admin rules: state, patches, lockout guards (unit-tested)
│   ├── emailTemplates.ts   # the branded email shell + BRAND identity (single source of email look)
│   └── emailService.ts     # Resend integration (inquiries, invites, resets, notices)
├── api/                    # Vercel serverless entry (CommonJS — see api/package.json)
├── src/
│   ├── components/         # public views + admin/ CMS + ui/ primitives (+ co-located .test.tsx)
│   ├── engine/             # galleryStateEngine.ts (DB-backed reactive store)
│   ├── data/               # assetRegistry.ts (generated), assetResolver.ts, registries
│   ├── lib/                # supabase.ts, adminApi.ts, markdown.ts,
│   │                       # roles.ts (shared role vocabulary), authRedirect.ts (auth hand-off),
│   │                       # adminRoute.ts (hash-route parse), narrative.ts (record → parts),
│   │                       # dimensions.ts (free-text size → inches)
│   └── server/db.ts        # pg Pool + Supabase admin client
├── supabase/migrations/    # 9 idempotent SQL migrations (the baseline sorts first)
├── supabase/email-templates/  # generated Supabase Auth mailer templates + manifest.json
├── scripts/                # run-migrations, introspect-schema, backup-catalog,
│   │                       # generate-asset-registry, generate-auth-email-templates
│   └── lib/                # migrationPlan.ts — pure ordering/skip logic (unit-tested)
├── src/test/               # vitest suites (incl. migrationSafety + migrationPlan + userAdmin)
├── data/archive/           # historical manifests + live schema introspection (provenance)
├── data/backups/           # gitignored logical dumps (see docs/runbooks/)
├── wayback/                # archived predecessor sites (v3 migration source — see §7)
├── docs/PRD.md             # Admin UI reliability PRD (implemented)
├── docs/adr/               # Architecture Decision Records (see ADR 0001)
├── docs/runbooks/          # operational procedures (backup/restore, Supabase email branding)
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

### Roles & permissions (the matrix is authoritative)

Role vocabulary lives in **`src/lib/roles.ts`** (`CmsRole`, `ROLE_ORDER`, `ROLE_DESCRIPTIONS`,
`roleAtLeast()`) so the browser bundle and the server share one definition. `server/lib/userAdmin.ts`
re-exports it; never re-declare a role list.

| Role | Rank | Can |
| :--- | :--- | :--- |
| `viewer` | 0 | Read-only: dashboard, catalog, pages |
| `editor` | 1 | + catalog writes, pages, media, inquiries, taxonomies, design, trash |
| `admin` | 2 | + Users and Settings (full control) |

- **A `minRole` on a nav item must match the server guard on the matching API route.** Otherwise a
  Viewer is offered a menu item that answers `403` — the exact defect `v2.11.0` fixed for Inquiries
  and Media. `ADMIN_NAV` in `src/components/admin/AdminLayout.tsx` carries the mapping as a comment.
- **Gate at both ends.** Route-level `requireAuth, requireRole(...)` on the server, plus a `Forbidden`
  panel and disabled controls in the UI. Server is the authority; the UI only avoids dead ends.
- **Never let the studio lock itself out.** `decideMutation()` in `server/lib/userAdmin.ts` refuses
  self-role-change / self-deactivate / self-delete and protects the last active administrator. Do not
  add a mutation path that bypasses it.

### Guardrails

- **Conventional Commits.** Release notes in `CHANGELOG.md` (Keep a Changelog + SemVer).
- **Migrations are additive and idempotent** — `IF NOT EXISTS` / `OR REPLACE` / guarded triggers.
  Enforced by `src/test/migrationSafety.test.ts`; do not merge a migration that fails it.
- **A migration that touches a core table must sort after `2026_09_01_baseline_core_tables.sql`.**
  Never add a file dated earlier than the baseline.
- **Never overwrite non-empty DB fields during backfills** — fill only `NULL`/`''`.
- **Back up before you write** — `npx tsx scripts/backup-catalog.ts`, then follow
  [`docs/runbooks/database-backup-restore.md`](docs/runbooks/database-backup-restore.md).
- **Media is Supabase Storage only** — never reference Cloudinary in new code.
- **Email branding has one source** — `server/emailTemplates.ts`. Studio-sent mail goes through
  Resend; Supabase's own mailer is branded separately by pasting `supabase/email-templates/` into the
  dashboard (see §2 and the runbook).
- **Auth redirects must be a bare origin** (no `#`). This is a hash-router SPA and `supabase-js` parses
  the session out of the URL *fragment*; a target like `…/#/admin` silently drops the session. Use
  `bareOrigin()` (`src/lib/authRedirect.ts`) or `buildAuthRedirect()` (`server/lib/userAdmin.ts`), and
  keep `src/lib/authRedirect.ts` as the **first** import in `src/main.tsx`.
- **`tsc --noEmit` must stay clean** (`npm run lint`); `npm test` (vitest) is offline/zero-token.
  Suite as of `v2.11.0`: **199 tests across 20 files**.
- Verify a claim against the code before documenting it. Stale docs were this repo's largest
  liability before `v2.9.0`.
