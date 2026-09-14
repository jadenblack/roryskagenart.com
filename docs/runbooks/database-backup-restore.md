# Runbook — Database Backup & Restore

**Applies to:** the `roryskagenart.com` Supabase project (Postgres + Storage + Auth).
**Owner:** Rory Skagen Studio Engineering.
**Related:** [`docs/adr/0001`](../adr/0001-schema-as-code-before-data-migration.md) ·
[`AGENTS.md`](../../AGENTS.md) §4 (write path) · [`scripts/backup-catalog.ts`](../../scripts/backup-catalog.ts)

---

## 1. Why this document exists

ADR 0001 found that the catalog had **no documented rollback path**: the only stated recovery
option for a bad write was "restore the whole Supabase project". This runbook closes that gap and
is a **Phase A prerequisite** for the v3 data migration — no backfill runs against the live
catalog until the operator knows exactly how to undo it.

Two distinct layers of protection exist. They cover different failure modes; you generally want
both.

| Layer | Protects against | Recovery granularity | Cost |
| :--- | :--- | :--- | :--- |
| **Platform backups** (Supabase) | Disaster, corruption, catastrophic bad write | Whole project, to a point in time | Plan-dependent (see §3) |
| **Repo logical dump** (`scripts/backup-catalog.ts`) | A specific bad migration or backfill | Per table, per row, inspectable as JSON | Free, ~1 second, run it yourself |

---

## 2. Layer 2 — repo logical dump (always available)

`scripts/backup-catalog.ts` is **strictly read-only** — it issues nothing but `SELECT`s. Run it
before any migration, backfill, or manual SQL session.

```bash
npx tsx scripts/backup-catalog.ts                 # → data/backups/<timestamp>/
npx tsx scripts/backup-catalog.ts --out ./tmp/bk  # explicit destination
```

It writes one JSON file per `public` table (8 tables: `profiles`, `taxonomies`, `settings`,
`artworks`, `artwork_terms`, `media_assets`, `pages`, `inquiries`) plus a self-describing
`manifest.json` holding row counts, byte sizes, the target database, the Postgres version, and the
list of migrations recorded in `public.schema_migrations`.

Connection comes from the same env vars as the migration runner
(`VRCL_SUPA_POSTGRES_PRISMA_URL` → `VRCL_SUPA_POSTGRES_URL` → `VRCL_SUPA_POSTGRES_URL_NON_POOLING`
→ `POSTGRES_URL`).

> ⚠️ **The dump contains production data, and `profiles` includes studio member email addresses.**
> `data/backups/` is gitignored — keep it that way. Never attach a dump to a PR, issue, or chat.

**Use it for:** comparing before/after state around a migration, recovering specific rows or
columns, and answering "what did this table look like at 14:32?".

---

## 3. Layer 1 — Supabase platform backups

> ✅ **RESOLVED 2026-09-14 — the project is on the FREE plan.** The tier was previously recorded
> here as "unverified". It is now verified: the Vercel project's Storage integration page for
> `roryskagen` states *"All projects created with the Supabase integration are currently on the
> free plan."*
>
> **Consequence: there are NO platform backups, and no PITR.** The repo logical dump in §2 is
> therefore the *only* recovery path this project has. Treat it as load-bearing, not a convenience.
> The blocking action is: **take a dump and copy it off this machine before any write to the live
> catalog.**

Facts verified against the Supabase documentation, 2026-09-14.

| Plan | Automatic backups | Retention |
| :--- | :--- | :--- |
| **Free ← this project** | **None** | — (export manually, see §2 and §4c) |
| **Pro** | Daily | 7 days |
| **Team** | Daily | 14 days |
| **Enterprise** | Daily | up to 30 days |

- **Point-in-Time Recovery (PITR)** is a paid add-on for Pro/Team/Enterprise and additionally
  requires a Small compute add-on. It restores to any point with second-level granularity. Enabling
  PITR **replaces** daily backups. Pricing scales with the retention window (7 / 14 / 28 days).
- Backups live in the dashboard under **Database → Backups**. Restores can also be driven from the
  Management API (`GET /v1/projects/{ref}/database/backups`,
  `POST /v1/projects/{ref}/database/backups/restore-pitr`).
- On the free tier, Supabase explicitly recommends exporting regularly with the CLI
  (`npx supabase db dump`) and keeping off-site copies.

### Critical caveats

1. **Storage is not backed up.** Database backups contain only *metadata* about Storage objects.
   Restoring an older backup **does not bring back objects deleted after that backup**. Our
   `artwork-images` bucket therefore needs its own story — see §6.
2. **Restores cause downtime.** The project is inaccessible during a restore, for a duration that
   scales with database size.
3. **Custom role passwords are not stored** in daily backups; reset them after a restore.
4. **Subscriptions and replication slots must be dropped before a restore and recreated after.**
   The Realtime slot is exempt and handled automatically.
5. **Deleting the project permanently destroys its backups.** There is no undo for that.

---

## 4. Restore procedures

### 4a. Row-level rollback from a repo dump (most common)

1. Take a fresh dump *before* touching anything, so you have a "bad" state to diff against:
   `npx tsx scripts/backup-catalog.ts`
2. Identify the affected table and rows by diffing the good and bad JSON snapshots.
3. Apply corrective `UPDATE`s through the established write path (`scripts/run-migrations.ts` with a
   new, idempotent SQL file — see `AGENTS.md` §4). Do **not** hand-edit production rows in a GUI.
4. Re-run `npx tsx scripts/introspect-schema.ts` and confirm row counts in the new report.

> ✅ **Now scripted (2026-09-14).** `scripts/restore-catalog.ts` replays a dump back into a
> database. It has a deliberate safety model: it writes nothing without `--apply`, it **refuses a
> remote target** unless `--allow-remote` is passed, and it defaults to the catalog tables only
> (`profiles`/`settings` are environment state — see below).
>
> ```bash
> # Plan only — prints what would happen, writes nothing (the default)
> npx tsx scripts/restore-catalog.ts --from data/backups/<ts> --db-url <url>
>
> # Rehearse against a scratch database
> npx tsx scripts/restore-catalog.ts --from data/backups/<ts> --db-url <url> --apply
>
> # Deliberate production rollback of one table
> npx tsx scripts/restore-catalog.ts --from <ts> --db-url "$PROD" \
>   --tables artworks --mode repair --allow-remote --apply
> ```
>
> `--mode load` (default) never overwrites an existing row; `--mode repair` upserts, and is the
> actual rollback.
>
> ✅ **EXERCISED against a real database on 2026-09-14.** The safety net is no longer a document.
> A full restore was rehearsed against the local scratch database (`supabase start`, §7b):
>
> | Step | Result |
> | :--- | :--- |
> | Plan-only run (no `--apply`) | printed the plan, **wrote nothing** |
> | Restore into an empty schema | **294 inserted, 4 skipped, 0 failed** |
> | Re-run the same restore | **0 inserted, 298 skipped, 0 failed** — idempotent |
> | Re-dump the restored database and compare | 5 of 6 tables **byte-identical**; the 6th (`pages`) differed only in `updated_at` |
>
> The 4 skipped rows were `pages`: `--mode load` never overwrites, and the local database already
> had those slugs from a migration seed. **That is the one thing to understand about `load` mode —
> it cannot correct a row that already exists. Use `--mode repair` when you need the snapshot's
> values to win.**
>
> The pure logic is also unit-tested offline (`src/test/restorePlan.test.ts`, 27 tests, including
> one that generates SQL for every row of a real dump).
>
> **Known limitation — `profiles` cannot be restored into a fresh database.** `profiles.id`
> foreign-keys to `auth.users(id)`, which is empty in a new project, and `settings.updated_by`
> foreign-keys to `profiles`. That is why neither is in the default restore set. Recovering studio
> staff accounts means recreating the auth users first.

### 4b. Whole-project restore from a platform backup

Only for genuine disasters. Expect downtime and data loss back to the restore point.

1. Take a repo dump first if the database is still reachable — it is your only per-row record.
2. Drop subscriptions and replication slots (skip the Realtime slot).
3. Dashboard → **Database → Backups** → pick the closest backup *before* the incident → confirm.
   (PITR: pick the exact timestamp instead.)
4. After completion: reset custom role passwords, recreate subscriptions/slots, then verify.
5. Verify against the repo: `npx tsx scripts/introspect-schema.ts`, then `npm test`, then re-run
   `npx tsx scripts/run-migrations.ts` (should report nothing to do).

---

## 5. Pre-migration checklist

Copy this into the PR description for any migration that writes to the live catalog.

- [ ] `npx tsx scripts/backup-catalog.ts` completed; the output path is recorded in the PR.
- [ ] The migration is idempotent (`IF NOT EXISTS` / `OR REPLACE` / guarded `DROP … IF EXISTS`) —
      enforced by `src/test/migrationSafety.test.ts`.
- [ ] Backfills never overwrite non-empty fields; they fill only `NULL`/`''` (`AGENTS.md` §8).
- [ ] `npm run lint` and `npm test` are green.
- [ ] The migration was applied to a **non-production** database first, or the reason it cannot be
      is stated explicitly.
- [ ] A rollback statement is written down — even if it is "restore `artworks.json` from the dump".
- [ ] `npx tsx scripts/introspect-schema.ts` re-run afterwards, and the diff reviewed.

---

## 6. Known gaps

| Gap | Impact | Status / plan |
| :--- | :--- | :--- |
| **Storage objects are not backed up** by database backups | Deleted `artwork-images` objects are unrecoverable from a DB restore | **Open.** Decide between bucket versioning and a periodic object listing + copy. Blocks the v3 media step. |
| **No scheduled / off-site dump** | A dump that only exists on this machine is lost with the machine — and on a Free plan it is the *only* backup | **Open, and the top priority.** Copy `data/backups/<ts>/` somewhere off this machine, or automate it. |
| **Backup plan tier** | — | ✅ **Resolved 2026-09-14: Free.** No automatic backups, no PITR. See §3. |
| **No scripted restore** | Row-level recovery was manual | ✅ **Written and exercised 2026-09-14** — `scripts/restore-catalog.ts`, unit-tested, and rehearsed end-to-end against a scratch database. See §4a. |
| **No native `pg_dump`** | `supabase db dump` shells out to a containerised `pg_dump`, so it fails with `docker: command not found`. Without it there is no restorable **schema** dump — only the per-table JSON in §2. | ✅ **Resolved 2026-09-14.** Docker Desktop 29.8.0 is installed and running. It lands at a **per-user** path (`%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin`) that is *not* on `PATH` — export it first, or the CLI will not find `docker`. |
| **No non-production database** | The pre-migration checklist requires a migration be applied to a non-production database first, and none existed | ✅ **Resolved 2026-09-14.** `supabase start` gives a local stack on `127.0.0.1:54322`. Note the CLI **cannot** apply this repo's migrations — see §7a — so `config.toml` disables them and the repo runner owns the schema (§7b). |
| **The migration set did not reproduce production's `schema_migrations` RLS flag** | Building a database from version control left the migration ledger readable with the anon key, so "the schema is reproducible from version control" was not quite true | ✅ **Fixed 2026-09-14.** `scripts/run-migrations.ts` now enables RLS on `schema_migrations` when it creates it. Found by rebuilding a database from migrations and diffing it against production; a rebuilt database now matches production on all nine tables' RLS state. |
| **Two migration files were checked out CRLF, and there was no `.gitattributes`** | `pg_get_functiondef` returns the stored source, so CR bytes from those files landed in stored function bodies — production had **0** CR bytes, a build from the affected checkout had **17**. The **committed** form of all ten files was already LF; only the checkout differed (`core.autocrlf = true` is set globally) | Functionally identical, but it made "reproduce the schema from version control" **checkout-dependent**, and it produced spurious diffs. | ✅ **Fixed 2026-09-14.** Added `.gitattributes` with `*.sql text eol=lf` (overrides `core.autocrlf`) and re-checked out the two files. **No content rewrite was needed** — the index was already LF. A rebuild now reports **0 CR bytes in all 7 stored functions**. ROADMAP_V3 R-16. |

---

## 7. ⚠️ Do NOT use the Supabase CLI's migration commands on this project

Verified against the live database on 2026-09-14 — **this project has two different migration
ledgers, and they disagree:**

| Ledger | Owner | Rows |
| :--- | :--- | :--- |
| `public.schema_migrations` | **this repo** — `scripts/run-migrations.ts` | **9** |
| `supabase_migrations.schema_migrations` | **the Supabase CLI** — `supabase db push` / `migration up` | **1** |

`supabase db push` and `supabase migration up` consult the *CLI's* ledger, so they would see eight
of this repo's nine migrations as unapplied and attempt to re-run them against production. That is
precisely the ledger-drift failure mode recorded in `AGENTS.md` §5, which had to be reconciled once
already.

**Rule: schema changes go through `scripts/run-migrations.ts`, never through the Supabase CLI.**
The CLI remains useful for `supabase start` (a local scratch database) and `supabase db dump`
(read-only), but not for applying migrations.

### 7a. This is not theoretical — `supabase start` fails because of it

Confirmed empirically on 2026-09-14 (CLI 2.117.0). On a **fresh** local volume, `supabase start`
tries to apply `supabase/migrations/` itself and dies:

```
Applying migration 2026_09_01_baseline_core_tables.sql...
Applying migration 2026_09_12_cms_v1_1_slug_backfill.sql...
Stopping containers...
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505)
Key (version)=(2026) already exists.
At statement: 6
INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES($1, $2, $3)
```

**Cause.** The CLI derives a migration's ledger `version` from the **leading digits of the
filename**, and it requires `<14-digit timestamp>_name.sql`. Every file in this repo starts
`2026_…`, so the CLI parses each one as version `2026` and the second one collides on the primary
key. The filenames are *correct* for this project (the repo runner keys on the full filename and
sorts lexicographically — see `src/test/migrationSafety.test.ts`) and must **not** be renamed:
renaming them would make all nine look unapplied to `public.schema_migrations`.

**Resolution (applied).** `supabase/config.toml` sets:

```toml
[db.migrations]
enabled = false

[db.seed]
enabled = false
```

With migrations disabled the CLI builds the base stack and leaves `public` empty, and this project
owns its own schema. Do not re-enable either flag; the comment in `config.toml` explains why.

### 7b. Bringing up a scratch database (the Phase 0 procedure)

```bash
npx supabase start                 # base stack; public schema is empty
npx supabase status                # API URL :54321, DB :54322, Studio :54323
```

Then apply the schema with **this repo's runner**, not the CLI:

```bash
VRCL_SUPA_POSTGRES_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  npx tsx scripts/run-migrations.ts
```

That single command is also the **empirical test of ADR 0001 Phase A**: if the nine migrations
reproduce the live schema, the "schema is reproducible from version control" claim holds. Compare
the result against a `supabase db dump` schema dump to prove it.

The default credentials above are the CLI's own well-known local defaults — they are not secrets
and they never leave `127.0.0.1`.
