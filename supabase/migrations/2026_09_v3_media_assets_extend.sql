-- PRD_V3_CLOUDINARY_EXIT.md — Stage v3.1
-- Extends public.media_assets into the authoritative media registry:
--   lqip        : tiny base64 blur-up placeholder (data URI)
--   renditions  : jsonb map of rendition name -> { path, width, height, bytes }
--   updated_at  : maintained by trigger for idempotent upserts
-- Safe to run multiple times (all statements are IF NOT EXISTS / OR REPLACE).

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS lqip text;

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS renditions jsonb;

-- Index for artwork-linkage lookups used by the asset registry generator (v3.2)
CREATE INDEX IF NOT EXISTS media_assets_artwork_slug_idx
  ON public.media_assets (artwork_slug)
  WHERE artwork_slug IS NOT NULL;

-- Keep updated_at authoritative on every write (the migration script upserts
-- explicitly, but direct SQL edits should behave the same way)
CREATE OR REPLACE FUNCTION public.media_assets_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_assets_touch ON public.media_assets;
CREATE TRIGGER trg_media_assets_touch
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.media_assets_touch_updated_at();
