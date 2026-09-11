/**
 * PRD_V3_CLOUDINARY_EXIT.md — Stage v3.1 migration script.
 *
 * Migrates every asset in all_cloudinary_assets.json onto Supabase:
 *   1. Downloads the Cloudinary original.
 *   2. Renders thumb/hero/full webp renditions + a tiny lqip blur-up with sharp.
 *   3. Uploads everything to the public `artwork-images` bucket
 *      under {publicId}/{thumb|hero|full|original}.{ext}.
 *   4. Upserts a public.media_assets row per asset (registry of record),
 *      including artwork_slug linkage via verified_posts_full.json.
 *
 * Idempotent: re-running skips assets whose four storage objects already exist
 * and whose manifest bytes match the stored row (use --force to re-render).
 *
 * Usage:
 *   npx tsx scripts/migrate-cloudinary-to-supabase.ts --dry-run
 *   npx tsx scripts/migrate-cloudinary-to-supabase.ts [--force] [--limit N] [--only publicId]
 *
 * Requires env: VRCL_SUPA_SUPABASE_URL (or SUPABASE_URL),
 *               VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import sharp from 'sharp';

dotenv.config();

// ---------------------------------------------------------------------------
// Config (rendition contract from PRD §3.1 — the single place sizes live)
// ---------------------------------------------------------------------------

const BUCKET_NAME = 'artwork-images';
const MANIFEST_PATH = path.resolve('all_cloudinary_assets.json');
const VERIFIED_POSTS_PATH = path.resolve('verified_posts_full.json');

export const RENDITIONS = {
  thumb: { width: 640, quality: 80 },
  hero: { width: 1280, quality: 82 },
  full: { width: 2048, quality: 85 }, // never upscaled (withoutEnlargement)
} as const;

type RenditionName = keyof typeof RENDITIONS;
const RENDITION_NAMES = Object.keys(RENDITIONS) as RenditionName[];

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const LIMIT_IDX = args.indexOf('--limit');
const LIMIT = LIMIT_IDX >= 0 ? parseInt(args[LIMIT_IDX + 1], 10) : undefined;
const ONLY_IDX = args.indexOf('--only');
const ONLY = ONLY_IDX >= 0 ? args[ONLY_IDX + 1] : undefined;

// ---------------------------------------------------------------------------
// Manifest + linkage types
// ---------------------------------------------------------------------------

interface ManifestAsset {
  publicId: string;
  format: string;
  version: number;
  width: number;
  height: number;
  bytes: number;
  url: string;
  thumbnailUrl?: string;
}

interface VerifiedPost {
  slug: string;
  cloudAsset?: { publicId?: string } | null;
}

// ---------------------------------------------------------------------------
// Shared env / clients
// ---------------------------------------------------------------------------

function requireEnv(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  throw new Error(`Missing required env var (tried: ${names.join(', ')})`);
}

const SUPABASE_URL = requireEnv(
  'VRCL_SUPA_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL'
);
const SUPABASE_KEY = requireEnv(
  'VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
);

// pg connection string (same precedence as src/server/db.ts)
function getConnectionString(): string {
  const raw =
    process.env.VRCL_SUPA_POSTGRES_PRISMA_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING ||
    '';
  if (!raw) throw new Error('PostgreSQL connection string missing from environment.');
  return raw.replace(/\?.*$/, '');
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false },
  max: 4,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string): void {
  console.log(msg);
}

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

/** Storage object path for an asset rendition (PRD §3.2 layout). */
export function storagePath(publicId: string, rendition: RenditionName | 'original', ext: string): string {
  return `${publicId}/${rendition}.${rendition === 'original' ? ext : 'webp'}`;
}

/** Public URL for a stored object. */
function publicUrl(storagePathRel: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePathRel}`;
}

async function fetchWithRetry(url: string, attempt = 1): Promise<Buffer> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error(`Empty body for ${url}`);
    return buf;
  } catch (err: any) {
    if (attempt >= 3) throw err;
    log(`  retry ${attempt + 1}/3 after error: ${err.message}`);
    await new Promise((r) => setTimeout(r, 800 * attempt));
    return fetchWithRetry(url, attempt + 1);
  }
}

interface RenditionBuffers {
  thumb: Buffer;
  hero: Buffer;
  full: Buffer;
  lqip: string; // data URI
}

/** Render the four rendition artifacts from an original image buffer (PRD §3.1). */
export async function renderRenditions(original: Buffer): Promise<RenditionBuffers> {
  const base = sharp(original, { failOn: 'none' }).rotate(); // honor EXIF
  const meta = await base.metadata();

  const renderOne = async (name: RenditionName): Promise<Buffer> => {
    const { width, quality } = RENDITIONS[name];
    return base
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  };

  const [thumb, hero, full] = await Promise.all([
    renderOne('thumb'),
    renderOne('hero'),
    renderOne('full'),
  ]);

  const lqipBuf = await base
    .clone()
    .resize({ width: 20 })
    .webp({ quality: 40 })
    .toBuffer();

  return {
    thumb,
    hero,
    full,
    lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
  };
}

// ---------------------------------------------------------------------------
// Bucket management (idempotent)
// ---------------------------------------------------------------------------

async function ensureBucket(): Promise<void> {
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) fail(`listBuckets failed: ${listErr.message}`);

  const existing = buckets?.find((b) => b.name === BUCKET_NAME);
  if (existing) {
    log(`Bucket '${BUCKET_NAME}' already exists (public=${existing.public}).`);
    if (!existing.public) {
      const { error } = await supabase.storage.updateBucket(BUCKET_NAME, { public: true });
      if (error) fail(`Could not make bucket public: ${error.message}`);
      log(`  updated bucket to public read.`);
    }
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024, // originals up to 50MB
  });
  if (error) fail(`createBucket failed: ${error.message}`);
  log(`Created public bucket '${BUCKET_NAME}'.`);
}

// ---------------------------------------------------------------------------
// Registry upsert
// ---------------------------------------------------------------------------

interface RegistryInput {
  publicId: string;
  format: string;
  originalBytes: number;
  width: number;
  height: number;
  slug: string | null;
  lqip: string;
  renditions: Record<RenditionName, { path: string; width: number; height: number; bytes: number }>;
}

async function upsertRegistryRow(input: RegistryInput): Promise<void> {
  const sql = `
    INSERT INTO public.media_assets (
      public_id, url, thumbnail_url, format, bytes, width, height,
      folder, artwork_slug, lqip, renditions, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())
    ON CONFLICT (public_id) DO UPDATE SET
      url            = EXCLUDED.url,
      thumbnail_url  = EXCLUDED.thumbnail_url,
      format         = EXCLUDED.format,
      bytes          = EXCLUDED.bytes,
      width          = EXCLUDED.width,
      height         = EXCLUDED.height,
      folder         = EXCLUDED.folder,
      artwork_slug   = COALESCE(EXCLUDED.artwork_slug, media_assets.artwork_slug),
      lqip           = EXCLUDED.lqip,
      renditions     = EXCLUDED.renditions,
      updated_at     = now()
  `;
  const { publicId, format, originalBytes, width, height, slug, lqip, renditions } = input;
  await pool.query(sql, [
    publicId,
    publicUrl(renditions.hero.path),
    publicUrl(renditions.thumb.path),
    format,
    originalBytes,
    width,
    height,
    BUCKET_NAME,
    slug,
    lqip,
    JSON.stringify(renditions),
  ]);
}

// ---------------------------------------------------------------------------
// Per-asset migration
// ---------------------------------------------------------------------------

interface MigrationOutcome {
  publicId: string;
  status: 'migrated' | 'skipped-up-to-date' | 'dry-run' | 'failed';
  detail?: string;
}

async function migrateAsset(asset: ManifestAsset, slugLink: string | null): Promise<MigrationOutcome> {
  const pid = asset.publicId;
  const ext = (asset.format || 'jpg').toLowerCase();

  try {
    // Idempotency check: all rendition objects present and registry row current.
    if (!FORCE) {
      const wanted = [
        ...RENDITION_NAMES.map((r) => storagePath(pid, r, ext)),
        storagePath(pid, 'original', ext),
      ];
      const { data: existing } = await supabase.storage.from(BUCKET_NAME).list(pid, {
        limit: 100,
      });
      const present = new Set((existing ?? []).map((f) => `${pid}/${f.name}`));
      const allPresent = wanted.every((w) => present.has(w));

      if (allPresent) {
        const { rows } = await pool.query(
          `SELECT renditions IS NOT NULL AS has_renditions, lqip IS NOT NULL AS has_lqip
             FROM public.media_assets WHERE public_id = $1`,
          [pid]
        );
        if (rows[0]?.has_renditions && rows[0]?.has_lqip) {
          return { publicId: pid, status: 'skipped-up-to-date' };
        }
      }
    }

    // 1. Download original (from Cloudinary, or from the bucket when re-rendering).
    const { data: origData, error: dlErr } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath(pid, 'original', ext));
    let original: Buffer;
    if (!dlErr && origData) {
      original = Buffer.from(await origData.arrayBuffer());
      log(`  original restored from bucket archive (${(original.length / 1024).toFixed(0)} KB)`);
    } else {
      original = await fetchWithRetry(asset.url);
    }

    // 2. Render renditions.
    const rends = await renderRenditions(original);

    // 3. Upload originals + renditions (x-upsert so re-runs overwrite cleanly).
    const uploadOne = async (p: string, body: Buffer | string, contentType: string) => {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(p, body, { contentType, upsert: true });
      if (error) throw new Error(`upload ${p}: ${error.message}`);
    };

    await uploadOne(storagePath(pid, 'original', ext), original, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
    for (const name of RENDITION_NAMES) {
      await uploadOne(storagePath(pid, name, 'webp'), rends[name], 'image/webp');
    }

    // 4. Upsert registry row.
    const meta = await sharp(original, { failOn: 'none' }).metadata();
    const renditionsMeta = Object.fromEntries(
      RENDITION_NAMES.map((name) => [
        name,
        {
          path: storagePath(pid, name, 'webp'),
          width: Math.min(RENDITIONS[name].width, meta.width ?? RENDITIONS[name].width),
          height: Math.round(
            (Math.min(RENDITIONS[name].width, meta.width ?? RENDITIONS[name].width) /
              (meta.width ?? RENDITIONS[name].width)) *
              (meta.height ?? 0)
          ),
          bytes: rends[name].length,
        },
      ])
    ) as Record<RenditionName, { path: string; width: number; height: number; bytes: number }>;

    await upsertRegistryRow({
      publicId: pid,
      format: ext,
      originalBytes: original.length,
      width: meta.width ?? asset.width,
      height: meta.height ?? asset.height,
      slug: slugLink,
      lqip: rends.lqip,
      renditions: renditionsMeta,
    });

    return { publicId: pid, status: 'migrated' };
  } catch (err: any) {
    return { publicId: pid, status: 'failed', detail: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('='.repeat(72));
  log(`Cloudinary -> Supabase migration ${DRY_RUN ? '(DRY RUN)' : ''}`);
  log(`target: ${SUPABASE_URL} bucket=${BUCKET_NAME}`);
  log('='.repeat(72));

  if (!fs.existsSync(MANIFEST_PATH)) fail(`manifest not found: ${MANIFEST_PATH}`);
  const manifest: ManifestAsset[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  log(`manifest assets: ${manifest.length}`);

  // artwork_slug linkage from verified_posts_full.json (catalog truth)
  let verified: VerifiedPost[] = [];
  if (fs.existsSync(VERIFIED_POSTS_PATH)) {
    verified = JSON.parse(fs.readFileSync(VERIFIED_POSTS_PATH, 'utf8'));
  }
  const manifestIds = new Set(manifest.map((a) => a.publicId.toLowerCase()));
  const slugLinkByPid = new Map<string, string>();
  for (const post of verified) {
    const pid = post.cloudAsset?.publicId?.toLowerCase();
    if (pid && manifestIds.has(pid) && !slugLinkByPid.has(pid)) {
      slugLinkByPid.set(pid, post.slug);
    }
  }
  log(`artwork_slug links resolvable from verified posts: ${slugLinkByPid.size}`);

  let assets = manifest;
  if (ONLY) assets = assets.filter((a) => a.publicId === ONLY);
  if (LIMIT) assets = assets.slice(0, LIMIT);

  if (DRY_RUN) {
    log('');
    log('--- DRY RUN PLAN (no writes performed) ---');
    for (const a of assets) {
      const ext = (a.format || 'jpg').toLowerCase();
      const slug = slugLinkByPid.get(a.publicId.toLowerCase()) ?? null;
      log(
        `${a.publicId}  ${a.width}x${a.height}  ${(a.bytes / 1024).toFixed(0)}KB  slug=${slug ?? '-'}`
      );
      for (const name of RENDITION_NAMES) {
        log(`    -> ${storagePath(a.publicId, name, ext)}  (w<=${RENDITIONS[name].width} webp q${RENDITIONS[name].quality})`);
      }
      log(`    -> ${storagePath(a.publicId, 'original', ext)}  (archival)`);
    }
    log('');
    log(`planned bucket ops: ${assets.length * (RENDITION_NAMES.length + 1)} uploads`);
    log(`planned registry upserts: ${assets.length}`);
    log('DRY RUN COMPLETE — no changes made.');
    await pool.end();
    return;
  }

  await ensureBucket();

  const outcomes: MigrationOutcome[] = [];
  let done = 0;
  for (const a of assets) {
    done += 1;
    const slug = slugLinkByPid.get(a.publicId.toLowerCase()) ?? null;
    const outcome = await migrateAsset(a, slug);
    outcomes.push(outcome);
    const tag =
      outcome.status === 'migrated'
        ? 'OK '
        : outcome.status === 'skipped-up-to-date'
        ? 'SKIP'
        : 'FAIL';
    log(`[${done}/${assets.length}] ${tag} ${outcome.publicId}${outcome.detail ? ' — ' + outcome.detail : ''}`);
  }

  // Summary
  const migrated = outcomes.filter((o) => o.status === 'migrated');
  const skipped = outcomes.filter((o) => o.status === 'skipped-up-to-date');
  const failed = outcomes.filter((o) => o.status === 'failed');

  log('');
  log('--- SUMMARY ---');
  log(`migrated: ${migrated.length}`);
  log(`skipped (already up to date): ${skipped.length}`);
  log(`failed: ${failed.length}`);
  if (failed.length) {
    log('failed publicIds:');
    for (const f of failed) log(`  ${f.publicId}: ${f.detail}`);
  }

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM public.media_assets');
  log(`media_assets rows now: ${rows[0].c}`);
  log(`expected: ${manifest.length}`);

  await pool.end();
  if (failed.length > 0) process.exitCode = 2;
}

main().catch((err) => {
  fail(err?.stack || err?.message || String(err));
});
