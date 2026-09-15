# `supabase/staged/` — the inert staging area for backfill SQL

**Nothing in this directory is ever applied by the migration runner.** It exists so a generated,
high-consequence write can be reviewed before it can reach production.

## Why the directory exists

`scripts/lib/migrationPlan.ts` applies **every** `.sql` file in `supabase/migrations/` that is not yet
recorded in `public.schema_migrations`. There is no second gate and no dry-run: the next routine

```bash
npx tsx scripts/run-migrations.ts
```

against production would apply it. A file placed in `supabase/migrations/` is therefore **armed the
moment it is committed**.

Phase 3 had to emit a backfill SQL file weeks before its Phase 4 gate opened. Committing it to
`supabase/migrations/` would have armed it. This directory is the deliberate deviation from
`PRD_V3` §3 Step 4c — see `plan/ROADMAP_V3.md` §3.A, *"One deliberate deviation from `PRD_V3` §3
Step 4c — keep it."*

## The rule

1. Generators write here, not to `supabase/migrations/`.
2. The file is inert here. It is not applied, not recorded in the ledger, and not referenced by any
   test or script.
3. Promote it into `supabase/migrations/` **only in the release PR that is authorised to apply it** —
   and rename it to match that release, e.g. `2026_09_15_v3_phase4_wayback_backfill.sql`.
4. When promoting, **drop any explicit `BEGIN;` / `COMMIT;`**. `run-migrations.ts` already wraps each
   file in one implicit transaction, and an explicit `BEGIN` makes Postgres warn *"there is already a
   transaction in progress"*.

## History

| File | Promoted | As |
| :--- | :--- | :--- |
| `2026_09_15_v3_wayback_backfill.sql` | v3.0.0 (2026-09-15) | `supabase/migrations/2026_09_15_v3_phase4_wayback_backfill.sql` |

That was the only file this directory ever held, and its promotion **opened** the Phase 4 gate. The
SQL body was promoted byte-for-byte; the only changes were the header comment and the removal of
`BEGIN;`/`COMMIT;`. This `README.md` keeps the directory tracked (git does not track empty
directories) so the convention survives its first and only occupant.

`scripts/wayback-stage-sql.ts` recreates this directory on demand (`mkdirSync(..., { recursive: true })`),
so a missing directory is not an error — but it should not go missing.
