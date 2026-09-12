-- CMS v1 — Taxonomies & site settings
-- 1. taxonomies: controlled vocabularies (series, tags) with sort order.
-- 2. artwork_terms: many-to-many artwork <-> term links.
-- 3. settings: JSONB key/value store for site configuration.
-- Backfills gallery_series into the 'series' taxonomy.
-- Safe to run multiple times.

-- ---------------------------------------------------------------
-- 1. Taxonomies
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.taxonomies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'series'
    CHECK (type IN ('series', 'tag', 'medium', 'location')),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, slug)
);

CREATE INDEX IF NOT EXISTS taxonomies_type_sort_idx
  ON public.taxonomies (type, sort_order);

-- ---------------------------------------------------------------
-- 2. Artwork <-> term join
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artwork_terms (
  artwork_id UUID NOT NULL REFERENCES public.artworks (id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES public.taxonomies (id) ON DELETE CASCADE,
  PRIMARY KEY (artwork_id, term_id)
);

CREATE INDEX IF NOT EXISTS artwork_terms_term_idx ON public.artwork_terms (term_id);

-- ---------------------------------------------------------------
-- 3. Settings key/value store
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------
-- Backfill: normalize existing gallery_series values into terms
-- ---------------------------------------------------------------
INSERT INTO public.taxonomies (type, slug, name, sort_order)
SELECT
  'series',
  lower(regexp_replace(gallery_series, '[^a-zA-Z0-9]+', '-', 'g')),
  gallery_series,
  row_number() OVER (ORDER BY gallery_series)
FROM (
  SELECT DISTINCT gallery_series
  FROM public.artworks
  WHERE gallery_series IS NOT NULL AND gallery_series <> ''
) s
ON CONFLICT (type, slug) DO NOTHING;

-- ---------------------------------------------------------------
-- Default settings (ignored if already present)
-- ---------------------------------------------------------------
INSERT INTO public.settings (key, value) VALUES
  ('site', '{"title":"Rory Skagen Art","tagline":"Austin, Texas • Est. 1985","contact_email":"studio@roryskagenart.com"}'::jsonb),
  ('inquiries', '{"notify_email":"studio@roryskagenart.com","auto_confirm":true}'::jsonb),
  ('hero', '{"excerpt_enabled":true,"auto_advance_seconds":6}'::jsonb)
ON CONFLICT (key) DO NOTHING;
