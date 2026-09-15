# Handoff prompt — v3.0.0 roadmap session (re-baseline + refine)

> **How to use:** copy everything from `--- BEGIN PROMPT ---` to `--- END PROMPT ---` into a fresh
> session. It is written to be self-contained: the new session has not seen this conversation.
>
> Written 2026-09-14 20:00 America/Sao_Paulo, after PRs #14, #15 and #16 merged. Every number below
> was re-read from the repo, the git history, the live API or `vercel`/`gh` output in this session.
> ⚠️ Two claims in the original brief are **stale** — see §3. Re-verify anything you rely on.

---

## BEGIN PROMPT

You are a **senior software architect** working in `roryskagenart.com` — a React 19 + Vite 6 +
Tailwind v4 SPA with a modular Express backend on Vercel, backed **solely by Supabase**
(Postgres + Storage + Auth). Cloudinary is fully decommissioned; never reintroduce it.

### 1. Your task — PLANNING ONLY

**Revise `plan/ROADMAP_V3.md`. Do not write application code, do not apply migrations, do not write
to the database.** Stop once the roadmap is written and present it for review.

⚠️ **`plan/ROADMAP_V3.md` already exists** (51 KB, ~6 phases, with an Appendix A claim→proof map).
It was written against baseline `v2.11.0` / `fac2360`, which is now **three releases stale**. Your
job is to **re-baseline and revise it in place**, not to start from scratch:

- Keep its structure where it still holds (phases, exit criteria, risk register, open questions,
  "do not do yet" list, Appendix A).
- **Update every stale fact** (see §3) and extend Appendix A with the new proofs.
- Add the three workstreams in §5 and the judgement calls in §6.

### 2. Read first, in this order

1. `AGENTS.md` — canonical project context; supersedes every historical `plan/` spec.
2. `plan/README.md` — status index for every spec, plus the reading order for a new agent.
3. `docs/adr/0001-schema-as-code-before-data-migration.md` — §3 defines **Phases A–D**.
   Phase A is complete and shipped; you are planning **B, C and D**.
4. `plan/PRD_V3_WAYBACK_DATA_MIGRATION.md` — migration spec (§3 pipeline, §4 execution prompt,
   §5 acceptance criteria, §6 risks).
5. `plan/BACKLOG_STUDIO_CMS.md` — prioritised studio-CMS backlog (Proposed, unscheduled).
6. `docs/reviews/2026-09-14-vercel-cron-email-v3-review.md` — the review that produced this
   session's work; §3 is the v3 readiness analysis (data model, pagination, media, caching,
   migration/back-compat) with measured numbers.
7. `docs/runbooks/email-delivery.md` and `docs/runbooks/database-backup-restore.md`.

### 3. ⚠️ Corrected starting state — the brief's baseline is stale

The brief states latest release `v2.11.0`, `main` = `fac2360`, suite 199 tests / 20 files, ledger
9/9, and "there is no v2.12.0 yet". **All four are out of date.** Verified in this session:

| Claim in the brief | Actual (verified 2026-09-14) |
| :--- | :--- |
| Latest release `v2.11.0` (`5122812`) | **`v2.13.0`** (`0aab9b3`). Tags: `v2.0.0`, `v2.9.0`, `v2.10.0`, `v2.11.0`, **`v2.12.0`**, **`v2.12.1`**, **`v2.13.0`** |
| `main` = `fac2360`, docs-only, unreleased | `main` = **`ed8cd83`** (PR #16). Three feature PRs merged after it: **#14, #15, #16** |
| Suite 199 tests / 20 files | **375 tests / 31 files**; `npm run lint` (`tsc --noEmit`) clean |
| Ledger 9 of 9 | **12 migration files** in `supabase/migrations/` |
| "no `v2.12.0` yet" | `v2.12.0` and `v2.12.1` both shipped |
| *Hygiene:* "`artworks` public SELECT policy does not exclude drafts" | **Already fixed in `v2.12.0`** — `2026_09_14_v2_12_artworks_public_select_excludes_drafts.sql` now reads `USING (trashed = false AND draft = false)`. `v2.12.1` additionally scoped staff policies to `public.is_admin_or_editor()`. **Drop this from the hygiene list; keep the server-side draft filter in `GET /api/artworks` as a standing rule.** |

Still true and still open: **no `LICENSE` file** (README claims Apache-2.0) and **2 moderate
Dependabot alerts on `qs`** (`qs array-limit bypass`; `qs DoS via Attacker Controlled isBuffer`;
installed `qs@6.16.0`, transitive — confirm the parent before acting).

**Because v2.12.0 already shipped, the brief's "which workstreams land in v2.12.0 vs v3.0.0"
question must be re-derived as "what lands in the next minor ([NEXT_MINOR_VERSION]) vs v3.0.0".**
Candidate content for the next minor is listed in §5.

### 4. Work already completed — do NOT redo

Merged this session (all on `main`, all released to production, 0 open PRs):

| PR | Commit | What | Verified behaviour |
| :-- | :-- | :-- | :-- |
| **#14** | `1906cc6` | Production email switched on + email fixes | `/api/email/status` → `configured:true, mode:"live"`; a real inquiry returned `201` with `email:{studio:true,collector:true}`; Resend shows both messages **`delivered`** from `Rory Skagen Art <studio@roryskagenart.com>` |
| **#15** | `09430f8` | Off-site backup verifier | `npx tsx scripts/verify-offsite-backup.ts` → `OK`, 8 tables / 307 rows / 406,593 B, exit 0; stale and unknown-stamp paths exit 1 |
| **#16** | `ed8cd83` | Delivery state persisted + Resend webhook + cron idempotency | New inquiry → `email_status:'sent'` with both Resend ids stored; forged webhook → log `Signature mismatch.` (proves the secret is present) |

Files added: `server/lib/emailRouting.ts`, `server/lib/webhookSignature.ts`,
`server/lib/offsiteBackup.ts` (no — that is `scripts/lib/offsiteBackup.ts`),
`scripts/verify-offsite-backup.ts`, `src/test/emailRouting.test.ts`,
`src/test/offsiteBackup.test.ts`, `src/test/emailReliability.test.ts`,
`supabase/migrations/2026_09_14_v2_13_1_inquiry_email_status.sql`,
`docs/runbooks/email-delivery.md`,
`docs/reviews/2026-09-14-vercel-cron-email-v3-review.md`.
Files modified: `server.ts`, `server/emailService.ts`, `server/routes/inquiries.ts`,
`server/routes/cronBackup.ts`, `server/lib/blobBackup.ts`, `.env.example`, `CHANGELOG.md`
(all under `## [Unreleased]`).

Vercel configuration changed (outside git): Production gained `RESEND_API_KEY` (dedicated
`roryskagenart-production` sending-only key), `RESEND_EMAIL_DOMAIN`, `EMAIL_MODE=live`,
`ADMIN_EMAIL`, `SITE_URL`, `RESEND_WEBHOOK_SECRET`; Preview gained `EMAIL_MODE=redirect` +
`EMAIL_REDIRECT_TO`. A Resend webhook is registered (`email.bounced`, `email.complained`) pointing
at `https://roryskagenart.com/api/email/webhook`.

### 5. Prioritised remaining refinements (acceptance criteria in brackets)

**P1 — blocking for any v3 write**
1. **Verify the Supabase plan tier and the restore path.** [Written record of: plan tier, whether
   daily backups exist, whether PITR exists, and a restore rehearsal into a scratch DB. Owner
   supplies the tier: **[SUPABASE_PLAN_TIER]**.] Known: DB backups exclude Storage objects; the
   project is believed to be on Free (1 GB storage, **pauses after 7 days idle**, no automatic
   backups). This is the highest-consequence write in the project's history — make it a hard gate
   in Phase B, not a footnote.
2. **Prove the scheduled backup actually runs before the load.** [One dump whose stamp falls in a
   06:43–06:59 UTC window, verified with `scripts/verify-offsite-backup.ts`.] As of this session no
   scheduled run has ever fired — all four dumps are manual, and the first is expected 2026-09-15.
3. **Per-artwork SEO + sitemap, pulled ahead of Phase C.** [A `sitemap.xml` and `robots.txt` that
   enumerate artwork routes; per-artwork `<title>`/`<meta description>`/`og:image`; a documented
   answer for how hash routes are represented.] Verified today: **no `robots.txt` and no
   `sitemap.xml` exist anywhere in the repo**; `index.html` has a single static `og:image` =
   `/android-chrome-512x512.png` (the app icon); the app is hash-routed (`#/catalog`, `#/admin`).
   Loading hundreds of mural records into that makes them invisible to search.

**P2 — cheap, high leverage**
4. **`metadata.sort_order` + image alt text need no migration.** `artworks.metadata` is `jsonb` and
   already round-trips through `GET /api/artworks` and `PATCH /api/artworks/:slug`. [Sort order
   honoured by the gallery; alt text rendered on `<img>`; no schema change; no data written.]
5. **Standing hygiene:** add `LICENSE` (Apache-2.0 per README); resolve or document the 2 `qs`
   alerts (identify the parent dependency first).

**P3 — carried from the v2.13.1 review list (already diagnosed, not yet done)**
6. `scripts/smoke-serverless.ts` gives **false negatives** — it filters `app._router.stack` on
   `.route`, so every router mounted with `app.use('/api/x', …)` is invisible. [Fix by walking
   mounted routers or invoking each endpoint; drop the dead `POST /api/auth/login` assertion; add
   `/api/cron/backup`; prove the guard fails when a route is removed.]
7. `api/index.js` is a committed build artifact that predates the cron route (zero occurrences of
   `cron`). It was deliberately tracked at `b5e6c3b` so Vercel CI finds the function — **confirm
   before untracking**. [Either regenerate + commit, or document it as an artifact.]
8. `server/lib/catalogDump.ts:120` hardcodes `target: '(serverless)'`, so every off-site dump loses
   the source host — the first question asked during a restore. [Pass the real target through; it
   must contain no credentials.]
9. Cron: Vercel can deliver a run twice (now mitigated) and **never retries**; Hobby keeps runtime
   logs **1 hour**. [Consider a durable `_last_run.json` in Blob and/or alerting when
   `scripts/verify-offsite-backup.ts --max-age-hours 26` exits non-zero.]

**P4 — v3 feature work (ADR 0001 Phase D), sized from measured data**
10. `artworks.kind` (mural vs fine art) + `source_site` / `source_url_path` / `source_post_id`
    provenance with a unique index. [Additive, idempotent, sorts after
    `2026_09_01_baseline_core_tables.sql`.]
11. Multi-image per work — `artworks.image_url` is single-valued, but murals have progress and
    detail shots. [An `artwork_images`-style join with position/role, or reuse
    `media_assets.artwork_slug` with ordering.]
12. Pagination + server-side search. `GET /api/artworks` returns **every** row with `narrative` and
    `metadata`: measured **138 rows = 165,193 B**, unpaginated, and there is **no `Cache-Control`,
    `ETag` or `Vary` anywhere** in `server/` or `src/server/`. [List projection excluding
    `narrative`/`metadata`; `?page&per_page&kind&series&status&q`; FTS/`pg_trgm` index; cache
    headers that never cache an editor's response.]
13. De-bundle `src/data/assetRegistry.ts` — **444,957 B / 4,602 lines shipped to every visitor** and
    imported by `src/data/assetResolver.ts`. [Served from an HTTP-cached endpoint instead.]
14. Renditions on upload — `server/routes/media.ts` writes **one object with no renditions**
    (`url` == `thumbnail_url`); `sharp` is only used in `scripts/migrate-cloudinary-to-supabase.ts`.
15. Wayback image completeness: **423** unique `wp-content/uploads` basenames are referenced but only
    ~90 content images exist on disk, plus **206** remote `web.archive.org` URLs. [A fetch step with
    manifest/retry and an explicit `needs_image` state.]

### 6. Judgement calls to make explicitly in the roadmap

- **Version mapping — justify, do not assume.** v2.12.0 already shipped, so re-derive: what lands in
  the next minor **[NEXT_MINOR_VERSION]** (candidates: P2 items, P3 items, SEO) versus **v3.0.0**
  (the merge + mural-aware features). **Validate the major-bump assumption rather than accepting
  it**: the merge is largely additive (new rows + additive columns), which under SemVer 2.0.0 argues
  for a *minor*; what makes it major is the **user-visible change to the public catalogue** (a new
  content class appearing in the gallery, new routes, and the SEO/URL surface changing) plus the
  migration's blast radius. Argue it both ways, then decide and record the reasoning. Note
  `package.json` stays `0.0.0` regardless.
- **Sequencing with rationale**: what can run in parallel (extraction/reconcile is read-only and can
  overlap hygiene work) versus hard blockers (tier verification → backup proof → Phase B → Phase C →
  Phase D). SEO sits **before Phase C**.
- **"Do not do yet" list** — ADR 0001 §5 defers `HomeLandingView` decomposition, design-system work,
  and feature scaffolding untouched by the migration path. Keep that boundary; name the items.
- **Risk register** building on `PRD_V3` §6, plus: Supabase Free pausing after 7 days idle;
  **1 GB storage ceiling** against ~400 new images; **Storage objects excluded from DB backups** (no
  off-site image copy exists at all today); Hobby Blob 1 GB/month + 2,000 advanced ops where
  exceeding the cap **cuts access for 30 days rather than billing**; Hobby cron daily-only with
  ±59 min precision and **no retries**.

### 7. Architecture decisions, conventions and constraints established here

- **Versions live in `CHANGELOG.md` + git tags only.** `package.json` stays `0.0.0`.
  Keep a Changelog 1.1.0 + SemVer 2.0.0 + Conventional Commits.
- **Release flow:** Conventional Commits on `main` → push `release/x.y.z` branch → PR → wait for the
  gates (**Vercel preview, Socket Security, Debricked — there are no GitHub Actions**) →
  `gh pr merge <n> --merge` (**never `--squash`**) → annotated tag **on the merge commit** → push the
  tag by object SHA → `gh release create` → update `DEPLOYMENT_LOG.md` from real
  `vercel ls roryskagen --yes --json` data (diff it; never invent a URL or build time).
- **Env vars are `VRCL_SUPA_*`**, never `SUPABASE_*` / `POSTGRES_URL`. `.env` / `.env.local` are
  gitignored; never print or commit values.
- **DB writes:** `npx tsx scripts/run-migrations.ts [<file>.sql]` (idempotent, ledger
  `public.schema_migrations`) or `getSupabaseAdmin()`. **Never paste SQL into the Supabase
  dashboard.** Migrations must be additive + idempotent, use `IF NOT EXISTS`, and sort after
  `2026_09_01_baseline_core_tables.sql` if they touch a core table — enforced by
  `src/test/migrationSafety.test.ts`. **Back up before any write** (`scripts/backup-catalog.ts`).
- **Two mailers:** Resend (repo-controlled: inquiries, invites, resets, notices) and Supabase Auth
  (dashboard-only: signup, magic link, reauthentication). Branding one does **not** brand the other.
- **`EMAIL_MODE`** = `live | redirect | off`, implemented centrally in `server/lib/emailRouting.ts`;
  unset ⇒ inferred from `VERCEL_ENV` (production→live, **preview→redirect**, else live). `redirect`
  without `EMAIL_REDIRECT_TO` **suppresses** rather than falling back to real recipients.
- **Serverless rule:** never fire-and-forget work after `res.json()` — Vercel can freeze the
  instance. Await it (`Promise.allSettled` in `POST /api/inquiries`) and report the real outcome.
- **`tsconfig` has no `strictNullChecks`** → a discriminated union on `ok: true | false` widens to
  `boolean` and **narrowing silently stops working**. Use one interface with an optional field.
  Also: **vitest transpiles without typechecking** — always run `npm run lint` *and* `npm test`.
- **`@vercel/blob` 2.8.0:** `get()` returns `{statusCode, stream, headers, blob}` with **no
  `.text()`** — use `await new Response(result.stream).text()`; it requires explicit
  `access: 'private'`; local scripts must `delete process.env.VERCEL_OIDC_TOKEN` (written by
  `vercel env pull`) and pass `token` explicitly.
- **Vercel CLI:** `vercel env add NAME preview` prompts for a git branch and rejects piped values
  with newlines — use `--value <v> --type config --yes`. `--type` accepts only `config` or `secret`.
  Env changes require `vercel redeploy <deployment-url>` (no `--yes`; preserves git metadata).
- **Hobby limits:** cron is available on all plans, **100 jobs/project**, **daily-only**, ±59 min
  precision in UTC, **`maxDuration` max 60 s**, **no retries**; runtime logs retained **1 hour**.
- **`wayback/` is immutable** — never modify. It is the merge source: 278 HTML pages
  (119 murals + 159 fine art), 170 image files / 10.2 MiB, 18 MB total.
- Current catalogue: **138 artworks**, 152 `media_assets` rows / 605 objects / **76.6 MiB**.

### 8. Known bugs, workarounds and debt

- **A real lead was lost:** an inquiry from **Flor Habba** sits in `public.inquiries` from before
  production email was configured — the studio was never notified. [Owner to follow up: **[OWNER_TO_CONFIRM]**]
- **Two test inquiry rows to delete:** `689daeb5-…` ("Delivery Test (delete me)") and
  `ea8c6344-…` ("Persistence Test (delete me)"). There is **no DELETE route for inquiries** — only
  `PATCH /:id/status` (editor+) — so remove them in `#/admin → Inquiries` or by SQL.
- `DEPLOYMENT_LOG.md` is **not updated** for PRs #14–#16 (no version tag was cut; the notes live in
  `## [Unreleased]`). Fold it into the next release PR.
- `151` `original.*` masters in Storage are **unreferenced by design** — the Cloudinary migration
  stored thumb/hero/full/**original** but `renditions` records only the first three. Reported by
  `scripts/verify-media-backup.ts`, not a failure. Re-baseline this after v3 or the guard becomes noise.
- `src/server/db.ts` hardcodes `ssl: { rejectUnauthorized: false }`, so the app cannot target local
  Supabase. `artwork_terms` is empty. DB password rotation is deferred.
- `CLOUDINARY_CLOUD_NAME` may still be present as dead Vercel config — confirm in the dashboard
  before touching production env.

### 9. Environment, tooling and commands

```bash
npm run lint                                   # tsc --noEmit — MUST be clean
npm test                                       # vitest run — 375 tests / 31 files today

npx tsx scripts/backup-catalog.ts              # back up BEFORE any DB write
npx tsx scripts/verify-backup.ts --all         # re-check local dumps (exit 0/1/2)
npx tsx scripts/verify-offsite-backup.ts --list          # what is in Blob
npx tsx scripts/verify-offsite-backup.ts --max-age-hours 26
npx tsx scripts/verify-media-backup.ts         # media_assets vs the Storage bucket
npx tsx scripts/introspect-schema.ts           # read-only schema dump
npx tsx scripts/smoke-serverless.ts            # ⚠️ currently reports false negatives

vercel crons ls                                # 1 job: /api/cron/backup @ 43 6 * * *
vercel env ls                                  # names/scopes only; Secret values are hidden
vercel logs https://roryskagenart.com          # Hobby keeps 1 hour
curl -s https://roryskagenart.com/api/email/status
```

**Windows / this environment:**
- `gh` is not on `PATH`: `"/c/Program Files/GitHub CLI/gh.exe"` with
  `GH_TOKEN=$(git remote get-url origin | sed -E 's#https://[^:]+:([^@]+)@.*#\1#')` (**never print it**).
- Prefix network git with `GIT_TERMINAL_PROMPT=0 git -c credential.helper=` or the credential
  manager hangs.
- **Never create local branches** — new loose refs under `.git/refs/` get deleted. Commit on `main`,
  then `git push origin main:refs/heads/<branch>`; sync with `git reset --hard FETCH_HEAD`; push
  tags by object SHA.
- Git Bash `/tmp` ≠ Node's (`C:\tmp`); `curl -o /dev/null` misbehaves; `rm -rf` is blocked (use
  `rm -f` per file, then `rmdir`).
- Shell: bash. Node 22.22.2 (managed) preferred; `vercel` CLI is global at
  `/c/Users/jaden.black/AppData/Roaming/npm/vercel`.

### 10. Open questions for the repo owner (separate from your own decisions)

1. **[SUPABASE_PLAN_TIER]** — what plan is this project on, and are daily backups enabled? (Blocking
   pre-flight; the docs record that DB backups exclude Storage and that daily backups are paid-tier.)
2. **[NEXT_RELEASE_VERSION]** — **recommendation decided in the prior session: ship one `v2.14.0`
   covering PRs #14, #15 and #16; do **not** cut a `v2.13.1`.** Rationale under SemVer 2.0.0:
   #15 (`scripts/verify-offsite-backup.ts`) and #16 (`POST /api/email/webhook`, new
   `inquiries.email_*` columns) add backwards-compatible **functionality**, which is a MINOR bump —
   a patch release containing them would be wrong. Only #14 is purely fix-shaped, and it is already
   merged on a linear `main`, so isolating it would mean tagging a past merge commit
   (`1906cc6`) for ceremony with no rollback benefit. **Override only if the owner wants the history
   split.** Then decide whether the v2.13.1 review leftovers (§5 P3: A1, A2, A3, B5) are folded into
   `v2.14.0` or deferred — they are small and thematically identical ("backup durability + email
   reliability follow-ups"), so folding them in is the default suggestion.
3. **[STORAGE_BUDGET]** — at ~400 new mural images with 4 renditions each, Supabase Free (1 GB) will
   not fit. Upgrade, cap renditions (skip `original`, `full` ≤ 2000 px WebP q80), or both?
4. **[IMAGE_SOURCING]** — the archive is image-poor (423 referenced vs ~90 present, 206 remote
   `web.archive.org` URLs). Re-fetch from the Wayback Machine, or accept gaps and ship a
   `needs_image` state?
5. **[MURAL_TAXONOMY]** — do mural categories (business, restaurant, museum, retail, signage, event,
   featured) become a new taxonomy vocabulary, or reuse `gallery_series`?
6. **[CANONICAL_OWNER]** — who reviews the COLLISION class from the reconcile report, and who signs
   off on `draft = true` rows before they are published?
7. **[MURAL_STATUS_MODEL]** — murals are not "SOLD". New `availability` column, or overload `status`?

### 11. Risks and rejected approaches

| Risk | Mitigation |
| :-- | :-- |
| Supabase Free pauses after 7 days idle; no automatic backups; Storage excluded | Verify tier (blocking); keep the daily Blob dump; add an off-site **image** mirror (none exists today) |
| Migration overwrites authored fine-art content | Fill-only-`NULL`/`''`; `INSERT … ON CONFLICT (slug) DO NOTHING`; murals land `draft = true` |
| Slug collisions across the two archives | Reconcile report; COLLISION class routed to **[CANONICAL_OWNER]**; never resolved inside the SQL generator |
| Hobby Blob overage **cuts access for 30 days** instead of billing | Retention pruning is mandatory; keep the 14-dump cap; ~0.5 MB per run |
| A silent cron failure | `scripts/verify-offsite-backup.ts --max-age-hours 26`; Hobby logs vanish in 1 hour |
| Dashboard env changes silently not applied | Always `vercel redeploy <url>` after an env change; verify via `/api/email/status` |
| Trusting a summary | **Verify every claim against the code before writing it.** Two claims in ADR 0001's first draft were wrong |

**Rejected approaches (with reasons):**
- *Reusing the Development Resend key in production* — shared revocation blast radius; a dedicated
  sending-only key scoped to the domain was created instead.
- *Adding an `svix`/`standardwebhooks` dependency* — the Svix HMAC is ~20 lines of `node:crypto`;
  a third-party SDK between us and a security check is not worth it.
- *Fire-and-forget email after `res.json()`* — Vercel can freeze the instance; now awaited.
- *Untracking `api/index.js` without evidence* — it was deliberately tracked at `b5e6c3b` so Vercel
  CI finds the function.
- *Applying v3 schema changes through the Supabase CLI* — two divergent ledgers; the CLI derives
  `version` from leading digits and collapses every `2026_*` file.

### 12. Guardrails (non-negotiable)

- **Never modify `wayback/`.** No DB writes, no migrations, no application code in this session.
- Keep `tsc --noEmit` clean and the existing tests green (you are not expected to change either).
- Never print or commit secrets. `CRON_SECRET`, `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` are
  Vercel Secrets and **cannot be read back**.

### 13. Done criteria

- `plan/ROADMAP_V3.md` re-baselined to `v2.13.0` / `ed8cd83`, with stale facts corrected and
  Appendix A extended.
- Phases B, C, D each with scope, **explicit exit criteria**, dependencies and target release.
- A **justified** version mapping (next minor vs v3.0.0), with the major-bump assumption tested
  rather than accepted.
- Sequencing with rationale: parallelisable work vs hard blockers; SEO placed before Phase C.
- Risk register; "do not do yet" list; open questions separated from your own decisions.
- `plan/README.md` status row for `ROADMAP_V3.md` updated.
- Present a one-page summary: version mapping, critical path, decisions needed from the owner.

---

## END PROMPT

---

## Notes for the human (not part of the prompt)

- **Recommended sequencing for the next session:** (1) cut **`v2.14.0`** from what is already merged
  (PRs #14–#16), optionally folding in the cheap §5 P3 items first — this closes the
  `[Unreleased]` section and fixes `DEPLOYMENT_LOG.md`; (2) **only then** start the v3.0.0 roadmap
  re-baseline. Do not begin Phase B until the Supabase tier is verified and one *scheduled* backup
  run has been proven at 06:43 UTC.
- The brief mentions "continue refining the **v2.14.0** release". No `v2.14.0` exists — the latest
  tag is `v2.13.0`, so `v2.14.0` is the natural next minor.
- The brief's hygiene item about the `artworks` draft policy is **already delivered** (`v2.12.0`).
- This session made no database writes beyond the single additive migration in PR #16, which was
  backed up first and verified idempotent.
