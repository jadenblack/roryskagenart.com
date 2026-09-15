/**
 * Phase 3.B, second half — upload the staged renditions and register them in `media_assets`.
 *
 * **This is the only script in Phase 3 that writes to Supabase**, and it is the least reversible
 * step in the whole v3 program (R-07): the artwork backfill is SQL that a dump restores, but an
 * upload puts bytes in a bucket that database backups do **not** cover. So it follows the same
 * discipline as `scripts/restore-catalog.ts`: **it writes nothing unless you pass `--apply`.**
 *
 * Three properties it guarantees:
 *
 *  1. **No `original.*` object.** Q4 says full resolution is never needed in the studio; S1 exists
 *     because the 151 unreferenced `original.*` masters are unmonitored surface area. Uploading one
 *     per Wayback image would recreate that problem at 11 files deep with no row referencing any.
 *
 *  2. **It refuses to collide.** `generate-asset-registry.ts` indexes each row under its `public_id`
 *     *and* its `artwork_slug`, first-wins. A `public_id` that equals an existing artwork slug would
 *     take that artwork's registry key away from it — a silent gallery regression (R-18). The
 *     pre-flight checks both key spaces and aborts rather than writing.
 *
 *  3. **`artwork_slug` is written only for a trusted match.** An image whose artwork is unadjudicated
 *     is uploaded and registered *unlinked*; linking it is a separate, reviewable act.
 *
 * Usage:
 *   npx tsx scripts/wayback-register.ts                       # plan only — nothing is written
 *   npx tsx scripts/wayback-register.ts --apply               # upload + upsert
 *   npx tsx scripts/wayback-register.ts --apply --only <publicId>
 *   npx tsx scripts/wayback-register.ts --apply --force       # re-upload unchanged entries
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  IMMUTABLE_CACHE_CONTROL,
  MEDIA_BUCKET,
  RENDITION_NAMES,
  renditionObjectPath,
} from '../server/lib/imageRenditions';
import { buildMediaAssetValues, type MediaAssetValues } from '../server/lib/mediaUpload';
import { resolvePoolTarget } from './lib/pgTarget';
import {
  findRegistryCollisions,
  type ExistingRegistryKey,
  type RenderManifest,
  type RenderManifestEntry,
} from './lib/waybackMedia';

dotenv.config();

const STAGING_ROOT = path.resolve('data/staging/wayback-media');
const MANIFEST_PATH = path.join(STAGING_ROOT, 'manifest.json');

interface Args {
  apply: boolean;
  force: boolean;
  only?: string;
  limit?: number;
}

/**
 * `--apply` is the write gate, matching `scripts/restore-catalog.ts`; `--dry-run` is accepted as an
 * explicit spelling of the default (the roadmap's exit criterion invokes it) and is rejected when
 * combined with `--apply`, because "write and don't write" is a typo, not an instruction.
 */
export function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false, force: false };
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--apply': args.apply = true; break;
      case '--dry-run': dryRun = true; break;
      case '--force': args.force = true; break;
      case '--only': args.only = argv[++i]; break;
      case '--limit': args.limit = parseInt(argv[++i], 10); break;
      default: break;
    }
  }
  if (dryRun && args.apply) {
    throw new Error('--dry-run and --apply contradict each other; pass at most one.');
  }
  return args;
}

function requireEnv(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  throw new Error(`Missing required env var (tried: ${names.join(', ')})`);
}

function getConnectionString(): string {
  const raw =
    process.env.VRCL_SUPA_POSTGRES_PRISMA_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING ||
    '';
  if (!raw) throw new Error('PostgreSQL connection string missing from environment.');
  return raw.replace(/\?.*$/, '');
}

/** Rows already in `media_assets` that would be touched, keyed by the keys the registry indexes. */
export type ExistingKey = ExistingRegistryKey;

/** `media_assets` columns this stage writes, derived from the manifest — never `original.*`. */
export function valuesFor(
  entry: RenderManifestEntry,
  publicUrl: (p: string) => string
): MediaAssetValues {
  return buildMediaAssetValues(
    {
      width: entry.width,
      height: entry.height,
      format: entry.format,
      lqip: entry.lqip,
      renditions: entry.renditions,
      buffers: {} as never, // the register stage uploads from disk, not from memory
    },
    {
      publicId: entry.publicId,
      sourceBytes: entry.sourceBytes,
      // Unadjudicated linkage stays NULL. See the module header, property 3.
      artworkSlug: entry.linkable ? entry.artworkSlug : null,
      publicUrl,
    }
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(
      `Render manifest not found: ${MANIFEST_PATH}\nRun: npx tsx scripts/wayback-render.ts`
    );
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as RenderManifest;
  let entries = manifest.entries;
  if (args.only) entries = entries.filter((e) => e.publicId === args.only);
  if (args.limit && args.limit > 0) entries = entries.slice(0, args.limit);

  const SUPABASE_URL = requireEnv(
    'VRCL_SUPA_SUPABASE_URL',
    'SUPABASE_URL',
    'NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL'
  );
  const SUPABASE_KEY = requireEnv(
    'VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  );
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
  const publicUrl = (p: string) =>
    `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${p}`;

  const poolTarget = resolvePoolTarget(getConnectionString());
  const pool = new Pool({ connectionString: poolTarget.connectionString, ssl: poolTarget.ssl });

  console.log('='.repeat(72));
  console.log(`Wayback register → Supabase${args.apply ? '' : ' (PLAN ONLY — pass --apply to write)'}`);
  console.log('='.repeat(72));
  console.log(`  manifest        : ${MANIFEST_PATH}`);
  console.log(`  entries         : ${entries.length} of ${manifest.entries.length}`);
  console.log(`  bucket          : ${MEDIA_BUCKET} @ ${SUPABASE_URL}`);
  console.log(`  cache-control   : ${IMMUTABLE_CACHE_CONTROL}s (immutable — no CDN, so this is the egress strategy)`);
  console.log('');

  // --- Pre-flight 1: every staged object must exist ---------------------------------------------
  const missing: string[] = [];
  for (const entry of entries) {
    for (const name of RENDITION_NAMES) {
      const file = path.join(STAGING_ROOT, entry.publicId, `${name}.webp`);
      if (!fs.existsSync(file)) missing.push(path.relative(process.cwd(), file));
    }
  }
  if (missing.length) {
    await pool.end();
    throw new Error(
      `Staged objects missing — re-run scripts/wayback-render.ts:\n  ${missing.join('\n  ')}`
    );
  }

  // --- Pre-flight 2: registry key collisions ----------------------------------------------------
  const { rows: existing } = await pool.query<ExistingRegistryKey>(
    'SELECT public_id, artwork_slug FROM public.media_assets'
  );
  const collisions = findRegistryCollisions(
    entries.map((e) => e.publicId),
    existing
  );
  if (collisions.length) {
    await pool.end();
    throw new Error(
      'Refusing to write — these public_ids are already claimed in the registry key space.\n' +
        'The registry generator is first-wins, so writing would take a live artwork\'s image:\n  ' +
        collisions.join('\n  ') +
        '\n\nResolve the artwork identity first (see the COLLISION rows in the reconcile report).'
    );
  }
  console.log(`  pre-flight      : ${entries.length} public_id(s) checked, 0 collisions in ${existing.length} registry rows`);
  console.log('');

  const { rows: before } = await pool.query<{ c: string }>(
    'SELECT count(*)::int AS c FROM public.media_assets'
  );

  if (!args.apply) {
    console.log('--- PLAN ---');
    for (const entry of entries) {
      const values = valuesFor(entry, publicUrl);
      console.log(
        `  ${entry.publicId.padEnd(40)} ${entry.kind.padEnd(16)} ` +
          `artwork_slug=${values.artwork_slug ?? 'NULL (unlinked)'}`
      );
      for (const name of RENDITION_NAMES) {
        console.log(`      → ${renditionObjectPath(entry.publicId, name)}  ${entry.renditions[name].bytes} B`);
      }
    }
    console.log('');
    console.log(`  objects to upload : ${entries.length * RENDITION_NAMES.length}`);
    console.log(`  rows to upsert    : ${entries.length}  (media_assets now: ${before[0].c})`);
    console.log(`  linked now        : ${entries.filter((e) => e.linkable).length}  · unlinked: ${entries.filter((e) => !e.linkable).length}`);
    console.log('');
    console.log('Plan only — nothing was written. Re-run with --apply to execute.');
    await pool.end();
    return;
  }

  // --- Apply ------------------------------------------------------------------------------------
  let uploaded = 0;
  let skipped = 0;
  const failures: { publicId: string; error: string }[] = [];

  for (const [index, entry] of entries.entries()) {
    const label = `[${index + 1}/${entries.length}]`;
    try {
      const values = valuesFor(entry, publicUrl);

      // Idempotency: an unchanged entry is one whose row already carries this exact renditions
      // document, lqip and linkage. Comparing the encoded bytes catches a ladder change.
      if (!args.force) {
        const { rows } = await pool.query<{
          renditions: unknown;
          lqip: string | null;
          artwork_slug: string | null;
        }>(
          'SELECT renditions, lqip, artwork_slug FROM public.media_assets WHERE public_id = $1',
          [entry.publicId]
        );
        const row = rows[0];
        if (
          row &&
          JSON.stringify(row.renditions) === JSON.stringify(values.renditions) &&
          row.lqip === values.lqip &&
          row.artwork_slug === values.artwork_slug
        ) {
          skipped += 1;
          console.log(`${label} SKIP  ${entry.publicId} — registry row already current`);
          continue;
        }
      }

      for (const name of RENDITION_NAMES) {
        const body = fs.readFileSync(path.join(STAGING_ROOT, entry.publicId, `${name}.webp`));
        const { error } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(renditionObjectPath(entry.publicId, name), body, {
            contentType: 'image/webp',
            cacheControl: IMMUTABLE_CACHE_CONTROL,
            upsert: true,
          });
        if (error) throw new Error(`upload ${name}: ${error.message}`);
      }

      await pool.query(
        `INSERT INTO public.media_assets (
           public_id, url, thumbnail_url, format, bytes, width, height,
           folder, artwork_slug, lqip, renditions, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())
         ON CONFLICT (public_id) DO UPDATE SET
           url           = EXCLUDED.url,
           thumbnail_url = EXCLUDED.thumbnail_url,
           format        = EXCLUDED.format,
           bytes         = EXCLUDED.bytes,
           width         = EXCLUDED.width,
           height        = EXCLUDED.height,
           folder        = EXCLUDED.folder,
           artwork_slug  = COALESCE(EXCLUDED.artwork_slug, media_assets.artwork_slug),
           lqip          = EXCLUDED.lqip,
           renditions    = EXCLUDED.renditions,
           updated_at    = now()`,
        [
          values.public_id,
          values.url,
          values.thumbnail_url,
          values.format,
          values.bytes,
          values.width,
          values.height,
          values.folder,
          values.artwork_slug,
          values.lqip,
          JSON.stringify(values.renditions),
        ]
      );

      uploaded += 1;
      console.log(
        `${label} OK    ${entry.publicId} — 3 objects, artwork_slug=${values.artwork_slug ?? 'NULL'}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ publicId: entry.publicId, error: message });
      console.log(`${label} FAIL  ${entry.publicId} — ${message}`);
    }
  }

  const { rows: after } = await pool.query<{ c: string }>(
    'SELECT count(*)::int AS c FROM public.media_assets'
  );

  console.log('');
  console.log('--- SUMMARY ---');
  console.log(`  uploaded / upserted : ${uploaded}`);
  console.log(`  skipped (current)   : ${skipped}`);
  console.log(`  failed              : ${failures.length}`);
  for (const f of failures) console.log(`    ${f.publicId}: ${f.error}`);
  console.log(`  media_assets        : ${before[0].c} → ${after[0].c}`);
  console.log(`  \`original.*\` written : 0 (by construction — Q4/S1)`);
  console.log('');
  console.log('Next: npx tsx scripts/generate-asset-registry.ts   (commit the regenerated registry on its own)');

  await pool.end();
  if (failures.length > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error('wayback-register failed:', err?.stack ?? err?.message ?? err);
  process.exit(1);
});
