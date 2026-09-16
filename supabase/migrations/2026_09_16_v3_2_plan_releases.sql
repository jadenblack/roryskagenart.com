-- ─────────────────────────────────────────────────────────────────────────────
-- v3.2.0 — Group: releases become first-class
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `v3.1.0` grouped the board by a free-text label (`plan_items.target_release`). This migration
-- introduces `public.plan_releases` and a real foreign key from the item to it, then backfills that
-- key from the labels already present.
--
-- ⚠️ `plan_items.target_release` is KEPT, not dropped. Dropping a column in the same migration that
-- introduces its replacement removes the only way to audit the backfill afterwards: with both
-- present, a reviewer can diff `target_release` against `plan_releases.version` and see every
-- mismatch, which is exactly the failure this backfill is most likely to have. It is scheduled for
-- removal no earlier than the release AFTER this one, and only once that diff has been run.
--
-- ⚠️ The backfill promotes every distinct non-empty label to a release row — including values that
-- are not versions at all (`backlog`, `someday`). That is intended, not a bug: `target_release` was
-- free text, the studio typed those values, and dropping them would silently ungroup real items.
-- `status` is left `planned` for all of them; promoting a row to `shipped` is a deliberate staff
-- action in the releases view, never something a backfill guesses.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_releases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The join key to history. `releaseLog` is keyed by version string, so a release row meets the
  -- CHANGELOG section that shares its version — D1 keeps that a *join*, never a merge.
  version     text NOT NULL UNIQUE,

  title       text,

  status      text NOT NULL DEFAULT 'planned',

  -- `target_date` is what the studio hopes; `shipped_at` is what actually happened. Both are
  -- nullable because a release exists before either is known, and conflating them would make
  -- "was it late?" unanswerable.
  target_date date,
  shipped_at  timestamptz,

  notes       text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT plan_releases_status_check
    CHECK (status IN ('planned', 'in_progress', 'shipped', 'cancelled'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. updated_at, maintained by the database rather than by each caller
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.plan_releases_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_releases_touch ON public.plan_releases;
CREATE TRIGGER trg_plan_releases_touch
  BEFORE UPDATE ON public.plan_releases
  FOR EACH ROW EXECUTE FUNCTION public.plan_releases_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. The foreign key on the item
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ON DELETE SET NULL, matching `plan_items.author_id`: deleting a release must orphan its items back
-- to "ungrouped", never delete the studio's thinking along with the label it was filed under.
ALTER TABLE public.plan_items
  ADD COLUMN IF NOT EXISTS release_id uuid REFERENCES public.plan_releases (id) ON DELETE SET NULL;

-- Grouping filters `IS NOT NULL`, so a partial index is both smaller and honest about intent.
CREATE INDEX IF NOT EXISTS plan_items_release_id_idx
  ON public.plan_items (release_id)
  WHERE release_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Backfill — two statements, both idempotent
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. Every distinct non-empty label becomes a release. `ON CONFLICT DO NOTHING` makes a re-run a
-- no-op, and `title` is left NULL rather than guessed from the version — a human names releases.
INSERT INTO public.plan_releases (version, title, status)
SELECT DISTINCT btrim(i.target_release), NULL, 'planned'
  FROM public.plan_items i
 WHERE i.target_release IS NOT NULL
   AND btrim(i.target_release) <> ''
ON CONFLICT (version) DO NOTHING;

-- 4b. Match items back by version. Skips rows that already carry a `release_id`, so re-running
-- after a staff member has re-filed an item by hand will not overwrite their choice.
UPDATE public.plan_items i
   SET release_id = r.id
  FROM public.plan_releases r
 WHERE i.release_id IS NULL
   AND i.target_release IS NOT NULL
   AND btrim(i.target_release) = r.version;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Row-level security — one policy, and no public read
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Same shape as `plan_items`: no `public` policy, and the authenticated predicate is the definer
-- helper rather than a bare `true`. `src/test/migrationSafety.test.ts` fails the build on either.
ALTER TABLE public.plan_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage plan_releases" ON public.plan_releases;
CREATE POLICY "Admins manage plan_releases"
  ON public.plan_releases FOR ALL TO authenticated
  USING (public.is_admin_or_editor())
  WITH CHECK (public.is_admin_or_editor());
