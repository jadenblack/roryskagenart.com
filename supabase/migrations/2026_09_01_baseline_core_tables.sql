-- Baseline schema for the four core domain tables.
--
-- WHY THIS EXISTS
-- These tables (artworks, media_assets, pages, inquiries) were created directly in the
-- Supabase project and were never captured by any migration in this repo — every other
-- migration only ALTERs or references them. That made the database impossible to
-- reproduce from version control: run-migrations.ts would fail on a fresh project at the
-- first `ALTER TABLE public.artworks`. See docs/adr/0001.
--
-- This migration is derived from a live introspection of the production database
-- (scripts/introspect-schema.ts -> data/archive/schema_introspection.md, 2026-09-14,
-- PostgreSQL 17.6). It is deliberately `IF NOT EXISTS` / `DROP POLICY IF EXISTS`
-- throughout, so it is a no-op on the existing database and only takes effect when
-- building a fresh one.
--
-- FILENAME ORDERING MATTERS: run-migrations.ts applies files in filename sort order, so
-- this is dated 2026_09_01 to sort BEFORE the 2026_09_12+ migrations that ALTER these
-- tables.
--
-- SCOPE: tables, constraints, indexes, RLS enablement, and policies for the four core
-- tables. Functions/triggers for these tables are already created by the existing
-- migrations and are intentionally not duplicated here.

-- ---------------------------------------------------------------------------
-- artworks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artworks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  year          text,
  medium        text,
  dimensions    text,
  price         text,
  status        text DEFAULT 'Available'::text,
  gallery_series text,
  edition       text,
  location      text,
  image_url     text,
  hero_slider   boolean DEFAULT false,
  enabled       boolean DEFAULT true,
  archived      boolean DEFAULT false,
  trashed       boolean DEFAULT false,
  trashed_at    timestamptz,
  narrative     text,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  draft         boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_artworks_slug      ON public.artworks (slug);
CREATE INDEX IF NOT EXISTS idx_artworks_status    ON public.artworks (status);
CREATE INDEX IF NOT EXISTS idx_artworks_series    ON public.artworks (gallery_series);
CREATE INDEX IF NOT EXISTS idx_artworks_hero      ON public.artworks (hero_slider);
CREATE INDEX IF NOT EXISTS idx_artworks_published ON public.artworks (updated_at DESC)
  WHERE draft = false AND trashed = false;
CREATE INDEX IF NOT EXISTS idx_artworks_drafts    ON public.artworks (updated_at DESC)
  WHERE draft = true;

-- ---------------------------------------------------------------------------
-- media_assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id     text NOT NULL UNIQUE,
  url           text NOT NULL,
  thumbnail_url text,
  format        text,
  bytes         bigint,
  width         integer,
  height        integer,
  folder        text,
  artwork_slug  text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  lqip          text,
  renditions    jsonb
);

CREATE INDEX IF NOT EXISTS media_assets_artwork_slug_idx
  ON public.media_assets (artwork_slug) WHERE artwork_slug IS NOT NULL;

-- ---------------------------------------------------------------------------
-- pages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pages (
  slug       text PRIMARY KEY,
  title      text NOT NULL,
  content    text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- inquiries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inquiries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL,
  phone         text,
  artwork_slug  text,
  artwork_title text,
  inquiry_type  text DEFAULT 'General Inquiry'::text,
  message       text NOT NULL,
  status        text DEFAULT 'new'::text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_email   ON public.inquiries (email);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON public.inquiries (created_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Without these, a fresh database built from the repo would have RLS *disabled* on
-- these tables — i.e. fully world-readable through PostgREST with the public anon key.
-- ---------------------------------------------------------------------------
ALTER TABLE public.artworks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries    ENABLE ROW LEVEL SECURITY;

-- artworks -------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active artworks"   ON public.artworks;
DROP POLICY IF EXISTS "Admins full access to artworks"    ON public.artworks;
DROP POLICY IF EXISTS "Service role full access to artworks" ON public.artworks;

CREATE POLICY "Public can view active artworks" ON public.artworks
  FOR SELECT TO public
  USING (trashed = false);

CREATE POLICY "Admins full access to artworks" ON public.artworks
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to artworks" ON public.artworks
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- media_assets ---------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view media assets"      ON public.media_assets;
DROP POLICY IF EXISTS "Admins full access to media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Service role full access to media assets" ON public.media_assets;

CREATE POLICY "Public can view media assets" ON public.media_assets
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins full access to media assets" ON public.media_assets
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to media assets" ON public.media_assets
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- pages ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view pages"      ON public.pages;
DROP POLICY IF EXISTS "Admins full access to pages" ON public.pages;
DROP POLICY IF EXISTS "Service role full access to pages" ON public.pages;

CREATE POLICY "Public can view pages" ON public.pages
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins full access to pages" ON public.pages
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to pages" ON public.pages
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- inquiries ------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can submit inquiries"           ON public.inquiries;
DROP POLICY IF EXISTS "Admins can view and manage inquiries"  ON public.inquiries;
DROP POLICY IF EXISTS "Service role full access to inquiries" ON public.inquiries;

CREATE POLICY "Public can submit inquiries" ON public.inquiries
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Admins can view and manage inquiries" ON public.inquiries
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to inquiries" ON public.inquiries
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
