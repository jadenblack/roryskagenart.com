-- v2.9 Security Hardening: Enable RLS and define policies for taxonomies, artwork_terms, and settings
-- Safe to re-run idempotently.

-- 1. Enable Row Level Security
ALTER TABLE public.taxonomies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artwork_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any
DROP POLICY IF EXISTS "Public read taxonomies" ON public.taxonomies;
DROP POLICY IF EXISTS "Public read artwork_terms" ON public.artwork_terms;
DROP POLICY IF EXISTS "Public read settings" ON public.settings;
DROP POLICY IF EXISTS "Admins manage taxonomies" ON public.taxonomies;
DROP POLICY IF EXISTS "Admins manage artwork_terms" ON public.artwork_terms;
DROP POLICY IF EXISTS "Admins manage settings" ON public.settings;

-- 3. Public Read Policies (Allow public visitors to read catalog series, tags, terms, and public settings)
CREATE POLICY "Public read taxonomies"
  ON public.taxonomies FOR SELECT
  USING (true);

CREATE POLICY "Public read artwork_terms"
  ON public.artwork_terms FOR SELECT
  USING (true);

CREATE POLICY "Public read settings"
  ON public.settings FOR SELECT
  USING (true);

-- 4. Admin / Editor Mutation Policies (Authenticated studio members only)
CREATE POLICY "Admins manage taxonomies"
  ON public.taxonomies FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Admins manage artwork_terms"
  ON public.artwork_terms FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Admins manage settings"
  ON public.settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
