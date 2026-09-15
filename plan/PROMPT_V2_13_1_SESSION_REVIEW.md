# Session-review prompt — v2.13.1

> **How to use this:** copy everything from `--- BEGIN PROMPT ---` down into a fresh session.
> It is written to be self-contained — the new session has not seen this conversation.
>
> Purpose: **verify, then fix.** v2.13.0 "backup durability" shipped and was proven working in
> production, but a review pass found loose ends that were out of scope for the release. This is a
> small, focused follow-up — not a feature release.

---

## BEGIN PROMPT

You are continuing work on **`roryskagenart.com`** (gallery + catalog raisonné + studio CMS for
artist Rory Skagen). React 19 · Vite 6 · Tailwind v4 · Express 4 · Supabase (Postgres + Storage +
Auth) · Resend · Vercel.

**Start by reading, in this order:**
1. `AGENTS.md` — the canonical, verified project context. It supersedes anything I say below.
2. `.workbuddy-ai/memory/MEMORY.md` — curated long-term project notes.
3. `.workbuddy-ai/memory/2026-09-14.md` — today's log (the v2.13.0 work is at the end).

### Current state (verified)

| Item | Value |
| :--- | :--- |
| Release | **v2.13.0** — tag → merge commit `0aab9b3` |
| `main` | `87c9db8` (docs follow-ups PR #12 + PR #13) |
| Open PRs / Dependabot alerts | **0 / 0** |
| Migration ledger | 11 / 11 |
| Catalog | 138 artworks · 307 rows · 152 media rows / 605 objects / 76.6 MiB |
| Gates | `tsc --noEmit` clean · **335 tests / 28 files** |
| Off-site backup | **Live and proven** — see below |

### What v2.13.0 did (context, do not redo)

1. **Verifiable dumps** — manifest format v2 (sha256 + row count + bytes per table);
   `scripts/backup-catalog.ts` self-verifies before exiting; `scripts/verify-backup.ts` re-checks
   any dump (newest / path / `--all` / `--json`; exit 0 ok, 1 problems, 2 nothing to check).
2. **Scheduled off-site dump** — `vercel.json` cron `43 6 * * *` → `GET /api/cron/backup`
   (`server/routes/cronBackup.ts`) → Vercel Blob under `catalog-backups/<stamp>/`. Retention in
   `server/lib/blobBackup.ts` (14 recent + one per month + 7-day floor). Shared dump builder in
   `server/lib/catalogDump.ts`.
3. **Media reconciliation** — `scripts/verify-media-backup.ts` + `scripts/lib/mediaReconcile.ts`.

It was proven end-to-end: endpoint invoked → 307 rows / 11 migrations / 9 objects / 406,593 B /
~1.3 s; the dump was **downloaded back out of Blob and re-verified** (`OK`, exit 0); a second run
deleted nothing. Gate in both states: `CRON_SECRET` unset ⇒ **503**; set + wrong bearer ⇒ **401**.

---

## Your task

Three phases. **Do not skip phase 1** — several items below are suspected, not yet confirmed, and
one of them is a known **false negative** that could send you chasing a bug that does not exist.

### Phase 1 — Verify (read-only, no commits)

Re-establish the baseline and confirm or refute each finding.

```bash
npm run lint            # tsc --noEmit
npm test                # vitest — NOTE: transpiles WITHOUT typechecking, so run BOTH
npx tsx scripts/verify-backup.ts --all
npx tsx scripts/verify-media-backup.ts
npx tsx scripts/smoke-serverless.ts
```

Expected results — **do not "fix" these, they are correct behaviour**:
- `verify-backup --all` reports dumps taken **before ~2026-09-14T18:15Z as format v1 and
  unverifiable** (exit 1). That is by design; they are still restorable. A v1 manifest is identified
  by the **absence** of `formatVersion`, not by `=== 1`.
- `verify-media-backup` reports **151 `unreferenced-original`** entries. Expected: the Cloudinary
  migration stored thumb/hero/full/**original** but `renditions` records only the first three. Those
  151 are the highest-resolution masters and no row points at them. Exit code should still be **0**.

Then confirm each item in the findings list below.

### Phase 2 — Fix

Triage as **P1 (must fix)** / **P2 (cheap, worth it)** / **P3 (defer, write it down)**. Ship only
P1 + P2 in v2.13.1. Ask before anything that changes **production configuration**.

### Phase 3 — Release v2.13.1

Standard flow, no shortcuts: CHANGELOG → branch → PR → wait for all 5 gates (`CLEAN`) →
`gh pr merge <n> --merge` (**never `--squash`**) → annotated tag **on the merge commit** → push tag
by object SHA → `gh release create --verify-tag` → `DEPLOYMENT_LOG.md` from real `vercel ls` data.

---

## Findings to confirm or refute

### A1 — `scripts/smoke-serverless.ts` gives false negatives (P1)

The route assertions are broken by construction:

```ts
const routes = (app as any)._router.stack
  .filter((l: any) => l.route)      // ← only DIRECT app-level routes have `.route`
  .flatMap(...)
```

Anything mounted with `app.use('/api/artworks', artworksRouter)` is a **router layer with no
`.route` property**, so it is filtered out. Actual output today:

```
registered route handlers: 4
GET /api/health present: true
GET /api/artworks present: false     ← FALSE: the route exists and works
POST /api/auth/login present: false  ← correct, but because the route was removed long ago
POST /api/inquiries present: false   ← FALSE: the route exists and works
```

So two of the four assertions are **false alarms**, one asserts a route that no longer exists
(grep for `/api/auth` in `server.ts` and `server/` returns nothing), and the new
`GET /api/cron/backup` is not covered at all.

**Fix direction:** walk mounted routers (or, better, assert by actually invoking each endpoint
in-process — the script already does this for `/api/health`), drop the dead `auth/login`
assertion, and add the cron route. Verify the fix by proving it fails when a route really is
removed — a guard that cannot fail is decoration.

### A2 — `api/index.js` is a tracked build artifact and is stale (P2)

`api/index.js` is committed, but it was generated by esbuild and last regenerated at `406def2`
(several releases ago). It contains **zero** occurrences of `cron`, so it predates the v2.13.0
route. Production is fine — `buildCommand` in `vercel.json` regenerates it on every deploy — but
the committed file misrepresents what is deployed.

⚠️ Before untracking it: `b5e6c3b` (v2.7.0) deliberately tracked it — *"track api/index.js so
Vercel CI builds find the function"*. So confirm whether it is actually required before removing
it. The safe options are (a) regenerate and commit it, or (b) leave it and document that it is a
build artifact. Do not untrack it without evidence.

### A3 — Off-site dumps lose the source host in their manifest (P2, cosmetic)

`server/lib/catalogDump.ts:120` hardcodes:

```ts
target: '(serverless)',
```

The CLI script records a real target via `describeTarget(connectionString)`. So every off-site dump
says `(serverless)` instead of e.g. `aws-0-us-east-1.pooler.supabase.com:5432/postgres`. That
degrades the dump's self-description — and *"which database did this come from?"* is the first
question asked during a restore. Pass the real target through; it must contain **no credentials**.

### B4 — There is no committed way to verify an off-site dump (P2)

`scripts/verify-backup.ts` only reads a local directory. The Blob copy was verified this session
using a **throwaway script** that downloaded the objects and then ran the existing verifier. So the
project currently produces off-site backups it has no committed way to check — which contradicts
the whole point of v2.13.0.

Candidate fix: `scripts/verify-offsite-backup.ts` (read-only; `list` → newest or `--stamp <x>` →
download → reuse `verifyDump`). Gotcha already learned: **`@vercel/blob` `get()` requires an
explicit `access: 'private'`** — it does not infer it, and omitting it fails with
`access must be "private" or "public"`. Keep the logic pure and unit-tested; the I/O belongs in the
script.

### B5 — A partially-uploaded dump still counts as a dump (P2)

Files are uploaded in array order and `manifest.json` is pushed **last**. If a run dies midway, the
stamp exists in Blob with no manifest, and `dumpsFromBlobs()` still groups it as a dump — so a
broken dump can sit in the store as "the newest" for 14 days. Confirm this by reading the code,
then consider requiring a manifest before a stamp counts as a dump (and/or pruning incomplete
stamps aggressively).

### B6 — Confirm `maxDuration` is actually honoured (P3)

`vercel.json` sets `functions["api/index.js"].maxDuration: 60` (was 30). The deployment succeeded,
but confirm against `vercel.com/docs/limits` that Hobby honours 60 and is not silently clamping.
Low impact — the run takes ~1.3 s.

### B7 — Confirm `CRON_SECRET` scope is intended (P3)

It is set in the **Production** environment only, so preview and development will 503 by design.
Confirm that is what we want and that the runbook says so.

---

## Hard constraints (non-negotiable)

- **Versions live in `CHANGELOG.md` + git tags only.** `package.json` stays `0.0.0`.
- **Never paste SQL into the Supabase dashboard** — use `npx tsx scripts/run-migrations.ts`.
- **Back up before any DB write**: `npx tsx scripts/backup-catalog.ts`.
- Env vars are **`VRCL_SUPA_*`**, not `SUPABASE_*` / `POSTGRES_URL`.
- **Supabase is the only vendor — never reintroduce Cloudinary.** (Note: `CLOUDINARY_CLOUD_NAME` is
  still set in Vercel in all three environments — dead config. Flag it; do not remove production
  config without asking.)
- **Never modify `wayback/`** — immutable archive, the v3 migration source.
- Hobby Blob: **1 GB/month + 2,000 advanced operations**; exceeding either **cuts off access for 30
  days** rather than billing. `del()` is free. Vercel cron on Hobby is **daily-only**.
- **Run both `npm run lint` and `npm test`.** vitest transpiles without typechecking — v2.13.0 had a
  real `tsc` error (`PutBlobResult` has no `size`) that 335 green tests hid.
- Secret hygiene: never print or commit secret values. `.env` and `.env.local` are gitignored.
  `CRON_SECRET` is a Vercel **Secret** and cannot be read back; a copy is in `.env.local`.

## Release mechanics (this environment's quirks)

- `gh` is not on `PATH`. Use `"/c/Program Files/GitHub CLI/gh.exe"` with
  `GH_TOKEN=$(git remote get-url origin | sed -E 's#https://[^:]+:([^@]+)@.*#\1#')`.
- Prefix network git with `GIT_TERMINAL_PROMPT=0 git -c credential.helper=` (a credential manager
  otherwise hangs).
- ⚠️ **Do not create local branches** — newly created loose refs under `.git/refs/` get deleted.
  Commit on `main`, then `git push origin main:refs/heads/<branch>`. Sync with
  `git reset --hard FETCH_HEAD`. Push tags **by object SHA**.
- Gates: no GitHub Actions. Vercel preview + Socket Security + Debricked (~1 min, 5 checks). Merge
  only when `mergeStateStatus` is `CLEAN`.
- Changing a Vercel env var requires a **redeploy**: `vercel redeploy <deployment-url>` (no `--yes`
  flag). It preserves git metadata; `vercel --prod` from local would create a deployment with no
  `githubCommitSha` and pollute `DEPLOYMENT_LOG.md`.
- `DEPLOYMENT_LOG.md`: rebuild rows from `vercel ls roryskagen --yes --json`. **Diff the log against
  `vercel ls` rather than only appending** — every release so far has left deployments unrecorded.
  Never invent a URL or build time.

## Out of scope for v2.13.1

- **v3.0.0** — the Wayback mural/fine-art merge (ADR 0001 Phases B/C/D). Separate session.
- Any schema change.
- An off-site *copy* of the 76.6 MiB image bucket (detection exists, backup does not).
- Rotating the leaked DB password; `src/server/db.ts` still hardcodes `ssl: { rejectUnauthorized: false }`.
- Adding a `LICENSE` file; `artwork_terms` is empty.

## Done criteria

- All Phase-1 checks run and their results recorded (including any finding you **refute**).
- `npm run lint` clean **and** `npm test` green, with the new/updated test count stated.
- Any new guard proven to fail when the thing it guards is broken.
- `CHANGELOG.md` `[2.13.1]`, `[Unreleased]` left empty at the top.
- PR merged, annotated tag **on the merge commit**, GitHub release created, `DEPLOYMENT_LOG.md`
  updated from real `vercel ls` data, **0 open PRs**.

---
## END PROMPT
