/**
 * Reconcile `public.media_assets` against the objects actually in Supabase Storage.
 *
 * WHY THIS EXISTS
 * Supabase database backups contain **only metadata about Storage objects** — restoring one does
 * not bring back a deleted file. The 605 images in the `artwork-images` bucket are the single
 * irreplaceable asset in this project, and until now nothing checked that the 152 rows describing
 * them and the objects themselves still agree. This script is that check, in both directions:
 *
 *   - **missing object** — a row points at a file that is not there. That is a broken image on the
 *     live gallery, and no database restore will fix it.
 *   - **unreferenced object** — a file no row points at. It is invisible to the catalog, so it
 *     would not be noticed if it were lost.
 *
 * It is STRICTLY READ-ONLY: one `SELECT` and a paginated walk of the bucket. It writes nothing and
 * deletes nothing — an orphaned object is reported, never removed.
 *
 * Usage:
 *   npx tsx scripts/verify-media-backup.ts              # human-readable summary
 *   npx tsx scripts/verify-media-backup.ts --json       # machine-readable
 *   npx tsx scripts/verify-media-backup.ts --limit 50   # show more problem lines (default 20)
 *   npx tsx scripts/verify-media-backup.ts --out <dir>  # also write an object listing
 *
 * Exit codes:
 *   0  no problems
 *   1  problems found
 *   2  nothing to check, or the environment/arguments were unusable
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolvePoolTarget } from './lib/pgTarget';
import {
  BLOCKING_KINDS,
  BUCKET,
  formatBytes,
  reconcileMedia,
  type MediaAssetRow,
  type StorageObject,
} from './lib/mediaReconcile';

dotenv.config();

/** Supabase's `list` caps a page at 1,000 entries; walk with an explicit offset. */
const PAGE = 1000;

function getConnectionString(): string {
  const raw =
    process.env.VRCL_SUPA_POSTGRES_PRISMA_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING ||
    '';
  if (!raw) throw new Error('PostgreSQL connection string missing from environment.');
  return raw.replace(/\?.*$/, '');
}

function storageClient() {
  const url =
    process.env.NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL ||
    process.env.VRCL_SUPA_SUPABASE_URL ||
    'https://orphcusijzkxpxkzapjp.supabase.co';
  const key = process.env.VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY is required to list the bucket.');
  return createClient(url, key, { auth: { persistSession: false } });
}

interface ListedEntry {
  name: string;
  id: string | null;
  metadata: { size?: number } | null;
}

/**
 * Every object under `prefix`, recursively.
 *
 * Supabase has no recursive listing: `list` returns the *immediate* children of one folder, and a
 * folder is distinguished only by having a null `id`/`metadata`. So the tree has to be walked.
 * Depth here is 2 (151 folders → files), but the walk is general.
 */
async function walk(
  supabase: ReturnType<typeof storageClient>,
  prefix: string,
  found: StorageObject[] = []
): Promise<StorageObject[]> {
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) throw new Error(`Listing "${prefix || '/'}" failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data as ListedEntry[]) {
      const child = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A folder has no id and no metadata; a file carries its size.
      if (entry.id === null && !entry.metadata) {
        await walk(supabase, child, found);
      } else {
        found.push({ path: child, bytes: entry.metadata?.size ?? null });
      }
    }

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return found;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const limitFlag = args.indexOf('--limit');
  const limit = limitFlag !== -1 && args[limitFlag + 1] ? Number(args[limitFlag + 1]) : 20;
  const outFlag = args.indexOf('--out');
  const outDir = outFlag !== -1 && args[outFlag + 1] ? path.resolve(args[outFlag + 1]) : null;

  const connectionString = getConnectionString();
  const poolTarget = resolvePoolTarget(connectionString);
  const pool = new Pool({ connectionString: poolTarget.connectionString, ssl: poolTarget.ssl });

  let rows: MediaAssetRow[];
  let objects: StorageObject[];

  try {
    console.log(`Target: ${new URL(connectionString).hostname} — reading media_assets…`);
    const result = await pool.query<MediaAssetRow>(
      'SELECT id, public_id, url, thumbnail_url, folder, renditions FROM public.media_assets ORDER BY id'
    );
    rows = result.rows;

    const supabase = storageClient();
    console.log(`Walking bucket "${BUCKET}"…`);
    objects = await walk(supabase, '');
  } finally {
    await pool.end();
  }

  if (rows.length === 0 && objects.length === 0) {
    console.error('Nothing to check — media_assets is empty and the bucket has no objects.');
    process.exit(2);
  }

  const report = reconcileMedia(rows, objects);
  const ok = report.blocking === 0;

  /**
   * Phase 0's last open exit criterion: capture a full object listing alongside a dump.
   *
   * Database backups describe Storage objects but do not contain them, so "what did we actually
   * have?" has no answer from a dump alone. This listing is that answer, and it is the artefact the
   * S1 deletion decision is checked against (before and after). It is written even when the report
   * is not OK — a listing of a bucket with a problem is exactly when you most want a copy.
   *
   * The sha256 is over the canonical `path\tsize` lines, so two listings can be compared without
   * diffing JSON, and a truncated or edited file is detectable.
   */
  if (outDir) {
    const listing = {
      generatedAt: new Date().toISOString(),
      bucket: BUCKET,
      ok,
      count: objects.length,
      totalBytes: objects.reduce((sum, o) => sum + (o.bytes ?? 0), 0),
      rows: rows.length,
      missing: report.missing,
      unreferenced: report.unreferenced,
      unreferencedOriginals: report.unreferencedOriginals,
      objects: [...objects]
        .map((o) => ({ path: o.path, bytes: o.bytes ?? null }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    };

    const canonical = listing.objects.map((o) => `${o.path}\t${o.bytes ?? ''}`).join('\n');
    const sha256 = crypto.createHash('sha256').update(canonical).digest('hex');

    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'object-listing.json');
    fs.writeFileSync(outPath, `${JSON.stringify({ ...listing, sha256 }, null, 2)}\n`, 'utf8');

    console.log('');
    console.log(`object listing written: ${outPath}`);
    console.log(`  ${listing.count} objects, ${formatBytes(listing.totalBytes)}, sha256 ${sha256.slice(0, 16)}…`);
  }

  if (asJson) {
    console.log(JSON.stringify({ ok, ...report }, null, 2));
  } else {
    console.log('');
    console.log(`media_assets rows   ${report.rows}`);
    console.log(`storage objects     ${report.objects}  (${formatBytes(report.objectBytes)})`);
    console.log(`paths referenced    ${report.referencedPaths}`);
    console.log('');
    console.log(`missing objects     ${report.missing}     ← a broken image; no DB restore brings it back`);
    console.log(`unreferenced files  ${report.unreferenced}     ← unexpected: not an original.* master`);
    console.log(`unresolved rows     ${report.external}`);
    console.log(`size mismatches     ${report.sizeMismatches}`);
    console.log(`unreferenced masters ${report.unreferencedOriginals}   ← expected (original.*); reported, not a failure`);
    console.log('');

    if (ok) {
      console.log('OK — every row resolves to an object; no unexpected orphans; no size mismatches.');
      if (report.unreferencedOriginals > 0) {
        console.log(
          `Note: ${report.unreferencedOriginals} original.* masters are unreferenced by design. They are the ` +
            `highest-resolution copies in the bucket and nothing in the catalog would notice if one vanished — ` +
            `they are the strongest argument for a periodic object listing.`
        );
      }
    } else {
      console.log(`${report.blocking} blocking problem(s):`);
      for (const problem of report.problems.filter((p) => BLOCKING_KINDS.includes(p.kind)).slice(0, limit)) {
        console.log(`  - [${problem.kind}] ${problem.detail}`);
      }
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`verify-media-backup failed: ${err?.message ?? err}`);
  process.exit(2);
});
