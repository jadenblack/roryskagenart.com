/**
 * PRD_V3 §3 Step 0 — snapshot the *canonical* side of the merge, read-only.
 *
 * WHY THIS EXISTS
 * The v3 merge is a MERGE, not a cold seed: the 138 existing `artworks` rows are the survivor and
 * their slugs win over anything the Wayback archive calls a page. Step 0 of the PRD therefore needs
 * `SELECT slug FROM public.artworks` — but doing that live makes the extraction pipeline
 * un-runnable and un-testable offline, and it makes the reconcile report irreproducible: two runs a
 * week apart could disagree with no record of why.
 *
 * So the canonical side is snapshotted to a file once, and every downstream step reads the file.
 * The snapshot carries the stamp and the row counts so a stale one is obvious.
 *
 * READ-ONLY. This script issues SELECTs and writes one JSON file. It never writes to the database.
 *
 * Usage:
 *   npx tsx scripts/snapshot-canonical-catalog.ts [--out <path>]
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { resolvePoolTarget } from './lib/pgTarget';

dotenv.config();

const OUT_DEFAULT = path.resolve('data/archive/wayback_canonical_catalog.json');

export interface CanonicalArtwork {
  slug: string;
  title: string;
  /** `artworks.image_url` — a filename ref, not a URL. */
  imageUrl: string | null;
  gallerySeries: string | null;
  year: string | null;
  draft: boolean;
}

export interface CanonicalMedia {
  publicId: string;
  artworkSlug: string | null;
  /** Filename basename, lowercased — the join key for "shared image public_id" matching. */
  basename: string;
}

export interface CanonicalCatalog {
  /** ISO stamp of when the snapshot was taken. */
  capturedAt: string;
  /** Which database — host/db only, never credentials (see scripts/lib/pgTarget.ts). */
  source: string;
  artworks: CanonicalArtwork[];
  media: CanonicalMedia[];
}

function connectionString(): string {
  const raw =
    process.env.VRCL_SUPA_POSTGRES_PRISMA_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING ||
    '';
  if (!raw) throw new Error('PostgreSQL connection string missing from environment.');
  return raw;
}

export function basenameOf(ref: string): string {
  const tail = ref.split('/').pop() ?? ref;
  return tail.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const outIdx = argv.indexOf('--out');
  const out = outIdx >= 0 ? path.resolve(argv[outIdx + 1]) : OUT_DEFAULT;

  const raw = connectionString();
  const target = resolvePoolTarget(raw);
  const pool = new Pool({ connectionString: target.connectionString, ssl: target.ssl, max: 2 });

  try {
    const artworks = await pool.query<{
      slug: string;
      title: string;
      image_url: string | null;
      gallery_series: string | null;
      year: string | null;
      draft: boolean;
    }>(
      `SELECT slug, title, image_url, gallery_series, year, draft
         FROM public.artworks
        WHERE trashed = false
        ORDER BY slug`
    );

    const media = await pool.query<{ public_id: string; artwork_slug: string | null }>(
      `SELECT public_id, artwork_slug
         FROM public.media_assets
        ORDER BY public_id`
    );

    const snapshot: CanonicalCatalog = {
      capturedAt: new Date().toISOString(),
      source: `${target.host}${target.isRemote ? ' (remote)' : ' (local)'}`,
      artworks: artworks.rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        imageUrl: r.image_url,
        gallerySeries: r.gallery_series,
        year: r.year,
        draft: r.draft === true,
      })),
      media: media.rows.map((r) => ({
        publicId: r.public_id,
        artworkSlug: r.artwork_slug,
        basename: basenameOf(r.public_id),
      })),
    };

    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

    console.log(`Canonical catalog snapshot → ${out}`);
    console.log(`  source   : ${snapshot.source}`);
    console.log(`  artworks : ${snapshot.artworks.length}`);
    console.log(`  media    : ${snapshot.media.length}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('snapshot-canonical-catalog failed:', err?.message ?? err);
  process.exit(1);
});
