/**
 * PRD_V3_CLOUDINARY_EXIT.md — Stage v3.2.
 * Generates src/data/assetRegistry.ts from the public.media_assets table
 * (populated by scripts/migrate-cloudinary-to-supabase.ts in stage v3.1).
 *
 * The generated module is committed so the client bundle needs no network
 * fetch on cold start. Re-run after media changes:
 *   npx tsx scripts/generate-asset-registry.ts
 *
 * ⚠️ R-18 — THIS GENERATOR MUST NOT BE SILENTLY FIRST-WINS.
 *
 * Two things conspired here and both are now fixed:
 *
 *   1. **The cover was arbitrary.** Keys were built by iterating `media_assets`
 *      `ORDER BY public_id`, and the first row to claim an `artwork_slug` key won. So a mural's
 *      cover was "whichever of its images sorts first alphabetically", not the authored one.
 *      Since Phase 4 (D3/Q16) the authored order is explicit in `public.artwork_images.position`,
 *      so rows are now ordered by `position = 0` first and the cover is deterministic.
 *
 *   2. **A stolen key was invisible.** If a `public_id` equals some artwork's `artwork_slug`, one
 *      row takes the other's key and a live artwork renders somebody else's photograph with no
 *      error anywhere. `findRegistryCollisions()` guards the *write* of a new id, but nothing
 *      guarded *regeneration*. Now every key claimed by two different rows is reported, and the
 *      generator refuses to write while any exist — the committed registry cannot silently
 *      regress.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { resolvePoolTarget } from './lib/pgTarget';

dotenv.config();

interface RenditionMeta {
  path: string;
  width: number;
  height: number;
  bytes: number;
}

interface RegistryRow {
  public_id: string;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  lqip: string | null;
  renditions: Record<string, RenditionMeta> | null;
  artwork_slug: string | null;
  /** `0` when this row is the authored cover (`artwork_images.position = 0`); `1` otherwise. */
  cover_rank: number;
}

const SUPABASE_URL =
  process.env.VRCL_SUPA_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://orphcusijzkxpxkzapjp.supabase.co';

function getConnectionString(): string {
  const raw =
    process.env.VRCL_SUPA_POSTGRES_PRISMA_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING ||
    '';
  if (!raw) throw new Error('PostgreSQL connection string missing from environment.');
  return raw.replace(/\?.*$/, '');
}

function publicUrl(relPath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/artwork-images/${relPath}`;
}

interface BuiltEntry {
  publicId: string;
  artworkSlug: string | null;
  entry: {
    keys: string[];
    thumb: ReturnType<typeof rendition> | null;
    hero: ReturnType<typeof rendition> | null;
    full: ReturnType<typeof rendition> | null;
    lqip: string | null;
    srcWidth: number;
    srcHeight: number;
    artworkSlug: string | null;
  };
}

function rendition(
  rends: Record<string, RenditionMeta>,
  name: string
): { url: string; width: number; height: number; bytes: number } | null {
  const m = rends[name];
  return m ? { url: publicUrl(m.path), width: m.width, height: m.height, bytes: m.bytes } : null;
}

async function main(): Promise<void> {
  // Loopback targets (the local scratch database on 127.0.0.1:54322) get no TLS — the SSL rule
  // lives in scripts/lib/pgTarget.ts. Remote behaviour is unchanged.
  const poolTarget = resolvePoolTarget(getConnectionString());
  const pool = new Pool({
    connectionString: poolTarget.connectionString,
    ssl: poolTarget.ssl,
  });

  // `cover_rank` first, then `public_id`: the cover of each artwork therefore claims that
  // artwork's `artwork_slug` key before its siblings do, which is what makes the gallery's
  // fallback image the authored one (R-18). The LEFT JOIN yields rank 1 for unlinked rows
  // (`artwork_slug IS NULL`), so an orphan can never become an artwork's cover.
  const { rows } = await pool.query<RegistryRow>(
    `SELECT m.public_id, m.url, m.thumbnail_url, m.width, m.height, m.lqip, m.renditions,
            m.artwork_slug,
            CASE WHEN ai.position = 0 THEN 0 ELSE 1 END AS cover_rank
       FROM public.media_assets m
       LEFT JOIN public.artwork_images ai
              ON ai.media_public_id = m.public_id
             AND ai.artwork_slug = m.artwork_slug
      WHERE m.renditions IS NOT NULL
      ORDER BY cover_rank, m.public_id`
  );

  await pool.end();

  if (rows.length === 0) {
    throw new Error('media_assets has no rows with renditions — run stage v3.1 migration first.');
  }

  // slug -> entry map. Primary key is the artwork_slug when present, so the
  // resolver can look up by artwork slug directly; public_id kept as fallback key.
  const built: BuiltEntry[] = rows.map((r) => {
    const rends = (r.renditions ?? {}) as Record<string, RenditionMeta>;
    const keys = [r.public_id, ...(r.artwork_slug ? [r.artwork_slug] : [])];
    return {
      publicId: r.public_id,
      artworkSlug: r.artwork_slug,
      entry: {
        keys,
        thumb: rendition(rends, 'thumb'),
        hero: rendition(rends, 'hero'),
        full: rendition(rends, 'full'),
        lqip: r.lqip ?? null,
        srcWidth: r.width,
        srcHeight: r.height,
        artworkSlug: r.artwork_slug,
      },
    };
  });

  const keyToEntry = new Map<string, BuiltEntry['entry']>();
  const claimOwner = new Map<string, { built: BuiltEntry; via: string }>();
  const collisions: string[] = [];

  /**
   * Claim a key for a row.
   *
   * Three outcomes, and the middle one is the whole point of this function:
   *
   *   1. **Same row.** `public_id` and `artwork_slug` are frequently identical — the `public_id =
   *      slug` convention for single-image artworks — so a row routinely re-claims its own key.
   *      Benign.
   *   2. **Same artwork, different row.** Every image of a mural claims that mural's `artwork_slug`
   *      key; `cover_rank` ordering means the authored cover gets there first and the siblings lose.
   *      This is expected and correct — it is what the `artwork_images` join exists to express.
   *   3. **Different artwork.** Then one row has taken a key that belongs to another, and the loser
   *      becomes unreachable while the winner may render where it does not belong. This is R-18.
   *      Reported, and the generator refuses to write.
   */
  const claim = (key: string, b: BuiltEntry, via: string): void => {
    if (!key) return;
    const owner = claimOwner.get(key);
    if (!owner) {
      claimOwner.set(key, { built: b, via });
      keyToEntry.set(key, b.entry);
      return;
    }
    if (owner.built === b) return;
    // Siblings of one artwork — the cover wins by construction, not by accident.
    if (owner.built.artworkSlug !== null && owner.built.artworkSlug === b.artworkSlug) return;
    collisions.push(
      `${key} — kept ${owner.via} (public_id ${owner.built.publicId}); ` +
        `dropped ${via} (public_id ${b.publicId})`
    );
  };

  for (const b of built) {
    const claimAll = (raw: string, via: string) => {
      const norm = raw.toLowerCase();
      claim(norm, b, via);
      // Alias keys so slug-style lookups hit assets whose public_id uses
      // legacy filenames (e.g. artwork slug "greetings-from-austin" vs
      // public_id "GreetingsfromAustin"): normalized (alnum-only) forms and
      // dashed forms both resolve to the same entry.
      const alnum = norm.replace(/[^a-z0-9]/g, '');
      if (alnum) claim(alnum, b, `${via} [alnum]`);
      const dashed = norm.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (dashed) claim(dashed, b, `${via} [dashed]`);
    };
    claimAll(b.publicId, `public_id ${b.publicId}`);
    if (b.artworkSlug) claimAll(b.artworkSlug, `artwork_slug ${b.artworkSlug}`);
  }

  if (collisions.length) {
    console.error(`\nR-18 — ${collisions.length} registry key collision(s):\n`);
    for (const c of collisions.slice(0, 40)) console.error(`  ${c}`);
    if (collisions.length > 40) console.error(`  … and ${collisions.length - 40} more`);
    console.error('');
    throw new Error(
      'Refusing to write src/data/assetRegistry.ts — resolve the collisions above ' +
        '(rename the offending public_id). Non-empty means do not write.'
    );
  }

  const fileHeader = `/**
 * AUTO-GENERATED by scripts/generate-asset-registry.ts — do not edit by hand.
 * Source of truth: public.media_assets (Supabase), populated by stage v3.1
 * migration from Cloudinary. Re-generate after media changes:
 *   npx tsx scripts/generate-asset-registry.ts
 *
 * PRD_V3_CLOUDINARY_EXIT.md — Stage v3.2.
 * Keys: asset public_id (lowercase) and artwork_slug where linked. Where an
 * artwork has several images, its artwork_slug key resolves to the authored
 * cover (public.artwork_images.position = 0), not to whichever public_id
 * happens to sort first (R-18).
 * Supabase project: ${SUPABASE_URL}
 */

export interface AssetRendition {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export interface AssetRegistryEntry {
  keys: string[];
  thumb: AssetRendition | null;
  hero: AssetRendition | null;
  full: AssetRendition | null;
  /** Tiny webp data-URI for blur-up placeholders (null when absent). */
  lqip: string | null;
  srcWidth: number;
  srcHeight: number;
  artworkSlug: string | null;
}

`;

  const lines: string[] = [];
  lines.push(`export const ASSET_REGISTRY: Record<string, AssetRegistryEntry> = {`);
  for (const [key, e] of [...keyToEntry.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const rend = (r: { width: number; height: number; bytes: number; url: string } | null) =>
      r
        ? `{ url: ${JSON.stringify(r.url)}, width: ${r.width}, height: ${r.height}, bytes: ${r.bytes} }`
        : 'null';
    lines.push(`  ${JSON.stringify(key)}: {`);
    lines.push(`    keys: ${JSON.stringify(e.keys)},`);
    lines.push(`    thumb: ${rend(e.thumb)},`);
    lines.push(`    hero: ${rend(e.hero)},`);
    lines.push(`    full: ${rend(e.full)},`);
    lines.push(`    lqip: ${e.lqip ? JSON.stringify(e.lqip) : 'null'},`);
    lines.push(`    srcWidth: ${e.srcWidth},`);
    lines.push(`    srcHeight: ${e.srcHeight},`);
    lines.push(`    artworkSlug: ${e.artworkSlug ? JSON.stringify(e.artworkSlug) : 'null'},`);
    lines.push(`  },`);
  }
  lines.push(`};`);
  lines.push('');

  const outPath = path.resolve('src/data/assetRegistry.ts');
  fs.writeFileSync(outPath, fileHeader + lines.join('\n'), 'utf8');
  const covers = rows.filter((r) => r.cover_rank === 0).length;
  console.log(
    `assetRegistry.ts written: ${keyToEntry.size} keys from ${rows.length} media_assets rows ` +
      `(${covers} authored covers) -> ${outPath}`
  );
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
