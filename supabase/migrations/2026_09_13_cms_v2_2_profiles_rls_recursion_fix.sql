-- CMS v2.2 — profiles RLS infinite-recursion fix
--
-- Bug: "profiles_select_admin" subqueried public.profiles from inside a
-- policy ON public.profiles. Postgres detects the self-reference and aborts
-- every evaluation of the SELECT policies with 42P17 ("infinite recursion
-- detected in policy"), which PostgREST surfaces as HTTP 500. The client
-- AuthContext profile lookup (GET /rest/v1/profiles?select=role,full_name)
-- therefore failed on every session refresh.
--
-- Fix: move the admin check into a SECURITY DEFINER function. The function
-- runs as its owner (bypassing RLS on profiles), so policies can consult it
-- without recursing. Idempotent: safe to run multiple times.

-- 1. Helper: is the current user an admin? (bypasses RLS via definer)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

-- 2. Replace the recursive SELECT policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- 3. Same de-recursion for the v2.9 admin/editor helper policies elsewhere
--    (they reference profiles inside their own table's policies — rewrite
--    them against the definer helper so they cannot recurse either).
--    is_admin_or_editor(): admin OR editor, RLS-free read.
CREATE OR REPLACE FUNCTION public.is_admin_or_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_editor() TO authenticated, anon;
