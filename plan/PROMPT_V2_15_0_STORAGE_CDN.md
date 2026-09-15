# Plan: v2.15.0 — Storage & CDN hardening (agent hand-off prompt)

**How to use:** Start a new agent session for the release, then `@` this file (and
`@AGENTS.md`). The brief below is fully self-contained — the agent needs no prior
context from any earlier conversation.

---

## Brief for the agent — execute release v2.15.0

You are taking over the roryskagenart.com gallery CMS to ship **release v2.15.0**,
whose sole scope is **storage + CDN hardening** of the existing media library so the
project stays comfortably inside the **Supabase FREE tier** ahead of the v3.0.0 Wayback
mural/fine-art merge (which will reuse the pipeline you build here).

`AGENTS.md` is canonical — read it first; it supersedes anything stale. Also read
`.workbuddy-ai/memory/MEMORY.md` and the **2026-09-14** daily-log section
*"Storage & CDN research (v.0)"* for the verified numbers behind this brief.

### Project & guardrails (from AGENTS.md — do not skip)
- React 19 + Vite 6 + Tailwind v4 + Express 4 (`server/`) + Supabase (PG + Storage +
  Auth) + Resend + `multer` + `sharp` + Vercel. **Supabase is the only vendor;
  Cloudinary is decommissioned forever.**
- Env vars are `VRCL_SUPA_*`. Never print `.env` / `.env.local` values.
- DB writes ONLY via `npx tsx scripts/run-migrations.ts` (idempotent ledger
  `public.schema_migrations`) or `getSupabaseAdmin()`. **NEVER run migrations through
  the Supabase CLI** — two ledgers exist and `2026_*` filenames collapse. CLI is fine
  only for `start` / `db dump`.
- Run BOTH `npm run lint` AND `npm test` before declaring done (vitest does not
  typecheck; `tsconfig` lacks `strictNullChecks`, so only `lint` catches union-narrowing bugs).
- Release flow: conventional commits on `main` → push `release/v2.15.0` branch → PR
  (gates: Vercel preview + Socket Security + Debricked; merge only when
  `gh pr view <n> --json mergeStateStatus` is `CLEAN`) → `gh pr merge --merge`
  (**never `--squash`**) → `git reset --hard FETCH_HEAD` → annotated tag **on the merge
  commit** → push tag by object SHA → `gh release create --verify-tag`. Never create
  local branches; sync with `reset --hard FETCH_HEAD`.
- **Precondition:** v2.14.0 must already be shipped (main sitting at the v2.14.0 merge
  commit) before you start. If it is not, stop and tell the owner.

### Background (verified findings)
- Supabase FREE: **1 GB file storage**, **5 GB egress/mo**, 500 MB DB. No auto backups /
  PITR; pauses after 7 days idle — the repo dump is the only recovery path.
- Vercel Blob Hobby (off-site backup): **1 GB/mo** + 2,000 advanced ops; over ⇒ 30-day
  cutoff. Backup is gated on `CRON_SECRET` (unset ⇒ 503) and writes **private** objects
  via `vercel.json` cron `43 6 * * *` → `/api/cron/backup`. Verify a real daily run with
  `scripts/verify-offsite-backup.ts`.
- Current catalog: **152 `media_assets` rows / 605 Storage objects / 76.6 MiB (~7.5% of
  1 GB)**. Problem: **151 full-res `original.*` masters are stored but unreferenced by
  design**, and `server/routes/media.ts` generates **NO real renditions** (url ==
  thumbnail_url) despite thumb/hero/full columns + a `renditions` JSON existing. The UI
  already reads `artwork.renditions?.{thumb,hero,full}` (GalleryGrid, ArtworkFocusView,
  ArtworkQuickViewModal).
- `GET /api/artworks` currently ships **no `Cache-Control`** anywhere (known v3 perf
  blocker).

### v2.15.0 scope — do these IN ORDER
1. **Pre-change backup + verify.** Run `scripts/backup-catalog.ts`, then
   `scripts/verify-backup.ts --all` and confirm exit 0. Do not proceed until verified.
2. **WebP + resize encode step.** Add an encode stage (sharp is available; see
   `scripts/migrate-cloudinary-to-supabase.ts` for existing sharp usage) that writes every
   asset as **WebP**, longest side capped at **2000px (fine art) / 1600px**, quality 80.
   JPG→WebP q80 typically saves 60–75%; PNG→WebP saves more. Apply to the existing catalog.
3. **Real rendition ladder.** Fix `server/routes/media.ts` so a genuine **thumb / hero /
   full** set is produced and stored in `renditions`, and the UI serves them (columns
   already exist). Stop the `url == thumbnail_url` no-op.
4. **Drop unreferenced masters.** After re-encoding to one optimized WebP "full" master,
   delete the 151 separate unreferenced `original.*` objects. Expected to roughly halve the
   76.6 MiB footprint. Keep the pre-change backup until the release is verified live.
5. **CDN in front of Supabase Storage (free).** Put **Cloudflare** in front of the Supabase
   Storage bucket as a cache proxy so gallery image traffic is served from Cloudflare's edge
   and Supabase egress drops to cache misses. Supabase free already includes 5 GB *cached*
   egress. Add `Cache-Control` (long-lived, immutable for renditions) on objects — currently absent.
6. **Re-measure & report.** After the encode + CDN change, report total Supabase Storage
   used (MB) and confirm Vercel Blob backup still < 1 GB/mo (~0.5 MB/run). Target **< ~800 MB**.

### Acceptance criteria
- [ ] All catalog assets are WebP at ≤2000px, served via thumb/hero/full renditions.
- [ ] Unreferenced `original.*` masters removed; pre-change backup verified.
- [ ] Cloudflare caching + `Cache-Control` confirmed reducing Supabase egress on a cache HIT.
- [ ] Post-change Supabase Storage **< 800 MB**; Vercel Blob backup **< 1 GB/mo**.
- [ ] `npm run lint` and `npm test` green; PR gates CLEAN; tagged `v2.15.0` by SHA.

### Escalation (only if post-change storage approaches ~800 MB+)
Do NOT default to Supabase Pro ($25/mo, 100 GB). Move bulk originals to **Cloudflare R2**
(10 GB free, $0 egress) or **Bunny Storage + CDN** (~$0.02/GB + ~$1/mo/1 TB), keeping
Supabase for DB + thumbnails. For any VIDEO added later, serve via a streaming CDN
(Cloudflare Stream / Bunny Stream / Mux), never Supabase egress. Report the path taken.

### Hand-off to v3.0.0
The Wayback merge (v3.0.0) will ingest `wayback/centraltexasmurals.com-v1` (20 imgs /
0.84 MB) and `wayback/roryskagen.com-v1` (150 imgs / 9.40 MB total — **170 imgs / 10.24 MB,
NO video, 0 imgs >2000px** — they are downscaled Wayback captures). Reuse the v2.15.0
WebP+resize + rendition pipeline for that ingest. **At v3.0.0, first confirm with the owner
whether ingestion uses these 10 MB wayback snapshots or the TRUE full-resolution originals
of the deprecated sites (murals can be tens of MB each)** — that answer changes the design,
and v2.15.0 deliberately does NOT depend on it.

When done, append a brief note to `.workbuddy-ai/memory/YYYY-MM-DD.md` with the final
measured Storage MB and what shipped.
