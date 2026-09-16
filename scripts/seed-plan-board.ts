/**
 * Seeds the planning board with the work that actually exists: one review item per unpublished
 * mural.
 *
 * WHY THIS IS IN THE MOST BASIC VERSION (§4, task 12)
 * An empty planning board is abandoned within a fortnight. There are ~60 murals in the catalog
 * that are live as `draft = true` and `enabled = false` — visible to nobody, absent from the
 * sitemap, and reviewed by no process at all (this is Q17 in `plan/ROADMAP_V3.md`, and the reason
 * `plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md` §8 warns that building a planning tool is
 * a very plausible thing to do *instead of* the work that publishes them). Seeding the board with
 * them does three things at once: it answers "how do mural drafts get reviewed?" with the cheapest
 * mechanism available, it gives the board immediate purpose, and it exercises the partial unique
 * index on `source_ref` against real data.
 *
 * ⚠️ IDEMPOTENT BY NATURAL KEY, AND IT SAYS SO OUT LOUD
 * The key is `source_ref = 'artwork:<slug>'`. Re-running must insert nothing.
 *
 * The classification is done in JavaScript against a pre-loaded set of existing keys, **not** by
 * relying on `ON CONFLICT DO NOTHING`. That is the Phase 3 NEW/EXISTS/COLLISION discipline, and
 * the reason is concrete: a silent `ON CONFLICT DO NOTHING` hides a wrong natural key — if the key
 * were built from the title instead of the slug, every run would insert nothing, the script would
 * report success, and the board would be seeded from the wrong rows forever. Here a conflict that
 * was *not* predicted by the pre-load is reported as a COLLISION and fails the run.
 *
 * Usage:
 *   npx tsx scripts/seed-plan-board.ts              # classify, then write
 *   npx tsx scripts/seed-plan-board.ts --dry-run    # classify only; writes nothing
 */

import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import {
  CONNECTION_VARS,
  TargetSafetyError,
  connectionVarsSetByOperator,
  describeTarget,
  resolvePoolTarget,
} from './lib/pgTarget';

const DRY_RUN = process.argv.includes('--dry-run');

/** The natural key. One prefix per source of items, so a future source cannot collide with these. */
const SOURCE_REF_PREFIX = 'artwork:';

interface MuralRow {
  slug: string;
  title: string;
  gallery_series: string | null;
  location: string | null;
  year: string | null;
}

type Classification = 'NEW' | 'EXISTS' | 'COLLISION';

interface Candidate {
  source_ref: string;
  classification: Classification;
  title: string;
  body: string;
}

/**
 * Resolve the connection string, preferring what the operator exported over what `.env` holds.
 *
 * ⚠️ The order is the point. `.env` in this repository points at the **production** Supabase
 * database, and `dotenv` fills any variable the shell did *not* export — so a `dotenv.config()`
 * first would let a stale `.env` silently win over an operator who deliberately exported a
 * scratch-database URL. `scripts/run-migrations.ts` was fixed for exactly this in v3.0.0; the same
 * two lines are repeated here rather than shared, because the migration runner also needs the
 * classification for its own refusal logic.
 */
function resolveConnectionString(): string {
  const fromOperator = connectionVarsSetByOperator(process.env);
  dotenv.config();
  const preferred = fromOperator.length > 0 ? fromOperator : CONNECTION_VARS;
  for (const name of preferred) {
    if (process.env[name]) return process.env[name] as string;
  }
  throw new TargetSafetyError(
    `No connection string. Set one of: ${CONNECTION_VARS.join(', ')}.`
  );
}

function buildTitle(mural: MuralRow): string {
  return `Review mural: ${mural.title}`;
}

/**
 * The body is written for the person who has to make the call, not for the script.
 *
 * It states the current state plainly (private draft, no sitemap entry), says what the decision
 * is, and says how to record it — because the answer to "what do I do with this item?" should not
 * require reading this file.
 */
function buildBody(mural: MuralRow): string {
  const context = [mural.gallery_series, mural.year, mural.location].filter(Boolean).join(' · ');

  return [
    'Imported from the studio’s archived mural site as a **private draft**: it is not visible on',
    'the public site and it is absent from the sitemap.',
    context ? `\nCatalog context: ${context}` : '',
    '\nDecide what should happen to it — publish it, merge it into an existing catalog entry, or',
    'leave it unpublished — then record the decision by moving this item to Done or Declined.',
    `\nStudio edit link: /admin/catalog?edit=${mural.slug}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

async function main(): Promise<void> {
  const connectionString = resolveConnectionString();
  const poolTarget = resolvePoolTarget(connectionString);

  console.log(`Target: ${describeTarget(connectionString)}${poolTarget.isRemote ? ' (remote)' : ' (local)'}`);
  if (DRY_RUN) console.log('Mode:   --dry-run — nothing will be written.\n');

  const pool = new Pool({
    connectionString: poolTarget.connectionString,
    ssl: poolTarget.ssl,
  });

  try {
    // The candidate set: unpublished murals. `kind` was added by the Phase 4 schema extension, so
    // this script must run after that migration — it does, and the column check below says so
    // rather than failing with a raw "column does not exist".
    const murals = await pool.query<MuralRow>(
      `SELECT slug, title, gallery_series, location, year
         FROM public.artworks
        WHERE kind = 'mural'
          AND draft = true
          AND trashed = false
        ORDER BY slug`
    );

    if (murals.rows.length === 0) {
      console.warn(
        '⚠️  No murals matched `kind = \'mural\' AND draft = true AND trashed = false`.\n' +
          '    Either every mural has been published, or the Phase 4 schema extension has not been\n' +
          '    applied. Nothing to do — refusing to report a seed that seeded nothing as success.'
      );
      process.exit(0);
    }

    // Pre-load the keys that already exist. This is what turns a conflict into a *reported*
    // event instead of a silently swallowed one.
    const existing = await pool.query<{ source_ref: string }>(
      `SELECT source_ref FROM public.plan_items WHERE source_ref IS NOT NULL`
    );
    const existingKeys = new Set(existing.rows.map((row) => row.source_ref));

    const candidates: Candidate[] = murals.rows.map((mural) => {
      const source_ref = `${SOURCE_REF_PREFIX}${mural.slug}`;
      return {
        source_ref,
        classification: existingKeys.has(source_ref) ? 'EXISTS' : 'NEW',
        title: buildTitle(mural),
        body: buildBody(mural),
      };
    });

    // A key appearing twice in one candidate set would make the run's own counts meaningless.
    const duplicateKeys = candidates
      .map((candidate) => candidate.source_ref)
      .filter((key, index, all) => all.indexOf(key) !== index);
    if (duplicateKeys.length > 0) {
      console.error(`✗ The candidate set contains duplicate keys: ${[...new Set(duplicateKeys)].join(', ')}`);
      process.exit(1);
    }

    const toInsert = candidates.filter((candidate) => candidate.classification === 'NEW');
    const collisions: string[] = [];

    if (!DRY_RUN) {
      for (const candidate of toInsert) {
        // `ON CONFLICT DO NOTHING` is a *backstop* here, not the mechanism: the classification
        // above already decided this row is new, so a conflict now means the pre-load disagreed
        // with the database and the natural key is not what this script believes it is.
        const result = await pool.query(
          `INSERT INTO public.plan_items (
             kind, title, body, status, source, source_ref
           ) VALUES ('task', $1, $2, 'new', 'studio', $3)
           ON CONFLICT DO NOTHING`,
          [candidate.title, candidate.body, candidate.source_ref]
        );
        if (result.rowCount === 0) {
          collisions.push(candidate.source_ref);
        }
      }
    }

    const inserted = DRY_RUN ? 0 : toInsert.length - collisions.length;

    console.log(`murals found:      ${murals.rows.length}`);
    console.log(`  NEW:             ${toInsert.length}${DRY_RUN ? ' (dry run — not written)' : ''}`);
    console.log(`  EXISTS:          ${candidates.length - toInsert.length}`);
    console.log(`  COLLISION:       ${collisions.length}`);
    if (!DRY_RUN) console.log(`  inserted:        ${inserted}`);

    if (collisions.length > 0) {
      console.error(
        `\n✗ ${collisions.length} row(s) conflicted despite being classified NEW. The natural key is\n` +
          '  not what this script thinks it is — investigate before re-running:\n' +
          collisions.slice(0, 10).map((key) => `    ${key}`).join('\n')
      );
      process.exit(1);
    }

    console.log(
      DRY_RUN
        ? '\nDry run complete. Re-run without --dry-run to write.'
        : `\nSeeded ${inserted} item(s). Re-running must insert 0 — that is the idempotency check.`
    );
  } finally {
    await pool.end();
  }
}

// Guard against `dotenv` being loaded twice through an import — the operator-precedence read above
// has to happen before the first `dotenv.config()`, so this file must not be imported by another
// module that has already called it.
if (process.argv[1] && path.basename(process.argv[1]).startsWith('seed-plan-board')) {
  main().catch((error) => {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
