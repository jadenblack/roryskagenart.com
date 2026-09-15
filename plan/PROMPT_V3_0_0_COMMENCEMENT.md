# Handoff prompt — v3.0.0 commencement

> **How to use:** copy everything from `--- BEGIN PROMPT ---` to `--- END PROMPT ---` into a fresh
> session. It is self-contained: the new session has not seen this conversation.
>
> Written 2026-09-14 23:40 America/Sao_Paulo, immediately after **v2.16.0** shipped
> (PR #21 → merge `95e3967`, tag `v2.16.0`; docs follow-up PR #22 → `9b4eb91`).
> Every number below was read from the repo, git, or the live API in that session.
>
> ⚠️ **Read §4 before you trust `plan/ROADMAP_V3.md`.** It is baselined on `v2.11.0`, which is now
> **six releases stale**, and several of its load-bearing claims are no longer true.

---

## BEGIN PROMPT

You are a **senior software architect** working in `roryskagenart.com` — the official digital
gallery, catalog raisonné and studio CMS for Austin artist Rory Skagen. React 19 + Vite 6 +
Tailwind v4 SPA, modular Express 4 backend on Vercel, backed **solely by Supabase**
(Postgres + Storage + Auth) plus Resend for mail. **Cloudinary is fully decommissioned — never
reintroduce it.** `AGENTS.md` is the canonical source of truth; read it first.

### 1. Your task — RE-BASELINE FIRST, then execute

**Step 1 (planning only — do this and then stop for review):**
Re-baseline `plan/ROADMAP_V3.md` **in place** against v2.16.0. Do not write application code, do not
apply migrations, do not write to the database in this step.

The roadmap is 51 KB with six phases, a risk register, 15 open questions, and an Appendix A
claim→proof map. Keep that structure where it still holds. Your job is to **update every stale fact**
(§4), **retire the questions that have since been answered** (§6), **fix the version mapping** (§4.3
— the numbers it proposes have all been spent), and **fold in the three deferred media items** (§5).

**Step 2 (only after I approve the re-baseline):** execute Phase 0 and ADR 0001 Phase B.

### 2. Verified current state (2026-09-14, re-read this session)

| Fact | Value |
| :--- | :--- |
| `main` | `9b4eb91` (merge of PR #22) |
| Latest release | **v2.16.0** (`95e3967`) |
| Tags | `v2.0.0`, `v2.9.0`, `v2.10.0`, `v2.11.0`, `v2.12.0`, `v2.12.1`, `v2.13.0`, `v2.14.0`, `v2.15.0`, `v2.16.0` |
| Migrations | 12 files, ledger `public.schema_migrations` |
| Catalog | 138 artworks · 307 rows · `media_assets` 152 rows |
| Tests | **419 tests / 33 files** — `npm run lint` + `npm test` + `npm run smoke` (31/31) all green |
| Storage bucket `artwork-images` | 605 objects, **76.6 MiB** (7.5 % of the 1 GB free allowance) |
| Wayback archive `wayback/` | 557 files / 18 MB — 278 HTML, 69 PNG, 96 JPG, 5 GIF, from **two** sources: `centraltexasmurals.com-v1` and `roryskagen.com-v1` |
| Supabase plan | **FREE** — no automatic backups, no PITR, pauses after 7 days idle, ~1 GB storage, 5 GB egress |
| Open Dependabot alerts | 2 |

### 3. What v3.0.0 is

Merge the **two archived predecessor websites** (mural projects + fine art) sitting in `wayback/`
into the Supabase catalog. This is a **MERGE, not a cold seed** (`PRD_V3_WAYBACK_DATA_MIGRATION.md`
§2) — the 138 existing artworks are the survivor and must not be duplicated or overwritten.

Read `plan/PRD_V3_WAYBACK_DATA_MIGRATION.md` and `docs/adr/0001-schema-as-code-before-data-migration.md`
before planning. ADR 0001 Phase A (baseline schema-as-code, rollback path, migration runner) is
**complete and tested**.

### 4. ⚠️ Stale facts in `ROADMAP_V3.md` — correct these first

**4.1 Baseline.** The document says *"Baseline: `v2.11.0` (`5122812`); `main` at `fac2360`"* and
*"Tags are exactly `v2.0.0`, `v2.9.0`, `v2.10.0`, `v2.11.0` — **no `v2.12.0`**"*. Both are now false
by six releases.

**4.2 Its "in progress" markers are obsolete.** Phase 0 is marked *"ships in `v2.12.0` — 🟡 in
progress"*. Since then: v2.12.0, v2.12.1, v2.13.0 (off-site backup cron → Vercel Blob), v2.14.0
(fail-able smoke guard, dump targets, incomplete-stamp pruning), v2.15.0 (`robots.txt`, MIT
`LICENSE`, delete path for inquiries), v2.16.0 (media upload ladder, dialog spacing). Re-derive what
Phase 0 actually still owes rather than trusting the checklist.

**4.3 The version mapping in §3 is invalid.** It proposes `v2.12.0` → `v2.13.0` → `v2.14.0`.
**All three have been spent on other work.** The next release is `v3.0.0`. Any SemVer argument built
on that sequence needs to be re-made.

**4.4 Security question Q8 is resolved.** The roadmap flags `artworks` having
`FOR ALL TO authenticated USING (true)` — no role check — as an open risk (R-06). **Fixed in
v2.12.1**: policies are now staff-scoped via `public.is_admin_or_editor()`. Keep the server-side
draft filter in `GET /api/artworks` regardless.

**4.5 Licence question Q11 is resolved — but not as the roadmap guessed.** It asked *"add
Apache-2.0, or correct the README claim?"*. The answer in v2.15.0 was **MIT**, and the README claim
was corrected to match. ⚠️ The `LICENSE` file is the **canonical unmodified MIT text** — appending
anything to it (a scope note, a copyright addendum) makes GitHub report `NOASSERTION`. The scope note
lives in `README.md` instead.

**4.6 Q2 is answered.** Supabase is on **FREE**: no automatic backups, no PITR, pauses after 7 days
of low activity. The repo dump is the only recovery path. (Q14 — Free vs Pro — is still open and is
now the single biggest risk in the program: the migration is the largest write in the project's
history and is currently protected by a JSON file on one machine.)

**4.7 The media pipeline is healthy — do not re-derive a diagnosis that was wrong.**
An earlier brief claimed the thumb/hero/full ladder was "dimensionally degenerate" and needed a
re-encode. **That was a misreading** (`PRD_V2_16_MEDIA_PIPELINE.md` §2). The catalog is already WebP,
already efficient (~221 KB/megapixel), already capped at 2048 px, and already correctly laddered
wherever the source is large enough — 79 of 151 assets are capped by *small sources* (median 624 px),
which is correct behaviour. There is **no re-encode project here**. If you find yourself planning
one, you have picked up a stale document.

### 5. Owner decisions that constrain v3 (2026-09-15 — standing, do not re-litigate)

- **Q1 — Assets are copies.** The artist holds all originals in a secure durable backup and can
  re-populate at any time. Deleting the 151 unreferenced `original.*` masters is **safe**; an off-site
  bucket copy is a convenience, not a gate.
- **Q2 — v3 ingests Wayback at web quality, applied PRE-INGEST.** The ingest is therefore a **batch
  offline pass**, not `POST /api/media/upload` (that route is for a human uploading one photo) and not
  `POST /api/artworks` (which hardcodes year 2024, "Acrylic on Canvas", 48"x60", $9,500, "Neon
  Americana"). **v3 needs a bulk registration path — design it before the pre-ingest pass has
  something to write into.**
- **Q3 — No Cloudflare, no new vendor.** Only worth revisiting alongside a move off Vercel. Egress
  strategy is immutable browser caching + small payloads.
- **Q4 — 2000 px is fine; full resolution is NEVER needed in the studio.** Print-on-demand will source
  originals off-studio. Never build full-res handling into the app.

**Deferred from v2.16.0 — v3 now carries them:**

| Item | What | Note |
| :--- | :--- | :--- |
| **S1** | Delete the 151 unreferenced `original.*` masters | Safe per Q1. Still irreversible: take a verified dump + a full object listing first. Not about the space (7.5 % of allowance) — about removing 151 objects no row references and no check would miss. |
| **S3** | Verify `Cache-Control` on the 605 existing objects | With no CDN this is the *whole* egress strategy. New uploads already set `31536000`; the migrated objects were never checked. |
| **S5** | Measure egress once and record it | ~8 MiB per full 138-artwork browse ⇒ ~640 browses/month of 5 GB. Never actually measured. |

### 6. Open questions — status since the roadmap was written

**Answered, retire them:** Q2 (FREE, no PITR) · Q8 (RLS fixed in v2.12.1) · Q11 (MIT, not Apache-2.0).
**Still open and blocking:** Q1 (version mapping — now forced, see §4.3) · Q3 (Storage backup
approach) · Q4 (legacy `#/artwork/<slug>` links) · Q5 (prerender vs edge SSR) · Q6 (mural type
modelling) · Q7 (`artwork_terms` — still empty) · Q9 (shared vs separate catalog surfaces) · Q10 (who
adjudicates collisions) · Q12 (Dependabot `qs`) · Q13 (Phase 5 in `v3.0.0` or `v3.1.0`) · **Q14 (Free
vs Pro — now the top risk)** · Q15 (Docker vs standalone pg client tools).

### 7. Known v3 prerequisites (unchanged, all still true)

- `kind` + source-provenance columns on `artworks` (murals are not paintings).
- **Multi-image support** — `artworks.image_url` is single-valued; murals need many photos.
- De-bundle `src/data/assetRegistry.ts` (445 KB / 4,602 lines shipped to every visitor).
- Pagination + FTS on `GET /api/artworks` (today: 138 rows / 165 KB, unpaginated, no `Cache-Control`).
- **Per-artwork addressable routes** — the prerequisite for `sitemap.xml`, which `public/robots.txt`
  deliberately omits today because the app is hash-routed.

### 8. Project law — non-negotiable

- **Read `AGENTS.md` first.** It supersedes everything in `plan/`.
- Versions live in `CHANGELOG.md` + git tags only; `package.json` stays `0.0.0`. Keep a Changelog,
  SemVer, Conventional Commits.
- **Every change ships through a PR.** Push **only** a `release/x.y.z` branch — ⚠️ **never push
  `main` first** (GitHub then refuses the PR with "No commits between main and release/x.y.z" and the
  commits reach production ahead of the gates; v2.15.0 did exactly this). Merge with `gh pr merge
  --merge` (never `--squash`) only when `mergeStateStatus=CLEAN`.
- **Run BOTH `npm run lint` and `npm test`** — vitest skips typecheck, and `tsconfig` lacks
  `strictNullChecks`, so lint is the only thing that catches broken union narrowing. Run
  `npm run smoke` after touching `server.ts` mounts.
- DB writes go through `npx tsx scripts/run-migrations.ts` (idempotent; additive-only; files sort
  after `2026_09_01_baseline_core_tables.sql`) or `getSupabaseAdmin()`. **Never paste SQL into the
  Supabase dashboard. Never run migrations via the Supabase CLI** (two ledgers; `2026_*` collapse).
- Take a verified dump (`scripts/backup-catalog.ts`) **before** any migration, and prove the restore
  path on a scratch DB first.
- Windows gotcha: git here often cannot create refs. `git checkout -b` / `tag` / `update-ref` may
  report success and write nothing, and `git fetch` updates `FETCH_HEAD` but not
  `refs/remotes/origin/main`. Fall back to writing `.git/refs/...` directly and pushing by SHA.
  `gh` needs `export GH_TOKEN="$(grep '^GITHUB_TOKEN=' .env.local | cut -d= -f2-)"`.

### 9. Exit criteria for step 1 (the re-baseline)

- [ ] `ROADMAP_V3.md` re-baselined to `v2.16.0` / `9b4eb91`; every stale fact in §4 corrected.
- [ ] Version mapping rebuilt from `v3.0.0` onward, with the SemVer case made honestly.
- [ ] Q2, Q8 and Q11 retired; Q14 escalated to the top risk.
- [ ] S1 / S3 / S5 slotted into phases, with S1's pre-conditions (verified dump + object listing)
      written down.
- [ ] The bulk-registration path for pre-ingest media (owner Q2) designed and sequenced.
- [ ] Appendix A extended with proofs for every new claim.
- [ ] Presented for review. **No code written, no migration applied, nothing written to the DB.**

---

## END PROMPT

---

### If you want a shorter start

For a session that should just get moving on the roadmap without the full brief:

> Re-baseline `plan/ROADMAP_V3.md` against **v2.16.0** (`9b4eb91`) — it is six releases stale and its
> proposed version numbers (`v2.12.0`–`v2.14.0`) have all been spent. Read `AGENTS.md` first. Correct
> the stale facts, retire the answered questions (RLS is fixed since v2.12.1; the licence is MIT since
> v2.15.0; Supabase is on FREE with no PITR), fold in the three deferred media items in
> `PRD_V2_16_MEDIA_PIPELINE.md`, and design the bulk media-registration path the pre-ingest pass needs.
> Planning only — no code, no migrations, no writes to the database. Then stop for review.
