/**
 * Phase 4, step 3 — attach the registered media to the artworks that now exist.
 *
 * **This is a write.** Like `wayback-register.ts` and `restore-catalog.ts` it refuses to write
 * unless you pass `--apply`, and it re-reads the live database to build its plan first.
 *
 * WHAT IT DOES
 *   1. `media_assets.artwork_slug` — set for the rows that registration deliberately left NULL,
 *      because at that time the artwork did not exist. It does now.
 *   2. `public.artwork_images` — one ordered row per image, `position = 0` being the cover. This is
 *      the D3/Q16 join; without it a mural's images 2..N are unreachable (R-18).
 *
 * WHAT IT WILL NOT DO
 *   - It never re-points a row that is already linked to a *different* artwork. That is a conflict:
 *     reported, never overwritten. Moving a photograph off a live artwork silently is the failure
 *     mode this guard exists for.
 *   - It never invents an artwork. A manifest slug the backfill did not create aborts the run.
 *   - It never deletes. Re-running it is a no-op once the plan is empty.
 *
 * Usage:
 *   npx tsx scripts/wayback-link.ts                              # plan only
 *   npx tsx scripts/wayback-link.ts --apply                      # write
 *   npx tsx scripts/wayback-link.ts --staging <dir>              # non-default manifest
 *   npx tsx scripts/wayback-link.ts --apply --limit 10           # first N links (a smoke run)
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { resolvePoolTarget } from './lib/pgTarget';
import type { RenderManifest } from './lib/waybackMedia';
import {
  artworksCovered,
  isWritable,
  planLinks,
  type LinkMediaRow,
} from './lib/waybackLink';

dotenv.config();

/** The recovered export is the v3 mural source (§3.D), so it is the default here. */
const DEFAULT_STAGING_ROOT = path.resolve('data/staging/wayback-recovered');

interface Args {
  apply: boolean;
  staging?: string;
  limit?: number;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--staging') args.staging = argv[++i];
    else if (argv[i] === '--limit') args.limit = parseInt(argv[++i], 10);
  }
  return args;
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const stagingRoot = args.staging ? path.resolve(args.staging) : DEFAULT_STAGING_ROOT;
  const manifestPath = path.join(stagingRoot, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Render manifest not found: ${manifestPath}\nRun: npx tsx scripts/wayback-render.ts --staging <dir>`
    );
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RenderManifest;
  let entries = manifest.entries.map((e) => ({ publicId: e.publicId, artworkSlug: e.artworkSlug }));
  if (args.limit && args.limit > 0) entries = entries.slice(0, args.limit);

  const poolTarget = resolvePoolTarget(getConnectionString());
  const pool = new Pool({ connectionString: poolTarget.connectionString, ssl: poolTarget.ssl });

  console.log('='.repeat(72));
  console.log(`Wayback link → Supabase${args.apply ? '' : ' (PLAN ONLY — pass --apply to write)'}`);
  console.log('='.repeat(72));
  console.log(`  manifest        : ${manifestPath}`);
  console.log(`  entries         : ${entries.length} of ${manifest.entries.length}`);
  console.log(`  target          : ${poolTarget.host}${poolTarget.isRemote ? '  ⚠ REMOTE' : '  (local)'}`);
  console.log('');

  const { rows: mediaRows } = await pool.query<LinkMediaRow>(
    'SELECT public_id, artwork_slug FROM public.media_assets'
  );
  const { rows: artworkRows } = await pool.query<{ slug: string }>('SELECT slug FROM public.artworks');

  const plan = planLinks(
    entries,
    mediaRows,
    artworkRows.map((r) => r.slug)
  );

  console.log('--- PLAN ---');
  console.log(`  artworks covered        : ${artworksCovered(plan)}`);
  console.log(`  media rows to link      : ${plan.links.length}   (artwork_slug NULL → set)`);
  console.log(`  already linked, correct : ${plan.alreadyLinked.length}`);
  console.log(`  artwork_images rows     : ${plan.joins.length}`);
  console.log('');
  console.log(`  ⚠ conflicts             : ${plan.conflicts.length}`);
  console.log(`  ⚠ unknown artworks      : ${plan.unknownArtworks.length}`);
  console.log(`  ⚠ manifest ids w/o row  : ${plan.missingMedia.length}`);
  if (plan.conflicts.length) {
    console.log('    conflicts (a row linked to a different artwork — never overwritten):');
    for (const c of plan.conflicts.slice(0, 20)) {
      console.log(`      ${c.publicId}: live=${c.actual} manifest=${c.expected}`);
    }
  }
  if (plan.unknownArtworks.length) {
    console.log('    unknown artworks (the backfill did not create these):');
    for (const s of plan.unknownArtworks.slice(0, 20)) console.log(`      ${s}`);
  }
  if (plan.missingMedia.length) {
    console.log('    manifest ids with no media_assets row (registration did not finish):');
    for (const p of plan.missingMedia.slice(0, 20)) console.log(`      ${p}`);
  }
  console.log('');

  if (!isWritable(plan)) {
    await pool.end();
    throw new Error(
      'Refusing to write — the plan has conflicts, unknown artworks, or missing media rows. ' +
        'Resolve them first; see the list above.'
    );
  }

  if (!args.apply) {
    console.log('Plan only — nothing was written. Re-run with --apply to execute.');
    await pool.end();
    return;
  }

  // --- Apply -------------------------------------------------------------------------------------
  const client = await pool.connect();
  let linked = 0;
  let joined = 0;
  try {
    await client.query('BEGIN');

    for (const link of plan.links) {
      const res = await client.query(
        `UPDATE public.media_assets
            SET artwork_slug = $1
          WHERE public_id = $2
            AND artwork_slug IS NULL`,
        [link.artworkSlug, link.publicId]
      );
      linked += res.rowCount ?? 0;
    }

    for (const join of plan.joins) {
      // `position` is rewritten on conflict so a re-render that changes the authored order is
      // reflected; the pair itself is the identity, so nothing is duplicated.
      await client.query(
        `INSERT INTO public.artwork_images (artwork_slug, media_public_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (artwork_slug, media_public_id) DO UPDATE SET position = EXCLUDED.position`,
        [join.artworkSlug, join.publicId, join.position]
      );
      joined += 1;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    await pool.end();
    throw err;
  }

  // The definition of done is *manifest* rows unlinked, not all rows unlinked. `media_assets`
  // carries 35 rows the wayback manifest never mentions (pre-existing fine-art orphans, R-17);
  // they will read 35 before and after this step, and chasing them to 0 here would be wrong.
  const manifestIds = entries.map((e) => e.publicId);
  const { rows: nullCount } = await pool.query<{ c: number }>(
    'SELECT count(*)::int AS c FROM public.media_assets WHERE artwork_slug IS NULL'
  );
  const { rows: nullManifest } = await pool.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM public.media_assets
      WHERE artwork_slug IS NULL AND public_id = ANY($1::text[])`,
    [manifestIds]
  );
  const { rows: joinCount } = await pool.query<{ c: number }>(
    'SELECT count(*)::int AS c FROM public.artwork_images'
  );

  console.log('--- SUMMARY ---');
  console.log(`  media rows linked       : ${linked}`);
  console.log(`  artwork_images upserted : ${joined}`);
  console.log(`  unlinked manifest rows  : ${nullManifest[0].c}  (0 expected — this is the gate)`);
  console.log(
    `  unlinked, all rows      : ${nullCount[0].c}  (35 are pre-existing non-manifest orphans, R-17)`
  );
  console.log(`  artwork_images total    : ${joinCount[0].c}`);
  console.log('');

  await pool.end();
}

main().catch((err) => {
  console.error('wayback-link failed:', err?.stack ?? err?.message ?? err);
  process.exit(1);
});
