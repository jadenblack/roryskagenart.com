/**
 * Render the Phase 3.A staged backfill SQL.
 *
 *   npx tsx scripts/wayback-stage-sql.ts              # write supabase/staged/
 *   npx tsx scripts/wayback-stage-sql.ts --dry-run    # plan + summary, write nothing
 *   npx tsx scripts/wayback-stage-sql.ts --out <path> # write somewhere else
 *
 * READ-ONLY with respect to Supabase. It reads two generated JSON artifacts and writes one SQL
 * file. It never opens a database connection, never touches Storage, and never touches `wayback/`.
 *
 * The output is STAGED, not applied — see the header of scripts/lib/waybackBackfill.ts and the
 * rendered file itself for why it must not live in supabase/migrations/ yet.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  buildBackfillPlan,
  mergeSources,
  renderBackfillSql,
  type CanonicalArtwork,
  type ExtractionFile,
} from './lib/waybackBackfill';

const EXTRACTION_PATH = path.resolve(process.cwd(), 'data', 'archive', 'wayback_extraction.json');
/**
 * The mural half of the backfill comes from the recovered export, not the scrape (D2).
 *
 * ⚠️ It is a *second source*, not a replacement. This file covers two archives; the recovered export
 * covers one. See `mergeSources()` in `./lib/waybackBackfill`.
 */
const RECOVERED_EXTRACTION_PATH = path.resolve(
  process.cwd(),
  'data',
  'archive',
  'wayback_recovered_extraction.json'
);
const CANONICAL_PATH = path.resolve(
  process.cwd(),
  'data',
  'archive',
  'wayback_canonical_catalog.json'
);
const STAGED_DIR = path.resolve(process.cwd(), 'supabase', 'staged');
const OUT_NAME = '2026_09_15_v3_wayback_backfill.sql';

interface CanonicalFile {
  capturedAt: string;
  source: string;
  artworks: CanonicalArtwork[];
}

function readJson<T>(p: string, what: string): T {
  if (!fs.existsSync(p)) {
    throw new Error(
      `${what} not found at ${p}.\n` +
        'Run `npx tsx scripts/snapshot-canonical-catalog.ts` then `npx tsx scripts/wayback-extract.ts` first.'
    );
  }
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

export function main(argv: string[] = process.argv.slice(2)): void {
  const dryRun = argv.includes('--dry-run');
  const outIdx = argv.indexOf('--out');
  const outPath =
    outIdx >= 0 && argv[outIdx + 1]
      ? path.resolve(argv[outIdx + 1])
      : path.join(STAGED_DIR, OUT_NAME);

  const scrape = readJson<ExtractionFile>(EXTRACTION_PATH, 'Extraction output');
  const recovered = readJson<ExtractionFile>(
    RECOVERED_EXTRACTION_PATH,
    'Recovered extraction output'
  );
  const canonical = readJson<CanonicalFile>(CANONICAL_PATH, 'Canonical snapshot');

  // D2: murals from the recovered export, paintings from the scrape.
  const extraction = mergeSources(scrape, recovered);

  const plan = buildBackfillPlan(extraction, canonical);
  const sql = renderBackfillSql(plan, {
    generatedAt: new Date().toISOString(),
    canonicalCapturedAt: canonical.capturedAt,
    canonicalSource: canonical.source,
    extractionGeneratedAt: extraction.generatedAt,
  });

  const s = plan.stats;

  console.log('='.repeat(72));
  console.log('Wayback backfill — STAGE (read-only; no DB writes, no uploads)');
  console.log('='.repeat(72));
  console.log(`  canonical snapshot : ${canonical.capturedAt} (${canonical.artworks.length} artworks)`);
  console.log(`  scrape (paintings) : ${scrape.generatedAt} (${scrape.records.length} records)`);
  console.log(
    `  recovered (murals) : ${recovered.generatedAt} (${recovered.records.length} records, ` +
      `${recovered.pages.length} pages)`
  );
  console.log(
    `  merged             : ${extraction.records.length} records, ${extraction.pages.length} pages`
  );
  console.log('');
  console.log(`  records            : ${s.records}`);
  console.log(`  INSERT  (NEW)      : ${s.inserted}`);
  console.log(`  UPDATE  (EXISTS)   : ${s.updated}   (${s.yearFills} carry a year fill)`);
  console.log(`  HELD               : ${s.held}`);
  console.log(`      collision      : ${s.heldCollision}`);
  console.log(`      known dedupe   : ${s.heldDedupe}`);
  console.log(`      fuzzy match    : ${s.heldFuzzy}`);
  console.log('');

  if (s.yearMismatches > 0) {
    console.log(
      `  ⚠ ${s.yearMismatches} EXISTS rows store a year that disagrees with the archive.`
    );
    console.log(
      "    Every catalog row stores '2024' (the POST /api/artworks default), so fill-only-empty"
    );
    console.log('    cannot correct them. Listed as a diagnostic in the file; no statement emitted.');
    console.log('');
  }

  if (s.held > 0) {
    console.log('  Held rows need a human decision before they can be staged:');
    for (const h of plan.held) {
      console.log(`    · [${h.reason}] ${h.slug ?? '(no slug)'} — ${h.relPath}`);
    }
    console.log('');
  }

  if (s.newWithUploadableImage > 0) {
    console.log(
      `  note: ${s.newWithUploadableImage} NEW rows have an image awaiting registration (Phase 3.B).`
    );
    console.log('        image_url is left NULL in this file by design.');
    console.log('');
  }

  if (dryRun) {
    console.log('  --dry-run: nothing written.');
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, sql, 'utf8');

  const lines = sql.split('\n').length;
  console.log(`  → ${outPath}`);
  console.log(`    ${lines} lines, ${Buffer.byteLength(sql, 'utf8')} bytes`);
  console.log('');
  console.log('  This file is STAGED. It is not applied by scripts/run-migrations.ts.');
  console.log('  Promote it in the Phase 4 PR, after the preconditions in its header are met.');
}

try {
  main();
} catch (err) {
  console.error('wayback-stage-sql failed:', (err as Error)?.message ?? err);
  process.exit(1);
}
