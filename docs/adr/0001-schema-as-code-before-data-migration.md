# ADR 0001 — Bring the Core Schema into Version Control Before the v3 Data Migration

- **Status:** Accepted
- **Date:** 2026-09-14
- **Deciders:** Rory Skagen Studio Engineering
- **Related:** [`AGENTS.md`](../../AGENTS.md) · [`plan/PRD_V3_WAYBACK_DATA_MIGRATION.md`](../../plan/PRD_V3_WAYBACK_DATA_MIGRATION.md) · [`plan/DRAFT_FEATURE_PULL_REQUEST.md`](../../plan/DRAFT_FEATURE_PULL_REQUEST.md)

---

## 1. The question

Should we invest in real repo development first — codifying future feature work, clearing tech
debt, improving the codebase — **before** attempting the v3 data migration?

## 2. Evidence (gathered 2026-09-14, verified against the repo)

1. **The core domain tables are not defined in version control.**
   `supabase/migrations/` creates only `profiles`, `taxonomies`, `artwork_terms`, `settings`
   (plus `schema_migrations` created by the runner). **`artworks`, `media_assets`, `pages`, and
   `inquiries` are never `CREATE`d anywhere** — the migrations only `ALTER`/reference them. They
   exist solely in the live Supabase project.

2. **The one schema reference we have is stale and incomplete.**
   The only `CREATE TABLE public.artworks` in the repo lives inside
   `plan/DRAFT_FEATURE_PULL_REQUEST.md` — a document now marked **⛔ Superseded**. It is missing
   columns the code actually uses (no `draft`, no `sort_order`) and names a column the code no
   longer uses (`gallery_series`, while the API/engine use `series`).

3. **Consequence: the database is not reproducible.** Running `scripts/run-migrations.ts` against
   a fresh Supabase project would fail — the first `ALTER TABLE public.artworks` targets a table
   that does not exist. There is no way to stand up a clean environment, no CI-verifiable schema,
   and no staging parity.

4. **No rollback story.** No backup/restore procedure for the catalog is documented anywhere. The
   only recovery path for a bad write is "restore the whole project".

5. **The migration's own code path is the least-tested code we have.** 9 test files exist, all
   under `src/` (admin CMS, UI primitives, state engine). **Zero tests cover `server/` (the API)
   or `scripts/` (including `run-migrations.ts` and the migration/backfill scripts).**

6. **The codebase is otherwise in good health.** Zero `TODO`/`FIXME`/`HACK`/`@ts-ignore` in
   `src/`, `server/`, or `scripts/`. `tsc --noEmit` is clean and 64 tests pass. The largest
   hand-written file is `src/components/HomeLandingView.tsx` (1229 lines); the largest file overall
   (`src/data/assetRegistry.ts`, 4602 lines) is auto-generated and not a concern.

7. **The schema is already close to mural-capable.** `artworks` carries `location`, `year`,
   `series`, `medium`, `dimensions`, `narrative`, `status`, plus M2M `taxonomies`/`artwork_terms`.
   Mural-specific attributes (client, project type) map onto existing columns and taxonomy terms.
   The expected schema gap is **small and additive**, not a redesign.

## 3. Decision

**Neither "refine broadly first" nor "migrate first". Adopt a bounded, dependency-ordered sequence
in which only the work that the migration actually depends on is pulled forward.**

| Phase | Work | Gate |
| :--- | :--- | :--- |
| **A — Blocking, small** | Introspect the live DB and commit a **baseline schema migration** (`CREATE TABLE IF NOT EXISTS` for `artworks`, `media_assets`, `pages`, `inquiries`). Document a **backup/restore** procedure. Add a **thin test harness** over the write path (`run-migrations.ts` idempotency + the backfill emit step). | A fresh Supabase project can be built from the repo and migrations re-run with zero mutations. |
| **B — Read-only** | Run the v3 extraction + reconcile (§ Pipeline of the v3 PRD). Emit the **NEW/EXISTS/COLLISION report** and a **schema-fit gap list**. No writes. | Gap list is empty or contains only additive changes. |
| **C — Load** | Apply any additive schema extensions, then the staged, idempotent backfill. Rows land `draft = true`. | Re-running the migration mutates nothing; fine-art rows untouched. |
| **D — Feature & refactor** | Mural-aware features and broad refactors (e.g. `HomeLandingView` decomposition) — **now driven by real data**. | — |

Codifying process — this ADR, `AGENTS.md`, Conventional Commits, the CHANGELOG discipline — is
**cheap and independent of sequencing**, so it is done now rather than treated as a phase.

## 4. Rationale

- **The single largest piece of tech debt *is* a migration prerequisite.** Writing ~100+ new rows
  into a schema we cannot reproduce or roll back is the definition of working hard instead of
  working smart. Phase A is not "refinement for its own sake"; it is unblocking.
- **Broad refactoring first has no stopping point and no evidence base.** Without the mural data we
  would be guessing which features and components matter. The data is the forcing function that
  tells us where to invest — so extract first, refactor after.
- **The blast radius is small.** The merge is largely additive (fine art already exists; murals are
  net-new) and new rows land as drafts. This argues *against* a long pre-migration freeze.
- **Phase A is genuinely small.** It is one introspection pass, one baseline migration, one short
  doc, and a handful of tests — not a rewrite.

## 5. Consequences

- **Positive:** reproducible DB; a real rollback path; feature work aimed by evidence; bounded,
  defensible scope; the migration becomes a routine, reversible operation.
- **Negative:** content lands marginally later; requires read access to the live DB for
  introspection.
- **Explicitly deferred, and *not* blockers:** `HomeLandingView` decomposition, design-system work,
  new feature scaffolding, and any refactor not touched by the migration path.

## 6. Rejected alternatives

| Option | Why rejected |
| :--- | :--- |
| **Broad codebase refinement first** | No natural stopping point; priorities would be guessed without the mural data; delays the actual business value (content) behind open-ended polish. |
| **Migrate immediately** | Targets a schema that exists only in production and is undocumented/stale; no rollback; highest-consequence code path is untested. |
| **Rebuild the schema from the superseded doc** | The doc is stale and incomplete (§2.2); it would bake in wrong column names. Ground truth must come from introspecting the live DB. |
