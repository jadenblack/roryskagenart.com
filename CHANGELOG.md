# Changelog

All notable changes to the **Rory Skagen Art** studio archive and gallery project (`roryskagenart.com`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed

- **Email: inquiry delivery is now awaited and reported truthfully.** `POST /api/inquiries` used to
  fire both Resend sends *after* `res.json()` and always answer `emailDispatched: true`. On Vercel the
  instance can be frozen once the response is flushed, so mail could be lost while the collector was
  told it had been sent. Both sends are now awaited (`Promise.allSettled`) and the response carries
  `email: { studio, collector }` with the real outcome. An inquiry is still stored and still returns
  `201` when mail fails — a mailer outage must not cost a lead.
- **Email: no environment separation.** Added `EMAIL_MODE` (`live` / `redirect` / `off`) and
  `EMAIL_REDIRECT_TO`, implemented once in the new `server/lib/emailRouting.ts`. A preview deployment
  can no longer email a real collector: recipients are replaced, the subject is prefixed `[PREVIEW]`,
  and a banner names who was originally addressed. `redirect` without a destination **suppresses**
  rather than falling back to the real recipient.
- **Email: hardcoded recipients.** Studio notifications now resolve from `ADMIN_EMAIL` + `STUDIO_CC`
  (`resolveStudioRecipients`); behaviour is unchanged when neither is set.
- **Email: public config leak.** `GET /api/email/status` published the studio's `adminEmail`. It now
  returns only `configured` / `domain` / `mode` / `apiKeyPresent`.
- **Cron: no way to tell a scheduled run from a manual one.** `GET /api/cron/backup` now logs the
  `user-agent` (`vercel-cron/1.0`) and `x-vercel-cron-schedule` header — relevant because Hobby keeps
  runtime logs for one hour.

- **Email: delivery outcome is now part of the record.** New additive migration
  `2026_09_14_v2_13_1_inquiry_email_status.sql` adds `inquiries.email_status`
  (`unknown|sent|partial|failed|suppressed|bounced`), `email_error`, `email_sent_at` and the two
  Resend message ids. A lost lead is now visible in `#/admin → Inquiries` instead of living only in
  Vercel's 1-hour log window. `suppressed` is deliberately distinct from `failed`.
- **Cron: scheduled runs are idempotent.** Vercel can deliver the same scheduled run more than once;
  a scheduled invocation now skips when a dump already exists for the current UTC day. Manual calls
  are never skipped, and `?force=true` overrides.

### Added

- **`POST /api/email/webhook`** — Resend delivery events. Verifies the Svix HMAC (constant-time,
  5-minute replay window) against `RESEND_WEBHOOK_SECRET` and marks an inquiry `bounced` by message
  id. Implemented with `node:crypto` rather than adding an SDK, and mounted with `express.raw()`
  because the signature covers the raw body.
- **`scripts/verify-offsite-backup.ts`** — the project produced off-site backups it had no
  committed way to check. Newest / `--stamp <x>` / `--list` / `--max-age-hours <n>` / `--json`;
  exit 0 verified · 1 problems · 2 nothing to check. Requires a `manifest.json`, so a dump whose
  upload died halfway is reported rather than accepted as "the newest" (finding B5), and
  `--max-age-hours` turns "the nightly backup stopped running" into a non-zero exit instead of a
  silent gap — which matters because Hobby keeps runtime logs for one hour.
  Proven against the live store: 8 tables / 307 rows / 11 migrations / 406,593 B, `OK`, exit 0.
- `scripts/lib/offsiteBackup.ts` — pure dump-selection half, 11 new tests
  (`src/test/offsiteBackup.test.ts`).
- `server/lib/emailRouting.ts` — pure routing/recipient helpers, 16 new tests
  (`src/test/emailRouting.test.ts`); `src/test/offsiteBackup.test.ts` (11) and
  `src/test/emailReliability.test.ts` (13). Suite: **375 tests / 31 files** (was 335 / 28).
- [`docs/runbooks/email-delivery.md`](docs/runbooks/email-delivery.md) — two-mailer architecture,
  environment matrix, production go-live checklist, troubleshooting, and why Resend is the right
  long-term mailer.
- `EMAIL_MODE`, `EMAIL_REDIRECT_TO`, `STUDIO_CC` documented in `.env.example`.

---

## [2.13.0] - 2026-09-14

> **Backup durability.** No schema change, no migration, and no change to the public gallery.
>
> The Supabase project is on the **Free plan: no automatic backups and no PITR** (verified
> 2026-09-14). The repo's logical dump was therefore the *only* recovery path this project had — and
> it existed on one laptop. This release makes that dump **verifiable**, **scheduled**, **off-site**
> and **pruned**, and closes the separate hole where the 605 image files in Storage were never
> compared against the rows describing them.
>
> It is a prerequisite for the v3 Wayback load, and deliberately its own release rather than scope
> added to `v2.12.0`.

### Added
- **Scheduled off-site dump.** `vercel.json` schedules one cron job → `GET /api/cron/backup`
  (`server/routes/cronBackup.ts`) → **Vercel Blob** under `catalog-backups/<stamp>/`. The route is
  gated on `CRON_SECRET` and returns **503 when the secret is unset** — it fails closed rather than
  open. Objects are written `access: 'private'`: a dump contains `profiles` emails and collector
  inquiries. The response carries metadata only, never row data.
- **`server/lib/catalogDump.ts`** — one in-memory dump builder shared by the CLI script and the cron
  route, because two writers of one backup format is how a backup stops being restorable.
- **`scripts/verify-backup.ts`** — re-check any dump: newest / a path / `--all` / `--json`.
  Exit **0** clean, **1** problems (do not restore from it), **2** nothing to check.
- **`scripts/verify-media-backup.ts`** — reconciles `media_assets` against the `artwork-images`
  bucket in **both** directions, read-only. Storage objects are the one thing a database restore
  cannot bring back, and nothing checked them before.
- Retention (`server/lib/blobBackup.ts`): keep 14 recent dumps, one per month for history, and
  never delete anything under 7 days old — so a run of bad dumps cannot wipe good ones. The dump
  written by the current run is never deleted, whatever the policy says.
- `src/test/bundleSafety.test.ts` — fails if a `scripts/lib/` module that runtime code depends on
  ever starts importing `pg`, `fs` or `dotenv`, which would pull them into the serverless bundle.

### Changed
- **`scripts/backup-catalog.ts` now emits manifest format v2** — a sha256, row count and byte length
  per table — and **self-verifies by re-reading the directory before exiting**, so a truncated or
  corrupted dump fails at creation instead of at restore.

### Fixed
- A v1 manifest is identified by the **absence** of `formatVersion`, not by `=== 1`. Every real v1
  dump on disk reports `undefined`, so the legacy branch was dead code and old dumps were reported
  as an unknown version instead of as *unverifiable but still restorable*. Found by running the
  verifier against the four dumps already in `data/backups/`.
- `stampToIso()` — a dump stamp (`2026-09-14T17-27-10-591Z`) is **not** a parseable date, and
  `selectForRetention` silently skips any dump whose `createdAt` fails to parse when applying its
  minimum-age floor. Feeding raw stamps in would have quietly disabled the one rule that stops bad
  dumps from deleting good ones.

### Verified
- **Against production, 2026-09-14** — `verify-media-backup.ts`: 152 rows ↔ 605 objects
  (76.6 MiB), **0 missing, 0 unexpected orphans, 0 size mismatches**. Detection proven, not
  assumed: replaying the real 152 rows against a perturbed object list yields `missing: 1` when one
  object is removed and `unreferenced: 1` when one stranger is added.
- 📌 **Finding: 151 `original.*` masters are unreferenced by design.** The Cloudinary migration
  stored `thumb`/`hero`/`full`/`original` per asset, but `media_assets.renditions` records only the
  first three. Those 151 files are the highest-resolution copies in the catalogue, no row points at
  them, and nothing in the app would notice if one vanished. Reported, not treated as a failure.
- Hobby-plan limits checked against `vercel.com/docs` rather than assumed: Blob includes
  **1 GB/month + 2,000 advanced ops**, and exceeding either **cuts off Blob access for 30 days**
  instead of billing — for a backup sink, a worse failure than an overage. One run is ~0.5 MB and
  ~10 advanced ops (`del()` is free). Hobby cron jobs may only run **once per day**.

### Notes
- `@vercel/blob` added (0 vulnerabilities reported at install). `package.json` version stays
  `0.0.0`; versions live in this file and in git tags.

---

## [2.12.1] - 2026-09-14

> **Security patch — no application code change.** Four Row Level Security policies granted full
> table access to *any* authenticated user, so the lowest `viewer` role could read **and write** the
> catalog, the media registry and the site pages, and read every collector inquiry, straight through
> PostgREST — bypassing the role matrix in `src/lib/roles.ts` entirely.
>
> **One database migration**, a policy *narrowing* only. No table, column, index, trigger or data
> change, and no client, server or API code touched. Baseline: `v2.12.0` (`f5cf64c`).

### Security
- **Four policies granted full table access to any authenticated user.** `artworks`, `media_assets`,
  `pages` and `inquiries` each carried a `FOR ALL TO authenticated` policy whose predicate was
  literally `true` — `"Admins full access to artworks"`, `"Admins full access to media assets"`,
  `"Admins full access to pages"`, `"Admins can view and manage inquiries"`. The names said
  *admins*; the predicates said *anyone who can log in*. `TO authenticated` is the Postgres role
  every Supabase session assumes and it carries no role claim, so a **`viewer`** — the lowest role in
  `src/lib/roles.ts` — could read and write every artwork, media asset and page, and read every
  inquiry, straight through PostgREST, bypassing the entire role matrix:

  ```
  GET    /rest/v1/inquiries?select=name,email,phone,message   -- every collector's details
  PATCH  /rest/v1/artworks?slug=eq.<any>                      -- edit any work
  DELETE /rest/v1/artworks?slug=eq.<any>                      -- delete any work
  ```

  The `inquiries` case was the worst of the four: collector name, email, phone and message are
  personal data the role matrix deliberately restricts to editor and above.

  `v2.12.0` recorded this as a **finding** against `artworks` alone. Enumerating the live policies
  showed the defect was in **four** places, and all four came from the same
  `2026_09_01_baseline_core_tables.sql`. Fixing two of four would have looked complete while leaving
  half the exposure — so this covers all four.

  **The fix is a completion, not an invention.** `2026_09_13_cms_v2_2_profiles_rls_recursion_fix.sql`
  already created and granted `public.is_admin_or_editor()`, and its own header says these helper
  policies should be "rewrite[n] against the definer helper so they cannot recurse either" — but the
  rewrite was never performed. The function was created, granted, and referenced by nothing. Each
  policy now uses `USING (public.is_admin_or_editor()) WITH CHECK (public.is_admin_or_editor())`,
  which mirrors the server guard exactly: all four routes are `requireRole("editor")`
  (`server/routes/artworks.ts`, `media.ts`, `pages.ts`, `inquiries.ts`), so the two layers finally
  agree. The helper is `SECURITY DEFINER` with `SET search_path = public`, which also avoids the
  `42P17` infinite-recursion trap this repo already hit once.

  It was never exploited — not because of a control, but because the app does not use that path.
  Verified before writing: every read and write in `src/` goes through `/api/*` (the only direct
  supabase-js table access in the client is `profiles`, in `src/context/AuthContext.tsx`), and the
  API is RLS-exempt because `query()` in `src/server/db.ts` opens a `pg` pool on the **owner**
  connection — no table here is `FORCE ROW LEVEL SECURITY`. As with the `v2.12.0` draft fix, that is
  a load-bearing accident, not a control.

  **Verified against a real database rather than argued.** The schema was built from
  `supabase/migrations/` into the local scratch database, seeded with one artwork, one inquiry, one
  media asset, one page and admin/editor/viewer profiles, then every policy was evaluated as each
  role (`SET LOCAL ROLE authenticated` + `request.jwt.claims`). With the old `USING (true)`
  predicate restored, a `viewer` passed **8 of 8** write probes; with the new predicate it is denied
  on **8 of 8**, while `admin` and `editor` are unaffected. A `viewer` can still read *published*
  artworks and pages — that is the `public` SELECT policy doing its job, since published work is
  public by design. A viewer also cannot self-promote: `profiles` has no UPDATE policy at all, so
  role changes can only go through `/api/admin/users` on the owner connection.
- **New regression guard — `src/test/migrationSafety.test.ts`.** Two tests now walk the migrations in
  apply order, keep only the *effective* final definition of each policy, and fail if any policy
  leaves `TO authenticated` with a `USING (true)` or `WITH CHECK (true)` predicate. A later migration
  that legitimately replaces a blanket policy is not flagged, so the guard judges the end state
  rather than the history. `TO public USING (true)` is deliberately allowed — anonymous read of
  published content and the public inquiry form are intended. The guard was **proven to fail**: with
  the fix removed it names all four offenders and the baseline that introduced them. Suite: 12 → 14
  tests in this file.

### Validation
- **Proven against production, not argued.** A temporary `viewer` account was created, signed in for
  a real session token, used to hit PostgREST directly, then deleted — the same standard applied to
  the `v2.12.0` draft fix:

  | probe as a real `viewer` session | result |
  | :--- | :--- |
  | `SELECT` artworks (published) | **138 rows** — public read intact |
  | `SELECT` inquiries (`name,email,phone,message`) | **0 rows** |
  | `SELECT` profiles | 1 row (own only) |
  | `UPDATE` artwork | **0 rows** |
  | `DELETE` artwork | **0 rows** |
  | `DELETE` inquiries | **0 rows** |
  | `INSERT` artwork | **blocked, `42501`** |
  | `UPDATE` own role → `admin` | **0 rows** — cannot self-promote |

  Cleanup verified: the auth user and its cascaded `profiles` row are gone, no probe rows remain,
  and the catalog is still at 138 artworks.
- **Proven on the local scratch database first.** With the old `USING (true)` predicate restored, a
  `viewer` passed **8 of 8** write probes; with the new predicate it is denied on **8 of 8**, while
  `admin` and `editor` are unaffected. A `viewer` can still read *published* artworks and pages —
  that is the `public` SELECT policy doing its job, since published work is public by design.
- `npm run lint` (`tsc --noEmit`) clean. `npm test` — **239/239 passing across 22 files** (was 237;
  the two new guards are included).
- Live introspection confirms the end state in production: all four policies now read
  `is_admin_or_editor()`, and the ledger is at **11 of 11**.

### Findings recorded (not fixed in this release)
- `artwork_terms`, `settings` and `taxonomies` are *correctly* scoped already, but via inline
  `EXISTS (SELECT 1 FROM profiles ...)` subqueries rather than the definer helper. They work, but
  they carry a subtle coupling to `profiles_select_own` that the helper does not. Left alone to keep
  this change minimal.

---

## [2.12.0] - 2026-09-14

> **Recoverability release — and the completion of [ADR 0001](docs/adr/0001-schema-as-code-before-data-migration.md)
> Phase A.** `v2.10.0` made the schema *reproducible*; this release makes it *recoverable*. The schema
> was dropped and rebuilt from `supabase/migrations/` alone into a virgin database, then introspected
> and diffed against production — **no structural differences remain** — and the restore path is now
> scripted, deterministic and rehearsed end-to-end. It also closes the draft leak in the `artworks`
> public read policy that `v2.10.0` and `v2.11.0` each recorded as an open finding.
>
> **One database migration** (`2026_09_14_v2_12_artworks_public_select_excludes_drafts.sql`) — a
> policy *narrowing* only. No table, column, index, trigger or data change. Baseline: `v2.11.0`
> (`5122812`).

### Added — Scripted Restore & Connection-Target Safety
- **`scripts/restore-catalog.ts` (new):** restores a `data/backups/<timestamp>/` snapshot through
  `psql`-free, parameterised inserts. Two modes with deliberately different semantics —
  `--mode load` (default) **never overwrites**, so it can only fill gaps and is safe to re-run;
  `--mode repair` upserts on conflict. Dry-run by default; `--apply` is required to write. Remote
  targets are refused unless `--allow-remote` is passed explicitly, `--tables`/`--all` scope the run,
  and `--best-effort` reports failures instead of aborting. It was exercised against the local
  scratch database before it was ever pointed at production (see **Validation**).
- **`scripts/lib/restorePlan.ts` (new):** the pure, offline-testable half of the restore path — the
  table list with each table's conflict target (primary key), the dependency-ordered
  `RESTORE_ORDER` (so foreign keys land in the right sequence), `CATALOG_TABLES` vs
  `ENVIRONMENT_TABLES`, the bindable-value coercion, statement construction, and failure
  summarisation. Kept free of `pg` and of the filesystem so it runs in the vitest suite with no
  network and no database.
- **`scripts/lib/pgTarget.ts` (new):** one shared rule for "is this connection string loopback or
  remote?", used by every script that opens a pool. Loopback (`localhost`, `127.0.0.1`, `::1`,
  `host.docker.internal`) connects with **no TLS** — which is what the local Postgres on `:54322`
  requires — while a remote target gets `{ rejectUnauthorized: false }`. Two parsing traps are
  handled explicitly and documented in the file: `new URL()` returns the IPv6 host **with** its
  brackets, so a bare `'::1'` comparison is dead code; and `postgresql:` is not a WHATWG "special
  scheme", so the host is not guaranteed to be lowercased.
- **Local Supabase dev stack (`supabase/config.toml`, `supabase/.gitignore`):** `supabase start` now
  brings up a throwaway Postgres on `127.0.0.1:54322` with REST/Studio beside it, so migrations and
  restores can be rehearsed against a real database instead of the live one. **CLI-managed migrations
  and seeding are disabled** (`[db.migrations] enabled = false`, `[db.seed] enabled = false`) — see
  the runbook for why this is not optional.
- **`.gitattributes` (new):** `*.sql text eol=lf`. See **Fixed** for the defect this prevents.

### Security
- **The `artworks` public SELECT policy no longer exposes drafts**
  (`supabase/migrations/2026_09_14_v2_12_artworks_public_select_excludes_drafts.sql`). The baseline
  policy was `USING (trashed = false)`, which filtered trashed rows but not drafts, so any holder of
  the anon key could read unpublished rows straight from PostgREST
  (`GET /rest/v1/artworks?select=slug,title,narrative&draft=eq.true`). It was never exploited only
  because the client reads through `GET /api/artworks`, which filters drafts server-side — a
  load-bearing accident, not a control. The predicate is now `trashed = false AND draft = false`.
  The server-side filter is **still required** and must not be removed: the API runs on the server's
  own connection, where RLS does not apply.
  **Verified against production rather than assumed.** The catalog currently holds zero drafts, which
  would make a naive "anon sees 0 drafts" check vacuous — it would have passed before the migration
  too. So a throwaway `draft = true` row was inserted, and with it present: the service role saw
  1 draft, `anon` saw **0** by both the `draft=eq.true` filter *and* a direct `slug=` fetch (the row
  has `trashed = false`, so the old predicate would have returned it), and `anon` still received all
  **138** published rows, proving public reads remain granted. The row was then deleted and the
  catalog confirmed back at 138 rows with 0 drafts.
- **RLS enabled on the migration ledger the runner creates.** `scripts/run-migrations.ts` created
  `public.schema_migrations` without row-level security, so on a rebuilt database the ledger was
  readable with the anon key. Production happened to have RLS enabled on that table already, which is
  exactly why no migration recorded it and why the static test set could never have caught it — the
  gap only appears on a *rebuild*. The runner now enables RLS immediately after the
  `CREATE TABLE IF NOT EXISTS`, making a from-scratch database match production.

### Fixed
- **Every database script hard-coded `ssl: { rejectUnauthorized: false }`.** Against the local
  scratch database this failed with *"The server does not support SSL connections"*. All five
  scripts (`run-migrations`, `backup-catalog`, `restore-catalog`, `introspect-schema`,
  `generate-asset-registry`) now resolve TLS from the connection target via `scripts/lib/pgTarget.ts`.
- **Latent dead code in the loopback check.** The IPv6 branch could never match, because Node's URL
  parser returns `'[::1]'` rather than `'::1'`. Brackets are now stripped and the comparison is
  case-insensitive; both are locked down by tests.
- **`artworks` drafts could be reached by anon key** — see **Security**.
- **Backups were not deterministic.** `scripts/backup-catalog.ts` selected rows with no `ORDER BY`,
  so two consecutive dumps of an unchanged database were not byte-identical and could not be diffed.
  It now orders by each table's primary key, sourced from the single table spec in
  `scripts/lib/restorePlan.ts` (which also replaced a second, drifting copy of the table list), and
  it throws if a table has no recorded primary key rather than silently dumping unordered.
- **CRLF in migration files made "reproducible from version control" checkout-dependent.** Two of the
  ten migrations (`2026_09_12_cms_v1_profiles_roles.sql`, `2026_09_12_cms_v1_taxonomies_settings.sql`)
  carried CRLF in the working tree under the machine's global `core.autocrlf = true`. Because
  Postgres stores function bodies verbatim as returned by `pg_get_functiondef`, the CR bytes were
  written into the *stored* function source, so the same commit produced a different database on
  Windows and on Linux — and a rebuild diff showed 17 carriage returns where production had none.
  Their **committed** form was already LF, so no content rewrite was needed: `.gitattributes` pins
  `*.sql` to `eol=lf`, the two files were re-checked out, and a rebuild now reports **0 CR bytes
  across all 7 stored functions**.
- **The autosave batching test was load-dependent.** It drove four rapid keystrokes with
  `userEvent.type()`, which inserts real inter-key delays, so under parallel-suite load the debounce
  window closed mid-word and the test asserted an intermediate title. Rewritten with synchronous
  `fireEvent.change` plus an explicit `toHaveBeenCalledTimes(1)` assertion, so it now verifies the
  property it was written for — four keystrokes produce exactly one save — rather than a timing race.
- **`testTimeout` raised to 15s** (`vitest.config.ts`). A full-suite run under load was observed
  taking ~25× its nominal duration in the environment phase, which pushed one real-timer
  `UsersAdminView` test past the 5s default. The raise is bounded and documented rather than
  open-ended, and is not a substitute for fixing genuinely slow tests.

### Docs
- **New runbook material — [`docs/runbooks/database-backup-restore.md`](docs/runbooks/database-backup-restore.md):**
  the plan tier is now recorded as **Free** (no platform backups, no PITR, projects pause after 7
  days of inactivity) with the consequences spelled out; §4a is marked **exercised**, including the
  rehearsal results and the `load` vs `repair` distinction; §6's known-gaps table was rebuilt from
  real statuses; **§7** documents the *two-ledger* problem; **§7a** records the empirical
  `supabase start` failure and its resolution; **§7b** is the scratch-database procedure.
- **`AGENTS.md`:** §4 documents that the runner creates and locks down `public.schema_migrations`,
  and adds the local scratch-database subsection (with the `config.toml` warning and the note that
  Docker Desktop installs per-user, so its `bin` is not on `PATH`); §5 records the Phase A
  verification, the gap it found, and the line-ending policy.
- **`plan/ROADMAP_V3.md` (new):** the `v3.0.0` program plan — six phases with exit criteria,
  dependencies and target release; a *justified* SemVer mapping; a risk register extending
  `PRD_V3` §6; a "do not do yet" list honouring ADR 0001 §5; and open questions separated from
  decisions. Indexed in `plan/README.md`.
- **`plan/BACKLOG_STUDIO_CMS.md` (new):** prioritised studio-CMS backlog written for a
  non-technical operator — manual catalog/hero ordering, undo & revision history, inquiry spam
  protection, per-artwork SEO, alt text, bulk actions, export, and inquiry follow-up. Every item was
  verified against the code and the live schema; nothing is scheduled. Indexed in `plan/README.md`
  as **Proposed**.
- **`DEPLOYMENT_LOG.md` reconciled.** It had drifted to its last row being `v2.8.0` (2026-09-12),
  omitting **seven production deployments** across `v2.9.0`, `v2.10.0` and `v2.11.0`, plus the PR
  preview deployments the release gate now depends on. Rows were reconstructed from the Vercel API
  (not invented), the stale `(Current Active)` marker moved to `v2.11.0`, the architecture milestones
  extended through Phases VI–VII, and a "Maintaining this log" section added with the query that
  rebuilds the table.
- **`AGENTS.md` §8 gains a Releases section** — the PR gate and its three checks (Vercel preview,
  Socket Security, Debricked), the "tag the merge commit on `main`" convention, the note that
  `v2.9.0` deviates, the rule not to prune a release branch unless asked, and the
  `DEPLOYMENT_LOG.md` obligation.

### Dependencies
- **Both moderate `qs` advisories resolved.** `express` moves `4.22.2 → 4.22.3`, which raises its
  `qs` range to `~6.16.0` (resolved `6.15.1 → 6.16.0`; `body-parser` dedupes to the same copy) and
  `path-to-regexp` to `~0.1.13`. Transitive only — no direct dependency and no `package.json` change.
  This clears the two Dependabot alerts that had been open since `v2.10.0`.

### Validation
- `npm run lint` (`tsc --noEmit`) clean. `npm test` — **237/237 passing across 22 files**, offline
  and zero-token, green on two consecutive full runs. Two new suites (+38 tests): `restorePlan` (27)
  and `pgTarget` (11). **Suite: 199 → 237 tests, 20 → 22 files.**
- **Phase A verified by destruction and rebuild.** Every `public` table was dropped and the schema
  recreated from `supabase/migrations/` alone — **10 of 10 migrations applied to a virgin database**.
  Introspection then showed no structural differences against production: 9 tables with all columns,
  types, defaults and constraints; 11 indexes; 20 policies; both `artworks` guard triggers; 7
  functions; 9 RLS flags. The only residual diffs were the four expected ones (ledger rows, and
  identifiers that differ by construction). This is what promoted Phase A from "believed" to
  "verified" and what unblocks `v3.0.0`.
- **The restore path was rehearsed end-to-end**, not merely unit-tested: plan mode wrote nothing;
  `--apply` inserted **294 rows, skipped 4, failed 0**; an immediate re-run inserted **0, skipped
  298, failed 0**, confirming idempotence; and a re-dump compared **5 of 6 tables byte-identical**,
  with `pages` differing only in `updated_at`. The 4 skips were all `pages` rows seeded by a
  migration — `load` correctly refuses to overwrite them, and `repair` is the mode that would.
- The two new suites run with no database and no network, which is what makes the write path
  testable at all; `server/` and `scripts/` still have almost no coverage, and the migration/write
  path remains the highest-consequence untested code in the repo.

### Findings recorded (not fixed in this release)
- **The sibling policy `"Admins full access to artworks"` is declared `FOR ALL TO authenticated
  USING (true) WITH CHECK (true)`.** The name says *admins*; the predicate says *any authenticated
  user*, so a `viewer` can read and write every artwork through PostgREST, bypassing the role matrix
  in `src/lib/roles.ts`. Scoping it to the real role claim is a larger change with a real blast
  radius and is deliberately not bundled here (ROADMAP_V3 §9 Q8 / risk R-06).
- **Storage objects are outside the backup scope.** `scripts/backup-catalog.ts` captures table rows
  only; the `artwork-images` bucket is not covered, and Supabase's own backups exclude Storage
  objects on every tier. Off-site durability for the image binaries is a separate, unscheduled work
  item.
- **The database password has not been rotated** — deliberately deferred by the owner to the `v3.0.0`
  cycle.
- Still open from `v2.10.0`: **no `LICENSE` file** (the README claims Apache-2.0 and now flags the
  gap), `artwork_terms` is empty, and there is no Supabase MCP server configured in this repo.

---

## [2.11.0] - 2026-09-14

> **Studio-operations release.** The Users screen becomes a real staff-management console (edit,
> invite, re-invite, reset), every studio email becomes branded, the public artwork dossier stops
> duplicating itself and the Scale & Proportions drawing becomes a true-to-scale elevation. Baseline:
> `v2.10.0` (`962587e`).
>
> **No database migration and no schema change.** The one API-shape change is additive; the only
> behavioural changes are the role gates, which *narrow* what a non-admin sees.

### Added — Studio User Administration
- **User editing (`PATCH /api/admin/users/:id`):** an administrator can now change a staff member's
  display name, email address, role and active state. Validated by `buildUserPatch()`
  (`server/lib/userAdmin.ts`); best-effort notification emails fire on role/access/email change.
- **Invite + re-invite:** `POST /api/admin/users/invite` mints an invitation; `POST /:id/reinvite`
  re-sends to a still-pending user (returns `409` if the address is already confirmed). For a user
  who has never signed in, the stale `auth.users` row is replaced first so re-invites are
  deterministic rather than stacking duplicate accounts.
- **Admin-issued password reset (`POST /:id/reset-password`):** mints a Supabase recovery link and
  delivers it through the studio's own branded mailer, returning the URL so an administrator can also
  hand it over manually.
- **Users screen rebuilt (`src/components/admin/UsersAdminView.tsx`):** search, pending-invite count,
  a "What each role can do" legend, an edit dialog, a delivery-result dialog with a copy-link field,
  resend-invite / send-password-reset row actions, empty state and success flash.
- **Branded email layer (`server/emailTemplates.ts`):** one table-based, inline-styled shell — brand
  mark, wordmark, gold rule, footer — shared by every studio message. Renders invite, password reset,
  access-changed, email-changed and test emails. `BRAND`, `resolveSiteUrl()` and
  `resolveBrandLogoUrl()` centralise the identity so nothing is hard-coded per template.
- **Supabase Auth mailer templates (`supabase/email-templates/`, `scripts/generate-auth-email-templates.ts`):**
  the six dashboard-only Supabase auth emails (invite, confirm sign-up, magic link, change email,
  reset password, reauthentication) generated from the same brand shell, plus a `manifest.json`
  mapping each file to its dashboard slot and subject. Run
  `npx tsx scripts/generate-auth-email-templates.ts` to regenerate.
- **Password-setup screen (`src/components/admin/PasswordSetupView.tsx`, `#/admin/set-password`):**
  the landing screen for invite and recovery sessions — new password + confirmation, reveal toggle,
  minimum length, and an explicit "this link has expired or already been used" state. Replaces the
  previously dead `#/admin/reset` route.
- **Shared role vocabulary (`src/lib/roles.ts`):** `CmsRole`, `CMS_ROLES`, `ROLE_ORDER`,
  `ROLE_LABELS`, `ROLE_DESCRIPTIONS`, `roleAtLeast()`, `normalizeRole()`, `roleLabel()`. Dependency-
  free so the browser bundle and the server share one definition instead of drifting.

### Changed — Catalog Administration
- **"Edit in Studio" now opens that entry's editor.** It previously dropped the curator on the full
  catalog list. `buildEditPath(slug)` produces `/admin/catalog?edit=<slug>`; `parseAdminPath()` reads
  it back and `AdminApp` deep-links straight into the artwork dialog for that slug
  (`src/lib/adminRoute.ts`).
- **The entry description is promoted into the info card.** The stored `narrative` is the full
  Obsidian source document — index link, H1, image embed, blockquote spec, then prose — and rendering
  it verbatim repeated the title and the hero image that are already on screen.
  `parseArtworkNarrative()` (`src/lib/narrative.ts`) now splits it into `description`, `metaLines`,
  `notes` and the untouched `markdown`; the description appears near the top and the original document
  moves behind a collapsed **Catalog Record** panel.
- **Duplicate media removed from the dossier.** The `.md` caption and the redundant Drive-record tab
  are gone; the physical size is shown instead, sourced from `formatDimensions()`.
- **Scale & Proportions rewritten as a true-to-scale elevation (`src/components/ScaleVisualizer.tsx`).**
  The old drawing was decorative and not proportional. The SVG is now drawn at **1 unit = 1 inch**
  (`viewBox="0 0 ${wallW} ${wallH}"`) with a 10 ft reference wall, a museum-standard 57″ centre line,
  a 5′ 10″ human figure and a 6 ft bench, plus dimension lines. Artwork rectangles carry
  `data-artwork-frame` / `data-width-in` / `data-height-in` so the proportions are assertable in
  tests. When no dimensions are recorded it says so instead of drawing a guess; a staff-only
  `showDataWarning` flag flags an aspect ratio that disagrees with the photograph by more than 15%.
- **Role-gated studio UI.** `ADMIN_NAV` items carry a `minRole` (`Inquiries`, `Media`, `Taxonomies`,
  `Design`, `Trash` → editor; `Users`, `Settings` → admin) and are filtered by `roleAtLeast()`. The
  matching routes render a `Forbidden` panel naming the required role, and every artwork mutation in
  `App.tsx` is gated behind `canManageCatalog` (admin or editor). Previously a Viewer was offered menu
  items that answered `403`.

### Fixed
- **Silent session drop on invite and reset links.** The app is a hash-router SPA and `supabase-js`
  reads the session out of the URL *fragment* and then blanks `window.location.hash` during its own
  async init — so by the time React mounted, the `type` that says "set a password first" was gone.
  Two changes fix it: the auth hand-off `type` is captured at module load in
  `src/lib/authRedirect.ts` (imported **first** in `src/main.tsx`, before the client is constructed),
  and `redirectTo` is now a **bare origin** with no `#` (`bareOrigin()` / `buildAuthRedirect()`).
- **Studio lockout is now impossible from the UI.** `decideMutation()` refuses self-role-change,
  self-deactivate and self-delete, and protects the last remaining active administrator from being
  demoted, deactivated or deleted by anyone. The Users screen mirrors the same guards by disabling the
  controls, and surfaces the server's `409` reason when a mutation is refused.
- **`UsersAdminView` imported role copy from a server module**, which risked pulling server code into
  the client bundle. Both sides now read `src/lib/roles.ts`.

### Docs
- **New runbook — [`docs/runbooks/supabase-email-branding.md`](docs/runbooks/supabase-email-branding.md):**
  documents the **two-mailer architecture** (studio-owned Resend vs dashboard-only Supabase Auth),
  the Resend env vars, paste-in steps for the six templates, SMTP sender setup, the redirect
  allow-list warning about `#`, known limitations and a verification checklist.
- **`AGENTS.md`:** §2 records the two-mailer model and the branded-template pipeline; §6 adds
  `server/lib/`, `supabase/email-templates/` and the new `src/lib/` modules; §8 adds the role matrix
  and the bare-origin redirect rule.

### Validation
- `npm run lint` (`tsc --noEmit`) clean. `npm test` — **199/199 passing across 20 files**, offline and
  zero-token. Nine new suites (+112 tests): `userAdmin` (29), `narrative` (13), `dimensions` (13),
  `emailTemplates` (13), `authRedirect` (10), `adminRoute` (9), `ArtworkFocusView` (9),
  `UsersAdminView` (8), `ScaleVisualizer` (8). **Suite: 87 → 199 tests.**
- The proportional-integrity tests read the artwork frame's `data-width-in`, so true scale is asserted
  numerically — `12"` renders width 12, `96"` renders width 96, and `3.5ft` resolves to 42.

### Findings recorded (not fixed in this release)
- **The `artworks` public SELECT policy still does not exclude drafts** (`USING (trashed = false)`).
  Unchanged from `v2.10.0` and still not exploitable, because the client reads through `/api/artworks`,
  which filters drafts server-side. Tightening the policy remains a tracked follow-up.

---

## [2.10.0] - 2026-09-14

> **Phase A of [ADR 0001](docs/adr/0001-schema-as-code-before-data-migration.md)** — the blocking
> prerequisite set for the v3 data migration. The database becomes reproducible from version
> control, a rollback path exists, and the migration runner's highest-consequence decisions gain
> test coverage. Baseline: `v2.9.0` (`de294d0`).
>
> **No runtime, API, or UI changes.** The one schema-touching artifact is written to be a verified
> no-op against the live database.

### Added — Reproducible Schema
- **Baseline schema migration (`supabase/migrations/2026_09_01_baseline_core_tables.sql`):** the four
  core domain tables — `artworks`, `media_assets`, `pages`, `inquiries` — were created directly in
  the Supabase project and were **never `CREATE`d anywhere in the repo**; every other migration only
  `ALTER`ed them. This baseline captures them with all indexes, `ENABLE ROW LEVEL SECURITY`, and every
  RLS policy. It is dated `2026_09_01` so the runner's lexicographic ordering applies it **before**
  the `2026_09_12+` migrations that depend on it, and is `IF NOT EXISTS` /
  `DROP POLICY IF EXISTS` throughout so it is a no-op against the existing database. Without it,
  `run-migrations.ts` failed on a fresh project at the first `ALTER TABLE public.artworks`.
- **Live schema introspection (`scripts/introspect-schema.ts`):** read-only dump of the `public`
  schema — tables, columns, constraints, indexes, triggers, functions, RLS status, policies, row
  counts, and the applied-migration ledger — written to `data/archive/schema_introspection.md`. The
  baseline migration above is derived from this output rather than from the stale superseded draft.
- **Catalog backup (`scripts/backup-catalog.ts`):** strictly read-only (`SELECT`-only) per-table JSON
  snapshot of all 8 `public` tables plus a self-describing `manifest.json` (row counts, byte sizes,
  target, Postgres version, recorded migrations). Output lands in the gitignored `data/backups/`.
- **Backup & restore runbook (`docs/runbooks/database-backup-restore.md`):** the rollback path ADR
  0001 found missing — Supabase platform backup tiers and retention, the PITR add-on, both restore
  procedures, a pre-migration checklist, and an explicit list of known gaps.
- **Write-path test coverage (`src/test/migrationPlan.test.ts`, `src/test/migrationSafety.test.ts`):**
  23 new tests. `migrationPlan` locks down the runner's ordering and skip-if-tracked decisions;
  `migrationSafety` asserts the idempotency and reproducibility invariants across every migration
  file — including the invariant that would have caught this release's core bug: *RLS may only be
  enabled on tables that some migration actually creates.* **Suite: 64 → 87 tests.**

### Changed
- **Migration runner refactor (`scripts/run-migrations.ts`):** the pure ordering/skip logic moved to
  `scripts/lib/migrationPlan.ts` so it is unit-testable offline — the runner previously had zero
  coverage because it opens a `pg` Pool at import. It now reads the `schema_migrations` ledger once
  instead of per file. **Behaviour is unchanged**, including all console output.

### Fixed — Documentation Accuracy
- **ADR 0001 contained two unverified claims**, caught by re-reading the code against the live
  introspection and corrected: the superseded draft's `CREATE TABLE` was said to use a column name
  the code no longer uses (`series`), but `gallery_series` is in fact correct in both the live
  database and `src/`; and `sort_order` was attributed to `artworks` when it belongs to `taxonomies`.
  The stale doc's real defect is narrower and now stated precisely: it is missing exactly one column
  (`draft`), every index, and all RLS objects.

### Docs
- **`AGENTS.md`:** §5 now records that the schema *is* reproducible (replacing the warning that it was
  not), documents the new **ledger drift** finding, and corrects row counts to verified live values
  (`profiles` 2 → 3; `inquiries`/`settings`/`taxonomies` added; `artwork_terms` is **empty**). §4
  documents the introspection and backup commands; §6 adds `docs/runbooks/`, `scripts/lib/`, and
  `src/test/`; §8 adds the baseline-ordering and back-up-before-you-write rules.
- **`plan/PRD_V3_WAYBACK_DATA_MIGRATION.md`:** all three §0 blocking prerequisites ticked with
  evidence; status advanced to *prerequisites satisfied, ready for read-only Steps 0–4*.
- **`.gitignore`:** `data/backups/` ignored — logical dumps contain production data and studio
  member email addresses, and must never be committed.

### Findings recorded (not fixed in this release)
- **The `artworks` public SELECT policy does not exclude drafts.** `USING (trashed = false)` would
  expose draft rows to any holder of the anon key. It is not currently exploitable because the client
  reads through the server API (`/api/artworks`), which filters drafts — but the policy is one
  direct-PostgREST query away from leaking unpublished work. Deferred to the Phase A follow-up rather
  than changed silently here.
- **Storage objects are not covered by database backups** (Supabase backs up metadata only), and the
  project's plan tier — which determines whether automatic backups exist at all — is unverified.
  Tracked in the runbook's known-gaps table.

### Validation
- `npm run lint` (`tsc --noEmit`) clean. `npm test` — **87/87 passing across 11 files**, offline.
- **Baseline migration proven to be a production no-op.** A read-only catalog backup was taken first
  (`scripts/backup-catalog.ts` — 8 tables, 306 rows), the migration was applied to the live database,
  and the schema was re-introspected and diffed against the pre-change report. The **only** deltas
  were the migration's own ledger row and the report's generation timestamp — no column, index,
  trigger, function, RLS, or policy difference.
- **Ledger drift reconciled.** Re-running the runner then applied the two previously out-of-band
  migrations and recorded them, so `public.schema_migrations` now holds **9 of 9** files. The same
  introspection diff confirmed those re-applications changed nothing but the ledger — the drift was
  bookkeeping, not schema.

---

## [2.9.0] - 2026-09-13

> **Delivered by commits:** `406def2` (Cloudinary residue cleanup, Supabase RLS hardening, server
> modularization) · `a43fe40` (artwork drafts, autosave, shadcn/ui primitives, test suite) ·
> `8e14fda` (full-bleed home hero, profiles RLS 500 fix) · docs reconciliation (this release).
> Baseline: `v2.8.0` (`411138a`).

### Added — Home Hero Rework & Profiles RLS Fix
- **Full-Bleed Hero Backdrop Slider:** The home masthead now overlays a single full-bleed artwork slider — the active piece cover-crops the entire canvas (no letterboxing for any aspect ratio), blurred and brightness-tuned per theme with a slow settle animation. The artwork meta card is gone; the only chrome is hover ghost-arrows, an interior active-slide name pill beside progress dots (bottom-right), and pause/play. `PageHeader` remains the standard header for all other public pages (the transient `bleed`/`inset` experiment was reverted).
- **Uniform Section Rhythm:** Sections below the hero live in one inset content frame whose `space-y` owns the vertical spacing — measured 64px between every section, fixing the padding gaps introduced by earlier full-width edits.
- **Profiles RLS Recursion Fix (migration `2026_09_13_cms_v2_2_profiles_rls_recursion_fix.sql`):** `profiles_select_admin` subqueried `public.profiles` inside a policy on `profiles`, so every client profile lookup aborted with Postgres 42P17 ("infinite recursion detected in policy") and PostgREST returned HTTP 500 on session refresh. The admin/editor checks moved into `SECURITY DEFINER` helper functions (`is_admin()`, `is_admin_or_editor()`); profile queries now return 200.
### Added — Draft Workflow, Auto-Save & Sticky Modals (PRD Phase 3+, per `docs/PRD.md`)
- **Artwork Drafts:** New `draft` column (migration `2026_09_13_cms_v2_1_artwork_drafts.sql`) with partial indexes and a DB trigger enforcing that a draft can never be publicly enabled. Save-as-draft / Publish in the artwork editor, Draft badge, Drafts filter tab with count, Publish/Unpublish row-menu actions, and a dashboard Drafts stat.
- **Draft Privacy End to End:** Anonymous API reads never receive draft rows (list filter + per-slug 404); the state engine gates drafts at its single `rowToRecord` choke point (`enabled=false`), so hero, gallery, catalog counts, and slug lookups all exclude them with no per-view special cases.
- **Draft Auto-Save:** Persisted drafts save automatically ~1.2 s after typing pauses (snapshot-diffed, keystrokes batched); live status indicator (Unsaved… / Saving… / ✓ Saved / Save failed); closing the dialog flushes unsaved draft edits; create mode requires an explicit first Save-as-draft; published works are never silently auto-saved.
- **Sticky Modal Headers:** `DialogHeader` is now sticky inside the scrolling `DialogContent` across all modals — titles and the close X stay pinned while long forms scroll.
- **Actions at the Top of CRUD Modals:** Action buttons relocated from the bottom footer into the sticky header row of every admin modal — artwork editor (Cancel / Save draft / Publish·Save changes, with the autosave indicator), trash & permanent-delete confirms, user delete-confirm and invite, taxonomy delete-confirm and create, and both page dialogs. Primary buttons submit via `requestSubmit()` so keyboard and pointer share one path.
- **Zero-Token Tests for Drafts & Autosave:** 11 new contracts covering the draft lifecycle (hidden publicly, badge, publish/unpublish fire once), autosave debouncing/batching/gating, close-flush, and sticky-header rendering. Suite total as of this release: **64 tests across 9 files** (`npm test`, offline).
### Fixed
- **Unsaved-Changes Protection:** Closing a dirty non-draft edit (X, Cancel, Esc, overlay) now asks "Discard unsaved changes?" instead of silently dropping edits; drafts flush automatically; `beforeunload` covers browser/tab closes; in-app navigation reporting via `onDirtyChange`.
- **Form-Reset Race:** The artwork editor's form previously reset whenever the engine refreshed (new record object identity), wiping in-progress edits; reset is now keyed on dialog-open/slug change only.
- **Duplicate Drafts on Create:** Creating a draft then continuing to type POSTed again on save; the dialog now switches to PATCH the created record (server returns the slug; engine refresh precedes the switch).
- **Catalog Row-Click View:** Clicking anywhere on a data row opens the artwork dossier; `navigateTo` gained the missing `/artwork/<slug>` branch (previously both row-click and the View menu item were silent no-ops); row-interior switches/menus no longer double-fire.
- **Modal (X) Close Button:** Now wired to `onOpenChange` via Radix context — previously dispatched a `dialog-close-request` CustomEvent that nothing in the codebase handled, so the button was guaranteed dead.
- **Modal Scroll on Short Viewports:** Dialog content owns `max-h` + `overflow-y-auto` (upstream pattern), ending the flex-centering top-clipping geometry; per-call-site `max-h-[85vh]` patches removed from `ArtworkEditDialog` and `PagesAdminView`.
- **Row Action (Dot) Menus:** Radix portal rendering with collision detection ends menu clipping inside the table's overflow container (the real mechanism behind "menu choices don't work"); items now carry `menu`/`menuitem` roles, arrow-key navigation, typeahead, and Esc/outside dismiss with focus restore.
- **Unconfirmed Trash:** "Move to trash" now routes through a confirmation dialog (matching permanent delete) instead of deleting immediately.
- **Native Browser Dialogs:** `window.confirm`/`alert` in Users and Taxonomies admin views replaced with standard themed confirm Dialogs; no native dialogs remain in `src/`.
- **InquiryModal Stale State:** Reopening after a submit showed the "Message Sent" screen instead of the form; transient state now resets on open.
### Changed
- **shadcn/ui Registry Adoption:** `ui/dialog`, `ui/dropdown-menu`, `ui/switch`, and `ui/label` regenerated from the official Tailwind v4 registry source on Radix — replacing the hand-rolled imitations; public API of call sites kept (additive `variant`/`onSelect` migration).
- **Bespoke Overlays Retired:** `ArtworkQuickViewModal` and `InquiryModal` migrated onto the shared `ui/Dialog` (portal, focus trap, scroll lock, working close); designs preserved and hardcoded hex colors tokenized.
- **Dropdown API Canonicalized:** Call sites (`CatalogView`, `UsersAdminView`) migrated from the custom `trigger` prop to `DropdownMenuTrigger asChild` + `DropdownMenuContent`, with `onSelect` handlers and per-row `aria-label`s.

### Docs — Documentation & Context Reconciliation
- **`AGENTS.md` (new):** single verified project-context document — authoritative stack, env var
  names, DB write path, post-migration schema, and guardrails — so future contributors and agents
  stop re-deriving state from contradictory specs.
- **`plan/README.md` (new):** status index for every specification (Implemented / Superseded / Planned).
- **Spec status corrections:** `plan/PRD_V2.9_CLEANUP_AND_OPTIMIZATION.md` marked **Implemented** with
  a per-subsystem delivery map; `plan/PRD_V2.1_CLOUDINARY_EXIT.md` marked **Implemented** with a
  delivery record; `plan/DRAFT_FEATURE_PULL_REQUEST.md` marked **Superseded** (Cloudinary-era
  assumptions).
- **`plan/PRD_V3_WAYBACK_DATA_MIGRATION.md` (new):** the v3 plan for merging both archived
  predecessor sites into the Supabase catalog + media library.
- **`README.md` reconciliation:** removed the obsolete Cloudinary badge, endpoint row, and env vars
  (including the legacy `CLOUDINARY_URL` line); corrected React 18→19 and Tailwind 3→4 badges; env
  block now matches `.env.example` (`VRCL_SUPA_*`); migration list completed to 8/8; directory tree
  refreshed; `/plan` links repaired; corrected the serverless entrypoint name to `api/index.js` and
  re-scoped the payload-limit note off the retired vendor.
- **Housekeeping:** quarantined the unimported `src/data/portfolioPostsData.updated.json` to
  `data/archive/` (provenance only; no importers — verified by repo-wide search).
- **Validation:** `npm run lint` (`tsc --noEmit`) clean; `npm test` — **64/64 passing across 9 files**;
  all internal documentation links verified to resolve (two pre-existing README links repaired:
  `/plan/FEATURE_PULL_REQUEST.md` → `plan/DRAFT_FEATURE_PULL_REQUEST.md`, and a `LICENSE` link with
  no target file). Documentation-only release: no runtime, schema, or API changes.

### Chore — Repository Hygiene & Decision Records
- **Package renamed off the scaffold name:** `"react-example"` → `"roryskagenart"` in `package.json`
  and `package-lock.json` (both the root and `packages[""]` entries, so `npm ci` stays valid).
  `.workbuddy-ai/` added to `.gitignore` so local agent workspace data stays out of `git status`.
- **ADR convention introduced (`docs/adr/`):** numbered Architecture Decision Records, immutable once
  accepted. **ADR 0001** records the sequencing decision for the v3 data migration, plus the finding
  that `artworks`, `media_assets`, `pages`, and `inquiries` have **no `CREATE TABLE` anywhere in the
  repo** — the database is therefore not reproducible from version control and `run-migrations.ts`
  would fail against a fresh project. It also corrects the v3 PRD's claim that no `multer` dependency
  exists.

### Completed (previously listed under "Planned & Staged")
- **Cloudinary deletion pass — done** (`406def2`): `cloudinaryMap.ts` deleted, the `/api/cloudinary/*`
  routes and the Cloudinary upload proxy removed, the `cloudinary` npm dependency uninstalled, and the
  image resolution chain is now Supabase-only (`external URL → asset registry → SVG fallback`). Root
  mapping JSONs relocated to `data/archive/`. (`multer` is retained — it powers the Supabase Storage
  upload route, not Cloudinary; see `AGENTS.md`.)
- **Database & security hardening — done** (`2026_09_13_v2_9_security_rls_hardening.sql`): RLS enabled
  on `taxonomies`, `artwork_terms`, and `settings` with public-read and admin/editor-write policies.

---

## [2.8.0] - 2026-09-12
### Added
- **Design System & Theme Palette:** Comprehensive CSS theme token system with rich light/dark mode styling for the fine art editorial gallery.
- **Dynamic PageHeader Component:** Unified header component across public views with subtitle metadata, stats counters, and breadcrumb indicators.
- **Design Administration View:** Studio dashboard controls for live theme preview and layout preferences.
### Deployment
- **Vercel Production:** [`roryskagen-5ugjqo1bo-ventureio.vercel.app`](https://roryskagen-5ugjqo1bo-ventureio.vercel.app) (Aliased to `roryskagenart.com`, `www.roryskagenart.com`)

---

## [2.7.0] - 2026-09-12
### Fixed
- **CI/CD Build Pipeline Hardening:** Added explicit git tracking for `api/index.js` so remote Vercel CI build containers find and deploy the serverless Express backend without missing artifacts (`b5e6c3b`).

---

## [2.6.0] - 2026-09-12
### Added
- **Studio Media Library Picker:** In-modal asset browser directly querying Supabase `media_assets`.
- **Drag-and-Drop Image Uploader:** Direct-to-storage upload component for studio admins creating or updating artwork catalog entries (`8db6c44`).

---

## [2.5.0] - 2026-09-12
### Changed
- **Single Source of Truth Cutover:** Migrated the public fine art gallery and catalog views to query directly from live Supabase PostgreSQL tables (`public.artworks`, `public.pages`) rather than static mock files (`7f040c4`).
### Fixed
- Artwork slug resolution fallback for legacy numeric IDs.

---

## [2.4.0] - 2026-09-12
### Fixed
- **Vercel Serverless CommonJS Scoping:** Emitted serverless bundle as CommonJS (`.cjs`) and configured `api/package.json` with `{"type": "commonjs"}` to prevent Node.js ESM loader errors on Vercel runtime (`86d91be`, `b640e59`).
- **Routing Configuration:** Corrected `vercel.json` rewrite escapes and explicitly declared the serverless function handler (`8a165b6`).
- **Database Backfill:** Migrated legacy numeric artwork identifiers to canonical URL slugs.

---

## [2.3.0] - 2026-09-12
### Added
- **Studio Admin CMS Dashboard:** Modern administration portal (`/#/admin`) built with **shadcn/ui** primitives, Lucide icons, and Tailwind CSS (`b68b523`).
- **Studio Brand Identity:** Custom Studio Brand Icon (`R`) and streamlined header navigation.
- **Database Migrations Engine:** Idempotent migration runner (`scripts/run-migrations.ts`) and applied CMS baseline migrations in `supabase/migrations/` (`0285ce5`).
- Pull Request [#1](https://github.com/jadenblack/roryskagenart.com/pull/1) merged to `main`.

---

## [2.2.0] - 2026-09-11
### Added
- **Vercel Serverless Express Bridge:** Bundled full Express REST API using `esbuild` to run serverlessly under Vercel (`api/index.js` / `dist/server.cjs`) (`1152f18`, `ceb0674`).
- **Catalog Telemetry:** Added live catalog artwork counter and hero slider excerpt typography.
### Removed
- Removed legacy Cloudinary UI manager and client-side upload dependencies (`7be31a5`).

---

## [2.1.0] - 2026-09-11
### Added
- **Cloudinary Exit Phase 1 (Migration Pipeline):**
  - Standalone tsx migration script `scripts/migrate-cloudinary-to-supabase.ts`.
  - Automated `sharp` image pipeline pre-generating 4 standard renditions per artwork:
    - `thumb` (640w WebP, q82)
    - `hero` (1280w WebP, q85)
    - `full` (original resolution WebP, q88)
    - `lqip` (20w Base64 blur placeholder)
  - Supabase Storage bucket `artwork-images` configuration with public read access.
  - Automated ingestion into `public.media_assets` registry (152 assets migrated).
- Added the `wayback/` archive — static snapshots of the two predecessor sites (Central Texas Murals and the earlier Rory Skagen Art portfolio) — for historical portfolio integrity verification (`16f6fb2`, `9be1222`).

---

## [2.0.0] - 2026-09-10
### Added
- **Production Baseline Tag (`v2.0.0`):**
  - Integrated Supabase PostgreSQL database client and schema definitions (`47dc025`).
  - Integrated Resend email service for collector inquiry notifications (`908d105`).
  - Architectural PRD roadmap documentation (`plan/PRD_V2.1_CLOUDINARY_EXIT.md`).
- **Historical Pre-Release Features (v2.0.0-alpha / v1.x Consolidation):**
  - Native admin authentication & session vault (`105bd5d`, `b77846b`).
  - Hero slider carousel management (`fbaeccf`).
  - Studio archive rebranding & inquiry terminology unification (`2ba865c`, `72a4a75`, `86a9677`).
  - Gallery filter persistence, hidden artwork status, and trash/restore lifecycle (`40614c2`, `7789398`, `dc98365`).
  - Baseline initialization from venturepilot repository (`4a159ca`, `faa6d37`).
