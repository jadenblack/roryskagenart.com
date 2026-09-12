-- CMS v1.1 — Replace numeric artwork slugs with title-derived slugs
--
-- The bulk import assigned every artwork its import index as slug ("0".."136").
-- The admin dashboard and public site address artworks by title-derived slug
-- (e.g. /api/artworks/gianondor), so every mutating call 404'd.
--
-- This migration:
--   1. Rewrites each numeric slug to slugify(title), de-conflicting with a
--      numeric suffix when needed.
--   2. Remaps media_assets.artwork_slug references that pointed at old
--      numeric slugs via matching title.
--   3. Best-effort NULLs any dangling references (artwork deleted earlier).
--
-- Idempotent: re-running finds no numeric slugs and does nothing.

-- 1. Slugify numeric-slug artworks (loop until none remain; handles any
--    duplicate-title collisions deterministically via -2, -3, … suffixes)
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INTEGER;
BEGIN
  FOR r IN
    SELECT id, title FROM public.artworks WHERE slug ~ '^[0-9]+$' ORDER BY CAST(slug AS INTEGER) ASC
  LOOP
    base := lower(regexp_replace(r.title, '[^a-zA-Z0-9]+', '-', 'g'));
    base := trim(both '-' from base);
    IF base IS NULL OR base = '' THEN
      base := 'artwork-' || r.id::text;
    END IF;

    candidate := base;
    n := 2;
    WHILE EXISTS (SELECT 1 FROM public.artworks WHERE slug = candidate AND id <> r.id) LOOP
      candidate := base || '-' || n;
      n := n + 1;
    END LOOP;

    UPDATE public.artworks SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 2. media_assets.artwork_slug remap: old numeric slug -> new slug, matched
--    through the media row's own public_id/title relationship where possible.
--    The migration ran when the mapping table still held "slug = old numeric";
--    match via the artwork that HAD that numeric slug before step 1 is not
--    possible post-hoc, so we match on the media public_id embedded title.
UPDATE public.media_assets m
SET artwork_slug = a.slug
FROM public.artworks a
WHERE m.artwork_slug ~ '^[0-9]+$'
  AND (
    lower(regexp_replace(a.title, '[^a-zA-Z0-9]+', '-', 'g')) = lower(m.public_id)
    OR m.public_id ILIKE a.slug || '%'
    OR (a.title ILIKE '%78704%' AND m.public_id ILIKE '%78704%')
  );

-- 3. Null out remaining dangling numeric references (artwork no longer exists)
UPDATE public.media_assets
SET artwork_slug = NULL
WHERE artwork_slug ~ '^[0-9]+$';

-- Guard against future regressions: artworks.slug must never be purely numeric
-- (checked on insert/update; raises a clear error instead of a silent 404 later)
CREATE OR REPLACE FUNCTION public.artworks_slug_not_numeric()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug ~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'artworks.slug must not be purely numeric (got "%")', NEW.slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_artworks_slug_guard ON public.artworks;
CREATE TRIGGER trg_artworks_slug_guard
  BEFORE INSERT OR UPDATE OF slug ON public.artworks
  FOR EACH ROW EXECUTE FUNCTION public.artworks_slug_not_numeric();
