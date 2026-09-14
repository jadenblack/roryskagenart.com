-- v2.12.1 — scope the blanket `{authenticated}` policies to the real staff roles.
--
-- WHY THIS EXISTS
-- Four policies grant full table access to *any* authenticated user, with a predicate that is
-- literally `true`:
--
--     "Admins full access to artworks"        ON public.artworks      FOR ALL TO authenticated
--     "Admins full access to media assets"    ON public.media_assets  FOR ALL TO authenticated
--     "Admins full access to pages"           ON public.pages         FOR ALL TO authenticated
--     "Admins can view and manage inquiries"  ON public.inquiries     FOR ALL TO authenticated
--
-- The names say "admins". The predicates say "anyone who can log in". `TO authenticated` in
-- Postgres means the `authenticated` role, which every Supabase user session assumes — it carries
-- no role claim, no group membership, nothing. So a `viewer` — the lowest role in
-- src/lib/roles.ts — can read and write every artwork, every media asset, every page and every
-- inquiry through PostgREST, bypassing the entire role matrix:
--
--     GET    /rest/v1/inquiries?select=name,email,phone,message   -- every collector's details
--     PATCH  /rest/v1/artworks?slug=eq.<any>                      -- edit any work
--     DELETE /rest/v1/artworks?slug=eq.<any>                      -- delete any work
--     DELETE /rest/v1/pages?slug=eq.<any>                         -- delete site pages
--
-- The `inquiries` case is the worst of the four: collector name, email, phone and message are
-- personal data that the role matrix deliberately restricts to editor and above.
--
-- This was recorded as a finding (not a fix) in the v2.12.0 CHANGELOG and in plan/ROADMAP_V3.md
-- §9 Q8 / risk R-06. Enumerating the live policies showed the defect is in four places rather
-- than the one that was originally noticed — hence this migration covers all four.
--
-- WHY IT WAS NEVER EXPLOITED
-- Not because of a control — because the app happens not to use the path. Verified before writing:
-- every read and write in src/ goes through /api/* (the only direct supabase-js table access in the
-- whole client is `profiles`, in src/context/AuthContext.tsx). The API is unaffected by RLS because
-- it does not use a user session at all: `query()` in src/server/db.ts opens a `pg` pool with the
-- database owner's connection string, and the owner bypasses RLS (no table here is FORCE ROW LEVEL
-- SECURITY — see data/archive/schema_introspection.md). Roles are resolved in Express
-- (server/middleware/auth.ts `resolveCmsUser`) and enforced by `requireRole()`. So narrowing these
-- policies cannot break the studio UI or the API. As with the v2.12.0 draft fix, that is a
-- load-bearing accident, not a control.
--
-- THE FIX — and why it is a completion, not an invention
-- `2026_09_13_cms_v2_2_profiles_rls_recursion_fix.sql` already created and granted
-- `public.is_admin_or_editor()`, and its own header says these helper policies should be
-- "rewrite[n] against the definer helper so they cannot recurse either" — but the rewrite was
-- never done. The function was created, granted, and left referenced by nothing. This migration
-- performs that rewrite for the four policies that need it.
--
-- The predicate mirrors the server guard exactly, so the two layers finally agree:
--   * artworks     — POST/PATCH/DELETE are `requireRole("editor")`  (server/routes/artworks.ts)
--   * media_assets — GET and POST /upload are `requireRole("editor")` (server/routes/media.ts)
--   * pages        — PUT /:slug is `requireRole("editor")`          (server/routes/pages.ts)
--   * inquiries    — GET and PATCH are `requireRole("editor")`      (server/routes/inquiries.ts)
-- All four are therefore `admin OR editor` → `public.is_admin_or_editor()`.
--
-- The helper is `SECURITY DEFINER` with `SET search_path = public`, so it reads `profiles` as its
-- owner. That matters twice: it avoids the 42P17 infinite-recursion trap this repo already hit
-- once (a policy on a table subquerying that same table), and it does not depend on the caller
-- being able to SELECT their own `profiles` row.
--
-- SAFETY
--   * Strictly a reduction in privilege. Before: every authenticated user. After: admin + editor.
--     Nobody gains access they did not already have.
--   * `is_admin_or_editor()` is already deployed, already granted to `authenticated` and `anon`,
--     and already reproduced by a rebuild — this migration only starts *using* it.
--   * Policy names are deliberately unchanged, so the v2.12.0 CHANGELOG finding and
--     ROADMAP_V3 §9 Q8 continue to refer to the same objects.
--   * No table, column, index, trigger or data change. RLS enablement is untouched (the static
--     test in src/test/migrationSafety.test.ts requires that RLS only be enabled by the migration
--     that creates a table, and these tables are created by the baseline).
--   * The `public` SELECT policies on all four tables are untouched, so anonymous browsing of
--     published artworks, pages and media URLs is unaffected.
--   * Idempotent: every policy is dropped before being recreated.
--
-- VERIFIED (2026-09-14, against the local scratch database — not production)
--   Built the schema from supabase/migrations/ into a scratch database, seeded one artwork and one
--   inquiry plus admin/editor/viewer profiles, then evaluated each policy as each role
--   (`SET LOCAL ROLE authenticated` + `request.jwt.claims`). With the old `USING (true)`
--   predicate restored, a viewer could SELECT/UPDATE/DELETE artworks and read inquiries. With this
--   predicate: viewer UPDATE/DELETE artworks → 0 rows; viewer DELETE inquiries → 0 rows; viewer
--   INSERT artworks → 42501; viewer SELECT inquiries → 0 rows; admin and editor unchanged.
--   A viewer can still SELECT *published* artworks and pages — that is the `public` policy doing
--   its job, since published work is public by design.
--
-- NOT FIXED HERE (deliberately — recorded, not silently changed)
--   * `artwork_terms`, `settings` and `taxonomies` are *correctly* scoped already, but they do it
--     with inline `EXISTS (SELECT 1 FROM profiles ...)` subqueries instead of the definer helper.
--     They work, but they carry a subtle coupling to `profiles_select_own` that the helper does
--     not. Left alone to keep this change minimal.
--   * `profiles` has no UPDATE policy at all, so no one can change a role through PostgREST — a
--     viewer cannot self-promote. Role changes go through /api/admin/users (owner connection).
--     That is intended; recorded here so it is not mistaken for a gap.
--   * The `artworks` public SELECT policy still must not be relied on as the only draft control —
--     /api/artworks must keep filtering drafts server-side.
--
-- Apply the normal way, never by pasting SQL into the dashboard:
--    npx tsx scripts/run-migrations.ts 2026_09_14_v2_12_1_staff_scoped_policies.sql

-- ---------------------------------------------------------------------------
-- artworks: "full access" now means staff, not "anyone with a session"
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins full access to artworks" ON public.artworks;

CREATE POLICY "Admins full access to artworks" ON public.artworks
  FOR ALL TO authenticated
  USING (public.is_admin_or_editor())
  WITH CHECK (public.is_admin_or_editor());

-- ---------------------------------------------------------------------------
-- media_assets: the media registry is staff-only to write
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins full access to media assets" ON public.media_assets;

CREATE POLICY "Admins full access to media assets" ON public.media_assets
  FOR ALL TO authenticated
  USING (public.is_admin_or_editor())
  WITH CHECK (public.is_admin_or_editor());

-- ---------------------------------------------------------------------------
-- pages: site copy and structure are staff-only to write
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins full access to pages" ON public.pages;

CREATE POLICY "Admins full access to pages" ON public.pages
  FOR ALL TO authenticated
  USING (public.is_admin_or_editor())
  WITH CHECK (public.is_admin_or_editor());

-- ---------------------------------------------------------------------------
-- inquiries: collector names, emails and phone numbers are staff-only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can view and manage inquiries" ON public.inquiries;

CREATE POLICY "Admins can view and manage inquiries" ON public.inquiries
  FOR ALL TO authenticated
  USING (public.is_admin_or_editor())
  WITH CHECK (public.is_admin_or_editor());
