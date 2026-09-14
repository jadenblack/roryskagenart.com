/**
 * Pure, side-effect-free helpers for the migration runner.
 *
 * WHY THIS IS A SEPARATE MODULE
 * `scripts/run-migrations.ts` is the highest-consequence code in the repo — it is the only
 * thing allowed to mutate the production schema. It previously had zero test coverage
 * because it opens a database connection at import time. The ordering and skip decisions
 * are the part that can actually go wrong, and they are pure: given the files on disk and
 * the set of already-applied filenames, which files do we run, in what order?
 *
 * Those decisions live here so `src/test/migrationPlan.test.ts` can lock them down
 * offline — no database, no network, no credentials.
 *
 * ORDERING IS LOAD-BEARING: migrations are applied in plain lexicographic filename sort,
 * which is why every file is date-prefixed and why the baseline must be dated *before*
 * every migration that depends on it. See docs/adr/0001.
 */
import fs from 'fs';
import path from 'path';

/** Default location of the SQL migrations, resolved from the process working directory. */
export const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');

/**
 * Every migration filename, in the exact order the runner applies them.
 *
 * Plain `.sort()` on purpose: this is the same comparison the runner has always used, so
 * changing it here would silently reorder production migrations.
 */
export function listMigrationFiles(dir: string = MIGRATIONS_DIR): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * The subset of `allFiles` not yet recorded in `public.schema_migrations`.
 * Order is preserved, so the caller's apply order is unchanged.
 */
export function selectPending(allFiles: string[], applied: Iterable<string>): string[] {
  const done = new Set(applied);
  return allFiles.filter((f) => !done.has(f));
}

/**
 * The files a given invocation should consider: explicit CLI arguments if any were passed,
 * otherwise every migration on disk.
 */
export function resolveTargets(explicit: string[], dir: string = MIGRATIONS_DIR): string[] {
  return explicit.length ? explicit : listMigrationFiles(dir);
}

/** Throws unless every requested filename exists on disk (guards against typos in CLI args). */
export function assertExist(files: string[], dir: string = MIGRATIONS_DIR): void {
  for (const f of files) {
    if (!fs.existsSync(path.join(dir, f))) {
      throw new Error(`Migration file not found: ${f}`);
    }
  }
}
