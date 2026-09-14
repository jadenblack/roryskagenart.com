# Roadmap — v3.0.0: the mural merge, and the release program around it

**Status:** 🧭 **Proposed — awaiting owner review.** Planning only. No application code, no
migrations, no database writes were performed in producing this document.
**Date:** 2026-09-14
**Baseline:** `v2.11.0` (`5122812`); `main` at `fac2360` (docs-only, no release cut)
**Owner:** Rory Skagen Studio Engineering
**Governing documents:** [`AGENTS.md`](../AGENTS.md) · [`docs/adr/0001`](../docs/adr/0001-schema-as-code-before-data-migration.md)
· [`plan/PRD_V3_WAYBACK_DATA_MIGRATION.md`](./PRD_V3_WAYBACK_DATA_MIGRATION.md)
· [`plan/BACKLOG_STUDIO_CMS.md`](./BACKLOG_STUDIO_CMS.md)

> **Verification note.** Every factual claim in this roadmap was re-read against the code, the
> migration files, the live-schema introspection (`data/archive/schema_introspection.md`) and the
> git history before it was written down. Appendix A maps each claim to the file and line that
> proves it. Where this document contradicts an older spec, this document and `AGENTS.md` win.

---

## 0. What this document is, and what it is not

This is a **planning artifact**. It sequences work; it does not perform it. Read it with `AGENTS.md`
open — `AGENTS.md` is the verified state of the world, and this roadmap is a proposal about what to
do next.

It deliberately **does not** re-litigate decisions that are already settled and verified
(`AGENTS.md` §2–§5, ADR 0001 Phase A). It builds on them.

---

## 1. Verified starting state

Confirmed in this session, not assumed:

| Fact | Evidence |
| :--- | :--- |
| `main` is `fac2360`, a docs-only merge (PR #6) | `git log`, `git rev-parse HEAD` |
| Tags are exactly `v2.0.0`, `v2.9.0`, `v2.10.0`, `v2.11.0` — **no `v2.12.0`** | `git tag -l` |
| Working tree clean; single branch `main` | `git status --short` |
| ADR 0001 Phase A complete: baseline schema, rollback path, runner tests, ledger 9/9 | `supabase/migrations/2026_09_01_baseline_core_tables.sql`, `scripts/backup-catalog.ts`, `docs/runbooks/database-backup-restore.md`, `AGENTS.md` §5 |
| Nine migration files; baseline sorts first | `ls supabase/migrations/` |
| Suite is **199 tests across 20 files**; `tsc --noEmit` clean | 8 suites in `src/test/` + 12 co-located suites |
| `artworks` has **no** `alt_text`, `caption` or `sort_order`; `metadata` is `jsonb` default `'{}'::jsonb` | `data/archive/schema_introspection.md` §Columns |
| `sort_order` exists **only** on `taxonomies` | `server/routes/taxonomies.ts:12–13`, `TaxonomiesAdminView.tsx` |
| No `sitemap.xml`, no `robots.txt`; `og:image` is `/android-chrome-512x512.png` (the app icon) | `ls public/`, `index.html:22` |
| No prerender/SSR plugin; `vercel.json` rewrites every non-API path to `index.html` | `vite.config.ts`, `vercel.json:17` |
| Catalog renders `alt=""`; media library renders `alt={item.public_id}` | `CatalogView.tsx:235` |
| No captcha / honeypot / rate limit anywhere | grep over `server/` + `src/` returns nothing |
| No direct client-side read of `artworks` — the only `supabase-js` table read is `profiles` | `AuthContext.tsx:51`; all artwork I/O goes through `/api/artworks` |
| README claims Apache-2.0 and admits no `LICENSE` file exists | `README.md:404` |
| `artworks` public SELECT policy is `USING (trashed = false)` — drafts are **not** excluded | `2026_09_01_baseline_core_tables.sql:129–131` |
| `artworks` "Admins full access" policy is `FOR ALL TO authenticated USING (true)` — **no role check** | `2026_09_01_baseline_core_tables.sql:133–135` |
| The runner applies **every** `.sql` in `supabase/migrations/` not yet in the ledger | `scripts/lib/migrationPlan.ts:22,30–35`, `scripts/run-migrations.ts:30,47–53` |
| **The Supabase project is on the FREE plan** — no automatic backups, no PITR | Vercel Storage integration page for `roryskagen`: *"All projects created with the Supabase integration are currently on the free plan."* Recorded in `docs/runbooks/database-backup-restore.md` §3 |
| **There are two divergent migration ledgers** — `public.schema_migrations` = **9** rows (this repo's runner) vs `supabase_migrations.schema_migrations` = **1** row (the Supabase CLI) | Queried live, 2026-09-14. See `docs/runbooks/database-backup-restore.md` §7 |
| **Docker is not installed**, so `supabase db dump` and `supabase start` both fail | `supabase db dump` → `docker: command not found (podman also not found)` |
| A read-only JSON dump was taken: 8 tables, 307 rows | `data/backups/2026-09-14T15-51-11-582Z/` |
| `scripts/restore-catalog.ts` + `scripts/lib/restorePlan.ts` now exist; 27 offline tests | `src/test/restorePlan.test.ts` — **not yet exercised against a real database** |
| `npm audit` is clean; `qs` 6.15.3 → 6.16.0 | ran 2026-09-14 |

The last two rows are new findings, not restatements of the docs. See §6 R-05 and R-06.

---

## 2. The program, decomposed

The brief names three workstreams. They decompose into **six phases**, of which ADR 0001 Phases A–D
are four (A is done). Two phases — pre-flight and addressability — are additions this roadmap argues
for, and both are *prerequisites*, not scope creep.

| Phase | Name | Writes to the DB? | ADR 0001 mapping | Ships in |
| :--- | :--- | :--- | :--- | :--- |
| **0** | Pre-flight — backup tier, restore proof, Storage story | No (read-only + docs/scripts) | *new — prerequisite* | `v2.12.0` |
| **1** | Hygiene & the cheap wins | One small migration | *new — prerequisite* | `v2.12.0` |
| **2** | Addressability — real paths, per-artwork SEO, sitemap | No | *new — prerequisite* | `v2.12.0` |
| **3** | Read-only extraction + reconcile | **No** | **Phase B** | `v2.12.0` |
| **4** | The load | **Yes — the highest-consequence write in the project's history** | **Phase C** | `v3.0.0` |
| **5** | Mural-aware features & refactors | Yes (content edits) | **Phase D** | `v3.1.0` |

---

## 3. Version mapping — and the SemVer case, made honestly

### 3.1 The assumption I was asked to validate

The brief, and `PRD_V3` §Target Milestone, both treat **"the mural merge" ⇒ `v3.0.0`** as a given.
**I do not think that survives contact with SemVer 2.0.0 §7–§8, and I am not going to pretend it
does.** The honest analysis:

**The mural merge is, by itself, a minor change — and arguably not even that.**

- SemVer governs *interfaces*. Adding rows to `artworks` is **content**, not an interface change.
  A table with 138 rows and a table with 240 rows have the same schema, the same API shape, and the
  same contract. Data volume is invisible to SemVer.
- The expected schema extension is **additive** (ADR 0001 §2.7: "small and additive, not a
  redesign"). Adding a column or a `taxonomies.type` value is explicitly *"new, backwards compatible
  functionality"* → **minor** under §7.
- New mural rows land `draft = true`, so they are invisible to every existing consumer until a human
  publishes them. A change that no consumer can observe is not a breaking change.
- The public API surface does not change: `GET /api/artworks` returns the same shape, with more rows.

So: **the merge is a `v2.x.0` minor. Calling it `v3.0.0` requires a different justification than
"we added content", and the CHANGELOG should not claim one.**

### 3.2 Where a genuine major *does* exist in this program

There is exactly one candidate, and it is created by the SEO prerequisite the brief asks me to pull
forward:

> **The public URL surface of the artwork catalog changes.**
> Today every artwork is `roryskagenart.com/#/artwork/<slug>` — a fragment, which is not a distinct
> document to any crawler. Making the new content findable requires **real paths**
> (`/artwork/<slug>`) plus crawler-visible tags. That re-shapes the catalog's public address space.

Whether that is *breaking* is a decision, not a fact:

| If we… | Then the change is… | And the correct bump is… |
| :--- | :--- | :--- |
| Ship permanent redirects from the legacy hash URLs to the new paths | **backwards compatible** — old links keep working | **minor** |
| Retire the legacy hash route contract for artwork pages | **backwards incompatible** — every existing bookmark, share and inbound link changes | **major** |

A gallery's inbound links *are* its search equity. Breaking them to gain discoverability would be
self-defeating. **My recommendation is therefore to ship the redirects** — which, applied honestly,
means **the whole program is SemVer-minor and there is no SemVer justification for a `3.0.0` at all.**

### 3.3 Recommendation

`v3.0.0` is a **program milestone label**, not a SemVer event. That is a legitimate thing for a
client deliverable to be — but it must be recorded as such rather than dressed up as a breaking
change. My recommendation:

| Release | Bump | Contents | The bump is correct because |
| :--- | :--- | :--- | :--- |
| **`v2.12.0`** | **minor** | Phase 0 (documented), Phase 1, **Phase 2 (addressability)**, Phase 3 (= ADR Phase B) | Purely additive. One small additive migration; one additive UI/metadata feature set; one routing change made **non-breaking by redirects**; a read-only report. Nothing an existing consumer depends on is removed or re-shaped. |
| **`v3.0.0`** | **major** *(milestone)* | Phase 4 (= ADR Phase C, the load) | **Honest position: this is a milestone major.** Its content is additive data plus an additive schema extension, which is a *minor* by the letter of SemVer. It is labelled `3.0.0` because it is the client-facing deliverable the studio engaged for, and it is the point at which the site stops being a fine-art gallery and becomes a mural **and** fine-art practice. The CHANGELOG entry will say this explicitly. |
| **`v3.1.0`** | minor | Phase 5 (= ADR Phase D, mural-aware features) + the deferred studio-CMS backlog | Additive features, driven by real data. |

**Two alternatives, both defensible — the owner must choose (§9 Q1):**

- **Purist SemVer:** `v2.12.0` → `v2.13.0` (the load) → `v2.14.0` (features). No major bump anywhere,
  because nothing breaks. Cleanest SemVer; under-signals the client milestone.
- **Unarguable major:** move Phase 2 into `v3.0.0` and ship it **without** permanent legacy
  redirects. `v3.0.0` is then a textbook §8 major. **I recommend against this** — it spends real
  SEO equity to buy a version number.

### 3.4 What must not be done

- Do **not** bump `package.json` (stays `0.0.0`). Versions live in `CHANGELOG.md` and git tags only.
- Do **not** invent a `v2.12.0` tag before its work is merged. Tags point at the **merge commit on
  `main`** (`v2.10.0` → `962587e`, `v2.11.0` → `5122812`).
- Do **not** touch the `v2.9.0` tag. It points at a pre-merge commit (`16df8d9`); it is the known
  exception and tags are immutable.

---

## 4. Phase-by-phase plan

### Phase 0 — Pre-flight (blocking; ships in `v2.12.0`) — 🟡 **in progress**

**Why it exists.** ADR 0001 gave the project a rollback *story*. Phase 4 is the largest write in the
project's history, and the story had three holes that are only acceptable *before* a write of that
size, not after.

**Scope — with status as of 2026-09-14**

1. **Verify the Supabase plan tier.** ✅ **DONE — and the answer is the worst case: the project is on
   the FREE plan.** No automatic backups, no PITR. Recorded in
   `docs/runbooks/database-backup-restore.md` §3. **The consequence is that the repo dump is the only
   recovery path the project has**, which promotes the off-site copy below from "nice to have" to the
   single blocking item in this phase.
2. **Prove the restore path, don't describe it.** ✅ **DONE — proven end-to-end on 2026-09-14.**
   `scripts/restore-catalog.ts` + `scripts/lib/restorePlan.ts` (27 offline tests) were rehearsed
   against the local scratch database:

   | Step | Result |
   | :--- | :--- |
   | Plan-only run (no `--apply`) | printed the plan, **wrote nothing** |
   | Restore into an empty schema | **294 inserted, 4 skipped, 0 failed** |
   | Re-run the same restore | **0 inserted, 298 skipped, 0 failed** — idempotent |
   | Re-dump and compare against the source snapshot | 5 of 6 tables **byte-identical**; `pages` differed only in `updated_at` |

   The 4 skipped rows were `pages`: `--mode load` never overwrites, and the local database already
   held those slugs from a migration seed. **`load` cannot correct an existing row — `repair` is
   the mode that makes the snapshot's values win.** That distinction is now documented in the
   runbook rather than discovered during an incident.
3. **Decide and document the Storage story.** ⬜ Open. Supabase database backups contain Storage
   *metadata* only, so a restore will not bring back deleted `artwork-images` objects (§3 caveat 1).
   Phase 4 **uploads new mural renditions**, which is an unrecoverable write under the current story.
   Choose bucket versioning or a periodic object listing + copy.
4. **Take a baseline dump, and get it off this machine.** 🟡 **Dump taken; off-site copy outstanding.**
   `data/backups/2026-09-14T15-51-11-582Z/` holds 8 tables / 307 rows. But `data/backups/` is
   gitignored and local-only, so on a Free plan it currently protects against *nothing* except a bad
   write on this same machine. **Copying it off-site is a hard prerequisite for Phase 4.**
5. **Get a non-production database.** ✅ **DONE.** Docker Desktop 29.8.0 is installed and running
   (client + server, daemon up) — note it installs to a **per-user** path,
   `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe`, which is *not* on `PATH` by
   default; the Supabase CLI only finds it if that directory is exported first. `supabase start`
   now brings up a full local stack: Postgres on `127.0.0.1:54322`, REST/Studio on `:54321`/`:54323`.
   **The CLI must not apply this repo's migrations** — see item 7 — so `config.toml` disables them
   and the repo runner owns the schema.
6. **Add a restorable schema dump.** ✅ **DONE.** The per-table JSON in item 4 is excellent for
   row-level diffs and poor for rebuilding a database — it contains no DDL. Two real dumps now sit
   beside it in the same snapshot directory: `schema.sql` (662 lines — 9 tables, 20 RLS policies, all
   7 functions, both `artworks` guard triggers, 9 `ENABLE ROW LEVEL SECURITY`) and `data.sql`
   (2,157 lines — every table that has rows). Produced with `supabase db dump --db-url`, which needs
   Docker (it shells out to a containerised `pg_dump`).
7. **Enable local dev so a scratch database exists.** 🟡 **Unblocked and starting.** `supabase init`
   created `supabase/config.toml` (local DB on port **54322** — the same loopback target
   `scripts/restore-catalog.ts` treats as local). The first `supabase start` **failed**, and the
   failure is worth recording because it is empirical proof of the R-13 two-ledger hazard:
   ```
   ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505)
   Key (version)=(2026) already exists.
   ```
   The CLI derives its ledger `version` from the **leading digits of the filename** and requires
   `<14-digit timestamp>_name.sql`; every file here starts `2026_…`, so they all collapse to version
   `2026`. The filenames are correct for this repo and must **not** be renamed. Resolved by setting
   `[db.migrations] enabled = false` and `[db.seed] enabled = false` in `supabase/config.toml` —
   the CLI now builds the base stack and leaves `public` empty, and this project's own runner owns
   the schema. Documented in `docs/runbooks/database-backup-restore.md` §7a/§7b.
   > ⚠️ **This invalidates a claim I made earlier in this roadmap.** I had written that `supabase
   > start` "applies those migrations to the fresh local database" and therefore gives the first
   > empirical test of ADR 0001 Phase A. It does not — and cannot, with these filenames. The Phase A
   > test is instead `VRCL_SUPA_POSTGRES_URL=<local> npx tsx scripts/run-migrations.ts` followed by a
   > structural diff against `schema.sql` (runbook §7b).

8. **Empirically verify ADR 0001 Phase A — "the schema is reproducible from version control".**
   ✅ **DONE, and the claim holds — after closing one real gap.** Procedure: drop every table in the
   local database, rebuild it from `supabase/migrations/` with `scripts/run-migrations.ts`
   (**10/10 applied cleanly to a virgin database**), then introspect both the rebuild and production
   and diff.

   **Result: no structural differences remain.** Tables, columns, types, defaults, constraints,
   indexes, all 20 policies, both `artworks` guard triggers, all 7 functions and all 9 RLS flags now
   match production exactly. The only residual diffs are the four expected ones: my unapplied
   draft-exclusion migration, empty row counts, the ledger's own row count, and application
   timestamps.

   **The gap it found — and this is the whole point of the exercise.** Production had **RLS enabled
   on `schema_migrations`** and **no migration created that state**: the runner creates the table,
   not a migration. A database rebuilt from version control therefore left the migration ledger
   readable with the anon key. Two things made this interesting:

   - `src/test/migrationSafety.test.ts` **forbids** the obvious fix — it asserts RLS is enabled only
     on tables that a *migration* creates, and no migration creates this one. The invariant is
     right; it just means the fix belongs in the **runner**, which owns the table. `run-migrations.ts`
     now enables RLS on `schema_migrations` after creating it. Verified safe before changing it: the
     owner bypasses RLS (no `FORCE`), so the ledger read *and* write paths still work, the statement
     is idempotent, and `anon` sees **0 rows**.
   - The test set would **never** have caught this. It is static analysis over SQL text; the drift
     was only visible by building a database and diffing it. That is an argument for keeping the
     scratch-database workflow alive rather than treating it as a one-off Phase 0 chore.

   A second difference was found and **fixed in the same session**: two of the ten migration files
   were CRLF in the working tree (the committed form was already LF — `core.autocrlf = true` is set
   globally and there was no `.gitattributes`), so CR bytes leaked into those files' stored function
   bodies (production 0 CR bytes; the rebuild had 17). Adding `.gitattributes` with
   `*.sql text eol=lf` and re-checking out the two files brought every stored function body to
   **0 CR bytes**. See R-16.

**Exit criteria**

- [x] The Supabase plan tier is recorded in the runbook with its source. → **Free.**
- [x] A restorable **schema** dump exists (`schema.sql`) alongside the JSON snapshot, and a
      `data.sql` dataset dump.
- [x] `data/backups/` is ignored by git. → **verified.**
- [x] `scripts/restore-catalog.ts` has restored a dump into a **non-production** database. →
      **294 inserted / 0 failed, idempotent on re-run, content-verified by re-dump.**
- [x] **A database can be built from `supabase/migrations/` and it matches production.** → the
      ADR 0001 Phase A claim, verified by teardown + rebuild + introspection diff (item 8).
- [ ] A copy of the dump exists **off this machine.** *(the local half is done — this is the single
      most important outstanding item, because on Free there is no other backup)*
- [ ] The Storage backup mechanism is documented and has run at least once.

**Dependencies:** none to start. **Item 5's Docker (or PostgreSQL client tools) blocks items 2, 3 and 6.**
**Release:** artifacts and docs ship in `v2.12.0`; the *verification* is a hard precondition on `v3.0.0`.

---

### Phase 1 — Hygiene and the cheap wins (ships in `v2.12.0`)

**Scope**

| Item | Note | Migration? |
| :--- | :--- | :--- |
| **LICENSE** | README claims Apache-2.0 and admits the file is missing (`README.md:404`). Add the file, or correct the claim. An ambiguous licence is a real problem for a commercial studio site. | No |
| **Dependabot `qs`** | 2 moderate advisories on the default branch. Bump, or record a reasoned dismissal. | No |
| **Tighten the `artworks` SELECT policy** | `USING (trashed = false)` → also exclude `draft`. See R-05: this is **promoted from "tracked follow-up" to a prerequisite of Phase 4.** | **Yes** (additive; sorts after the baseline) |
| **Inquiry spam protection** | Honeypot field + per-IP rate limit on `POST /api/inquiries`. Each submission spends Resend quota. | No |
| **Alt text** | An "Image description" field on the artwork editor, stored at `metadata.alt_text`, rendered as the catalog `alt`. Cheapest item on the list. | **No** — `metadata` is `jsonb` and already round-trips |
| **Manual ordering** | `metadata.sort_order` + server ordering + a pin/move control, and hero ordering by the same value. | **No** — same reason |
| *(optional)* **CSV export** | Ranks #6 in the backlog and doubles as a text-only backup of the catalog — which directly supports Phase 0's story. | No |

**Why the cheap wins belong here and not later.** They need no migration (`artworks.metadata` is
`jsonb`, is returned by `GET /api/artworks`, and is an accepted field on `PATCH /api/artworks/:slug`),
so they can land while Phase 3 is still read-only. They also change the **shape of the editor**, and
Phase 5's mural-aware features will build on whatever editor exists — so landing them before the
mural rows arrive is cheaper than retrofitting afterwards.

**Exit criteria**

- [ ] `LICENSE` exists, or `README.md` no longer claims one.
- [ ] `npm audit` no longer reports the two moderate `qs` advisories.
- [ ] The policy migration is applied **through the runner**, and a second run reports *Nothing to
      do* (`src/test/migrationSafety.test.ts` stays green).
- [ ] A direct anon PostgREST `GET /rest/v1/artworks?select=slug` returns **no** draft rows.
- [ ] `/api/artworks` **still** filters drafts server-side (this filter must never be removed), and
      the studio's own draft list still works for admin/editor sessions.
- [ ] A burst of inquiry submissions is throttled, and the honeypot path is covered by a test.
- [ ] Alt text renders in the catalog; `sort_order` controls both catalog and hero order, with a
      sensible fallback for rows that have none.
- [ ] `npm run lint` clean; suite green with new coverage.

**Dependencies:** none. Runs in parallel with Phase 2 and Phase 3.

---

### Phase 2 — Addressability (the SEO prerequisite; ships in `v2.12.0`, hard blocker on Phase 4)

**Why it is a prerequisite, not a nice-to-have.** Phase 4 adds on the order of a hundred mural
records. Landing them into a hash-routed SPA with no `sitemap.xml`, no `robots.txt`, and a single
`og:image` that is the app icon (`index.html:22`) produces content **that search engines and social
cards cannot see**. That is not a cosmetic gap — it would make the entire merge commercially
invisible, and it would be far more expensive to fix after a hundred new rows exist than before.

It is also worth stating the sharp edge: **a `sitemap.xml` of `/#/artwork/<slug>` URLs would be
worthless.** Fragments are not distinct documents; a crawler sees one page. The prerequisite
therefore genuinely requires real paths **and** crawler-visible tags — which is why this phase, and
not a sitemap alone, is the gate.

**Scope**

1. **Real paths for artwork routes.** Move `/artwork/<slug>` off the fragment. Keep the app's hash
   routing for *app* routes if that is expedient; what matters is that the canonical, crawlable
   artwork URL is a path.
2. **Per-artwork metadata.** `<title>`, `<meta name="description">`, `<link rel="canonical">`, and
   `og:image` / `twitter:image` pointing at the artwork's **hero rendition** — absolute URLs.
3. **Crawler-visible tags.** Tags must be present in the served HTML, not injected after hydration.
   Two viable shapes, both of which avoid building an SSR stack:
   - **(a) Build-time prerender** — emit `dist/artwork/<slug>/index.html` per published artwork, plus
     `dist/sitemap.xml` and `dist/robots.txt`, from `artworks` at build time. Vercel serves the exact
     static file ahead of the catch-all rewrite. *Recommended: smallest change, no runtime, no
     serverless cold-path.*
   - **(b) Edge SSR** for the artwork route only.
   Pick one and record it (§9 Q5).
4. **Sitemap + robots.** Generated from `artworks`, **excluding drafts and trashed rows**, so
   unpublished mural drafts are never advertised to crawlers.
5. **Redirect the legacy hash URLs** so existing bookmarks and shares keep resolving (§3.2).

**Exit criteria**

- [ ] `curl` of the preview's `/artwork/<slug>` returns HTML containing that artwork's `<title>`,
      description and an **absolute** `og:image` — verified by fetching raw HTML, not by reading the
      DOM in a browser.
- [ ] `dist/sitemap.xml` enumerates every published artwork and **zero** drafts.
- [ ] `dist/robots.txt` exists and references the sitemap.
- [ ] A legacy `/#/artwork/<slug>` link still lands on that artwork.
- [ ] A test asserts the prerender/sitemap generator excludes drafts.
- [ ] `npm run lint` clean; suite green.

**Dependencies:** none to start. **Blocks Phase 4.**

---

### Phase 3 — Read-only extraction and reconcile (ADR 0001 Phase B; ships in `v2.12.0`)

**Scope** — `PRD_V3` §3 Steps 0–4, unchanged in substance:

- **Step 0 Validate:** confirm no Cloudinary residue; capture `artworks` / `media_assets` counts;
  build the canonical-slug map from `SELECT slug FROM public.artworks`.
- **Step 1 Extract** both archives, skipping `feed/`, `page/`, `comments/`, `wp-json/`,
  `wp-content/`, `wp-includes/` and category-archive indexes.
- **Step 2 Reconcile** against live slugs — exact → fuzzy title ≥ 0.85 → shared image `public_id` —
  **seeded with the §2 divergence map** (`today` → `today-atomic-sunrise`, `regador-5` → `regador-v`,
  the two dedupe pairs, …), and classify **NEW / EXISTS / COLLISION**.
- **Step 3 Media (report only):** resolve every image against `media_assets` and produce the
  `needs_upload` list. **No uploads in this phase.**
- **Step 4 Emit:** `data/archive/wayback_extraction.json`,
  `data/archive/wayback_reconcile_report.md`, the draft backfill SQL, and the **schema-fit gap list**.

**One deliberate deviation from `PRD_V3` §3 Step 4c.** The PRD says to emit the backfill SQL into
`supabase/migrations/`. **Do not.** `scripts/lib/migrationPlan.ts:30–35` and
`scripts/run-migrations.ts:30,47–53` show that the runner applies **every** `.sql` file in that
directory that is not yet in the ledger — so committing the backfill there in `v2.12.0` means the
next routine `npx tsx scripts/run-migrations.ts` would silently apply it, weeks before its gate. Emit
it to a staging location **outside** `supabase/migrations/` (e.g. `supabase/staged/`) and promote it
into `supabase/migrations/` only in the `v3.0.0` PR that applies it.

**Exit criteria** (ADR 0001 Phase B gate)

- [ ] 100% of content pages across both archives are covered; every page with no title or no image is
      listed in the report.
- [ ] The report enumerates every NEW / EXISTS / COLLISION row with its canonical slug.
- [ ] Every COLLISION is routed to **human review** — the matcher's output is a proposal, not a
      verdict.
- [ ] The **schema-fit gap list is empty or contains only additive changes.** This is the gate.
- [ ] `wayback/` is byte-identical to its pre-run state (verify with `git status`).
- [ ] **Zero database writes.**

**Dependencies:** none. Runs in parallel with Phases 0, 1 and 2 — it is read-only by construction.

---

### Phase 4 — The load (ADR 0001 Phase C; ships in `v3.0.0`)

**This is the highest-consequence write in the project's history.** Every control in §6 exists to
make it reversible.

**Scope, in order**

1. **Confirm every Phase 0, 1 and 2 exit criterion is met.** This is the gate, not a formality.
2. **Apply the additive schema extension** from Phase 3's gap list, through the runner, as its own
   migration that sorts after the baseline.
3. **Prove the restore on a scratch database**, then **take a fresh dump** of production.
4. **Media:** render `thumb` / `hero` / `full` / `lqip` for every `needs_upload` image with `sharp`,
   upload to `artwork-images/{slug}/`, upsert `media_assets` (`public_id = slug`,
   `artwork_slug` = canonical slug), then regenerate `src/data/assetRegistry.ts`. **Land the registry
   regeneration as its own commit** — it is a generated multi-thousand-line file and it will
   otherwise bury the review.
5. **The staged, idempotent backfill** — media, then artworks, then `taxonomies` /
   `artwork_terms`. `INSERT … ON CONFLICT (slug) DO NOTHING` for NEW rows as `draft = true`;
   `UPDATE … WHERE col IS NULL OR col = ''` for EXISTS rows. Never overwrite authored content.
6. **Prove idempotency** — re-run the migration; it must mutate nothing.
7. **Re-introspect and diff** against the pre-write report.

**Exit criteria** (`PRD_V3` §5, sharpened)

- [ ] Re-running the migration mutates nothing.
- [ ] **Fine-art rows are untouched**, demonstrated by diffing the pre-write dump against a post-write
      dump — with any deliberate fill-only-empty fills enumerated individually.
- [ ] Every mural row is `draft = true` **and** `enabled = false`.
- [ ] An anonymous `GET /api/artworks` excludes them, **and** a direct anon PostgREST read of
      `artworks` excludes them (the Phase 1 policy).
- [ ] Every mural image has a `media_assets` row; the asset registry is regenerated and the app builds.
- [ ] `npm run lint` clean; suite green.
- [ ] The introspection diff is reviewed and attached to the PR.
- [ ] The PR description carries the runbook §5 pre-migration checklist, including the dump path.

**Dependencies (hard blockers):** Phase 0 verified · Phase 1 policy applied · Phase 2 shipped ·
Phase 3's gap list clean and COLLISIONs adjudicated.

---

### Phase 5 — Mural-aware features and refactors (ADR 0001 Phase D; ships in `v3.1.0`)

**Scope.** Mural-specific facets (project type, client, commissioning context), a mural view or
filter, and the review-and-publish workflow for the loaded drafts — all **driven by the real data**,
which is precisely why ADR 0001 sequenced it last.

**Exit criteria**

- [ ] Each feature is justified by the loaded data, not by speculation.
- [ ] Every loaded draft has an explicit publish/keep-draft decision, or a documented batch policy.
- [ ] `npm run lint` clean; suite green.

**Dependencies:** Phase 4 complete. Cannot begin earlier — this is the whole point of the ADR's
ordering.

---

## 5. Sequencing, critical path, and parallelism

```
 Phase 0  Pre-flight (tier · restore proof · Storage story)   ── BLOCKING ──┐
        │                                                                   │
 Phase 1  Hygiene + cheap wins ─────────────┐                              │
        │                                   │                              │
 Phase 2  Addressability (SEO) ── BLOCKING ─┼──────────────────────────────┤
        │                                   │                              │
 Phase 3  Extraction + reconcile (read-only)┘                              │
        │                                                                   │
        └──────────────────────────────► Phase 4  THE LOAD ──► Phase 5  Features
```

**Critical path**

`Phase 0 (tier verified) → Phase 2 (addressability) → Phase 4 (the load) → Phase 5 (features)`

Everything else hangs off it:

- **Phase 1 and Phase 3 run in parallel with Phase 0 and Phase 2.** Phase 3 is read-only by
  construction, so it can start on day one; Phase 1 needs no migration except the policy.
- **Phase 1 is not on the critical path, with one exception:** the `artworks` SELECT-policy tightening
  *is* a blocker on Phase 4 (R-05). If Phase 1 slips, that one migration must still land first.
- **Hard blockers, stated plainly:**
  - No write of any kind before **Phase 0's tier verification**.
  - No Phase 4 before **Phase 2 ships** — otherwise a hundred new records land invisible.
  - No Phase 4 before **Phase 1's policy migration** — otherwise a hundred unpublished mural drafts
    are one anonymous PostgREST query away from exposure.
  - No Phase 5 before **Phase 4's data exists**.
- **A note on release boundaries.** `v2.12.0` bundles four phases. That is deliberate — all four are
  additive or read-only, so the release's risk profile is low — but it makes `v2.12.0` the largest
  *code* release in the program while `v3.0.0` is the largest *data* release. Keeping those risks in
  separate releases is the point.

---

## 6. Risk register

Builds on `PRD_V3` §6. R-01…R-04 are the PRD's, sharpened; R-05…R-11 are new.

| ID | Risk | Impact | Mitigation | Gate |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | **Slug collision across the two sites** — murals and fine art were authored separately, and DB slugs already diverge from wayback folder names in at least 11 known pairs | A mural overwrites, or is merged into, the wrong fine-art record | Fuzzy + image-`public_id` matching, seeded with the §2 divergence map; **every COLLISION routed to human review**; `ON CONFLICT DO NOTHING`; fill-only-empty | Phase 3 exit |
| **R-02** | **Murals accidentally published** | Unreviewed client work goes live | `draft = true` + the `trg_artworks_draft_guard` trigger forcing `enabled = false`; explicit `enabled = false` in the backfill as belt-and-braces; verify the anon API **and** a direct anon PostgREST read both exclude them | Phase 4 exit |
| **R-03** | **Missing mural images** — many mural photos were never in the Cloudinary-era registry | Broken or placeholder artwork pages on the new content | `needs_upload` report in Phase 3; render + upload in Phase 4; **and see R-07 — this upload is the least reversible write in the program** | Phase 3 + 4 exit |
| **R-04** | **Overwriting authored fine-art narratives** | Irrecoverable loss of the artist's own words | Fill-only-`NULL`/`''` rule in the generated SQL; **plus a test asserting the generated SQL contains no unguarded `SET` on an authored field**; pre/post dump diff | Phase 4 exit |
| **R-05** | **Draft rows are reachable with the anon key.** The public SELECT policy is `USING (trashed = false)` and does **not** exclude drafts | Loading ~100+ unpublished mural drafts makes unpublished client work a single PostgREST query away from exposure. Safe *today* only because the client reads through `/api/artworks` | **Promote the policy tightening from "tracked follow-up" to a hard prerequisite of Phase 4** (Phase 1); never remove the server-side draft filter; assert with an anon query | Phase 1 exit |
| **R-06** | **The `artworks` "Admins full access" policy is `FOR ALL TO authenticated USING (true)`** — the name says admins, the predicate says *any authenticated user*. A `viewer` can read **and write** every artwork directly via PostgREST, bypassing the role matrix entirely | The role model in `src/lib/roles.ts` is enforceable only through `/api/*`; PostgREST is an unpoliced second door, and Phase 4 adds a large body of unpublished content behind it | Scope the policy to the actual role claim (or a `SECURITY DEFINER` helper, as the profiles fix already did) as part of Phase 1. **New finding — see §9 Q8** | Phase 1 |
| **R-07** | **Storage objects are not covered by database backups.** A DB restore will not bring back uploaded `artwork-images` objects — and the tier is now confirmed **Free**, so there is no platform backup at all | A bad media step in Phase 4 could be unrecoverable | Phase 0: decide bucket versioning vs periodic copy, **demonstrate** a restore; take the object listing *before* uploading | Phase 0 exit |
| **R-08** | **Bulk backfill on a small table.** A single bad statement could touch all 138 existing rows | Wide blast radius from one mistake | Staged (media → artworks → terms), `ON CONFLICT DO NOTHING`, fill-only-empty, dump first, apply to a **scratch DB** first, re-run to prove idempotency, re-introspect and diff | Phase 4 exit |
| **R-09** | **`artwork_terms` is empty, so the M2M filter path has never been exercised** — the mural category backfill will be its first real use | An untested code path becomes load-bearing in the highest-risk release | Treat the taxonomy path as new code; test on a scratch DB; the reconcile report must state exactly which terms are linked | Phase 4 exit |
| **R-10** | **No scripted restore exists.** The runbook says so and defers it to Phase C | The safety net is a document, not a capability | Phase 0 adds and *exercises* `scripts/restore-catalog.ts`; runbook §5 makes "applied to a non-production database" a checklist item | Phase 0 exit |
| **R-11** | **The generated asset registry produces a very large diff**, burying the actual change in review | Review fatigue → a real defect slips through | Regenerate in its own commit, separate from the migration and the code | Phase 4 |
| **R-12** | **Hash-route SEO:** a `sitemap.xml` of fragment URLs is worthless | The whole merge lands invisible, and the fix gets more expensive with every new row | Phase 2 ships real paths + crawler-visible tags + sitemap **before** Phase 4; verified by fetching raw HTML | Phase 2 exit |
| **R-13** | **The Supabase CLI has a *second, divergent* migration ledger.** `supabase_migrations.schema_migrations` holds **1** row while `public.schema_migrations` holds **9**. ✅ **CONFIRMED EMPIRICALLY 2026-09-14** — the first `supabase start` died on it (`duplicate key value violates unique constraint "schema_migrations_pkey"`, `Key (version)=(2026) already exists`), because the CLI parses every `2026_…` filename as version `2026` | Running `supabase db push` / `migration up` would see eight migrations as unapplied and **re-run them against production** — the exact ledger-drift failure this repo already reconciled once. It also breaks `supabase start` on a fresh volume | **Never apply schema changes via the Supabase CLI.** Standing rule in `docs/runbooks/database-backup-restore.md` §7. `supabase/config.toml` sets `[db.migrations] enabled = false` / `[db.seed] enabled = false` so the CLI cannot apply them; `db dump` is read-only and unaffected. **Do not rename the migration files to satisfy the CLI** — the repo runner keys on the full filename | Permanent |
| **R-14** | **Free-plan projects pause after 7 days of low activity** | The gallery can go offline during a quiet period, and unpausing is a manual dashboard action. This is an **availability** risk, not a backup one, and no repo-side mitigation fully removes it | A keep-alive that touches the database at least daily; the durable fix is upgrading to Pro (paid projects cannot be paused). **Owner decision — see §9 Q14** | Ongoing |
| **R-15** | **The only backup lives on this machine.** `data/backups/` is gitignored and local | A disk failure destroys the sole recovery path for a Free-tier project with no platform backups | Copy the dump off-site, and automate it. Treated as a hard prerequisite of Phase 4 | Phase 0 exit |
| **R-16** | **Two migration files were checked out CRLF, and there was no `.gitattributes`.** `core.autocrlf = true` is set globally, so git checks text files out with CRLF. `2026_09_12_cms_v1_profiles_roles.sql` (82 lines) and `2026_09_12_cms_v1_taxonomies_settings.sql` (70 lines) were CRLF in the working tree; the other eight were LF. **The committed form of all ten was already LF — only the working tree differed.** `pg_get_functiondef` returns the stored source, so the CR bytes inside those two files' function bodies landed in the database | A database built from the affected checkout stored CRLF inside `handle_new_user` and the touch functions, so its function bodies differed from production's (17 CR bytes vs 0). Functionally identical, but "reproducible from version control" became **checkout-dependent**, and it produced spurious diffs | ✅ **FIXED 2026-09-14.** Added `.gitattributes` with `*.sql text eol=lf` (overrides `core.autocrlf`) and re-checked out the two files. Because the index was already LF there was **no content rewrite**. Verified by rebuilding the database: **all 7 stored function bodies now report 0 CR bytes**, matching production. Found by the item 8 rebuild-and-diff | ✅ done |

---

## 7. Do not do yet

ADR 0001 §5 explicitly defers these, and **this roadmap keeps that boundary**:

- **`HomeLandingView` decomposition.** Still the largest hand-written file (1229 lines) and still
  *not* touched by the migration path. Refactoring it now would be guessing.
- **Design-system work.** No design tokens, no component-library consolidation, no theming rework.
- **Feature scaffolding not touched by the migration path.**

And from `BACKLOG_STUDIO_CMS.md`, these are **not** in `v2.12.0` or `v3.0.0` — they are `v3.1.0`-or-later:

- Per-artwork revision history / undo (§1.2) — valuable, but not a migration dependency.
- Bulk catalog actions (§3.2) — the mural load doubles the catalog, so this gets *more* valuable; that
  is an argument for `v3.1.0`, not for pulling it forward.
- Print stylesheet / PDF catalogue (§3.3).
- Inquiry notes, owner, follow-up filter (§4.1).
- Onboarding help and dashboard checklist (§4.2).

**One boundary clarification.** Pulling Phase 2 (SEO/addressability) forward does **not** violate the
ADR's deferral list. The deferrals are about *unforced* refactors; addressability is a **migration
prerequisite** — without it Phase 4's content is invisible — and ADR 0001 §3 itself pulls forward
"only the work that the migration actually depends on."

---

## 8. Decisions taken in this document

These are mine, made to keep the plan coherent. Each is reversible if the owner disagrees.

1. **Phase 0 is a prerequisite, not part of the migration.** Tier verification, a *demonstrated*
   restore, and a Storage decision all precede the first write.
2. **Phase 2 (addressability) sits ahead of Phase 4**, in `v2.12.0` — not alongside the load.
3. **The `artworks` SELECT-policy tightening is promoted from "tracked follow-up" to a Phase 4
   blocker** (R-05). The load changes the exposure from theoretical to material.
4. **The backfill SQL is staged outside `supabase/migrations/`** until the `v3.0.0` PR, because the
   runner applies every file in that directory (deviation from `PRD_V3` §3 Step 4c).
5. **The cheap wins (`metadata.sort_order`, alt text) land in `v2.12.0` via `metadata`** — no
   migration, and before the mural rows arrive.
6. **Phase 5 ships separately from Phase 4** (`v3.1.0`) to keep the data release's risk bounded.
7. **`v3.0.0` is recorded as a milestone major, with the SemVer caveat stated in the CHANGELOG** —
   rather than manufacturing a breaking change to justify it (§3.3).
8. **The taxonomy / `artwork_terms` path is treated as new, untested code** (R-09).
9. **`v2.12.0` carries four phases** because all four are additive or read-only; the code-risk
   release and the data-risk release are deliberately separate.
10. **The asset-registry regeneration is its own commit** (R-11).

---

## 9. Open questions for the repo owner

Separated deliberately from §8. Each needs a human answer before execution.

| # | Question | Blocks | My recommendation |
| :--- | :--- | :--- | :--- |
| **Q1** | **Version mapping.** Accept `v3.0.0` as a milestone major (§3.3, recommended), go purist (`v2.12.0` → `v2.13.0` → `v2.14.0`), or move Phase 2 into a redirect-free `v3.0.0` to earn a textbook major? | Every release tag | Milestone major, with the caveat written down |
| **Q2** | **What is the Supabase plan tier? Is PITR enabled?** | ~~Everything~~ | ✅ **ANSWERED 2026-09-14: FREE. No automatic backups, no PITR.** The repo dump is the only recovery path. Follow-on decision is Q14 |
| **Q3** | **Storage backup: bucket versioning, or periodic object listing + copy?** | Phase 0, Phase 4 media step | Object listing + copy — it is cheap, scriptable, and provably restorable |
| **Q4** | **Do we keep the legacy `#/artwork/<slug>` links working?** | Q1, Phase 2 | **Yes** — a gallery's inbound links are its SEO equity |
| **Q5** | **Addressability approach: build-time prerender, or edge SSR?** | Phase 2 | Build-time prerender — no runtime, no cold path, smallest change |
| **Q6** | **How should mural project type be modelled?** Reuse `gallery_series`, or add `taxonomies.type = 'project_type'` (and `client`)? | Phase 3 gap list, Phase 4 schema | Decide from the extracted data — but decide *before* the schema extension |
| **Q7** | **Is `artwork_terms` meant to be populated at all?** It is empty today, so the M2M filter has never run. | Phase 4 | Yes — and treat it as new code (R-09) |
| **Q8** | **The `FOR ALL TO authenticated USING (true)` policy (R-06)** — is it intentional, or a misnamed over-permission? Any authenticated user can write every artwork via PostgREST today. | Phase 1 | Fix it; the role matrix is currently enforced only at the `/api/*` layer |
| **Q9** | **Should murals and fine art share one catalog surface, or be separate sections?** | Phase 2 routing, Phase 5 features | Separate sections — the two bodies of work have different audiences |
| **Q10** | **Who adjudicates the COLLISION class?** It needs the artist or the studio, not the matcher. | Phase 3 → 4 | The studio, with the report as the worksheet |
| **Q11** | **LICENSE: add Apache-2.0, or correct the README claim?** | Phase 1 | Add the file — a commercial studio site should not have an ambiguous licence |
| **Q12** | **Dependabot `qs`: bump, or dismiss with a reason?** | Phase 1 | Bump if it does not force an Express major; otherwise document the dismissal |
| **Q13** | **Bundle Phase 5 into `v3.0.0`, or ship it as `v3.1.0`?** | `v3.0.0` scope | Ship separately (§8.6) |
| **Q14** | **Free tier: keep-alive cron, or upgrade to Pro?** The project is on Free, which means *no* backups, *no* PITR, **and** automatic pausing after 7 days of low activity — i.e. the live gallery can go down on its own. Pro (~$25/mo) removes the pausing and adds 7-day daily backups; it does **not** back up Storage objects. | R-14, and the whole backup story | **Upgrade to Pro before the migration.** The migration is the largest write in the project's history and is currently protected by nothing but a JSON file on one machine. If Pro is not viable, a daily keep-alive plus an automated off-site dump is the minimum |
| **Q15** | **Docker Desktop, or the standalone PostgreSQL client tools?** Both unblock a scratch database and a restorable `pg_dump`; the client tools are ~50 MB with no WSL2 and no reboot. | Phase 0 items 2, 3, 5, 6 | The client tools (`winget install PostgreSQL.PostgreSQL.17`) are enough for the dump/restore path; Docker is only needed for `supabase start` |

---

## 10. Release mechanics (unchanged project law)

Applies to `v2.12.0`, `v3.0.0` and `v3.1.0` alike.

- **Version numbers live in `CHANGELOG.md` and git tags only.** `package.json` stays `0.0.0`.
- Format: **Keep a Changelog 1.1.0** + **SemVer 2.0.0** + **Conventional Commits**.
- **Every change ships through a PR.** Push `release/x.y.z`, open a PR, wait for the three gates —
  **Vercel preview, Socket Security, Debricked** (there are **no GitHub Actions**) — and merge only
  when `mergeStateStatus` is `CLEAN`.
- Merge with `gh pr merge <n> --merge` — **not** `--squash`.
- **Tag the merge commit on `main`**, then push the tag, then `gh release create`.
  (`v2.9.0` is the immutable historical exception.)
- **Update `DEPLOYMENT_LOG.md`** in every release, with rows rebuilt from
  `vercel ls roryskagen --yes --json`. Never invent a URL, commit or build time.
- `v3.0.0`'s CHANGELOG entry must carry the **SemVer caveat** from §3.3: the major is a program
  milestone; the change set is additive.
- Do not prune release branches without asking.

---

## Appendix A — Claim → evidence

| Claim | Evidence |
| :--- | :--- |
| `main` = `fac2360`; tags `v2.0.0`/`v2.9.0`/`v2.10.0`/`v2.11.0`; no `v2.12.0` | `git log --oneline`, `git tag -l`, `git rev-parse HEAD` |
| `artworks` has no `alt_text` / `caption` / `sort_order`; `metadata` is `jsonb` | `data/archive/schema_introspection.md` §Columns |
| `metadata` round-trips through the API | `server/routes/artworks.ts:25` (SELECT), `:149` (PATCH allow-list), `:169–170` (JSON encode) |
| `sort_order` exists only on `taxonomies` | `server/routes/taxonomies.ts:12–13,23,33–37` |
| Catalog ordering is `updated_at DESC` | `server/routes/artworks.ts:48` |
| Drafts are filtered server-side on list and per-slug | `server/routes/artworks.ts:40–43`, `:74–80` |
| Public SELECT policy is `USING (trashed = false)` | `supabase/migrations/2026_09_01_baseline_core_tables.sql:129–131` |
| "Admins full access" is `FOR ALL TO authenticated USING (true)` | same file, `:133–135` |
| No `sitemap.xml` / `robots.txt`; `og:image` is the app icon | `ls public/`; `index.html:22` |
| No prerender/SSR plugin; catch-all rewrite to `index.html` | `vite.config.ts`; `vercel.json:17` |
| Catalog renders `alt=""` | `src/components/admin/CatalogView.tsx:235` |
| No captcha / honeypot / rate limiting | grep over `server/` + `src/` → no matches |
| No direct client-side `artworks` read | `src/context/AuthContext.tsx:51` is the only `supabase-js` table read |
| The runner applies every `.sql` in `supabase/migrations/` | `scripts/lib/migrationPlan.ts:22,30–35`; `scripts/run-migrations.ts:30,47–53` |
| README claims Apache-2.0 with no `LICENSE` file | `README.md:404` |
| `HomeLandingView.tsx` is 1229 lines | `wc -l` |
| Backup tier unverified; Storage excluded from DB backups; no scripted restore | `docs/runbooks/database-backup-restore.md` §3, §4a, §6 |
| Suite is 199 tests / 20 files | 8 suites in `src/test/` + 12 co-located suites |
| `wayback/` = 278 HTML files across two archives | `find wayback -name "*.html" \| wc -l` |

## Appendix B — Documentation to update when this program executes

| Document | Change | When |
| :--- | :--- | :--- |
| `CHANGELOG.md` | `[Unreleased]` → `[2.12.0]`; then `[3.0.0]` with the SemVer caveat | each release |
| `DEPLOYMENT_LOG.md` | New rows, rebuilt from the Vercel API | each release |
| `AGENTS.md` §5 | Row counts; the policy change; the addressability model | `v2.12.0` |
| `AGENTS.md` §6–§7 | New scripts (`restore-catalog`), staged-migrations path, prerender step | `v2.12.0` |
| `docs/runbooks/database-backup-restore.md` | Tier recorded; Storage story; scripted restore marked *exercised* | Phase 0 |
| `plan/README.md` | Add this roadmap; flip `PRD_V3` status as phases complete | `v2.12.0` |
| `plan/PRD_V3_WAYBACK_DATA_MIGRATION.md` | Status → *Phases B/C delivered*; record the §3 Step 4c deviation | Phase 3 / 4 |
| `plan/BACKLOG_STUDIO_CMS.md` | Mark §1.4, §1.3, §1.1, §3.1 as scheduled in `v2.12.0` | `v2.12.0` |
