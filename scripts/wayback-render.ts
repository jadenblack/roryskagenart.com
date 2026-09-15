/**
 * Phase 3.B, first half — render the Wayback images into local staging.
 *
 * **This script writes nothing outside `data/staging/` and performs no uploads and no database
 * writes.** It is the offline, inspectable half of the Q2 bulk pre-pass; `scripts/wayback-register.ts`
 * is the half that touches Supabase, and it reads the manifest this writes rather than re-reading the
 * archive or re-encoding anything.
 *
 * WHY A STAGING DIRECTORY AT ALL
 * Rendering is the expensive, irreversible-feeling step and the one most likely to need a second
 * look: `sharp` can fail on a truncated capture, and a `derivative-only` image silently caps at its
 * own width. Materialising the WebP files lets a human (or the register stage's pre-flight) inspect
 * exactly what would be uploaded *before* any of it leaves the machine. `data/staging/` is gitignored
 * for the same reason `data/backups/` is — it is regenerable output, not source.
 *
 * ⚠️ **No `original.*` object is ever written.** Q4 says full resolution is never needed in the
 * studio, and S1's whole premise is that the 151 unreferenced `original.*` masters are unmonitored
 * surface area. Writing one per Wayback image would create a second generation of exactly that
 * problem, 12 files deep, with no row referencing any of them.
 *
 * Usage:
 *   npx tsx scripts/wayback-render.ts [--dry-run] [--force] [--only <publicId>] [--limit N]
 */
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  RENDITIONS,
  RENDITION_NAMES,
  renderRenditions,
  type RenditionName,
} from '../server/lib/imageRenditions';
import {
  buildMediaPlan,
  type MediaPlanSkip,
  type RenderManifest,
  type RenderManifestEntry,
} from './lib/waybackMedia';
import type { ArchiveId } from './lib/waybackExtract';
import type { ReconciledRecord } from './lib/waybackReconcile';

const WAYBACK_ROOT = path.resolve('wayback');
const EXTRACTION_PATH = path.resolve('data/archive/wayback_extraction.json');
const STAGING_ROOT = path.resolve('data/staging/wayback-media');
const MANIFEST_PATH = path.join(STAGING_ROOT, 'manifest.json');

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * `public_id` becomes a bucket folder, so it must stay a single safe path segment.
 *
 * The planner only ever emits slugs and normalised basenames, so this cannot fire today — which is
 * exactly why it is worth asserting: a future planner change that emitted a slash would otherwise
 * scatter objects into nested folders that no row points at.
 */
export function assertSafePublicId(publicId: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(publicId) || publicId.startsWith('.')) {
    throw new Error(`Unsafe public_id for a bucket folder: ${JSON.stringify(publicId)}`);
  }
}

/** Resolve an archive-relative path, refusing anything that escapes `wayback/`. */
export function resolveSource(archive: ArchiveId, archivePath: string): string {
  const abs = path.resolve(WAYBACK_ROOT, archive, archivePath);
  const root = path.resolve(WAYBACK_ROOT, archive);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`archive path escapes the archive root: ${archive}/${archivePath}`);
  }
  return abs;
}

function loadManifest(): RenderManifest | null {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as RenderManifest;
  } catch {
    return null;
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');
  const onlyIdx = argv.indexOf('--only');
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : undefined;
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(argv[limitIdx + 1], 10) : undefined;

  if (!fs.existsSync(EXTRACTION_PATH)) {
    throw new Error(
      `Extraction not found: ${EXTRACTION_PATH}\nRun: npx tsx scripts/wayback-extract.ts`
    );
  }
  const extraction = JSON.parse(fs.readFileSync(EXTRACTION_PATH, 'utf8')) as {
    generatedAt: string;
    records: ReconciledRecord[];
  };

  const plan = buildMediaPlan(extraction.records);
  let items = plan.items;
  if (only) items = items.filter((i) => i.publicId === only);
  if (limit && limit > 0) items = items.slice(0, limit);

  console.log('='.repeat(72));
  console.log(`Wayback render → local staging${dryRun ? ' (DRY RUN)' : ''}`);
  console.log('='.repeat(72));
  console.log(`  planned images  : ${plan.items.length} across ${plan.artworkCount} artworks`);
  console.log(`  skipped         : ${plan.skipped.length} (${plan.skipped.map((s) => s.basename).join(', ') || '—'})`);
  console.log(`  linkable now    : ${plan.linkableCount}`);
  console.log(`  staging         : ${STAGING_ROOT}`);
  console.log(`  ladder          : ${RENDITION_NAMES.map((n) => `${n}<=${RENDITIONS[n].width} q${RENDITIONS[n].quality}`).join(' · ')}`);
  console.log('');

  for (const item of plan.items) {
    assertSafePublicId(item.publicId);
  }

  if (dryRun) {
    for (const item of items) {
      const abs = resolveSource(item.archive, item.archivePath);
      const exists = fs.existsSync(abs);
      const kb = exists ? (fs.statSync(abs).size / 1024).toFixed(0) : '?';
      console.log(
        `  ${item.publicId.padEnd(38)} ${item.kind.padEnd(16)} ${kb.padStart(5)}KB  ` +
          `${exists ? '' : '⚠ MISSING  '}${item.linkable ? 'linkable' : 'unlinked'}  ← ${item.sourcePath}`
      );
    }
    console.log('');
    console.log(`DRY RUN — nothing rendered. ${items.length} image(s) would be written to ${STAGING_ROOT}`);
    return;
  }

  const previous = force ? null : loadManifest();
  const ladderMatches =
    previous != null && JSON.stringify(previous.ladder) === JSON.stringify(RENDITIONS);
  const priorByPublicId = new Map((previous?.entries ?? []).map((e) => [e.publicId, e]));

  fs.mkdirSync(STAGING_ROOT, { recursive: true });

  const entries: RenderManifestEntry[] = [];
  const failures: { publicId: string; error: string }[] = [];
  let rendered = 0;
  let reused = 0;

  for (const [index, item] of items.entries()) {
    const label = `[${index + 1}/${items.length}]`;
    try {
      const abs = resolveSource(item.archive, item.archivePath);
      if (!fs.existsSync(abs)) throw new Error(`source file not found: ${item.archivePath}`);
      const source = fs.readFileSync(abs);
      const hash = sha256(source);

      // Idempotency: identical bytes + a matching ladder + all three objects present ⇒ reuse.
      const prior = priorByPublicId.get(item.publicId);
      const stagingDir = path.join(STAGING_ROOT, item.publicId);
      const objectsPresent = RENDITION_NAMES.every((n) =>
        fs.existsSync(path.join(stagingDir, `${n}.webp`))
      );
      if (ladderMatches && prior && prior.sourceSha256 === hash && objectsPresent) {
        entries.push(prior);
        reused += 1;
        console.log(`${label} SKIP  ${item.publicId} — unchanged`);
        continue;
      }

      const result = await renderRenditions(source, item.publicId);
      fs.mkdirSync(stagingDir, { recursive: true });
      for (const name of RENDITION_NAMES) {
        fs.writeFileSync(path.join(stagingDir, `${name}.webp`), result.buffers[name]);
      }

      entries.push({
        basename: item.basename,
        archive: item.archive,
        archivePath: item.archivePath,
        sourcePath: item.sourcePath,
        artworkSlug: item.artworkSlug,
        publicId: item.publicId,
        linkable: item.linkable,
        kind: item.kind,
        derivativeOf: item.derivativeOf,
        sourceBytes: source.length,
        sourceSha256: hash,
        width: result.width,
        height: result.height,
        format: result.format,
        lqip: result.lqip,
        renditions: result.renditions,
      });
      rendered += 1;
      const ceiling = item.kind === 'derivative-only' ? '  (derivative-only — capped at source width)' : '';
      console.log(
        `${label} OK    ${item.publicId} — ${result.width}x${result.height} ${result.format}, ` +
          `full ${(result.renditions.full.bytes / 1024).toFixed(0)}KB${ceiling}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ publicId: item.publicId, error: message });
      console.log(`${label} FAIL  ${item.publicId} — ${message}`);
    }
  }

  // `--only`/`--limit` produce a partial manifest by design; say so rather than silently replacing
  // a complete one with a subset that the register stage would then treat as the whole plan.
  const partial = Boolean(only) || Boolean(limit);
  if (partial && previous) {
    for (const prior of previous.entries) {
      if (!entries.some((e) => e.publicId === prior.publicId)) entries.push(prior);
    }
  }

  entries.sort((a, b) => a.artworkSlug.localeCompare(b.artworkSlug) || a.basename.localeCompare(b.basename));

  const manifest: RenderManifest = {
    generatedAt: new Date().toISOString(),
    ladder: RENDITIONS,
    extraction: { path: path.relative(process.cwd(), EXTRACTION_PATH), generatedAt: extraction.generatedAt },
    entries,
    skipped: plan.skipped,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log('');
  console.log('--- SUMMARY ---');
  console.log(`  rendered        : ${rendered}`);
  console.log(`  reused          : ${reused}`);
  console.log(`  failed          : ${failures.length}`);
  for (const f of failures) console.log(`    ${f.publicId}: ${f.error}`);
  console.log(`  manifest        : ${MANIFEST_PATH} (${entries.length} entries)`);
  console.log(`  objects written : ${entries.length * RENDITION_NAMES.length} (no \`original.*\`)`);
  console.log('');
  console.log('Nothing was uploaded. Next: npx tsx scripts/wayback-register.ts   (plan only; add --apply to write)');

  if (failures.length > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error('wayback-render failed:', err?.stack ?? err?.message ?? err);
  process.exit(1);
});
