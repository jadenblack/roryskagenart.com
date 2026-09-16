# Roadmap — a studio feedback & planning tool: `v3.1.0` → `v3.3.0`

> **Status:** 📋 **PROPOSED — nothing here is scheduled.** Written 2026-09-15 against the state that
> shipped as `v3.0.0`. Every claim below was verified against the code, the live schema or the
> migration set; file paths, route guards and column names are real.
>
> **Read `../AGENTS.md` first** — it is the verified current state. Read
> [`ROADMAP_V3.md`](./ROADMAP_V3.md) second: **it already spends the version numbers this document
> needs.** §1.1 is the collision, and it is the one thing that must be decided before any of this
> is built.
>
> **✅ Owner decisions recorded 2026-09-15** (§9). **Q-A = A:** this tool takes `v3.1.0`–`v3.3.0`
> and Phase 5 slides to `v3.4.0` — and the `ROADMAP_V3.md` edits that requires are in this same PR,
> as §3.5 demanded. **Q-B:** the "development logs" are **`CHANGELOG.md`** and
> **`DEPLOYMENT_LOG.md`**, shown **as they are changed**. **Q-C:** no public "What's new" page —
> out of scope entirely, not deferred. Still open: **Q-D** (pre-flight doc repair) and **Q-E**
> (`viewer` access to the board).

---

## 0. What this document is, and what it is not

**It is** a spec + roadmap for one self-contained feature program: a studio tool that shows the
project's own history, captures and triages ideas/features/bugs, groups them into releases, and
opens a public feedback door from the website footer.

**It is not** a replacement for `ROADMAP_V3.md`. That document owns the mural program. This one
owns a feature program that runs alongside it. Where they disagree about a version number, §3.5
settles it.

**The pleasant part:** this is the first feature program in the repo's history that the studio can
use to plan *itself*. `v3.2.0` and `v3.3.0` should be planned on the board that `v3.1.0` ships —
that is the acceptance test for the whole thing. If the studio does not reach for the tool to plan
the tool's own next release, the tool has failed regardless of how many tests pass.

---

## 1. Verified starting state

### 1.1 ⚠️ The collision: `v3.1.0` is already reserved

`ROADMAP_V3.md` **§3.4** maps `v3.1.0` to *"Phase 5 (= ADR Phase D, mural-aware features) + the
deferred studio-CMS backlog"*. **Decision #6** in that document's §8 repeats it, and **Q13** was
closed on exactly that basis. `ROADMAP_V3.md` §4 Phase 5 is headed *"ships in `v3.1.0`"*.

So "the 3.1 release" is not a free number. Three ways out, all written up in §3.5; this document
recommends the first — **and on 2026-09-15 the owner took it (Q-A = A).** The table below is
therefore the plan, not a proposal, and `ROADMAP_V3.md` carries the matching edit.

| | `v3.1.0` | `v3.2.0` | `v3.3.0` | `v3.4.0` |
| :--- | :--- | :--- | :--- | :--- |
| **A — recommended** | **this tool: Capture** | **this tool: Group** | **this tool: Close the loop** | Phase 5 (mural features + studio-CMS backlog) |
| **B — alternative** | Phase 5 | this tool: Capture | this tool: Group | this tool: Close the loop |

**Why A is the better trade**, not just the more convenient one:

- **Nothing has shipped against `v3.1.0`.** No tag, no CHANGELOG section, no branch. Renumbering an
  unexecuted plan is legitimate; moving a *tag* is not (`ROADMAP_V3.md` §3.5 forbids it, and
  rightly).
- **Phase 5 is data-driven by construction** — ADR 0001 sequenced it last precisely so it would be
  designed against real rows. It cannot begin before the loaded murals exist, and it is therefore
  gated on nothing this document does.
- **The tool is the review workflow Phase 5 needs.** Q17 is still open: *"how do mural drafts get
  reviewed and published?"* — ~60 murals are live as `draft = true` **and** `enabled = false`,
  invisible (0 of 60 new mural slugs appear in the live sitemap, per `DEPLOYMENT_LOG.md`). A board
  that holds one review item per unpublished mural is the cheapest honest answer to Q17, and it is
  §4 v3.1 task 7.
- **The tool is small and self-contained.** It adds one table and touches no existing table, no
  artwork route and no public render path. Phase 5 is a catalog-wide change. Shipping the small,
  isolated one first keeps the review load low.

**What A does *not* fix:** the 60 hidden murals are a business-visible gap **today**, and neither
release in this document publishes them. §7 P-02 keeps that visible. If the owner wants them
published before any of this, the right move is a small standalone `v3.0.1`-style publish pass, not
a renumbering of this program.

### 1.2 What already exists to build on

| Capability | Where it already lives | What that means here |
| :--- | :--- | :--- |
| Admin nav with per-item role gating | `src/components/admin/AdminLayout.tsx` — `ADMIN_NAV`, `minRole`, and `badgeFor()` which already renders a count badge | Two new nav items and a badge need **no new plumbing** |
| Admin hash routing | `src/App.tsx:60` routes `#/admin/…`; `src/lib/adminRoute.ts` parses `subPath` | `/admin/changelog` and `/admin/planning` are two `switch` cases in `AdminApp.tsx` |
| Server route modules + guards | `server/routes/*.ts`, `server/middleware/auth.ts` (`requireAuth`, `requireRole`), mounted in `server.ts` | A new `server/routes/plan.ts` follows an established shape |
| Public write endpoint with a server-derived contract | `POST /api/inquiries` (`server/routes/inquiries.ts:13`) | The exact precedent for the public feedback door — **including its unfixed spam hole, see P-04** |
| Generated-artifact + offline-test idiom | `scripts/generate-asset-registry.ts` → `src/data/assetRegistry.ts`, guarded by tests | The changelog viewer should be built this way, not with runtime `fs` |
| Pure-helper idiom for testable logic | `scripts/lib/seoPlan.ts` — *"a decision made inside a script that talks to Supabase is a decision no test can reach"* | The changelog parser goes in `scripts/lib/releaseLog.ts` |
| Role vocabulary, shared | `src/lib/roles.ts` (`roleAtLeast`, `CmsRole`) | Reuse; never re-declare a role list |
| Branded studio mailer | `server/emailTemplates.ts` (`BRAND`, `renderBrandedEmail()`) via Resend | Any notification email in `v3.2.0` uses this, never the Supabase Auth mailer |
| DB write path | `scripts/run-migrations.ts` (migrations) · `query()` / `getSupabaseAdmin()` (`src/server/db.ts`) | Unchanged. **Never the Supabase CLI** (`ROADMAP_V3.md` R-13) |

**Not available, and do not assume otherwise:** there is no Supabase MCP server in this repo
(`AGENTS.md` §4), no GitHub Actions (the gates are Vercel preview + Socket + Debricked), and no
public user accounts — "logged in" means a studio `profiles` row with role `admin`/`editor`/`viewer`.

---

## 2. The product, decomposed

Seven capabilities. This list is the definition of "the core feature set" that §4 delivers.

| # | Capability | Ships in |
| :--- | :--- | :--- |
| **C1** | **History** — the admin menu displays the changelog and the development/deployment logs | `v3.1.0` |
| **C2** | **Capture** — CRUD of ideas, feature requests, bugs and planning tasks | `v3.1.0` |
| **C3** | **Group** — items are groupable into releases; releases become first-class | `v3.1.0` (by label) → `v3.2.0` (by entity) |
| **C4** | **Intake (public)** — a footer link for public feedback/suggestions | `v3.1.0` |
| **C5** | **Intake (staff)** — feature-request and bug-submission links for authenticated users | `v3.1.0` |
| **C6** | **Triage** — status, priority, promote, assign, link | `v3.2.0` |
| **C7** | **Close the loop** — draft release notes from completed items, and reconcile them against what actually shipped | `v3.3.0` |

C7 is the reason the feature exists. A backlog nobody reads is worse than a spreadsheet; a backlog
that produces the changelog entry is a system of record.

---

## 3. Design decisions

### 3.1 D1 — History is **derived**; the plan is **authored**. Do not merge them.

There are two different things in this request and conflating them is the main design trap:

| | History (C1) | Plan (C2/C3/C6) |
| :--- | :--- | :--- |
| Direction | **Backward** — what shipped | **Forward** — what might |
| Source of truth | `CHANGELOG.md` + `DEPLOYMENT_LOG.md`, owned by the **release process** | A new `plan_items` table, owned by the **studio** |
| Mutability | Read-only in the app | Full CRUD |
| Failure if wrong | The studio reads a lie | The studio plans badly |

So **`v3.1.0` puts no release data in the database.** The history view is generated from the
markdown the release process already maintains.

**How** — following the `assetRegistry.ts` precedent exactly:

```
scripts/lib/releaseLog.ts          pure parser: markdown string → typed structure. No fs, no pg.
scripts/generate-release-log.ts    reads the two markdown files, calls the parser, writes the artifact
src/data/releaseLog.generated.ts   AUTO-GENERATED, checked in, "do not edit by hand"
server/routes/plan.ts              GET /api/plan/history returns the generated structure
src/test/releaseLog.test.ts        parser fixtures
src/test/releaseLogSync.test.ts    the artifact matches its sources  ← the staleness guard
```

**Rejected alternatives, and why:**

- **Read the markdown at runtime with `fs`.** It works locally and is a packaging risk in the
  serverless function (`api/index.js` is a single esbuild bundle; nothing else in `server/` reads
  from disk). It also puts an untestable I/O call in the middle of the decision.
- **Parse the markdown in the browser.** Puts the whole changelog in the client bundle. See P-08:
  `src/data/assetRegistry.ts` is already **1,010,970 bytes (~987 KB)**, up from the ~445 KB
  recorded in `ROADMAP_V3.md` R-20 — the load made the site's largest payload problem worse, exactly
  as R-20 predicted. Do not add to it.
- **Store releases in the DB and generate `CHANGELOG.md` from it.** This forks the release process
  into two truths on day one, and the CHANGELOG is a release artifact governed by Keep a Changelog +
  Conventional Commits. **`v3.3.0` drafts a changelog section for a human to paste — it never
  writes the file.** That boundary is deliberate and should survive.

**The staleness guard is a feature.** `releaseLogSync.test.ts` regenerates the structure in memory
and asserts it equals the checked-in artifact. A stale history view therefore cannot ship. The cost
is one command in the release checklist — `npx tsx scripts/generate-release-log.ts` — which sits
naturally next to the existing `generate-asset-registry.ts` step.

**"Displaying as they are changed" — what the owner asked for, and how this delivers it.** The
requirement (Q-B, 2026-09-15) is that the two documents are shown *as they change*, not snapshotted
once. The generated-artifact design satisfies that with a guarantee rather than a hope: the view is
never hand-maintained, and `releaseLogSync.test.ts` **fails the suite** the moment the artifact and
`CHANGELOG.md`/`DEPLOYMENT_LOG.md` disagree. So "the view is as current as the last regeneration" is
enforced by the same gate that blocks a merge — a release that forgot to regenerate cannot ship,
which is the strongest form of "as they are changed" available without reading the files at runtime.
The cost is one checklist line per release, and it is stated in the exit criteria (§4) as
`generate-release-log.ts` then `git diff --exit-code` → no diff.

### 3.2 D2 — `v3.1.0` has **one** new table

"Nothing complicated, starting simple" means: prove the whole loop with the least schema. So
`v3.1.0` groups by a **free-text release label** (`plan_items.target_release`, with autocomplete
sourced from `SELECT DISTINCT`), and `v3.2.0` promotes releases to a real entity.

Why this is not throwaway work: the migration is purely additive (`CREATE TABLE` + `ADD COLUMN IF
NOT EXISTS` + a backfill), the UI's grouping control is unchanged, and it avoids guessing a release
table's shape before a single real release has been planned. It also gives `v3.2.0` a genuine,
reviewable backfill instead of an empty table — the same shape as the Phase 4 load.

### 3.3 D3 — Two intake doors, one modal

The public door and the staff door must be **different endpoints with different contracts**, because
the anonymous one is a wider attack surface and must accept strictly less:

| Endpoint | Guard | Accepts | Server forces |
| :--- | :--- | :--- | :--- |
| `POST /api/plan/feedback` | **none** (public) | `title`, `body`, optional `email` | `kind = 'suggestion'`, `source = 'public'` |
| `POST /api/plan/items` | `requireAuth` (any role) | `kind ∈ idea\|feature\|bug\|task`, `title`, `body`, `priority` | `source = 'studio'`, `author_id` from the session |

**`source` and `author_id` are never read from the request body.** They are derived from the
session, or fixed by the route. That is what stops an anonymous caller filing as staff, and it is
the one thing about this design that must not be "simplified" later.

`GET`/`PATCH`/`DELETE /api/plan/items` are `requireRole('editor')`.

### 3.4 D4 — Access matrix, and the nav must match it

`AGENTS.md` §8 is unambiguous: *"a `minRole` on a nav item must match the server guard on the
matching API route"* — the defect `v2.11.0` fixed for Inquiries and Media. This feature adds two
nav items, so the rule applies twice.

| Nav item | Route | API guard | `minRole` | Who sees it |
| :--- | :--- | :--- | :--- | :--- |
| **Changelog** | `/admin/changelog` | `requireAuth` (history is static and non-sensitive) | *(none)* | all roles |
| **Planning** | `/admin/planning` | `requireRole('editor')` | `editor` | editor, admin |
| *(footer)* Feedback | — | `POST /api/plan/feedback` public | — | every visitor |
| *(footer)* Feature / Bug | — | `POST /api/plan/items` `requireAuth` | — | every signed-in user |

Two nav items rather than one with tabs, because the two differ in **access level** (all roles vs
editor+) and in **data source** (static vs DB) — and because `ADMIN_NAV` is a flat list whose
badge lookup keys on the route, so a nested-tab component would be new plumbing for no gain.

**A `viewer` can file but cannot read the board.** That asymmetry is intentional: anyone may knock,
only editors triage. It also means the footer's two staff links must render for `viewer` too — the
user's request says "logged in users", not "editors".

**RLS mirrors the API, and is stricter than it.** `plan_items` gets one policy —
`FOR ALL TO authenticated USING (public.is_admin_or_editor())` — and **no `public` policy at all**,
so the anon key reads zero rows. The public write reaches the table through `/api/*`, which uses
`query()` (the `postgres` role, which bypasses RLS); **the API is therefore the gate for that
endpoint, and RLS is defence in depth.** Corollary, and it belongs in a comment: never add a public
read of `plan_items`. The table holds public submitters' email addresses.

### 3.5 D5 — Version mapping (the §1.1 decision) — ✅ **DECIDED 2026-09-15: A**

**Chosen (A):** `v3.1.0` Capture · `v3.2.0` Group · `v3.3.0` Close the loop · **Phase 5 →
`v3.4.0`**. Justification in §1.1. The owner took this option on 2026-09-15.

**Not chosen (B):** Phase 5 keeps `v3.1.0`; the tool becomes `v3.2.0` → `v3.4.0`. Kept on the
record because it was a live alternative and the trade was real — but it is **not** the plan, and
nothing below assumes it.

**Either way:** `package.json` stays `0.0.0`; versions live in `CHANGELOG.md` and git tags only
(`ROADMAP_V3.md` §3.5). No tag is moved. Because A was chosen, **`ROADMAP_V3.md` §3.4, §4 Phase 5,
§5, §7 and decision #6 are edited in this same PR** — otherwise the repo holds two contradictory
plans, which is the exact failure mode `plan/README.md` was written to prevent.

⚠️ **One promise had to be re-homed, and it is recorded rather than quietly dropped.**
`ROADMAP_V3.md` §3.3 committed to *"raise the default in `v3.1.0` with notice"* for
`GET /api/artworks` pagination — and `v3.1.0` is now this tool. Verified 2026-09-15:
`server/routes/artworks.ts` contains **no** `page`/`limit`/`offset` handling (only a `LIMIT 1` on
the slug lookup), and there is **no** `/api/media/registry` route anywhere in `server/` or `src/`.
So the opt-in pagination that promise depends on **has not shipped**, and neither has the R-20
de-bundle it was paired with — both were scheduled for Phase 2, which shipped without them. The
promise is therefore unfulfilled, not merely re-dated. It now rides with **Phase 5 / R-20**, and it
is called out in `ROADMAP_V3.md` §3.4 so the reassignment is visible where the promise was made
rather than only here.

---

## 4. Release-by-release plan

### `v3.1.0` — **Capture**

> **The most basic version.** One migration, one new route module, two new admin screens, three
> footer links, one generated artifact. No email. No release entity. No public page.

#### What is explicitly **not** in `v3.1.0`

Not an oversight list — a scope fence. Each item is scheduled in `v3.2.0`/`v3.3.0` below.

- No `plan_releases` table (grouping is a text label).
- No item detail view, no comments, no audit trail, no attachments.
- No notification email (the nav badge is the notification).
- No public "What's new" page — **decided out of scope entirely** (Q-C), not deferred to a later
  release. It was the one item here that touched the public render path, `seoPlan.ts` /
  `prerender-seo.ts` and `vercel.json`, and it is now **removed** rather than postponed.
- No screenshot or file attachments on items or release notes — **backlog, see §8** (owner-raised
  2026-09-15: *"screenshots would be great for anything that involves UI"*, explicitly parked as a
  future enhancement).
- No CSV export, no search, no drag-to-reorder.
- No publish path for the 60 unpublished murals (see P-02).

#### Tasks

**Schema**

1. **`supabase/migrations/2026_09_1X_v3_1_plan_items.sql`** *(date it to the day it is written; it
   must sort after `2026_09_01_baseline_core_tables.sql`)*. One table, three indexes, RLS, one
   policy, one trigger + its function:

   ```sql
   CREATE TABLE IF NOT EXISTS public.plan_items (
     id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     kind           text NOT NULL,
     title          text NOT NULL,
     body           text,
     status         text NOT NULL DEFAULT 'new',
     priority       text,
     target_release text,                 -- a label in v3.1; an FK target in v3.2
     source         text NOT NULL DEFAULT 'studio',
     source_ref     text,                 -- 'artwork:<slug>', 'release:v3.0.0', … idempotency + linking
     author_id      uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
     author_name    text,
     author_email   text,
     page_url       text,                 -- where a public submission came from
     created_at     timestamptz NOT NULL DEFAULT now(),
     updated_at     timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT plan_items_kind_check
       CHECK (kind IN ('idea', 'feature', 'bug', 'task', 'suggestion')),
     CONSTRAINT plan_items_status_check
       CHECK (status IN ('new', 'accepted', 'planned', 'in_progress', 'done', 'declined')),
     CONSTRAINT plan_items_priority_check
       CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high')),
     CONSTRAINT plan_items_source_check CHECK (source IN ('studio', 'public'))
   );

   CREATE INDEX IF NOT EXISTS plan_items_status_idx
     ON public.plan_items (status, created_at DESC);
   CREATE INDEX IF NOT EXISTS plan_items_release_idx
     ON public.plan_items (target_release) WHERE target_release IS NOT NULL;
   CREATE UNIQUE INDEX IF NOT EXISTS plan_items_source_ref_key
     ON public.plan_items (source_ref) WHERE source_ref IS NOT NULL;

   ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;

   DROP POLICY IF EXISTS "Admins manage plan_items" ON public.plan_items;
   CREATE POLICY "Admins manage plan_items"
     ON public.plan_items FOR ALL TO authenticated
     USING (public.is_admin_or_editor())
     WITH CHECK (public.is_admin_or_editor());
   ```

   plus `public.plan_items_touch_updated_at()` (`CREATE OR REPLACE`, copying
   `profiles_touch_updated_at()`), `DROP TRIGGER IF EXISTS trg_plan_items_touch` then
   `CREATE TRIGGER … BEFORE UPDATE … FOR EACH ROW`.

   **Why a partial unique index on `source_ref`:** it is what makes the `v3.1` seed (task 7) and
   every later re-run idempotent, and it is the join key that lets a bug report name the artwork it
   is about.

   **This migration must satisfy `src/test/migrationSafety.test.ts` unchanged.** It does, and the
   checklist is worth stating because that suite is the gate: `IF NOT EXISTS` on the table and every
   index; `DROP POLICY IF EXISTS` before `CREATE POLICY`; `DROP TRIGGER IF EXISTS` before
   `CREATE TRIGGER`; RLS enabled **only** on a table this migration creates; no table created twice;
   and — the `v2.12.1` regression guard — **no policy granting `TO authenticated USING (true)`**.

2. ⚠️ **Add `plan_items` to the backup/restore set in the same PR** — `TABLES`, `RESTORE_ORDER` and
   `CATALOG_TABLES` in `scripts/lib/restorePlan.ts`. This is R-07 repeating otherwise:
   `artwork_images` was in **no** backup set until `v3.0.0`, so the dump looked complete while the
   murals' cover ordering was unrestorable. A table created by a migration is not backed up until
   someone adds it by hand. `server/lib/catalogDump.ts` reads `RESTORE_ORDER`, so one edit covers
   both the CLI and the cron writer.

**History (C1)**

3. **`scripts/lib/releaseLog.ts`** — pure parser. `parseChangelog(md)` → releases with `version`,
   `date`, and sections (`Added`/`Changed`/`Fixed`/`Removed`/`Security`/`Deprecated`) each holding
   entries; `parseDeploymentLog(md)` → the deployment rows (date, version, URL, status, target,
   commits). Tolerates: the `[Unreleased]` section, `~~struck~~` retired rows, missing columns, and
   malformed input (returns what it could parse plus a diagnostic — never throws).
4. **`scripts/generate-release-log.ts`** → `src/data/releaseLog.generated.ts`, with the
   `AUTO-GENERATED … do not edit by hand` banner and the regenerate command, exactly as
   `src/data/assetRegistry.ts` has it.
5. **`src/test/releaseLog.test.ts`** + **`src/test/releaseLogSync.test.ts`** (D1).
6. **`GET /api/plan/history`** in the new `server/routes/plan.ts`, `requireAuth`, returns the
   generated structure. Mounted in `server.ts` as `app.use("/api/plan", planRouter)`.

**Intake + CRUD (C2, C4, C5)**

7. **`server/routes/plan.ts`** — the five endpoints of §3.3/§3.4. Validation and coercion live in a
   pure **`server/lib/planRules.ts`** (allowed `kind`/`status` transitions, the anonymous coercion,
   title/body length caps, the PATCH allow-list), so the rules are unit-testable without a database
   — the same split as `server/lib/userAdmin.ts`.
8. **Spam and abuse on the public door** — a hidden honeypot field plus a per-IP rate limit, both in
   a small shared helper. **Fix `POST /api/inquiries` with the same helper in this PR**: backlog
   §1.3 records that the inquiry form has no captcha, honeypot or rate limit and that each
   submission spends Resend quota. Shipping a second unguarded public write endpoint next to the
   first would be knowingly repeating a documented defect.
9. **Admin UI** — `src/components/admin/ChangelogView.tsx` (releases + deployments, read-only) and
   `src/components/admin/PlanningView.tsx` (flat list, filters by kind/status/release, a create/edit
   dialog, delete with confirmation, and an autocomplete on `target_release` from
   `SELECT DISTINCT`).
10. **Nav + routing** — two entries in `ADMIN_NAV` and two `switch` cases in `AdminApp.tsx`, with
    `minRole` exactly as §3.4 specifies.
11. **Footer + shared modal** — `src/components/FeedbackModal.tsx`, and three footer links in
    `src/App.tsx` (the footer is inline there, lines ~366–490; it already branches on
    `isAuthenticated` for the Studio Login control). Public visitors see *Feedback & Suggestions*;
    authenticated users additionally see *Request a Feature* and *Report a Bug*.
12. **Seed the board with the work that actually exists** — an idempotent backfill keyed on
    `source_ref = 'artwork:<slug>'` creating one review item per `artworks` row where
    `kind = 'mural' AND draft = true`. ~60 rows. **Why this is in the most basic version:** an empty
    planning board is abandoned within a fortnight, and this gives it immediate purpose, answers
    Q17's "how do mural drafts get reviewed?" with the cheapest possible mechanism, and exercises
    the unique index. The backfill **must print inserted-vs-skipped counts** — the Phase 3
    NEW/EXISTS/COLLISION discipline, for the same reason: a silent `ON CONFLICT DO NOTHING` hides a
    wrong natural key.
13. **Dashboard** — one card on `DashboardHome` (open items, unread public submissions) linking to
    `/admin/planning`, shown only when `canEdit`.
14. **`scripts/smoke-serverless.ts`** — add all six new endpoints to the expected table. The suite
    walks the mounted route table, so a route that is not listed is a route nobody notices is
    missing.

**Release plumbing**

15. `npm run lint` **and** `npm test` (vitest transpiles without typechecking — a type error in
    `server/` passes the suite and is caught only by `lint`); `npm run smoke` (a new mount);
    `npx tsx scripts/backup-catalog.ts` before the migration; rehearse on the local scratch DB
    (`supabase start` + this repo's runner, **never the Supabase CLI for migrations**).
16. Docs: `CHANGELOG.md`, `DEPLOYMENT_LOG.md` (its own post-merge docs PR), `AGENTS.md` §5/§6/§8,
    `plan/README.md` index, and — if §3.5 A is chosen — the `ROADMAP_V3.md` edits listed there.

#### Exit criteria — written as commands, not prose

- [ ] `npm run lint` exits 0.
- [ ] `npm test` green, including `migrationSafety` and the two new `releaseLog` suites.
- [ ] `npm run smoke` exits 0 with the six new endpoints present.
- [ ] `npx tsx scripts/run-migrations.ts` prints the intended `Target:`, and a **second** run
      reports nothing pending (idempotency).
- [ ] `npx tsx scripts/introspect-schema.ts` shows `plan_items` with RLS enabled and exactly one
      policy, and `schema_migrations` one row longer.
- [ ] A direct anon PostgREST read of `plan_items` returns **zero rows** (the RLS proof, not the
      policy text).
- [ ] A public `POST /api/plan/feedback` stores `kind='suggestion'`, `source='public'`; the same
      request with `"source":"studio"` in the body still stores `'public'`.
- [ ] An unauthenticated `GET /api/plan/items` returns 401; an authenticated `viewer` returns 403.
- [ ] `npx tsx scripts/generate-release-log.ts` then `git diff --exit-code` → no diff (the artifact
      is in sync with `CHANGELOG.md`).
- [ ] The Planning board shows ~60 seeded mural-review items.

---

### `v3.2.0` — **Group** (C3, C6)

The release where the board becomes a real tool rather than a list.

1. **Migration** `…_v3_2_plan_releases.sql`: `plan_releases` (`id`, `version text UNIQUE`,
   `title`, `status ∈ planned|in_progress|shipped|cancelled`, `target_date`, `shipped_at`,
   `notes`, timestamps) with RLS + the same `is_admin_or_editor()` policy and touch trigger; then
   `ALTER TABLE public.plan_items ADD COLUMN IF NOT EXISTS release_id uuid REFERENCES
   public.plan_releases (id) ON DELETE SET NULL`; then a backfill inserting distinct non-null
   `target_release` values and matching them back by `version`.
   **Keep `target_release` for at least one release.** It is the escape hatch if the backfill
   mismatches, and dropping a column in the same migration that introduces its replacement removes
   the ability to check the backfill afterwards.
2. **Releases view** — CRUD, plus a "shipped" transition that records `shipped_at`.
3. **Grouping UI** — the board grouped by release with a move control; the flat list stays.
4. **Item detail drawer** — triage actions (status/priority/kind), the promote action
   (a `suggestion` → `feature`/`task` in one step), and a link field bound to `source_ref`.
5. **Unread badge** — `badgeCount` on the Planning nav item for `status = 'new'`; `AdminLayout`
   already renders it.
6. **Notification email** — a **batched** Resend digest to `ADMIN_EMAIL` for new public submissions,
   rendered from `server/emailTemplates.ts`. Batched, not per-row: a public endpoint that sends mail
   is a way to spend the studio's Resend quota (P-04).
7. **Cross-link history ↔ plan** — a release row shows its matching historical CHANGELOG section,
   joined on `version`. First place the two sources meet, and it stays a *join*, not a merge (D1).
8. Tests: `planRules` transitions, the releases backfill (fixtures incl. a `target_release` that
   matches no version), the badge count, the drawer.

---

### `v3.3.0` — **Close the loop** (C7)

1. **Release-notes assembly** — from `plan_items` where `release_id = X AND status = 'done'`, emit a
   **Keep a Changelog** section grouped by `kind` (`feature`/`idea` → Added, `bug` → Fixed,
   `task` → Changed), as copyable/downloadable markdown. **It produces a draft. It never writes
   `CHANGELOG.md`** (D1).
2. **Reconciliation view** — the capability that makes "tracks" true: list releases that shipped
   with no matching CHANGELOG entry, and CHANGELOG entries with no matching release. This is the
   `DEPLOYMENT_LOG.md` drift problem (`AGENTS.md` §8: it *"drifted three releases behind once
   already"*) turned into a screen.
3. **Timeline / roadmap view** — items grouped by release in date order.
4. **Item ↔ artwork linking in the UI** — pick an artwork for `source_ref` so a bug report names the
   piece it is about.
5. **Search, filter, sort, CSV export** of items.
6. **~~Public "What's new" page~~ — ❌ CUT (Q-C, 2026-09-15).** The owner decided there is no need
   for public display in this scope, so this is not a `v3.3.0` item and not a later one either. It
   is kept here, struck rather than deleted, with its cost intact so a future owner can price it
   instead of re-deriving it: a real public path needs `scripts/prerender-seo.ts` (which writes
   `dist/artwork/<slug>/index.html` and is artwork-specific), `scripts/lib/seoPlan.ts`
   (`selectIndexable` is artwork-shaped), the `vercel.json` catch-all negative lookahead, and a
   `sitemap.xml` entry. Not a one-line change — which is part of why cutting it is the cheap call.
7. **Optional, only if the board is genuinely in daily use:** item comments, and an
   `plan_item_events` audit trail. **Do not build these speculatively** — they are the classic
   features that get built for a tool nobody uses.

---

## 5. Task inventory

The complete set, in dependency order. `→` means "cannot start before".

| # | Task | Cap | Release | Blocked by |
| :--- | :--- | :--- | :--- | :--- |
| 0 | ✅ **DONE 2026-09-15 — Q-A = A.** `ROADMAP_V3.md` §3.4/§4/§5/§7/#6 edited in this PR | — | pre-flight | — |
| 1 | ✅ **DONE 2026-09-15 — Q-B:** `CHANGELOG.md` + `DEPLOYMENT_LOG.md`, shown as they change. **Q-C:** no public page | — | pre-flight | — |
| 2 | ✅ **DONE 2026-09-15 — Q-D answered yes.** `AGENTS.md` header (`v2.13.0` → `v3.1.0`), §5 (16 migrations, `plan_items`, row counts), §6 (the new files, 13 → 16 migrations), §8 (the `minRole` ↔ guard matrix, **813/47**), plus `docs/runbooks/database-backup-restore.md` (the ledger counts and the `plan_items` restore-set row) and `plan/README.md`'s `604/605` → `604 of 1109` | — | pre-flight | — |
| 3 | ✅ **DONE 2026-09-15** — `2026_09_15_v3_1_plan_items.sql`. Rehearsed twice on the scratch DB (applied, then "Nothing to do"); live read-back: RLS on, **exactly one policy**, 15 columns, 4 indexes, 1 trigger, 4 CHECKs | C2 | 3.1.0 | 0 |
| 4 | ✅ **DONE 2026-09-15** — `TABLES` + `RESTORE_ORDER` (after `profiles`) + `CATALOG_TABLES`; a dump now covers **10 tables** | C2 | 3.1.0 | 3 |
| 5 | ✅ **DONE 2026-09-15** — `scripts/lib/releaseLog.ts`, pure and offline (23 tests) | C1 | 3.1.0 | — |
| 6 | ✅ **DONE 2026-09-15** — `scripts/generate-release-log.ts` → `src/data/releaseLog.generated.ts`; 21 releases / 77 deployment rows / 68 sections / 224 entries, **0 warnings**, byte-identical on re-run | C1 | 3.1.0 | 5 |
| 7 | ✅ **DONE 2026-09-15** — `releaseLog.test.ts` (23) + `releaseLogSync.test.ts` (3), the latter a real staleness gate on the committed artifact | C1 | 3.1.0 | 5, 6 |
| 8 | ✅ **DONE 2026-09-15** — `server/lib/planRules.ts`: the two-door asymmetry, the `PATCH_COLUMNS` allow-list, transitions, filters (49 tests) | C2 | 3.1.0 | — |
| 9 | ✅ **DONE 2026-09-15** — `server/routes/plan.ts` (6 endpoints, **no router-wide guard** — the guards differ by design), mounted in `server.ts` with scoped 64 KB parsers and a narrow body-parser error handler | C1–C5 | 3.1.0 | 3, 5, 8 |
| 10 | ✅ **DONE 2026-09-15** — `server/lib/requestGuards.ts` (24 tests), applied to the new endpoint **and** `POST /api/inquiries`, which was the repo's only unguarded public write | C4 | 3.1.0 | 9 |
| 11 | ✅ **DONE 2026-09-15** — `ChangelogView.tsx`, reading the generated artifact so a parser change fails `npm run lint` | C1 | 3.1.0 | 9 |
| 12 | ✅ **DONE 2026-09-15** — `PlanningView.tsx`: stats, 3 filters, table, create/edit dialog, delete confirm, `<datalist>` release picker | C2, C3 | 3.1.0 | 9 |
| 13 | ✅ **DONE 2026-09-15** — two `ADMIN_NAV` rows + two `AdminApp` cases, `minRole` per §3.4; parity asserted by `src/test/adminNavGuard.test.ts` (9 tests, **proven able to fail**) | C1–C3 | 3.1.0 | 11, 12 |
| 14 | ✅ **DONE 2026-09-15** — `FeedbackModal.tsx` (3 modes) + three footer links in `App.tsx` (the two staff ones behind `isAuthenticated`) | C4, C5 | 3.1.0 | 9 |
| 15 | ✅ **DONE 2026-09-15** — `scripts/seed-plan-board.ts`, `--dry-run` supported, classification done in JS (not by trusting `ON CONFLICT`): **62 murals → 62 NEW → 62 inserted**, then **0 NEW / 62 EXISTS / 0 inserted** | C2 | 3.1.0 | 3 |
| 16 | ✅ **DONE 2026-09-15** — `DashboardHome` planning card (`?limit=1`: the query runs, the payload is one row) | C2 | 3.1.0 | 12 |
| 17 | ✅ **DONE 2026-09-15** — 6 rows in `REQUIRED` + 8 DB-free probes (four 401s, 400, 201 honeypot, **413 for a 70 KB body** — which pins the parser-ordering decision) | — | 3.1.0 | 9 |
| 18 | ✅ **DONE 2026-09-15** — `planRules` (49) + `requestGuards` (24) + `adminNavGuard` (9); **813 tests / 47 files**, up from 717/43 | — | 3.1.0 | 13, 14 |
| 19 | 🚧 **IN FLIGHT** — scratch rehearsal ✅, backup pending, PR pending, gates pending, tag pending, `DEPLOYMENT_LOG` pending (its own post-merge docs PR) | — | 3.1.0 | all |
| 20 | Migration: `plan_releases` + `plan_items.release_id` + backfill | C3 | 3.2.0 | 19 |
| 21 | Releases view (CRUD, `shipped_at`) | C3 | 3.2.0 | 20 |
| 22 | Board grouping by release + move control | C3 | 3.2.0 | 20 |
| 23 | Item detail drawer + triage + promote + link | C6 | 3.2.0 | 20 |
| 24 | Unread badge on the Planning nav item | C6 | 3.2.0 | 20 |
| 25 | Batched Resend digest for new public submissions | C4 | 3.2.0 | 20 |
| 26 | Release ↔ historical changelog section join | C1, C3 | 3.2.0 | 20 |
| 27 | Release-notes assembly (draft only, never writes `CHANGELOG.md`) | C7 | 3.3.0 | 23 |
| 28 | Reconciliation view (shipped vs changelog drift) | C7 | 3.3.0 | 26, 27 |
| 29 | Timeline/roadmap view | C7 | 3.3.0 | 20 |
| 30 | Item ↔ artwork linking UI | C7 | 3.3.0 | 23 |
| 31 | Search / filter / sort / CSV export | C6 | 3.3.0 | 23 |
| 32 | ~~Public "What's new" page~~ — ❌ **CUT by Q-C** (2026-09-15); see §4 `v3.3.0` item 6 | — | — | — |
| 33 | Comments + `plan_item_events` audit trail — **only if the board is in daily use** | — | 3.3.0 opt | 23 |
| 34 | **Screenshot attachments for UI-related items** — **backlog, not scheduled** (§8) | — | backlog | — |

---

## 6. Sequencing, dependencies, and the critical path

```
  Q-A ✅ = A (2026-09-15) ── CLEARED ──► `ROADMAP_V3.md` §3.4/§4/§5/§7/#6 edited in this same PR
  Q-B ✅ `CHANGELOG.md` + `DEPLOYMENT_LOG.md`        Q-C ✅ no public page → task 32 cut

  3.1.0  schema ──► restorePlan ──► routes ──► UI ──► footer ──► seed ──► release
          │              │             ▲
          │              │        parser + rules (parallel, no deps)
          │              └─ BLOCKING: a new table that is not in the backup set is R-07
          └─ BLOCKING: everything downstream needs the table

  3.2.0  plan_releases ──► grouping UI ──► detail/triage ──► badge ──► digest
                              └─ BLOCKING: 3.3's assembly needs release_id

  3.3.0  assembly ──► reconciliation ──► timeline / linking / search / export
                                          (no public page — cut by Q-C)
```

**Critical path:** `migration → routes → PlanningView/ChangelogView → release`. **Q-A is off it** —
it was the gate, and it is now closed.

**Genuinely parallel, no dependencies:** tasks 5–8 (the parser, the generator, the tests and the
pure rules) can all be written before the migration exists, because none of them touch the
database. That is the point of putting the decisions in pure modules — it is also what makes them
testable offline, which is this repo's stated testing posture.

**Hard blockers, stated plainly:**

- ~~**No work before Q-A is answered.**~~ ✅ **CLEARED 2026-09-15 (Q-A = A).** Building this on a
  version number another document owns is how a repo ends up with two contradictory plans — and the
  remedy was to settle the number and edit the other document in the same PR, which is what
  happened. The precondition is **met, not waived**: if `ROADMAP_V3.md` and this document ever
  disagree about a version again, this blocker is back.
- **No migration merge without task 4** (the backup set). Same PR, not a follow-up.
- **No `v3.3.0` assembly before `v3.2.0`'s `release_id` exists** — assembly is a group-by-release
  query and has nothing to group by until then.
- ~~**No public page before Q-C.**~~ ✅ **RESOLVED by cutting it.** Q-C = no public display in this
  scope, so the one item that touched the public render path, the sitemap and `vercel.json` leaves
  the program entirely rather than waiting on a decision.

---

## 7. Risk register

| ID | Risk | Impact | Mitigation | Status |
| :--- | :--- | :--- | :--- | :--- |
| **P-01** | **The version collision (§1.1)** — `v3.1.0` was already assigned to Phase 5 by `ROADMAP_V3.md` §3.4/#6/Q13 | Two contradictory plans in one repo; a release cut against the wrong scope | ✅ **CLOSED 2026-09-15 — Q-A = A.** Phase 5 → `v3.4.0`, and `ROADMAP_V3.md` §3.4/§4/§5/§7/#6 are edited **in this same PR**, so the two documents agree. Residual: the *unfulfilled* `v3.1.0` pagination promise, re-homed to Phase 5/R-20 rather than dropped (§3.5) | ✅ Closed |
| **P-02** | **60 murals are live but unpublished** (`draft = true` **and** `enabled = false`; 0 of 60 in the sitemap). Neither release here publishes them, and a planning tool is a very plausible thing to build *instead of* the work | The merged mural content delivers nothing visible, indefinitely | The v3.1 seed (task 15) puts all 60 on the board as review items — that makes the gap *visible and countable* rather than a memory. Publishing them remains a separate, owner-scheduled pass; **do not let this program become the reason it slips** | Open — needs an owner date |
| **P-03** | **The generated history artifact goes stale** — exactly the failure mode `assetRegistry.ts` has | The studio reads a changelog that is not the changelog | `releaseLogSync.test.ts` regenerates in memory and asserts equality, so staleness **cannot ship**; regeneration joins the release checklist next to `generate-asset-registry.ts` | Mitigated by design |
| **P-04** | **A public write endpoint is a spam and cost vector.** Backlog §1.3 records that `POST /api/inquiries` has no captcha, honeypot or rate limit, and that each submission spends Resend quota | A second unguarded public endpoint next to a documented defect; a flooded inbox and burnt email quota | Honeypot + per-IP rate limit in v3.1 (task 10), **and fix `/api/inquiries` with the same helper in the same PR**. The `v3.2` digest is batched, never per-row | Open — task 10 |
| **P-05** | **`plan_items` holds public submitters' email addresses** — PII, in a table the public can reach a route to | Leaked collector/visitor contact details | RLS: `is_admin_or_editor()` only, **no `public` policy at all**; the public write goes through `/api/*`, which uses the RLS-bypassing `postgres` role, so the API is the gate. Add a comment: never add a public read of this table | Mitigated by design |
| **P-06** | **A new table that is not in the backup set** — R-07 exactly: `artwork_images` was in no dump until `v3.0.0`, so the dump looked complete while the murals' cover ordering was unrestorable | The planning board is unrecoverable; the loss is silent until a restore | Task 4, **same PR as the migration**. `server/lib/catalogDump.ts` reads `RESTORE_ORDER`, so one edit covers the CLI and the cron writer | Open — task 4 |
| **P-07** | **Nav/API role drift** — a `minRole` that disagrees with the server guard offers a Viewer a menu item that answers 403. This is the defect `v2.11.0` fixed for Inquiries and Media, and this feature adds two nav items | Dead ends for read-only accounts | §3.4's matrix is the contract; task 18 adds a parity test that reads `ADMIN_NAV` and the route file and asserts they agree | Open — task 18 |
| **P-08** | **Bundle growth.** `src/data/assetRegistry.ts` is now **1,010,970 bytes (~987 KB)** — up from the ~445 KB recorded in `ROADMAP_V3.md` R-20. The mural load made the site's largest payload problem worse, as R-20 predicted | Adding the changelog to the client bundle would compound a known, un-fixed problem | The history is served from `GET /api/plan/history`, never imported by a component; `AdminApp` stays `React.lazy`-loaded | Mitigated by design — but R-20 itself remains open |
| **P-09** | **A silent seed backfill.** `ON CONFLICT DO NOTHING` keyed on `source_ref` will skip rows if the natural key is wrong, and report success | 60 items become 12 and nobody notices | The backfill **must print inserted vs skipped**, and the exit criteria assert ~60 rows — the Phase 3 NEW/EXISTS/COLLISION discipline | Open — task 15 |
| **P-10** | **Two truths for releases** — `plan_releases` (forward) and `CHANGELOG.md` (backward) will disagree | The reconciliation screen exists to surface this; if the sources are merged instead, the release process forks | D1: never write `CHANGELOG.md` from the app; `v3.3` *drafts* and *reconciles*, a human commits. The join is on `version` and stays a join | Mitigated by design |
| **P-11** | **Building features for a tool nobody uses** — comments, audit trails, drag-reorder, screenshot attachments, a public page | Effort spent on speculation | Everything past `v3.2.0` task 23 is explicitly optional (task 33), **cut** (task 32, by Q-C) or **parked as backlog** (task 34, screenshots). **The acceptance test is §0: the studio plans `v3.2.0` on the board `v3.1.0` shipped.** If that does not happen, stop and reassess before `v3.3.0` | Open — deliberate |

---

## 8. Do not do yet

Carried forward from `ROADMAP_V3.md` §7 and `docs/adr/0001` §5 — these still hold:

- **`HomeLandingView` decomposition.** 1229 lines, still untouched by any migration path.
- **Design-system work.** No design tokens, no theming rework.
- **The studio-CMS backlog** (`BACKLOG_STUDIO_CMS.md`) — revision history, bulk actions, print/PDF,
  inquiry notes, onboarding help. It was `v3.1.0`-or-later; it now rides with Phase 5 (**`v3.4.0`**,
  after the 2026-09-15 reassignment — `v3.1.0`–`v3.3.0` are this tool).
- **No CDN, no new vendor** (Q3) · **no full-resolution handling in the studio, ever** (Q4) ·
  **no re-encode of the existing catalog** · **do not modify `wayback/`**.

New to this document:

- **Do not add a public read of `plan_items`.** Ever. P-05.
- **Do not write `CHANGELOG.md` from the application.** It is a release artifact. Draft it, reconcile
  it, commit it by hand. D1.
- **Do not build the comments/audit-trail layer before the board is in daily use.** Task 33.
- **Do not build screenshot / file attachments yet.** Owner-raised 2026-09-15 — *"screenshots would
  be great for anything that involves UI"* — and parked in the same breath as a future enhancement,
  so it is **task 34: backlog, not scheduled**. It is not free when it does come, and the reasons
  belong here so it is not waved through later: it needs a **storage surface** (a new bucket or
  prefix — the repo has exactly one, `artwork-images`), an **upload route** carrying the same
  honeypot / rate-limit / size-cap obligations as task 10, and it **inherits the R-07 / R-17 gap** —
  Storage objects are in no database dump, and the repo has **no delete path for storage objects**,
  so an attachment cannot be withdrawn once written. Decide the retention and delete story *before*
  building the upload button, not after.
- **Do not apply migrations through the Supabase CLI.** R-13 is permanent: two divergent ledgers, and
  every `2026_…` filename collapses to version `2026`.

---

## 9. Open questions for the owner

| # | Question | Blocks | Recommendation |
| :--- | :--- | :--- | :--- |
| **Q-A** | **Version mapping.** ~~Does this tool take `v3.1.0`–`v3.3.0` and push Phase 5 to `v3.4.0` (**A**), or does Phase 5 keep `v3.1.0` and the tool become `v3.2.0`–`v3.4.0` (**B**)?~~ | ~~Everything~~ | ✅ **ANSWERED 2026-09-15 — A.** The tool takes `v3.1.0`–`v3.3.0`; **Phase 5 → `v3.4.0`**. `ROADMAP_V3.md` §3.4/§4/§5/§7/#6 edited **in this same PR**. Nothing had shipped against `v3.1.0` (no tag, no CHANGELOG section, no branch), so the renumber is legitimate — and no tag was moved. Residual: the unfulfilled `v3.1.0` pagination promise, re-homed in §3.5 |
| **Q-B** | **What are the "development logs"?** ~~This document assumes `DEPLOYMENT_LOG.md` + `plan/README.md`…~~ | Task 5's parser scope, task 11's view | ✅ **ANSWERED 2026-09-15 — `CHANGELOG.md` + `DEPLOYMENT_LOG.md`**, displayed **as they are changed**. ⚠️ This document's earlier guess of `plan/README.md` was **wrong** and is corrected here: the spec index is a *planning* artifact, not a log. Parser scope (task 5) therefore reads **exactly two files**. `.workbuddy-ai/memory/*.md` stay out — internal agent working memory, not studio-facing |
| **Q-C** | **Should there be a public "What's new" page?** | ~~Task 32~~ | ✅ **ANSWERED 2026-09-15 — NO.** *"No need for public display in this scope."* **Not deferred — cut:** task 32 is removed, §4's `v3.3.0` item 6 is struck, and §6's blocker is resolved. This was the program's only public-render-path item, so the whole program now touches no public route, no sitemap and no `vercel.json` |
| **Q-D** | **Should the pre-flight doc repair be in scope?** `AGENTS.md` is stale in at least four verified places: its header says *"Verified against: release `v2.13.0`"* while `v3.0.0` shipped; §6 says *"13 idempotent SQL migrations"* against 15 files on disk; §8 says *"Suite as of `v2.14.0`: 390 tests across 31 files"* against 43 test files now; and `ROADMAP_V3.md` R-20's *"~445 KB"* for `assetRegistry.ts` is now ~987 KB | Nothing — it is hygiene | ✅ **ANSWERED 2026-09-15 — yes, as task 2**, and executed in this PR. The four cited places were repaired (plus `docs/runbooks/database-backup-restore.md` and `plan/README.md`), and §8 gained the `minRole` ↔ guard matrix plus a release checklist so the header, the counts and the derived artifacts are refreshed *as part of* a release rather than a release later. ⚠️ `ROADMAP_V3.md` R-20's `~445 KB` figure was **not** touched — it is a frozen historical risk statement, and R-20 itself is re-homed to Phase 5 |
| **Q-E** | **Should a `viewer` see the Planning board?** §3.4 says no (read is editor+, matching RLS exactly). The cost is that a read-only account can file a bug but not watch it | Task 13, task 23 | **No, keep it editor+.** The board holds public submitters' emails, and RLS/API parity is worth more than viewer visibility |

---

## 10. Release mechanics (unchanged project law)

Restated because this program spans three releases and the process is the part that gets skipped:

- **Version numbers live in `CHANGELOG.md` and git tags only.** `package.json` stays `0.0.0`.
- **Keep a Changelog 1.1.0** + **SemVer 2.0.0** + **Conventional Commits**.
- **Every change ships through a PR.** Push `release/x.y.z`, open the PR, wait for the three gates —
  **Vercel preview, Socket Security, Debricked** (there are **no GitHub Actions**) — and merge only
  at `mergeStateStatus=CLEAN`. ⚠️ `UNSTABLE` can read with all checks `pass`; re-query.
- ⚠️ **Never push `main` first** — GitHub then refuses the PR and the commits reach production ahead
  of the gates. `v2.15.0` did exactly this.
- Merge with `gh pr merge <n> --merge` — **not** `--squash`.
- **Tag the merge commit on `main`.** ⚠️ `git tag -a` writes a loose ref which this sandbox prunes:
  build the object with `git mktag` and **push it by SHA**.
- **Update `DEPLOYMENT_LOG.md`** every release, in its own post-merge docs PR — the row cites the
  merge SHA and the deploy URL, so it cannot exist beforehand.
- **Back up before you write:** `npx tsx scripts/backup-catalog.ts`, then follow
  [`../docs/runbooks/database-backup-restore.md`](../docs/runbooks/database-backup-restore.md).
- **Rehearse on the local scratch DB** (`supabase start` + **this repo's** runner). The Supabase CLI
  is for `start`/`db dump` only — R-13.

---

## Appendix A — Claim → evidence

| Claim | Evidence |
| :--- | :--- |
| `v3.1.0` **was** assigned to Phase 5 before 2026-09-15 | `plan/ROADMAP_V3.md` §3.4 table; §4 "Phase 5 … ships in `v3.1.0`"; §8 decision #6; §9 Q13 — all four now read `v3.4.0`, edited in this PR |
| The `v3.1.0` pagination promise is **unfulfilled**, not merely re-dated | `plan/ROADMAP_V3.md` §3.3 — *"raise the default in `v3.1.0` with notice"*; `server/routes/artworks.ts` has no `page`/`limit`/`offset` (only `LIMIT 1` on the slug lookup, `:67`); no `/api/media/registry` route in `server/` or `src/` — so R-20's de-bundle is unshipped too, though both were scheduled for Phase 2 |
| The repo has no delete path for Storage objects | `AGENTS.md` §4 / `v2.16.0` notes — *"this repo has no delete path for storage objects"*; relevant to task 34 (screenshots) |
| 60 murals are unpublished and absent from the sitemap | `DEPLOYMENT_LOG.md` v3.0.0 row — *"0 of the 60 new mural slugs appear in the live sitemap (138 `<loc>`)"* |
| Q17 (mural draft review) is still open | `plan/ROADMAP_V3.md` §9 Q17 |
| `ADMIN_NAV` carries `minRole` and a badge hook | `src/components/admin/AdminLayout.tsx:31–69` (`AdminNavItem`, `ADMIN_NAV`), `:96–97` (`badgeFor`) |
| Admin hash routing and `subPath` parsing | `src/App.tsx:60–64`; `src/lib/adminRoute.ts` |
| The public write precedent, with its spam hole | `server/routes/inquiries.ts:13` (`POST /`, no guard); `plan/BACKLOG_STUDIO_CMS.md` §1.3 |
| Route guards available | `server/middleware/auth.ts` — `requireAuth`, `requireRole("editor"\|"admin")` |
| `is_admin_or_editor()` exists and is granted | `supabase/migrations/2026_09_13_cms_v2_2_profiles_rls_recursion_fix.sql:41,55` |
| New-table RLS obligations | `src/test/migrationSafety.test.ts` — *"enables RLS only on tables that some migration actually creates"*, the `v2.12.1` blanket-policy guard, and the `DROP … IF EXISTS` guards |
| A new table must be added to the backup set by hand | `scripts/lib/restorePlan.ts:44` (`TABLES`), `:75` (`RESTORE_ORDER`), `:91` (`CATALOG_TABLES`); `server/lib/catalogDump.ts:31,76` reads them; `AGENTS.md` §5 R-07 note |
| Generated-artifact idiom and its banner | `src/data/assetRegistry.ts:1–14`; `scripts/generate-asset-registry.ts` |
| `assetRegistry.ts` is ~987 KB, not ~445 KB | `ls -l src/data/assetRegistry.ts` → 1,010,970 bytes; `ROADMAP_V3.md` R-20 says ~445 KB |
| Pure-helper idiom, stated by the repo | `scripts/lib/seoPlan.ts:1–22` — *"a decision made inside a script that talks to Supabase is a decision no test can reach"* |
| Prerender is artwork-specific | `scripts/prerender-seo.ts:202–224` (`dist/artwork/<slug>/index.html`, `dist/sitemap.xml`); `scripts/lib/seoPlan.ts` `selectIndexable` |
| The footer is inline and already branches on auth | `src/App.tsx:366` (footer), `:470–487` (`isAuthenticated` branch) |
| The studio mailer is Resend with one branded shell | `server/emailTemplates.ts` (`BRAND`, `renderBrandedEmail()`); `AGENTS.md` §2 |
| Smoke test has an explicit endpoint table | `scripts/smoke-serverless.ts:109–149` |
| Migration invariants the new file must satisfy | `src/test/migrationSafety.test.ts` (`IF NOT EXISTS` × table/index/column, policy and trigger drop guards) |
| `DEPLOYMENT_LOG.md` has drifted before | `AGENTS.md` §8 — *"it drifted three releases behind once already"* |
| Doc drift is a named, permanent risk | `plan/ROADMAP_V3.md` R-21 |
| `AGENTS.md` is stale | header *"Verified against: release `v2.13.0`"*; §6 *"13 idempotent SQL migrations"* vs 15 files; §8 *"390 tests across 31 files"* vs `find src -name '*.test.ts*' \| wc -l` = 43 |
| Suite must be run as lint **and** test | `AGENTS.md` §8 — *"vitest transpiles without typechecking"* |
| Never migrate via the Supabase CLI | `AGENTS.md` §4; `ROADMAP_V3.md` R-13 |

## Appendix B — Documentation to update when this program executes

| Document | Change | When |
| :--- | :--- | :--- |
| `plan/README.md` | ✅ Row added and its status updated to record the task 0/1 decisions; flip again as each release ships | ✅ done / each release |
| `plan/ROADMAP_V3.md` | ✅ **DONE** — §3.4 phase table + version-mapping table, §4 Phase 5 heading, §5, §7 studio-CMS backlog line, §8 decision #6, §9 Q13: Phase 5 → `v3.4.0`, plus the re-homed pagination promise | ✅ done — task 0 |
| `AGENTS.md` header | *"Verified against"* → the release this work starts from | ✅ **done — `v3.1.0`**, plus §8 now carries a release checklist so it stops going stale |
| `AGENTS.md` §5 | `plan_items` (+ `plan_releases` in 3.2); row counts | ✅ **done for 3.1.0** (11 tables / 16 migrations); `plan_releases` still due in 3.2.0 |
| `AGENTS.md` §6 | New files: `server/routes/plan.ts`, `server/lib/planRules.ts`, `scripts/lib/releaseLog.ts`, `scripts/generate-release-log.ts`, the two admin views; migration count 15 → 16 | ✅ **done** — also `server/lib/requestGuards.ts`, `src/lib/planVocabulary.ts`, `src/lib/antiSpam.ts`, `scripts/seed-plan-board.ts`, `src/data/releaseLog.generated.ts` |
| `AGENTS.md` §8 | The `minRole` ↔ guard table (two new rows); the suite count | ✅ **done** — the matrix is now a table, the count reads 813/47, and the public-write + generated-artifact guardrails were added |
| `docs/runbooks/database-backup-restore.md` | `plan_items` in the restore set and the table order | ✅ **done** — §6 gained the `plan_items` row, and §7's two ledger counts were corrected (9 → 15→16) |
| `CHANGELOG.md` | A section per release | ✅ **done for 3.1.0**; ⚠️ also closed the `v3.0.0` section, which still read `[Unreleased]` after the tag shipped |
| `DEPLOYMENT_LOG.md` | A row per release, from the Vercel/GitHub Deployments API | ⬜ **pending** — its own post-merge docs PR, task 19 |
| `plan/BACKLOG_STUDIO_CMS.md` | Mark §1.3 (inquiry spam) delivered, with the commit | ✅ **done** — §1.3 delivered in `v3.1.0`; §1.4 also corrected (tier confirmed Free) |
