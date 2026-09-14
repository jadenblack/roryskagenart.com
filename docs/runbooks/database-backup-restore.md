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

Facts verified against the Supabase documentation, 2026-09-14. **Confirm the project's current plan
in the dashboard before relying on any of this** — the tier is not recorded in the repo.

| Plan | Automatic backups | Retention |
| :--- | :--- | :--- |
| **Free** | **None** | — (export manually, see below) |
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

> **Not yet automated.** There is no scripted restore-from-dump. Phase C (the v3 load) will add one
> and exercise it against a **non-production** database first — an untested restore script in the
> critical path is a liability, not a safety net.

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

| Gap | Impact | Owner / plan |
| :--- | :--- | :--- |
| **Storage objects are not backed up** by database backups | Deleted `artwork-images` objects are unrecoverable from a DB restore | Phase C — decide between bucket versioning and a periodic object listing + copy |
| **No scripted restore** from the repo dump | Row-level recovery is manual | Phase C, exercised on a scratch database |
| **Backup plan tier is unverified** | Free tier means *no* automatic backups at all | Verify in the dashboard; if free, schedule `supabase db dump` |
| **No scheduled/off-site dump** | A local-only dump is lost with the machine | Consider an automation once the write path is stable |
