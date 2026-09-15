/**
 * Phase 4, step 4 — write the taxonomy dimension and the `artwork_terms` rows (D5 / Q6, R-09).
 *
 * **This is a write.** Plan by default; `--apply` to execute. Same discipline as
 * `wayback-register.ts`, `wayback-link.ts` and `restore-catalog.ts`.
 *
 * It creates the 10 taxonomy rows the recovered export defines — 8 `project_type`, 2 `curation` —
 * and then the `artwork_terms` rows that file each mural under them. `artwork_terms` has been empty
 * since the baseline, so this is the first exercise of the M2M path (R-09).
 *
 * Usage:
 *   npx tsx scripts/wayback-taxonomies.ts                 # plan only
 *   npx tsx scripts/wayback-taxonomies.ts --apply         # write
 *   npx tsx scripts/wayback-taxonomies.ts --extraction <path>
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { resolvePoolTarget } from './lib/pgTarget';
import {
  isWritable,
  planTaxonomies,
  type ExtractionPage,
  type ExtractionRecord,
  type ExtractionTaxonomy,
} from './lib/waybackTaxonomies';

dotenv.config();

const DEFAULT_EXTRACTION = path.resolve('data/archive/wayback_recovered_extraction.json');

interface ExtractionFile {
  taxonomy: ExtractionTaxonomy[];
  pages: ExtractionPage[];
  records: ExtractionRecord[];
}

interface Args {
  apply: boolean;
  extraction?: string;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--extraction') args.extraction = argv[++i];
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
  const extractionPath = args.extraction ? path.resolve(args.extraction) : DEFAULT_EXTRACTION;
  if (!fs.existsSync(extractionPath)) {
    throw new Error(`Extraction not found: ${extractionPath}`);
  }
  const extraction = JSON.parse(fs.readFileSync(extractionPath, 'utf8')) as ExtractionFile;

  const poolTarget = resolvePoolTarget(getConnectionString());
  const pool = new Pool({ connectionString: poolTarget.connectionString, ssl: poolTarget.ssl });

  console.log('='.repeat(72));
  console.log(`Wayback taxonomies → Supabase${args.apply ? '' : ' (PLAN ONLY — pass --apply to write)'}`);
  console.log('='.repeat(72));
  console.log(`  extraction      : ${extractionPath}`);
  console.log(`  target          : ${poolTarget.host}${poolTarget.isRemote ? '  ⚠ REMOTE' : '  (local)'}`);
  console.log('');

  const { rows: artworkRows } = await pool.query<{ slug: string }>('SELECT slug FROM public.artworks');
  const { rows: taxonomyRows } = await pool.query<{ type: string; slug: string }>(
    'SELECT type, slug FROM public.taxonomies'
  );

  const plan = planTaxonomies(
    extraction.taxonomy,
    extraction.pages,
    extraction.records,
    artworkRows.map((r) => r.slug)
  );

  const projectTypes = plan.taxonomyRows.filter((r) => r.type === 'project_type');
  const curation = plan.taxonomyRows.filter((r) => r.type === 'curation');
  const existingKeys = new Set(taxonomyRows.map((t) => `${t.type}\u0000${t.slug}`));
  const newTaxonomies = plan.taxonomyRows.filter((r) => !existingKeys.has(`${r.type}\u0000${r.slug}`));

  console.log('--- PLAN ---');
  console.log(`  taxonomies existing     : ${taxonomyRows.length}`);
  console.log(`  taxonomies to create    : ${newTaxonomies.length}   (${projectTypes.length} project_type, ${curation.length} curation)`);
  console.log(`  artwork_terms to write  : ${plan.distinctTerms}`);
  console.log(`  artworks receiving terms: ${new Set(plan.terms.map((t) => t.artworkSlug)).size}`);
  console.log('');
  console.log(`  ⚠ unknown categories    : ${plan.unknownCategories.length}`);
  console.log(`  ⚠ unknown artworks      : ${plan.unknownArtworks.length}`);
  if (plan.unknownCategories.length) {
    for (const c of plan.unknownCategories) console.log(`      category not in the taxonomy block: ${c}`);
  }
  if (plan.unknownArtworks.length) {
    for (const s of plan.unknownArtworks.slice(0, 20)) console.log(`      artwork not in the DB: ${s}`);
  }
  console.log('');
  console.log('  taxonomy rows:');
  for (const r of plan.taxonomyRows) {
    console.log(`    ${r.type.padEnd(13)} ${r.slug.padEnd(12)} ${r.name}`);
  }
  console.log('');

  if (!isWritable(plan)) {
    await pool.end();
    throw new Error('Refusing to write — the plan has unknown categories or artworks.');
  }

  if (!args.apply) {
    console.log('Plan only — nothing was written. Re-run with --apply to execute.');
    await pool.end();
    return;
  }

  // --- Apply -------------------------------------------------------------------------------------
  const client = await pool.connect();
  let taxWritten = 0;
  let termsWritten = 0;
  try {
    await client.query('BEGIN');

    for (const row of plan.taxonomyRows) {
      await client.query(
        `INSERT INTO public.taxonomies (type, slug, name, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (type, slug) DO UPDATE
           SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order`,
        [row.type, row.slug, row.name, row.sortOrder]
      );
      taxWritten += 1;
    }

    for (const term of plan.terms) {
      // Resolve ids by name, so this is idempotent and does not depend on ids read earlier.
      const res = await client.query(
        `INSERT INTO public.artwork_terms (artwork_id, term_id)
         SELECT a.id, t.id
           FROM public.artworks a, public.taxonomies t
          WHERE a.slug = $1 AND t.type = $2 AND t.slug = $3
         ON CONFLICT DO NOTHING`,
        [term.artworkSlug, term.taxonomyType, term.taxonomySlug]
      );
      termsWritten += res.rowCount ?? 0;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    await pool.end();
    throw err;
  }

  const { rows: taxCount } = await pool.query<{ c: number }>('SELECT count(*)::int c FROM public.taxonomies');
  const { rows: termCount } = await pool.query<{ c: number }>('SELECT count(*)::int c FROM public.artwork_terms');

  console.log('--- SUMMARY ---');
  console.log(`  taxonomies upserted     : ${taxWritten}`);
  console.log(`  artwork_terms inserted  : ${termsWritten}`);
  console.log(`  taxonomies total        : ${taxCount[0].c}`);
  console.log(`  artwork_terms total     : ${termCount[0].c}`);
  console.log('');

  await pool.end();
}

main().catch((err) => {
  console.error('wayback-taxonomies failed:', err?.stack ?? err?.message ?? err);
  process.exit(1);
});
