# Review — Vercel cron, Resend email, and v3.0.0 readiness

**Date:** 2026-09-14 20:15 UTC (17:15 America/Sao_Paulo)
**Baseline:** `v2.13.0` (`0aab9b3`), `main` `87c9db8`, 138 artworks / 307 rows, 11/11 migrations
**Method:** live probes against `https://roryskagenart.com`, `vercel env ls`, `vercel crons ls`,
`vercel logs`, `vercel project ls`, a read-only Vercel Blob listing, and source inspection.
Everything marked **VERIFIED** was observed in this session; everything else is labelled.

---

## 0. Prioritized action list

| # | P | Area | Finding | Change in |
| :-- | :-- | :-- | :-- | :-- |
| 1 | **P0** | Email | **Production has no Resend key.** `GET /api/email/status` → `configured:false, apiKeyPresent:false`. Every collector inquiry is saved and **silently not sent** — and the API still answers `emailDispatched:true`. | Vercel env (Prod **+ Preview**) + `server/routes/inquiries.ts:47` |
| 2 | **P0** | Email | Sends are fire-and-forget **after** `res.json()` (`inquiries.ts:30-45`). On Vercel the instance can freeze before Resend returns, so mail is lost with a 201 response. | `server/routes/inquiries.ts` |
| 3 | **P1** | v3 | `src/data/assetRegistry.ts` is **445 KB / 4,602 lines bundled into the client**. v3 (3–4× assets) → multi-MB JS on every visit. Move to an HTTP-cached endpoint. | `src/data/assetRegistry.ts`, `src/data/assetResolver.ts`, new `server/routes/registry.ts` |
| 4 | **P1** | v3 | `GET /api/artworks` is **unpaginated and uncached**: 138 rows = **165,193 B**, including `narrative` + `metadata`. v3 → 400+ rows ≈ 0.5–1 MB per page load, no `Cache-Control` anywhere in `server/`. | `server/routes/artworks.ts`, `server.ts` |
| 5 | **P1** | Cron | **The scheduled job has never fired.** Blob holds 4 dumps, all from manual invocations (19:29–20:08 UTC); none from the 06:43 window. Hobby logs are kept **1 hour**, so a silent failure leaves no trace. | `server/routes/cronBackup.ts`, new `scripts/verify-offsite-backup.ts` |
| 6 | **P1** | Email | No environment separation: preview deployments would mail real collectors. Add a to-address override / dry-run for non-production. | `server/emailService.ts`, `.env.example` |
| 7 | **P1** | v3 | **Single image per artwork** (`artworks.image_url`) vs murals with progress/detail shots; and `POST /api/artworks` hardcodes fine-art defaults (year 2024, "Acrylic on Canvas", 48"×60", $9,500, "Neon Americana"). Never import v3 through that route. | new migration + `server/routes/artworks.ts:106-131` |
| 8 | **P2** | Email | `GET /api/email/status` is **public** and leaks `adminEmail` + config. `ADMIN_EMAIL` / `SITE_URL` / `BRAND_LOGO_URL` are unset in Vercel (hardcoded fallbacks in use). | `server.ts:48-56`, Vercel env |
| 9 | **P2** | Cron | Local `@vercel/blob` scripts break with `OIDC is enabled for this project, but not for the "development" environment` because `vercel env pull` writes `VERCEL_OIDC_TOKEN` into `.env.local`. | runbook, any future off-site verifier |
| 10 | **P2** | v3 | Upload route (`server/routes/media.ts`) writes **one object, no renditions** — every newly uploaded image is served at full resolution. v3's ~400 images make that a performance regression. | `server/routes/media.ts` (reuse `sharp` as in `scripts/migrate-cloudinary-to-supabase.ts`) |
| 11 | **P2** | v3 | Archive is image-poor: **423** unique `wp-content/uploads` basenames referenced vs ~90 content images on disk; **206** `web.archive.org` URLs. Plan re-fetch + a `needs_image` state. | new `scripts/` extraction step |
| 12 | **P2** | v3 | No `kind`/discipline, no `source_*` provenance, no FTS index, no multi-image join. Add before the backfill, not after. | new `supabase/migrations/2026_09_1X_v3_*.sql` |
| 13 | **P3** | Email | Supabase Auth mailer (signup/confirm/magic-link) is dashboard-only and unbranded unless the generated files in `supabase/email-templates/` are pasted in. | Supabase dashboard |
| 14 | **P3** | Cron | Add per-day idempotency (skip if a dump for today's UTC date exists) — Vercel can deliver the same run twice. | `server/routes/cronBackup.ts` |

---

## 1. CRON environment variable

### 1.1 Verified state — the secret works today

| Check | Result |
| :-- | :-- |
| `vercel crons ls` | 1 job: `/api/cron/backup` @ `43 6 * * *` |
| `vercel env ls` | `CRON_SECRET` — type **Secret**, **Production** only, created 41 min ago. **There is no variable named `CRON`.** |
| `curl -H "Authorization: Bearer $CRON_SECRET" …/api/cron/backup` | **200** → `{"stamp":"2026-09-14T20-08-20-091Z","tables":8,"rows":307,"migrations":11,"uploaded":9,"retainedDumps":4,"storeBytes":1626372,"allowanceUsed":0.0015,"durationMs":1015}` |
| No header | **401** |
| Wrong bearer | **401** `{"success":false,"error":"Unauthorized."}` |

The route **fails closed**: an unset/empty secret returns **503**, not 200
(`server/routes/cronBackup.ts:42-55`). Since production returns 200 with the real bearer and 401
without it, `CRON_SECRET` is present, non-empty (64 chars) and correctly scoped.

### 1.2 Likely causes of "an empty CRON variable" (ranked)

1. **Secret masking — benign, and the most likely.** Vercel never renders the value of a
   type-*Secret* variable. It appears as an empty value cell in Settings → Environment Variables.
   Proof it is set: the 200 above.
2. **Environment scoping.** A variable set only in Development/Preview shows blank when the
   dashboard filter is Production. Real scoping gap in this project: `BLOB_READ_WRITE_TOKEN` is
   **Production + Preview** but **not** Development, so local runs depend entirely on `.env.local`.
3. **Wrong project.** `vercel project ls` lists **10** projects under `ventureio`
   (`roryskagen`, `skagen-blog`, `rio-codex`, …). Only `roryskagen` has a cron job.
4. **Stale deployment.** Env changes do not reach an existing deployment. Newest production
   deployment is 31 min old, so code and env are currently in sync. If you just added the variable,
   redeploy: `vercel redeploy <deployment-url>` (no `--yes`; it preserves git metadata, unlike
   `vercel --prod` from local).
5. **A var literally named `CRON` with an empty value.** Nothing in the code reads `CRON` — only
   `CRON_SECRET` (`server/routes/cronBackup.ts:43`). Such a variable is inert but confusing: delete it.

### 1.3 Exact fix steps (use only if the endpoint ever answers 503)

```bash
# 1) Re-create the secret (>= 16 chars; docs recommend a random string)
vercel env rm CRON_SECRET production --yes
openssl rand -hex 32 | vercel env add CRON_SECRET production

# 2) Optional: Preview too, so you can trigger the route on preview URLs.
#    Vercel Cron itself only ever invokes the PRODUCTION deployment.

# 3) Env changes require a redeploy
vercel ls roryskagen --yes            # copy the production deployment URL
vercel redeploy <production-deployment-url>

# 4) Verify (expect 200 / 401 / 401)
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $CRON_SECRET" \
  https://roryskagenart.com/api/cron/backup

# 5) Refresh the local copy used by runbook §2b
vercel env pull .env.local --yes
```

Gotcha: `vercel env pull` also writes `VERCEL_OIDC_TOKEN`. Any local script using `@vercel/blob`
then fails with `Vercel Blob: OIDC is enabled for this project, but not for the "development"
environment`. Pass `token` explicitly (or `delete process.env.VERCEL_OIDC_TOKEN`) in local scripts.

### 1.4 Hobby-plan cron limits (from `vercel.com/docs`, fetched today)

| Limit | Hobby | Pro / Enterprise |
| :-- | :-- | :-- |
| Cron supported? | **Yes — all plans** | Yes |
| Jobs per project | **100** | 100 |
| Minimum interval | **Once per day** (anything more frequent **fails the deployment**) | Once per minute |
| Scheduling precision | **Per hour, ±59 min** (a `43 6 * * *` job fires 06:43:00–06:59:59 **UTC**) | Per minute |
| Function timeout | default 10 s, **max `maxDuration` 60 s** | 15 s default / 300 s max (Pro), 900 s (Ent) |
| Timezone | always UTC | UTC |
| Retries on failure | **None — Vercel will not retry** | None |
| Runtime log retention | **1 hour** | 1 day (Pro) / 3 days (Ent) |

Your `vercel.json` sets `functions["api/index.js"].maxDuration: 60`, i.e. exactly the Hobby
ceiling — it is honoured, and cannot be raised. The run takes ~1.0–1.3 s.

Other behaviours that matter here: delivery is best-effort (a run can be missed *or delivered
twice*), 3xx responses are treated as final and not followed, cron does not run under
`vercel dev`, and **an instant rollback does not update cron config** — the job keeps pointing at
the old schedule.

### 1.5 How to verify a job actually executed

1. **Trust the side effect, not the logs.** The durable evidence is the object in Blob. Read-only
   listing today: **36 objects / 4 dumps × 9 files × 406,593 B**, stamps
   `2026-09-14T19-29`, `19-32`, `20-07`, `20-08` UTC — **all manual**. No `06:4x` dump exists.
   The cron entry only landed in `vercel.json` at **16:12 -03 (19:12 UTC)** today
   (`2834f22 feat(backup): schedule an off-site catalog dump to Vercel Blob`), i.e. *after* today's
   06:43 window. **First scheduled run: 2026-09-15, 06:43–06:59 UTC.**
2. **Logs (only useful within the hour):** `vercel logs https://roryskagenart.com` → look for
   `λ GET /api/cron/backup`. Dashboard: Settings → Cron Jobs → *View Logs*
   (filter `requestPath:/api/cron/backup`).
3. **Make it durable — recommended.** Hobby keeps runtime logs for 1 hour, so a failure at 06:43 is
   invisible by breakfast. Options, cheapest first:
   - write `catalog-backups/_last_run.json` (stamp, status, durationMs, rowCount) **first**, and
     have `scripts/verify-offsite-backup.ts` fail if the newest dump is older than ~26 h;
   - log `req.get('user-agent')` (`vercel-cron/1.0`) and `x-vercel-cron-schedule` at
     `server/routes/cronBackup.ts:78` so a scheduled run is distinguishable from a manual curl;
   - ship the missing `scripts/verify-offsite-backup.ts` (finding B4 in the v2.13.1 prompt) —
     `list` → newest/`--stamp` → download with **`access: 'private'`** → reuse `verifyDump`.
4. **Manual trigger:** `curl -H "Authorization: Bearer $CRON_SECRET" https://roryskagenart.com/api/cron/backup`.
   Vercel documents no CLI command for triggering a cron job.

---

## 2. Email (Resend on Vercel)

### 2.1 Current configuration, per environment

| Variable | Local (`.env`) | Vercel Dev | Vercel Preview | Vercel Prod |
| :-- | :-- | :-- | :-- | :-- |
| `RESEND_API_KEY` | ✅ (`.env`) | ✅ Secret | ❌ | ❌ |
| `RESEND_EMAIL_DOMAIN` | ✅ | ✅ Config | ❌ | ❌ |
| `ADMIN_EMAIL` | ❌ | ❌ | ❌ | ❌ |
| `SITE_URL` | ❌ | ❌ | ❌ | ❌ |
| `BRAND_LOGO_URL` | ❌ | ❌ | ❌ | ❌ |

**VERIFIED:** `GET https://roryskagenart.com/api/email/status` →
`{"configured":false,"domain":"roryskagenart.com","adminEmail":"rory@ventureio.com",
"fromAddress":"Rory Skagen Art <onboarding@resend.dev>","siteUrl":"https://roryskagenart.com",
"apiKeyPresent":false}`.

So: **local development sends mail; Preview and Production do not.** `getResendClient()` returns
`null` (`server/emailService.ts:16-25`), `deliver()` short-circuits with
`{success:false,error:'Resend API key is not configured'}`, and every send — inquiry notification,
collector confirmation, staff invite, admin password reset, access/email-change notice — is a no-op
in production today.

### 2.2 Failure modes, ranked

1. **Silent inquiry loss (P0).** `POST /api/inquiries` returns `201 {success:true,
   emailDispatched:true}` **unconditionally** (`server/routes/inquiries.ts:47`) — the flag is a
   literal, never the result of `deliver()`. A collector is told "we got your message"; the studio
   never hears. Recovery depends on someone opening `#/admin → Inquiries`.
2. **Fire-and-forget in a serverless runtime (P0).** Both sends are `.catch()`-ed after
   `res.status(201).json(...)` (`inquiries.ts:29-45`). Once the response is flushed Vercel may
   freeze the instance, so the Resend call can be killed mid-flight. In serverless, **await before
   responding** (or use `waitUntil`/`after`).
3. **Sender/domain mismatch (P1).** With `RESEND_EMAIL_DOMAIN` unset the default is
   `roryskagenart.com`, so the From becomes `studio@roryskagenart.com`. Resend rejects sends from an
   unverified domain (`403 The roryskagenart.com domain is not verified`). Verify the domain and the
   SPF/DKIM/DMARC records in Resend → Domains before switching the key on.
4. **`onboarding@resend.dev` trap (P1).** When `RESEND_API_KEY` is missing the From is rewritten to
   `onboarding@resend.dev` (`emailService.ts:34`), which Resend only allows to deliver **to the
   account owner's own address**. If a key is added but the domain is not verified, studio
   notifications to `rory@ventureio.com` bounce while local tests look fine.
5. **No environment separation (P1).** Nothing stops a preview deployment from emailing real
   collectors once a key exists; nothing stops a dev key from being reused in prod.
6. **Public config leak (P2).** `GET /api/email/status` (`server.ts:48`) has **no auth** and
   publishes `adminEmail`, `fromAddress`, `domain`, `siteUrl`, `apiKeyPresent`.
7. **Hardcoded recipients (P2).** `jaden@venturepilot.org` is always added to studio notifications
   (`emailService.ts:102`) and `rory@ventureio.com` is the fallback in three places. Both should be
   env-driven (`ADMIN_EMAIL` + `STUDIO_CC`).
8. **Second mailer (P3).** Supabase Auth still sends signup/confirm/magic-link/reset mail with its
   own templates; branding that one requires pasting `supabase/email-templates/*.html` into the
   dashboard. Branding Resend does nothing for it.

### 2.3 Improvements — reliability, observability, safe testing

**Fix now (P0/P1)**
- Add `RESEND_API_KEY` **and** `RESEND_EMAIL_DOMAIN` to **Production** (and Preview) in Vercel →
  `vercel env add RESEND_API_KEY production`, then `vercel redeploy <prod-url>`.
- `server/routes/inquiries.ts`: `await` both sends, then report the truth:
  ```ts
  const [studio, collector] = await Promise.allSettled([...]);
  return res.status(201).json({ success: true, inquiry: savedInquiry,
    email: { studio: studio.status === 'fulfilled' && studio.value.success,
             collector: collector.status === 'fulfilled' && collector.value.success } });
  ```
  Keep returning 201 when mail fails — a collector must not be punished for a mailer outage.
- Add durable state so failures are visible outside the 1-hour log window: `inquiries.email_status`
  (`pending|sent|failed`) + `inquiries.email_error` (new additive migration) or a
  `public.email_log` table. Surface it in `src/components/admin/InquiriesView.tsx`.

**Environment separation (P1)**
- Add `EMAIL_MODE` (`live|redirect|off`) and `EMAIL_REDIRECT_TO`:
  - any value other than `live` ⇒ all outbound mail is re-pointed to `EMAIL_REDIRECT_TO`, subject
    prefixed `[PREVIEW]`, original recipient in the body. Implement once in `deliver()`
    (`server/emailService.ts:63-78`) so every template inherits it.
  - Preview + Development ⇒ `redirect`; Production ⇒ `live`.
- Use a separate Resend key per environment (dev/preview/prod) so revoking one does not take down
  production, and so preview usage never counts against the production sending reputation.
- Keep `ADMIN_EMAIL`, `SITE_URL`, `BRAND_LOGO_URL` out of source: they exist in `.env.example` but
  are unset in Vercel, so `rory@ventureio.com` / `https://roryskagenart.com` come from hardcoded
  fallbacks in `server/emailService.ts:29-30` and `server/emailTemplates.ts`. Set them explicitly.

**Observability (P2)**
- Resend webhook → `POST /api/email/webhook` (verify the `svix` signature) recording
  `delivered|bounced|complained|deferred` against the stored `messageId`. Return `messageId` from
  `deliver()` (it already can) and persist it on the inquiry row.
- Structured one-line logs (`[email] kind=inquiry status=failed error=…`) — plain
  `console.log`/`warn` today, and Hobby keeps runtime logs for one hour.
- A weekly "is mail alive" check: `POST /api/email/send-test` (admin-only, already exists at
  `server.ts:58`) is manual; consider having the daily cron assert `getEmailConfig().configured`.

**Safe testing outside production (P2)**
- Gate `GET /api/email/status` behind `requireAuth`/`requireRole('admin')` — or return only
  `{configured}` anonymously.
- `.env.example`: add `EMAIL_MODE`, `EMAIL_REDIRECT_TO`, `STUDIO_CC`; document that
  `onboarding@resend.dev` can only reach the account owner.

---

## 3. v3.0.0 — supporting the full Wayback dataset

**Scale to plan for (VERIFIED):** `wayback/` = 18 MB / 365 files — 278 HTML pages
(119 murals + 159 fine-art), 170 image files (10.2 MiB), **423** unique `wp-content/uploads`
basenames referenced, **206** unique `web.archive.org/...` image URLs. Current catalog: 138
artworks, 152 `media_assets` rows, 605 storage objects / 76.6 MiB.
Realistic v3 landing: **~350–450 artworks, ~600–900 images, ~250–400 MiB** of media.

### 3.1 Data modeling and storage

| Need | Today | Change |
| :-- | :-- | :-- |
| Mural vs fine-art discriminator | none — `gallery_series` is the only axis; murals would mix into the fine-art catalog | `artworks.kind text NOT NULL DEFAULT 'artwork'` (`'artwork'`/`'mural'`), CHECK-constrained, in a new additive migration |
| Provenance / re-runnability | none | `source_site text`, `source_url_path text`, `source_post_id text` + `UNIQUE (source_site, source_post_id)` so re-runs are idempotent and auditable |
| Mural-specific fields | `location text`, `metadata jsonb` (no GIN index) | either a `mural_projects` side table (client, address, city, install year, surface, sq ft, crew, condition) **or** `metadata` + `CREATE INDEX … USING gin (metadata jsonb_path_ops)`. Prefer real columns for anything filtered or sorted; keep `metadata` for long-tail |
| Multiple images per work | `artworks.image_url` is **single-valued** | `artwork_images(artwork_slug, media_asset_id, position int, role text, is_primary bool)` with `UNIQUE (artwork_slug, position)`; keep `image_url` as the denormalized primary for backward compatibility |
| Categories | `taxonomies` + `artwork_terms` exist but `artwork_terms` is **empty** | seed a `project-type` vocabulary (business, restaurant, museum, retail, signage, event, featured) and a `collection` vocabulary for the 11 fine-art series |
| Status semantics | `status text` = Available/SOLD, no CHECK | murals are not sold — add `availability text` or a `kind`-aware status vocabulary; document rather than overload `status` |
| Full-text search | none | `search_vector tsvector` generated from title/narrative/medium/gallery_series + GIN index; add `pg_trgm` for the ≥0.85 fuzzy title match the reconcile step needs |

**Storage budget — the real constraint.** Supabase is on the **Free plan (1 GB storage)**; you are
at 76.6 MiB today. 800 new images with 4 renditions each will not fit. Decide before the migration:
cap renditions (`full` ≤ 2000 px, WebP q80–82; skip `original` for wayback-derived images — note the
151 unreferenced `original.*` masters already stored today), or upgrade. Also: **Supabase DB backups
exclude Storage objects**, so images currently have no off-site copy at all — one vendor, zero
redundancy. Add an off-site image mirror (Google Drive 15 GB or R2/B2) or accept the risk explicitly.

### 3.2 Pagination and search

- `server/routes/artworks.ts:18-60` selects **every** row with `narrative` + `metadata` and
  `ORDER BY updated_at DESC`. Measured: **138 rows = 165,193 B**. Add
  `?page&per_page&kind&series&status&q&sort`, return `{items, total, page, per_page}`, and use a
  **list projection** that omits `narrative`/`metadata` (they are the payload). Keep
  `GET /api/artworks/:slug` as the detail read.
- `src/engine/galleryStateEngine.ts:210` fetches the whole catalog and filters in memory;
  `src/components/admin/CatalogView.tsx` renders it. Both need pagination/virtualization before
  450 rows.
- `GET /api/inquiries` is hard-limited to `LIMIT 100` (`server/routes/inquiries.ts:58`) — fine, but
  paginate it too if the v3 launch drives traffic.
- Move search server-side (FTS above) instead of client-side substring matching.

### 3.3 Media handling and performance

- `src/data/assetRegistry.ts` = **444,957 B / 4,602 lines**, imported by
  `src/data/assetResolver.ts` and therefore **shipped to every visitor**. At 3–4× assets this is
  1.5–2 MB of JavaScript. Replace with `GET /api/media/registry` (or per-slug lookup) returning
  JSON with a long `Cache-Control`; keep `scripts/generate-asset-registry.ts` writing to
  `data/archive/` instead of `src/` so it stops entering the bundle.
- `server/routes/media.ts` upload writes a **single object with no renditions** and sets `url` ==
  `thumbnail_url`. `sharp` is already a dependency but is only used in
  `scripts/migrate-cloudinary-to-supabase.ts`. Generate thumb/hero/full/lqip on upload before v3
  loads ~400 images, or the public gallery serves full-resolution originals.
- The archive is **image-poor**: 423 referenced basenames vs ~90 content images on disk, plus 206
  remote `web.archive.org` URLs. Add an explicit fetch step with a manifest, retries, and a
  `needs_image` state — do not assume extraction will find a file.
- Keep LQIP + `srcset`/`sizes` on renditions; the registry already models them.

### 3.4 Caching

There is **no `Cache-Control`, `ETag`, or `Vary` anywhere** in `server/` or `src/server/` today
(grep: zero hits). Add:

| Surface | Header |
| :-- | :-- |
| Public catalog list | `Cache-Control: public, max-age=60, stale-while-revalidate=300` + `ETag` |
| Registry endpoint | `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` |
| Supabase Storage renditions | upload with `cacheControl: '31536000'`; serve `max-age=31536000, immutable` |
| Any response built for a signed-in editor | `Cache-Control: private, no-store` |

⚠️ `GET /api/artworks` serves **both** anonymous visitors and editors (drafts are added for
editor+ at `server/routes/artworks.ts:34-43`). Do not blanket-cache that route. Either
`Vary: Authorization, Cookie` and skip caching when `resolveCmsUser()` returns a viewer, or —
cleaner — split a public `/api/catalog` from the admin route.

### 3.5 Migration and backward compatibility

1. **Do not import through `POST /api/artworks`.** It hardcodes `year '2024'`,
   `medium 'Acrylic on Canvas'`, `dimensions '48" x 60"'`, `price '$9,500'`,
   `gallery_series 'Neon Americana'`, `location 'Austin Studio'`
   (`server/routes/artworks.ts:106-131`). Every mural would acquire those. Use
   `npx tsx scripts/run-migrations.ts <file>.sql` per the PRD.
2. **Additive + idempotent, and correctly ordered.** Any migration touching a core table must sort
   after `2026_09_01_baseline_core_tables.sql`; name new files `2026_09_15_v3_*.sql`.
   `src/test/migrationSafety.test.ts` enforces this — extend it for the v3 files.
3. **Fill-only-empty.** Backfills must `UPDATE … WHERE col IS NULL OR col = ''` and
   `INSERT … ON CONFLICT (slug) DO NOTHING`; mural rows land `draft = true` (trigger forces
   `enabled = false`). Prove it with a test that runs the migration twice.
4. **Prove the backup before the load.** `npx tsx scripts/backup-catalog.ts`, then confirm the
   **scheduled** off-site dump has actually run once (§1.5) — today it has not.
5. **Re-baseline the media guard.** `scripts/verify-media-backup.ts` currently tolerates 151
   unreferenced `original.*` masters. After v3 that number changes; re-record the expected set or
   the guard becomes noise.
6. **Regenerate and de-bundle the registry** after media changes
   (`scripts/generate-asset-registry.ts`), and re-run `scripts/verify-media-backup.ts`.
7. **Verify anonymity of drafts** after the backfill with an anonymous `GET /api/artworks` (curl,
   no session) — murals must not appear.
8. **Slug collisions** (`commissions-misc/today` → `today-atomic-sunrise`, marcia-ball and
   austin-postcard dedupe pairs): resolve in the reconcile report, never in the SQL generator.

---

## 4. Consolidated change list

**Vercel dashboard / env**
- Add `RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN` to **Production** (and Preview) → redeploy.
- Add `ADMIN_EMAIL`, `SITE_URL` to Production; add `EMAIL_MODE`, `EMAIL_REDIRECT_TO` to
  Preview/Development.
- Keep `CRON_SECRET` in Production (already correct); optionally add to Preview.
- Delete any empty variable literally named `CRON`.

**Code**
- `server/routes/inquiries.ts` — await sends, report real delivery state.
- `server/emailService.ts` — env-driven recipients, `EMAIL_MODE` redirect in `deliver()`.
- `server.ts:48` — require auth on `/api/email/status`; trim the payload.
- `server/routes/cronBackup.ts` — log UA + `x-vercel-cron-schedule`; optional same-day skip.
- `server/routes/artworks.ts` — pagination, list projection, conditional cache headers.
- `server/routes/media.ts` — renditions on upload.
- `server/routes/registry.ts` (new) + `src/data/assetResolver.ts` — move the 445 KB registry off the
  client bundle.
- `server/lib/httpCache.ts` (new) — shared cache-header helper.
- `src/engine/galleryStateEngine.ts`, `src/components/admin/CatalogView.tsx` — paginate/virtualize.
- `scripts/verify-offsite-backup.ts` (new) — the missing way to check a Blob dump.
- `supabase/migrations/2026_09_1X_v3_*.sql` (new) — `kind`, `source_*`, FTS, `artwork_images`,
  taxonomy seed, `inquiries.email_status` / `.email_error`.

**Docs**
- `docs/runbooks/database-backup-restore.md` — add "how to prove the scheduled dump ran" (§1.5).
- `docs/runbooks/supabase-email-branding.md` — record the two-mailer split and the domain-
  verification prerequisite.
- `.env.example` — add `EMAIL_MODE`, `EMAIL_REDIRECT_TO`, `STUDIO_CC`.
