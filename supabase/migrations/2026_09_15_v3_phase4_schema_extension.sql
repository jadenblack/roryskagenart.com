-- v3.0.0 Phase 4 — the additive schema extension (step 2 of the load)
--
-- WHY THIS FILE EXISTS
-- `supabase/staged/2026_09_15_v3_wayback_backfill.sql` cannot run without it: the backfill writes
-- `artworks.kind`, `artworks.source_site`, `artworks.source_url_path` and
-- `artworks.source_archive_path`, and none of those columns exist. This is the G1/G2/G3 gap list
-- from Phase 3, plus the two owner decisions that were gated on it:
--
--   D3 / Q16  Adopt the `artwork_images` join. `media_assets.artwork_slug` is already 1:N, but
--             `generate-asset-registry.ts` indexes the registry by `artwork_slug` FIRST-WINS, so
--             only the lowest `public_id` is reachable by slug and a mural's images 2..N are
--             invisible even though their rows and objects exist (R-18). 38 of 63 recovered mural
--             artworks are multi-image, max 21. The join makes "which image is the cover"
--             answerable — `position = 0` — which is what the gallery needs regardless.
--   D5 / Q6   `taxonomies.type = 'project_type'` for the 8 project types, with `Featured` / `Home`
--             as `curation` flags. The existing CHECK only allows series/tag/medium/location, so
--             the 144 `artwork_terms` rows of step 4 cannot be filed without widening it.
--
-- EVERYTHING HERE IS ADDITIVE. No column is dropped, no type is narrowed, no existing row is
-- rewritten. The two `DROP CONSTRAINT` statements are the idempotency idiom for a CHECK whose
-- definition must change — they are immediately followed by the replacement, in this file.
--
-- IDEMPOTENT BY CONSTRUCTION: `IF NOT EXISTS` on every column, table and index; `DROP … IF EXISTS`
-- before every `CREATE`. Re-running this file must mutate nothing.
-- `src/test/migrationSafety.test.ts` enforces each of those guards.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. artworks — the kind discriminator and the source provenance (G1/G2/G3)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `kind` is what separates the two bodies of work the merge brings together. It is nullable and
-- carries no default on purpose: NULL means "not yet classified", which is the honest state for the
-- 138 pre-existing fine-art rows until a migration says otherwise. A `NOT NULL DEFAULT 'painting'`
-- would silently stamp every mural loaded through a path that forgot to set it.
ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS kind text;

-- Where the row came from. Provenance is not decoration here: it is what makes the merge
-- auditable, and it is the only way to answer "which archive produced this row?" after the fact.
ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS source_site text;

ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS source_url_path text;

ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS source_archive_path text;

-- The three values the backfill actually emits. `other` exists so an unclassifiable archive record
-- has somewhere honest to land rather than being forced into `painting` or `mural`.
ALTER TABLE public.artworks
  DROP CONSTRAINT IF EXISTS artworks_kind_check;

ALTER TABLE public.artworks
  ADD CONSTRAINT artworks_kind_check
  CHECK (kind IS NULL OR kind IN ('painting', 'mural', 'other'));

-- The gallery splits the two bodies of work, so this is a real query path, not a speculative index.
CREATE INDEX IF NOT EXISTS idx_artworks_kind
  ON public.artworks (kind);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. taxonomies — widen the type vocabulary (D5 / Q6)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The recovered WordPress export carries 10 categories across the 62 mural posts. Eight of them
-- (`interior`, `business`, `exterior`, `restaurant`, `event`, `retail`, `signage`, `museum`)
-- describe *what the work is*; two (`featured`, `home`) describe *where it is shown*. Filing a
-- mural under both `interior` and `featured` as the same kind of thing would put it in two
-- contradictory buckets, so they get two dimensions.
--
-- Widening a CHECK is the one place in this file where a constraint is dropped. `DROP … IF EXISTS`
-- immediately followed by the replacement keeps the file re-runnable, and the new list is a strict
-- superset of the old one — no existing row can violate it.
ALTER TABLE public.taxonomies
  DROP CONSTRAINT IF EXISTS taxonomies_type_check;

ALTER TABLE public.taxonomies
  ADD CONSTRAINT taxonomies_type_check
  CHECK (type = ANY (ARRAY['series', 'tag', 'medium', 'location', 'project_type', 'curation']));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. artwork_images — the ordered join (D3 / Q16)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Keyed on `(artwork_slug, media_public_id)` rather than on surrogate ids because those are the
-- two identifiers the media pipeline already speaks: the render manifest carries `artworkSlug` and
-- `publicId`, and `media_assets.public_id` is UNIQUE NOT NULL. A surrogate key would add a lookup
-- on both sides of every write for no gain.
--
-- ⚠️ `position` is the whole point of the table. The registry generator's first-wins behaviour
--    becomes "the row at position 0 is the cover", which is deterministic and reviewable instead of
--    depending on which `public_id` happened to sort first.
--
-- ⚠️ `artwork_slug` REFERENCES `artworks(slug)` — note that `artworks.slug` is UNIQUE but is NOT the
--    primary key, which is legal for an FK target. `ON UPDATE CASCADE` is load-bearing: the studio
--    can rename a slug, and the join rows must follow rather than block the rename. This is
--    deliberately *stricter* than `media_assets.artwork_slug`, which carries no FK at all and
--    therefore cannot be trusted to name a real artwork.
CREATE TABLE IF NOT EXISTS public.artwork_images (
  artwork_slug    text        NOT NULL,
  media_public_id text        NOT NULL,
  position        integer     NOT NULL DEFAULT 0,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT artwork_images_pkey PRIMARY KEY (artwork_slug, media_public_id),
  CONSTRAINT artwork_images_position_check CHECK (position >= 0),
  CONSTRAINT artwork_images_artwork_slug_fkey
    FOREIGN KEY (artwork_slug) REFERENCES public.artworks (slug)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT artwork_images_media_public_id_fkey
    FOREIGN KEY (media_public_id) REFERENCES public.media_assets (public_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- The read path: "every image of this artwork, in order".
CREATE INDEX IF NOT EXISTS artwork_images_artwork_position_idx
  ON public.artwork_images (artwork_slug, position);

-- The reverse: "which artworks use this image" (also what the FK needs to stay cheap).
CREATE INDEX IF NOT EXISTS artwork_images_media_idx
  ON public.artwork_images (media_public_id);

-- RLS is not optional here — `src/test/migrationSafety.test.ts` fails any table that a migration
-- creates without enabling it, and a table readable by the anon key with no policy is exactly the
-- R-05/R-06 class of defect the project has already paid for twice.
ALTER TABLE public.artwork_images ENABLE ROW LEVEL SECURITY;

-- Public read: the gallery must be able to resolve a mural's images 2..N for an anonymous visitor.
-- `TO public USING (true)` is the intended posture for published catalog content and matches
-- `artwork_terms`, `taxonomies` and `media_assets`.
DROP POLICY IF EXISTS "Public read artwork_images" ON public.artwork_images;
CREATE POLICY "Public read artwork_images"
  ON public.artwork_images
  FOR SELECT
  TO public
  USING (true);

-- Write is staff-only, through the definer helper — never a bare predicate, never `USING (true)`
-- for the `authenticated` role (the v2.12.1 regression guard).
DROP POLICY IF EXISTS "Admins manage artwork_images" ON public.artwork_images;
CREATE POLICY "Admins manage artwork_images"
  ON public.artwork_images
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_editor())
  WITH CHECK (public.is_admin_or_editor());
