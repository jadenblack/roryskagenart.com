-- v2.12.0 — the `artworks` public SELECT policy must not expose drafts.
--
-- WHY THIS EXISTS
-- The baseline migration created the public read policy as:
--
--     CREATE POLICY "Public can view active artworks" ON public.artworks
--       FOR SELECT TO public
--       USING (trashed = false);
--
-- which filters trashed rows but NOT drafts. Any holder of the anon key can therefore read
-- unpublished rows straight from PostgREST:
--
--     GET /rest/v1/artworks?select=slug,title,narrative&draft=eq.true
--
-- It has not been exploitable so far only because the client never reads `artworks` directly —
-- every read goes through GET /api/artworks, which filters drafts server-side for anonymous
-- callers (server/routes/artworks.ts). That is a load-bearing accident, not a control.
--
-- It was recorded as a "tracked follow-up" in v2.10.0 and v2.11.0. The v3 mural merge promotes
-- it to a hard prerequisite: that migration loads on the order of a hundred unpublished mural
-- drafts, which turns a theoretical leak into a material one (see plan/ROADMAP_V3.md, risk R-05).
--
-- SAFETY — WHY THIS IS SAFE FOR THE APP
-- Verified before writing: the only direct supabase-js table read in src/ is `profiles`
-- (src/context/AuthContext.tsx). All artwork I/O goes through /api/artworks, which runs on the
-- server's own connection and is unaffected by RLS. So narrowing this policy cannot break the
-- studio UI. The server-side draft filter must still never be removed.
--
-- ⚠️ DO NOT APPLY THIS MIGRATION until plan/ROADMAP_V3.md Phase 0 is satisfied — specifically:
--    * the Supabase plan tier is confirmed (it is Free, so there are NO platform backups), and
--    * scripts/restore-catalog.ts has been exercised against a non-production database.
-- Apply it the normal way, never by pasting SQL into the dashboard:
--    npx tsx scripts/run-migrations.ts 2026_09_14_v2_12_artworks_public_select_excludes_drafts.sql
--
-- NOT FIXED HERE (deliberately — needs an owner decision, see ROADMAP_V3 §9 Q8 / risk R-06):
-- the sibling policy `"Admins full access to artworks"` is declared `FOR ALL TO authenticated
-- USING (true) WITH CHECK (true)`. The name says admins; the predicate says *any authenticated
-- user*, so a `viewer` can read and write every artwork through PostgREST, bypassing the role
-- matrix in src/lib/roles.ts entirely. Scoping that policy to the real role claim is a separate,
-- larger change and is not bundled here.

-- ---------------------------------------------------------------------------
-- artworks: exclude drafts from the anonymous read path
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public can view active artworks" ON public.artworks;

CREATE POLICY "Public can view active artworks" ON public.artworks
  FOR SELECT TO public
  USING (trashed = false AND draft = false);
