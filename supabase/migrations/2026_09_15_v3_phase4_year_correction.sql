-- v3.0.0 Phase 4 — D4 / Q18: the archive `post_date` is authoritative for the mural rows.
--
-- WHY THIS IS A SEPARATE MIGRATION
-- Owner decision D4 says the archive year is authoritative, and that it is an **overwrite** of
-- `artworks.year`, not a fill-only-empty pass. It therefore cannot live in the backfill: every
-- UPDATE in 2026_09_15_v3_phase4_wayback_backfill.sql is guarded on the columns it sets being NULL
-- or empty, and `year` is neither — `POST /api/artworks` hardcodes `'2024'`, so all 138
-- pre-existing rows hold a plausible-looking non-empty value. A fill-only-empty pass could never
-- correct them. It also needs its own reviewed scope and its own pre-write dump (R-07).
--
-- WHAT IT FIXES — and only this
-- The 60 mural rows the backfill INSERTed already carry their real archive year, because they were
-- new and there was nothing to preserve. The **2 rows the backfill merged into** were pre-existing
-- live artworks, so their hardcoded `'2024'` survived the merge. Measured 2026-09-15 with
-- scripts/_diag-year.ts — 62 records, 60 agree with the archive, exactly 2 disagree:
--
--   austin-postcard   stored '2024' → archive '2011'   (page: austin-postcard, publishedAt 2011-…)
--   marcia-ball       stored '2024' → archive '2015'   (page: marcia-ball,     publishedAt 2015-…)
--
-- ⚠️ NOT IN SCOPE — deliberately, and it needs a different data source
-- 136 other artworks still sit on the hardcoded `'2024'` default: **116 paintings** and **20 rows
-- with `kind IS NULL`**. The recovered archive is a mural source only, so it carries no year for
-- them. Correcting those needs the painting archive or owner input, and guessing would replace one
-- wrong value with another. Recorded as a finding; see the v3.0.0 release notes.
--
-- IDEMPOTENCY
--   Each statement is guarded on `year IS DISTINCT FROM <target>`, so a second pass matches zero
--   rows and mutates nothing. `kind = 'mural'` is asserted so the update cannot silently apply to a
--   row that has since been reclassified.
--
-- TRANSACTION CONTROL IS DELIBERATELY ABSENT — scripts/run-migrations.ts executes each file as one
-- implicit transaction. Do not add BEGIN/COMMIT (no other migration does).

UPDATE public.artworks
   SET year = '2011'
 WHERE slug = 'austin-postcard'
   AND kind = 'mural'
   AND year IS DISTINCT FROM '2011';

UPDATE public.artworks
   SET year = '2015'
 WHERE slug = 'marcia-ball'
   AND kind = 'mural'
   AND year IS DISTINCT FROM '2015';
