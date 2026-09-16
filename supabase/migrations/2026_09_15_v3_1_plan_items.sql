-- v3.1.0 — the studio feedback & planning board (capability C2: "Capture")
--
-- WHY THIS FILE EXISTS
-- The studio asked for a place to record ideas, feature requests, bugs and planning tasks, and to
-- group them into releases — the first feature program in this repo's history that the studio can
-- use to plan *itself*. This migration creates the single table that makes it possible.
--
-- WHAT IT DELIBERATELY DOES NOT DO (scope fence, not an oversight)
--   * No `plan_releases` table. v3.1.0 groups by the free-text `target_release` label and v3.2.0
--     promotes it to an entity with a reviewable backfill. Guessing a release table's shape before
--     a single real release has been planned is how you get a schema you rewrite.
--   * No comments, no audit trail, no attachments. See §8 of
--     plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md — building those before the board is in
--     daily use is the classic way to build features for a tool nobody uses (P-11).
--   * No public read policy. Ever. See the RLS section below; this table holds public submitters'
--     email addresses.
--
-- ⚠️ WHY `source` AND `author_id` ARE COLUMNS AND NOT REQUEST FIELDS
-- There are two intake doors: an anonymous one (`POST /api/plan/feedback`) and an authenticated one
-- (`POST /api/plan/items`). `source` and `author_id` are **derived from the session or fixed by the
-- route**, never read from a request body — that is what stops an anonymous caller filing as staff.
-- The CHECK constraints below are the database-side half of that rule: `source` cannot hold a third
-- value, and `kind` cannot hold one outside the list the routes accept.
--
-- ⚠️ FILE ORDERING. This file sorts before `2026_09_15_v3_phase4_*.sql` ('1' < 'p'). That is
-- harmless and intentional: the only foreign key here is to `public.profiles`, which
-- `2026_09_12_cms_v1_profiles_roles.sql` creates. Nothing in this file depends on the Phase 4
-- extension, so the intra-day ordering does not matter. If a future revision adds a dependency on
-- a Phase 4 column, rename this file so it sorts after them rather than relying on this note.
--
-- IDEMPOTENT BY CONSTRUCTION: `IF NOT EXISTS` on the table and every index, `DROP … IF EXISTS`
-- before every `CREATE`. Re-running this file must mutate nothing.
-- `src/test/migrationSafety.test.ts` enforces each of those guards.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. plan_items — the board
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 'suggestion' is the only kind the anonymous door can produce (the route forces it); the other
  -- four are what staff file. A single vocabulary for both doors is what lets a public suggestion
  -- be *promoted* to a feature in v3.2.0 without changing its identity.
  kind           text NOT NULL,

  title          text NOT NULL,
  body           text,

  status         text NOT NULL DEFAULT 'new',

  -- Nullable on purpose: "not triaged yet" is a real state and must not be indistinguishable from
  -- "triaged as low".
  priority       text,

  -- A free-text release label in v3.1.0 ('v3.2.0', 'backlog', 'someday'); an FK target in v3.2.0.
  -- Deliberately NOT a foreign key yet — see the scope fence above.
  target_release text,

  source         text NOT NULL DEFAULT 'studio',

  -- The idempotency key and the join key. 'artwork:<slug>' for a seeded mural-review item,
  -- 'release:v3.0.0' to tie an item to a shipped release. The partial unique index below is what
  -- makes the v3.1 seed re-runnable and what lets a bug report name the artwork it is about.
  source_ref     text,

  -- ON DELETE SET NULL, not CASCADE: removing a staff member must never delete the items they
  -- filed. The board is a record of the studio's thinking, and that outlives any one account.
  -- `author_name` / `author_email` are denormalised on purpose so an item stays attributable after
  -- the profile is gone — and so an anonymous submission has an identity at all.
  author_id      uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  author_name    text,
  author_email   text,

  -- Where a public submission came from. Useful for triage ("which page is generating this?"), and
  -- it is attacker-controlled text, so the route caps its length.
  page_url       text,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT plan_items_kind_check
    CHECK (kind IN ('idea', 'feature', 'bug', 'task', 'suggestion')),
  CONSTRAINT plan_items_status_check
    CHECK (status IN ('new', 'accepted', 'planned', 'in_progress', 'done', 'declined')),
  CONSTRAINT plan_items_priority_check
    CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high')),
  CONSTRAINT plan_items_source_check
    CHECK (source IN ('studio', 'public'))
);

-- The board's default view: newest first, filtered by status. A composite index rather than two
-- single-column ones because every real query pairs them.
CREATE INDEX IF NOT EXISTS plan_items_status_idx
  ON public.plan_items (status, created_at DESC);

-- Partial: most rows will have a release label eventually, but the index only needs the ones that
-- do, and the grouping query always filters `IS NOT NULL`.
CREATE INDEX IF NOT EXISTS plan_items_release_idx
  ON public.plan_items (target_release)
  WHERE target_release IS NOT NULL;

-- The idempotency key. Partial because `source_ref` is optional and Postgres treats NULLs as
-- distinct in a unique index anyway — being explicit documents the intent and keeps the index small.
CREATE UNIQUE INDEX IF NOT EXISTS plan_items_source_ref_key
  ON public.plan_items (source_ref)
  WHERE source_ref IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. updated_at, maintained by the database rather than by each caller
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.plan_items_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_items_touch ON public.plan_items;
CREATE TRIGGER trg_plan_items_touch
  BEFORE UPDATE ON public.plan_items
  FOR EACH ROW EXECUTE FUNCTION public.plan_items_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Row-level security — one policy, and no public read
-- ─────────────────────────────────────────────────────────────────────────────
--
-- This mirrors the server guard exactly: every read and write route for this table is
-- `requireRole('editor')` (except the two intake doors, which INSERT only), so the database-side
-- predicate is `is_admin_or_editor()` — the same definer helper the v2.12.1 security patch put on
-- `artworks`, `media_assets`, `pages` and `inquiries`.
--
-- ⚠️ THERE IS NO `public` POLICY, AND THERE MUST NEVER BE ONE.
-- `plan_items` holds the email addresses of anonymous members of the public who used the feedback
-- form. A public read would leak them. The public *write* does not need one either: it arrives
-- through `/api/*`, which runs on the owner connection where RLS does not apply, so the API route
-- is the gate and RLS is defence in depth. A `TO authenticated USING (true)` policy would be the
-- v2.12.1 defect all over again — `src/test/migrationSafety.test.ts` fails the build if one appears.
ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage plan_items" ON public.plan_items;
CREATE POLICY "Admins manage plan_items"
  ON public.plan_items FOR ALL TO authenticated
  USING (public.is_admin_or_editor())
  WITH CHECK (public.is_admin_or_editor());
