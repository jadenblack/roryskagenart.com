-- CMS v2.1 — Artwork drafts (PRD §4 Phase 3)
--
-- Adds publishing-state to the catalog: a draft is work-in-progress that must
-- never render on the public site until explicitly published.
--
-- Design:
--   * `draft BOOLEAN NOT NULL DEFAULT false` — additive, no existing rows change.
--   * Partial indexes keep the two hot queries fast: anonymous API reads scan
--     only published rows; the admin catalog scans drafts cheaply.
--   * A guard trigger enforces the core invariant AT THE DATABASE: a draft can
--     never also be enabled for public display (draft forces enabled = false).
--     Even a buggy client or raw SQL UPDATE cannot leak a draft publicly.
--
-- Idempotent: guarded by IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.

ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS draft BOOLEAN NOT NULL DEFAULT false;

-- Anonymous listing reads filter draft = false; admin draft view scans draft = true.
CREATE INDEX IF NOT EXISTS idx_artworks_published
  ON public.artworks (updated_at DESC)
  WHERE draft = false AND trashed = false;

CREATE INDEX IF NOT EXISTS idx_artworks_drafts
  ON public.artworks (updated_at DESC)
  WHERE draft = true;

-- Invariant: a draft is never publicly enabled, regardless of what the
-- client sends. Publishing a draft re-enables it only when the caller also
-- flips draft = false (server does this atomically in the PATCH contract).
CREATE OR REPLACE FUNCTION public.artworks_draft_forces_disabled()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.draft IS TRUE AND NEW.enabled IS TRUE THEN
    NEW.enabled := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_artworks_draft_guard ON public.artworks;
CREATE TRIGGER trg_artworks_draft_guard
  BEFORE INSERT OR UPDATE OF draft, enabled ON public.artworks
  FOR EACH ROW EXECUTE FUNCTION public.artworks_draft_forces_disabled();
