# Deployment Log

This document tracks all production and preview deployments for **`roryskagenart.com`** hosted on **Vercel** (`ventureio/roryskagen`).

---

## Production Environments & Domains

- **Primary Custom Domain:** [https://roryskagenart.com](https://roryskagenart.com)
- **Secondary Domain:** [https://www.roryskagenart.com](https://www.roryskagenart.com)
- **Vercel Production Alias:** [https://roryskagen.vercel.app](https://roryskagen.vercel.app)
- **Project Console:** `ventureio / roryskagen`
- **Connected Database:** Supabase PostgreSQL (`supabase-roryskagen` - `orphcusijzkxpxkzapjp.supabase.co`)
- **Storage Bucket:** `artwork-images` (Supabase Storage)

---

## Deployment History (Latest to Earliest)

> **Note on `n/a` build times (2026-09-15 00:59Z onward):** build durations come from
> `vercel ls --json`, which needs a Vercel token that is not configured in this environment. Those
> rows were reconciled from **GitHub's Deployments API** instead, so the URL, target, status and
> commit are exact — only the duration is missing.

| Date (UTC) | Version | Deployment URL | Status | Build Time | Target | Associated Commits / Milestone |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-09-16** | **v3.1.0** | [`roryskagen-h6hw785vd-ventureio.vercel.app`](https://roryskagen-h6hw785vd-ventureio.vercel.app) | `● Ready` | n/a | Production | `0ab5c5b0`: PR #36 — **the studio feedback & planning board, Capture** (`release/v3.1.0`). Adds `public.plan_items` (15 columns, 4 CHECK constraints, 3 indexes, RLS with one `is_admin_or_editor()` policy and **no public policy** — the table holds public submitters' email addresses) and `server/routes/plan.ts`: six endpoints behind two doors — `POST /api/plan/feedback` is public and server-forced to `kind='suggestion'` / `source='public'` / `status='new'`, while `POST /api/plan/items` sits behind `requireAuth` and takes `author_id` from the session. A `viewer` can **file** but cannot **read** the board: `GET`/`PATCH`/`DELETE /api/plan/items*` require `editor` (open question **Q-E**). Also: admin Planning + Changelog views (the latter generated from `CHANGELOG.md` + `DEPLOYMENT_LOG.md`), a footer feedback modal, honeypot + rate-limit guards shared with the inquiry route, and `plan_items` added to `scripts/lib/restorePlan.ts` in the same change. **The migration was applied after the merge** — `public.plan_items` exists, `schema_migrations` 15 → 16. ⚠️ Between the merge and the migration the **off-site backup was broken**: `server/lib/catalogDump.ts` shares `RESTORE_ORDER` with `scripts/backup-catalog.ts`, so both threw `relation "public.plan_items" does not exist`; a partial dump (9 of 10 tables, no manifest) was written at `00:59:45Z` and is quarantined under `data/backups/` as `...-FAILED-no-manifest`. Post-migration backup: **10 tables, 862 rows, 16 recorded migrations, format v2, sha256 verified**. Annotated tag `v3.1.0` points at this commit **(Current Active)** |
| 2026-09-16 | v3.1.0-preview | [`roryskagen-haqtecemf-ventureio.vercel.app`](https://roryskagen-haqtecemf-ventureio.vercel.app) | `● Ready` | n/a | Preview | `0a6cbae7`: `release/v3.1.0` preview (PR #36) |
| **2026-09-16** | post-v3.0.0 | [`roryskagen-b1yaiomkr-ventureio.vercel.app`](https://roryskagen-b1yaiomkr-ventureio.vercel.app) | `● Ready` | n/a | Production | `42942d8b`: PR #35 — the `v3.1.0`–`v3.3.0` feedback & planning roadmap, the `ROADMAP_V3.md` renumber (**Phase 5 → `v3.4.0`**), and the two unshipped Phase 2 promises (`GET /api/artworks` pagination, the R-20 `assetRegistry.ts` de-bundle) re-homed to Phase 5 with exit criteria. Docs-only; no release cut. **Reconciled late** — this deploy had no row until the v3.1.0 reconciliation |
| **2026-09-15** | post-v3.0.0 | [`roryskagen-jmb7duit7-ventureio.vercel.app`](https://roryskagen-jmb7duit7-ventureio.vercel.app) | `● Ready` | n/a | Production | `eac45a5c`: PR #34 — re-verify the `Cache-Control` finding after the v3.0.0 load (**604/1109**, correcting `plan/README.md`'s stale 604/605). Docs-only; no release cut. **Reconciled late** — this deploy had no row until the v3.1.0 reconciliation |
| **2026-09-15** | **v3.0.0** | [`roryskagen-eveke8i3u-ventureio.vercel.app`](https://roryskagen-eveke8i3u-ventureio.vercel.app) | `● Ready` | n/a | Production | `dc4be84`: PR #32 — **Phase 4, the load** (`release/v3.0.0`), the only v3 release that **writes production data**. Merges the two archived predecessor sites into the catalog: `artworks` **138 → 205** (+67, −0: 62 mural, 123 painting, 20 kind-null), `artwork_images` 0 → 168, `artwork_terms` 0 → 142, `taxonomies` 3 → 13, `media_assets` 152 → 320, recorded migrations 12 → 15. **60 of the 62 murals land `draft = true` AND `enabled = false`** — confirmed against production: **0 of the 60 new mural slugs appear in the live sitemap** (138 `<loc>`), while the 2 merge targets stay published. D4/Q18 corrects the stored `'2024'` placeholder on those two targets (`austin-postcard` → **2011**, `marcia-ball` → **2015**; the live page title now reads *Austin Postcard (2011)*). Also fixed **R-07** — `artwork_images` was in no backup set, so the only recovery path would have restored a catalog whose murals had lost their cover ordering — and a `run-migrations.ts` trap where `.env`'s production connection string outranked an operator's scratch override. Annotated tag `v3.0.0` points at this commit |
| 2026-09-15 | v3.0.0-preview | [`roryskagen-lb0w5bldu-ventureio.vercel.app`](https://roryskagen-lb0w5bldu-ventureio.vercel.app) | `● Ready` | n/a | Preview | `9f48914`: `release/v3.0.0` preview (PR #32) |
| **2026-09-15** | post-v2.17.0 | [`roryskagen-mflxjjduk-ventureio.vercel.app`](https://roryskagen-mflxjjduk-ventureio.vercel.app) | `● Ready` | n/a | Production | `4946546`: PR #28 — records the **proven off-site restore** in `ROADMAP_V3.md` §4.1.1 (a Blob dump was verified *and restored* into the scratch DB: 298 rows inserted, 0 failed, 138/138 artworks field-exact), settles **Q14 on Free**, records the five Phase 4 gating decisions in the brief, and adds `--out` to `scripts/verify-offsite-backup.ts`. Docs + one dev script — **no runtime change** |
| 2026-09-15 | post-v2.17.0-preview | [`roryskagen-kuopzva2c-ventureio.vercel.app`](https://roryskagen-kuopzva2c-ventureio.vercel.app) | `● Ready` | n/a | Preview | `480713a`: `docs/v3-phase0-proven-restore` preview (PR #28) |
| **2026-09-15** | **v2.17.0** | [`roryskagen-8nfr20e5h-ventureio.vercel.app`](https://roryskagen-8nfr20e5h-ventureio.vercel.app) | `● Ready` | n/a | Production | `d078f0a`: PR #27 — **§3.D recovered-source ingest** (`release/v2.17.0`). Offline only: no schema change, **no database write and no upload**. Annotated tag `v2.17.0` points at this commit |
| 2026-09-15 | v2.17.0-stack ⚠️ | [`roryskagen-1hlmxv2zy-ventureio.vercel.app`](https://roryskagen-1hlmxv2zy-ventureio.vercel.app) | `● Ready` | n/a | Production | `d23feb0` → `ec1d12b` → `af481e1` → `f8ac24d`: **PRs #26, #24, #23 and #25 merged in a 90-second burst**, each triggering its own production deploy. Only the last (`f8ac24d`, PR #25) was live for the ~31 s before `d078f0a`. `af481e1` (PR #23) reports `inactive` — superseded within a second. All four are docs/infra commits with **no runtime change** |
| 2026-09-15 | v2.17.0-preview | [`roryskagen-fxvci04lf-ventureio.vercel.app`](https://roryskagen-fxvci04lf-ventureio.vercel.app) | `● Ready` | n/a | Preview | `ff4a21a`: `release/v2.17.0` preview (PR #27) |
| 2026-09-15 | v2.17.0-preview | [`roryskagen-ds00jjfdj-ventureio.vercel.app`](https://roryskagen-ds00jjfdj-ventureio.vercel.app) | `● Ready` | n/a | Preview | `05472dd`: `docs/v3-handoff-prompts` preview (PR #26) |
| 2026-09-15 | v2.17.0-preview | [`roryskagen-k9mi5utv6-ventureio.vercel.app`](https://roryskagen-k9mi5utv6-ventureio.vercel.app) | `● Ready` | n/a | Preview | `e8cad05`: `docs/v3-roadmap-rebaseline` preview (PR #23) |
| 2026-09-15 | v2.17.0-preview | [`roryskagen-bb12dc4wb-ventureio.vercel.app`](https://roryskagen-bb12dc4wb-ventureio.vercel.app) | `● Ready` | n/a | Preview | `8895914`: `feat/v3-phase-3b-media-path` preview (PR #25) |
| 2026-09-15 | v2.17.0-preview | [`roryskagen-imz50tmv4-ventureio.vercel.app`](https://roryskagen-imz50tmv4-ventureio.vercel.app) | `● Ready` | n/a | Preview | `2748aed`: `feat/v3-phase-3a-extraction` preview (PR #24) |
| 2026-09-15 | post-v2.16.0 | [`roryskagen-rlm0sbuc7-ventureio.vercel.app`](https://roryskagen-rlm0sbuc7-ventureio.vercel.app) | `● Ready` | n/a | Production | `9b4eb91`: PR #22 — deployment-log reconciliation for v2.16.0 (docs-only; no release cut) |
| **2026-09-15** | **v2.16.0** | [`roryskagen-3opl3rped-ventureio.vercel.app`](https://roryskagen-3opl3rped-ventureio.vercel.app) | `● Ready` | n/a | Production | `95e3967`: PR #21 — **media upload ladder** (`POST /api/media/upload` now renders thumb/hero/full + lqip) and **dialog header spacing** (`--dialog-pad`) |
| 2026-09-15 | v2.16.0-preview | [`roryskagen-80qokoqnh-ventureio.vercel.app`](https://roryskagen-80qokoqnh-ventureio.vercel.app) | `● Ready` | n/a | Preview | `cdf5ce6`: `release/v2.16.0` preview (PR #21) |
| 2026-09-15 | post-v2.15.0 | [`roryskagen-j9ads6rw4-ventureio.vercel.app`](https://roryskagen-j9ads6rw4-ventureio.vercel.app) | `● Ready` | n/a | Production | `28fa775`: PR #20 — canonical (unmodified) MIT `LICENSE` text, `DEPLOYMENT_LOG` reconciliation for v2.15.0 |
| 2026-09-15 | post-v2.15.0-preview | [`roryskagen-magujvk3w-ventureio.vercel.app`](https://roryskagen-magujvk3w-ventureio.vercel.app) | `● Ready` | n/a | Preview | `fabc546`: `docs/deployment-log-v2.15.0` preview (PR #20) |
| 2026-09-15 | v2.15.0 | [`roryskagen-mhjkpcdcf-ventureio.vercel.app`](https://roryskagen-mhjkpcdcf-ventureio.vercel.app) | `● Ready` | 29s | Production | `0c1e2e5`: PR #19 — close-out: `robots.txt`, MIT `LICENSE`, B6/B7 backup-cron docs, `scripts/delete-inquiries.ts` |
| 2026-09-15 | v2.15.0-preview | [`roryskagen-qsxizptfv-ventureio.vercel.app`](https://roryskagen-qsxizptfv-ventureio.vercel.app) | `● Ready` | 22s | Preview | `4d26808`: `release/v2.15.0` preview (PR #19) |
| 2026-09-15 | pre-v2.15.0 ⚠️ | [`roryskagen-lzfgy4tht-ventureio.vercel.app`](https://roryskagen-lzfgy4tht-ventureio.vercel.app) | `● Ready` | 21s | Production | `4d26808`: **process error — `main` was pushed before the PR was opened.** Put the v2.15.0 commits into production ~10 min ahead of the gates; corrected by force-pushing `main` back to `ddd68e9`. No commit was lost (`release/v2.15.0` held all six) and the code is identical to `0c1e2e5`, but the release flow was inverted. |
| 2026-09-14 | v2.14.0 | [`roryskagen-acpbha6hs-ventureio.vercel.app`](https://roryskagen-acpbha6hs-ventureio.vercel.app) | `● Ready` | 27s | Production | `ddd68e9`: PR #18 — deployment-log reconciliation for v2.14.0 |
| 2026-09-14 | v2.14.0-preview | [`roryskagen-p0dov38uf-ventureio.vercel.app`](https://roryskagen-p0dov38uf-ventureio.vercel.app) | `● Ready` | 22s | Preview | `15de886`: `docs/deployment-log-v2.14.0` preview (PR #18) |
| **2026-09-14** | **v2.14.0** | [`roryskagen-89shn06c6-ventureio.vercel.app`](https://roryskagen-89shn06c6-ventureio.vercel.app) | `● Ready` | 26s | Production | `ba4cdc9`: PR #17 — fail-able serverless smoke guard, real (credential-free) dump target, incomplete-stamp pruning |
| 2026-09-14 | v2.14.0-preview | [`roryskagen-r312u7fru-ventureio.vercel.app`](https://roryskagen-r312u7fru-ventureio.vercel.app) | `● Ready` | 26s | Preview | `cd061f5`: `release/v2.14.0` preview (PR #17) |
| 2026-09-14 | post-v2.13.0 | [`roryskagen-bmfc8tueb-ventureio.vercel.app`](https://roryskagen-bmfc8tueb-ventureio.vercel.app) | `● Ready` | 32s | Production | `ed8cd83`: **redeploy** of PR #16 to activate `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` — no code change |
| 2026-09-14 | post-v2.13.0 | [`roryskagen-7ir6o8x8o-ventureio.vercel.app`](https://roryskagen-7ir6o8x8o-ventureio.vercel.app) | `● Ready` | 22s | Production | `ed8cd83`: PR #16 — email reliability: persisted delivery outcome, Resend webhook, cron idempotency |
| 2026-09-14 | post-v2.13.0-preview | [`roryskagen-j1ufs3fho-ventureio.vercel.app`](https://roryskagen-j1ufs3fho-ventureio.vercel.app) | `● Ready` | 27s | Preview | `9d019e4`: `feat/email-reliability` preview (PR #16) |
| 2026-09-14 | post-v2.13.0 | [`roryskagen-khhh8k0s1-ventureio.vercel.app`](https://roryskagen-khhh8k0s1-ventureio.vercel.app) | `● Ready` | 28s | Production | `09430f8`: PR #15 — a committed way to verify an off-site dump |
| 2026-09-14 | post-v2.13.0-preview | [`roryskagen-bh1oeied4-ventureio.vercel.app`](https://roryskagen-bh1oeied4-ventureio.vercel.app) | `● Ready` | 28s | Preview | `ddd9849`: `feat/verify-offsite-backup` preview (PR #15) |
| 2026-09-14 | post-v2.13.0 | [`roryskagen-2oh52yeyz-ventureio.vercel.app`](https://roryskagen-2oh52yeyz-ventureio.vercel.app) | `● Ready` | 28s | Production | `1906cc6`: PR #14 — awaited inquiry sends, non-production email routing, trimmed public status |
| 2026-09-14 | post-v2.13.0-preview | [`roryskagen-o8r19kd3i-ventureio.vercel.app`](https://roryskagen-o8r19kd3i-ventureio.vercel.app) | `● Ready` | 31s | Preview | `9e52e19`: `fix/email-delivery-routing` preview (PR #14) |
| 2026-09-14 | post-v2.13.0 | [`roryskagen-h0d4wwenq-ventureio.vercel.app`](https://roryskagen-h0d4wwenq-ventureio.vercel.app) | `● Ready` | 31s | Production | `87c9db8`: PR #13 — v2.13.0 end-to-end backup proof recorded in docs |
| **2026-09-14** | **v2.13.0** | [`roryskagen-l6owfa5ru-ventureio.vercel.app`](https://roryskagen-l6owfa5ru-ventureio.vercel.app) | `● Ready` | 37s | Production | `0aab9b3`: **redeploy** of PR #11 to activate `CRON_SECRET` — no code change |
| 2026-09-14 | post-v2.13.0 | [`roryskagen-840bb4awf-ventureio.vercel.app`](https://roryskagen-840bb4awf-ventureio.vercel.app) | `● Ready` | 21s | Production | `7430c58`: PR #12 — deployment-log reconciliation for v2.13.0 (docs-only; no release cut) |
| 2026-09-14 | post-v2.13.0-preview | [`roryskagen-fho11dxx3-ventureio.vercel.app`](https://roryskagen-fho11dxx3-ventureio.vercel.app) | `● Ready` | 28s | Preview | `dbab164`: `docs/deployment-log-v2.13.0` preview (PR #12) |
| **2026-09-14** | **v2.13.0** | [`roryskagen-nw0o1dvkd-ventureio.vercel.app`](https://roryskagen-nw0o1dvkd-ventureio.vercel.app) | `● Ready` | 27s | Production | `0aab9b3`: PR #11 — backup durability: verifiable dumps (format v2 + self-check), scheduled off-site dump to Vercel Blob, media reconciliation |
| 2026-09-14 | v2.13.0-preview | [`roryskagen-r7sgc8fca-ventureio.vercel.app`](https://roryskagen-r7sgc8fca-ventureio.vercel.app) | `● Ready` | 32s | Preview | `f97b262`: `release/v2.13.0` preview (PR #11) |
| 2026-09-14 | v2.13.0-preview | [`roryskagen-75gdnmrt8-ventureio.vercel.app`](https://roryskagen-75gdnmrt8-ventureio.vercel.app) | `● Ready` | 27s | Preview | `0548783`: `release/v2.13.0` first push (PR #11) — verifiable dumps |
| **2026-09-14** | post-v2.12.1 | [`roryskagen-mn0kyxxco-ventureio.vercel.app`](https://roryskagen-mn0kyxxco-ventureio.vercel.app) | `● Ready` | 21s | Production | `bd414c4`: PR #10 — deployment-log reconciliation for v2.12.1 (docs-only; no release cut) |
| 2026-09-14 | post-v2.12.1-preview | [`roryskagen-i3d75q0ke-ventureio.vercel.app`](https://roryskagen-i3d75q0ke-ventureio.vercel.app) | `● Ready` | 24s | Preview | `2174bcb`: `docs/deployment-log-v2.12.1` preview (PR #10) |
| **2026-09-14** | **v2.12.1** | [`roryskagen-ea803f82o-ventureio.vercel.app`](https://roryskagen-ea803f82o-ventureio.vercel.app) | `● Ready` | 22s | Production | `9466c90`: PR #9 — security patch: the four blanket `{authenticated}` RLS policies scoped to `is_admin_or_editor()` |
| 2026-09-14 | v2.12.1-preview | [`roryskagen-618pmc6b2-ventureio.vercel.app`](https://roryskagen-618pmc6b2-ventureio.vercel.app) | `● Ready` | 21s | Preview | `f87a695`: `release/v2.12.1` preview (PR #9) |
| **2026-09-14** | post-v2.12.0 | [`roryskagen-q2pyhmx7b-ventureio.vercel.app`](https://roryskagen-q2pyhmx7b-ventureio.vercel.app) | `● Ready` | 20s | Production | `e4c49c7`: PR #8 — deployment-log reconciliation for v2.12.0 (docs-only; no release cut) |
| 2026-09-14 | post-v2.12.0-preview | [`roryskagen-cwuk2xcnn-ventureio.vercel.app`](https://roryskagen-cwuk2xcnn-ventureio.vercel.app) | `● Ready` | 21s | Preview | `eb21640`: `docs/deployment-log-v2.12.0` preview (PR #8) |
| **2026-09-14** | **v2.12.0** | [`roryskagen-6bdmr4283-ventureio.vercel.app`](https://roryskagen-6bdmr4283-ventureio.vercel.app) | `● Ready` | 22s | Production | `f5cf64c`: PR #7 — recoverability: scripted restore path, target-aware TLS, migration-ledger RLS, SQL line-ending policy, deterministic backups, `artworks` draft-exclusion policy |
| 2026-09-14 | v2.12.0-preview | [`roryskagen-30qktwved-ventureio.vercel.app`](https://roryskagen-30qktwved-ventureio.vercel.app) | `● Ready` | 22s | Preview | `80dafa0`: `release/v2.12.0` preview (PR #7) |
| **2026-09-14** | post-v2.11.0 | [`roryskagen-805gsqagx-ventureio.vercel.app`](https://roryskagen-805gsqagx-ventureio.vercel.app) | `● Ready` | 20s | Production | `fac2360`: PR #6 — archive sweep and deployment-log reconciliation (docs-only; no release cut) |
| 2026-09-14 | post-v2.11.0-preview | [`roryskagen-f29yvagl5-ventureio.vercel.app`](https://roryskagen-f29yvagl5-ventureio.vercel.app) | `● Ready` | 22s | Preview | `6087cf3`: `docs/archive-sweep` preview (PR #6) |
| **2026-09-14** | **v2.11.0** | [`roryskagen-megh7ufrr-ventureio.vercel.app`](https://roryskagen-megh7ufrr-ventureio.vercel.app) | `● Ready` | 22s | Production | `5122812`: PR #5 — studio operations: user administration, branded email, catalog dossier, true-to-scale drawing, role-gated nav |
| 2026-09-14 | v2.11.0-preview | [`roryskagen-ppaqvs6aa-ventureio.vercel.app`](https://roryskagen-ppaqvs6aa-ventureio.vercel.app) | `● Ready` | 21s | Preview | `467bd14`: `release/v2.11.0` preview |
| **2026-09-14** | **v2.10.0** | [`roryskagen-janycb9ok-ventureio.vercel.app`](https://roryskagen-janycb9ok-ventureio.vercel.app) | `● Ready` | 22s | Production | `962587e`: PR #4 — schema as code, reproducibility & rollback path |
| 2026-09-14 | v2.10.0-preview | [`roryskagen-ltwemien7-ventureio.vercel.app`](https://roryskagen-ltwemien7-ventureio.vercel.app) | `● Ready` | 20s | Preview | `48b01b9`: `release/v2.10.0` preview |
| **2026-09-14** | **v2.9.0** | [`roryskagen-oup13vzfl-ventureio.vercel.app`](https://roryskagen-oup13vzfl-ventureio.vercel.app) | `● Ready` | 22s | Production | `de294d0`: PR #3 — v2.9.0 release-notes completion |
| 2026-09-14 | v2.9.0-preview | [`roryskagen-luvktp6wq-ventureio.vercel.app`](https://roryskagen-luvktp6wq-ventureio.vercel.app) | `● Ready` | 21s | Preview | `40641d0`: `docs/v2.9.0-changelog` preview |
| **2026-09-14** | **v2.9.0** | [`roryskagen-6bywenhlm-ventureio.vercel.app`](https://roryskagen-6bywenhlm-ventureio.vercel.app) | `● Ready` | 20s | Production | `fd2ff25`: PR #2 — documentation & context reconciliation |
| 2026-09-14 | v2.9.0-preview | [`roryskagen-3fpbilkpx-ventureio.vercel.app`](https://roryskagen-3fpbilkpx-ventureio.vercel.app) | `● Ready` | 20s | Preview | `6b4be84`: `release/v2.9.0` preview |
| **2026-09-14** | **v2.9.0** | [`roryskagen-kdewt7lyy-ventureio.vercel.app`](https://roryskagen-kdewt7lyy-ventureio.vercel.app) | `● Ready` | 22s | Production | `8e14fda`: Full-bleed home hero, profiles RLS 500 fix |
| **2026-09-13** | **v2.9.0** | [`roryskagen-7l5crbs05-ventureio.vercel.app`](https://roryskagen-7l5crbs05-ventureio.vercel.app) | `● Ready` | 22s | Production | `a43fe40`: Artwork drafts, autosave, shadcn/ui primitives, test suite |
| **2026-09-13** | **v2.9.0** | [`roryskagen-8exvnt9u9-ventureio.vercel.app`](https://roryskagen-8exvnt9u9-ventureio.vercel.app) | `● Ready` | 18s | Production | `406def2`: Cloudinary residue cleanup, RLS hardening, server modularization |
| **2026-09-12** | **v2.8.0** | [`roryskagen-5ugjqo1bo-ventureio.vercel.app`](https://roryskagen-5ugjqo1bo-ventureio.vercel.app) | `● Ready` | 22s | Production | `411138a`: Theme palette, PageHeader, design admin |
| **2026-09-12** | **v2.7.0** | [`roryskagen-fgsmx4fqk-ventureio.vercel.app`](https://roryskagen-fgsmx4fqk-ventureio.vercel.app) | `● Ready` | 20s | Production | `b5e6c3b`: Track `api/index.js` for remote Vercel CI |
| **2026-09-12** | **v2.6.0** | [`roryskagen-i1ma7ozgd-ventureio.vercel.app`](https://roryskagen-i1ma7ozgd-ventureio.vercel.app) | `● Ready` | 20s | Production | `8db6c44`: Drag-and-drop uploader + media picker |
| **2026-09-12** | **v2.5.0** | [`roryskagen-br83wfqzg-ventureio.vercel.app`](https://roryskagen-br83wfqzg-ventureio.vercel.app) | `● Ready` | 20s | Production | `7f040c4`: Supabase single source of truth |
| **2026-09-12** | v2.4.1 | [`roryskagen-krbi5vu8n-ventureio.vercel.app`](https://roryskagen-krbi5vu8n-ventureio.vercel.app) | `● Error` | 2s | Production | Routing declaration test |
| **2026-09-12** | **v2.4.0** | [`roryskagen-efocaczfa-ventureio.vercel.app`](https://roryskagen-efocaczfa-ventureio.vercel.app) | `● Ready` | 22s | Production | `8a165b6`, `b640e59`: CJS scoping & serverless route repair |
| **2026-09-12** | v2.3.2 | [`roryskagen-5i3si5m0l-ventureio.vercel.app`](https://roryskagen-5i3si5m0l-ventureio.vercel.app) | `● Error` | 2s | Production | ESM / CJS module boundary debugging |
| **2026-09-12** | v2.3.1 | [`roryskagen-bep5qkpf9-ventureio.vercel.app`](https://roryskagen-bep5qkpf9-ventureio.vercel.app) | `● Error` | 2s | Production | `vercel.json` JSON escape syntax fix |
| **2026-09-12** | **v2.3.0** | [`roryskagen-7fb2tkhjb-ventureio.vercel.app`](https://roryskagen-7fb2tkhjb-ventureio.vercel.app) | `● Ready` | 7s | Production | `b68b523`, `41f08e6`: PR #1 CMS Admin Dashboard with shadcn/ui |
| **2026-09-11** | **v2.2.0** | [`roryskagen-t2f0zd7ss-ventureio.vercel.app`](https://roryskagen-t2f0zd7ss-ventureio.vercel.app) | `● Ready` | 30s | Production | `ceb0674`, `7be31a5`: Bundled Express serverless function |
| **2026-09-11** | v2.2.0-rc | [`roryskagen-nd813sakx-ventureio.vercel.app`](https://roryskagen-nd813sakx-ventureio.vercel.app) | `● Ready` | 32s | Production | Serverless pre-bundling validation |
| **2026-09-11** | **v2.1.0** | [`roryskagen-3losagkmx-ventureio.vercel.app`](https://roryskagen-3losagkmx-ventureio.vercel.app) | `● Ready` | 18s | Production | `5b6a857`: Supabase Storage & Sharp Rendition Pipeline |
| **2026-09-10** | **v2.0.0** | [`roryskagen-7ua9x1ntz-ventureio.vercel.app`](https://roryskagen-7ua9x1ntz-ventureio.vercel.app) | `● Ready` | 18s | Production | `796bf03`: Production Baseline Tag (`v2.0.0`) |
| **2026-09-09** | v2.0.0-rc2 | [`roryskagen-noyq3jg1e-ventureio.vercel.app`](https://roryskagen-noyq3jg1e-ventureio.vercel.app) | `● Ready` | 24s | Production | `908d105`: Resend email notifications integration |
| **2026-09-09** | v2.0.0-rc1 | [`roryskagen-jx8xlyj9j-ventureio.vercel.app`](https://roryskagen-jx8xlyj9j-ventureio.vercel.app) | `● Ready` | 27s | Production | `47dc025`: Supabase PostgreSQL client integration |
| **2026-08-25** | v1.2.0 | [`roryskagen-2qdv1twxq-ventureio.vercel.app`](https://roryskagen-2qdv1twxq-ventureio.vercel.app) | `● Ready` | 17s | Production | `fbaeccf`: Hero slider management & terminology polish |
| **2026-08-20** | v1.1.0 | [`roryskagen-acqklljqv-ventureio.vercel.app`](https://roryskagen-acqklljqv-ventureio.vercel.app) | `● Ready` | 19s | Production | `1cf4d89`, `b77846b`: Navigation revamp & client vault |
| **2026-08-19** | v1.0.1 | [`roryskagen-3fpmyg0om-ventureio.vercel.app`](https://roryskagen-3fpmyg0om-ventureio.vercel.app) | `● Ready` | 10s | Production | `105bd5d`, `7789398`: Native auth & state persistence |
| **2026-08-18** | **v1.0.0** | [`roryskagen-exi06l3r8-ventureio.vercel.app`](https://roryskagen-exi06l3r8-ventureio.vercel.app) | `● Ready` | 20s | Production | `4a159ca`, `faa6d37`: Initial baseline deployment |

---

## Key Deployment Milestones & Architecture Evolution

1. **Phase I: Monolithic Client SPA (Aug 18 – Aug 25, 2026)**
   - Deployed as pure static Vite output.
   - Images served via Cloudinary and local mock state.
2. **Phase II: Data Layer & Media Migration (Sep 9 – Sep 11, 2026)**
   - Transitioned to Supabase PostgreSQL database and Supabase Storage bucket.
   - Batch generated sharp image renditions (`thumb`, `hero`, `full`, `lqip`).
3. **Phase III: Serverless Express Migration (Sep 11, 2026)**
   - Transitioned Express API into a single bundled Vercel serverless function (`/api/index.js`).
4. **Phase IV: Studio Admin CMS with shadcn/ui (Sep 12, 2026)**
   - Modern administration dashboard at `/#/admin`.
   - Idempotent SQL migration pipeline and Supabase single source of truth.
5. **Phase V: Design System & Theme Engine (Sep 12, 2026)**
   - Modernized editorial theme palette and PageHeader components live on `roryskagenart.com`.
6. **Phase VI: Release Engineering & Schema-as-Code (Sep 14, 2026)**
   - Releases now go through a PR gate: a Vercel preview deployment plus Socket Security and
     Debricked checks must pass before merge to `main` (`v2.9.0` onward).
   - Baseline schema migration (`2026_09_01_baseline_core_tables.sql`) makes the database
     reproducible from version control; read-only schema introspection and a catalog
     backup/restore runbook were added (`v2.10.0`).
7. **Phase VII: Studio Operations (Sep 14, 2026)**
   - Staff-management console (edit / invite / re-invite / reset), branded studio email from a
     single shell, role-gated navigation and actions, and a true-to-scale Scale & Proportions
     drawing (`v2.11.0`).
8. **Phase VIII: Recoverability & Rehearsal (Sep 14, 2026 — Present)**
   - ADR 0001 Phase A verified by destruction and rebuild: 10 of 10 migrations recreate the schema
     in a virgin database with no structural difference from production. The restore path is
     scripted and rehearsed end-to-end, backups are deterministic and diffable, a local Supabase
     stack provides a scratch database to rehearse against, and the `artworks` public read policy
     no longer exposes drafts (`v2.12.0`).
   - Authorization hardened on the database side: the four blanket `FOR ALL TO authenticated
     USING (true)` policies on `artworks`, `media_assets`, `pages` and `inquiries` are scoped to
     `public.is_admin_or_editor()`, so a `viewer` can no longer read or write through PostgREST.
     Verified with a temporary viewer session against production (`v2.12.1`).
9. **Phase IX: Backup Durability (Sep 14, 2026 — Present)**
   - The dump is now **verifiable**: manifest format v2 records a sha256 per table and
     `scripts/backup-catalog.ts` self-verifies before exiting, so a bad dump fails at creation
     rather than at restore.
   - It is **off-site and scheduled**: a daily Vercel Cron invokes `GET /api/cron/backup`, which
     writes to Vercel Blob under `catalog-backups/<stamp>/` with retention pruning. This closes the
     gap where the only copy of the catalog lived on one machine — on a Supabase **Free** plan that
     provides no platform backups at all (`v2.13.0`).
   - Storage is **reconciled**: `scripts/verify-media-backup.ts` compares `media_assets` against the
     `artwork-images` bucket in both directions, since database backups hold no object data.
   - The off-site copy is **proven restorable, not merely present**: `scripts/verify-offsite-backup.ts`
     gained `--out <dir>`, which materialises a checksum-verified Blob dump on disk (and refuses to
     write when verification fails). The dump at `2026-09-15T06-43-29-617Z` was then restored into an
     emptied scratch database — **298 rows inserted, 0 skipped, 0 failed**, with **138/138 artworks
     matching on `slug` + `title` + `year`**. With the owner's **Q14** decision to remain on Free,
     this drill *is* the compensating control for having no platform backups at all
     (`v2.17.0` follow-up, PR #28).

---

## Maintaining this log

Rows are one per notable deployment. To refresh after a release, list deployments with their
commit SHAs (this is how the `v2.9.0`–`v2.11.0` rows above were reconstructed):

```bash
vercel ls roryskagen --yes --json | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  for (const x of JSON.parse(s).deployments.slice(0,15))
    console.log([new Date(x.createdAt).toISOString().slice(0,16),
      (x.target||'-').padEnd(10), (x.meta.githubCommitSha||'').slice(0,7),
      (x.meta.githubCommitRef||'?').padEnd(18), x.url].join('  '));
});"
```

Do **not** invent a row. Every URL, commit and build time here came from the Vercel API.

**Preferred when no Vercel token is configured — GitHub's Deployments API.** Vercel reports each
deployment to GitHub, so the URL, target, state and commit SHA are all available through `gh`, with
no token beyond the repo PAT. This is how the `v2.16.0`–`v2.17.0` rows were reconciled:

```bash
gh api "repos/jadenblack/roryskagenart.com/deployments?per_page=22" \
  --jq '.[] | "\(.id) \(.created_at) \(.environment) \(.sha[0:7])"' |
while read id created env sha; do
  url=$(gh api "repos/jadenblack/roryskagenart.com/deployments/$id/statuses" \
        --jq '.[0].environment_url // "-"')
  echo "$created  $env  $sha  $url"
done
```

⚠️ `environment_url` is what you want, **not** the `url` on the deployment object (that is an API
self-link). ⚠️ A deployment's state can be `inactive` when a later deploy superseded it within the
same second — record it as-is rather than omitting the row, because a missing production deploy is
indistinguishable from a deploy that never happened. ⚠️ Resolve an unfamiliar merge SHA with
`gh api repos/jadenblack/roryskagenart.com/commits/<sha> --jq '.commit.message'` before describing it.
