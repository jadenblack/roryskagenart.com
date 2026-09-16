/**
 * Pure, side-effect-free helpers for the catalog restore script.
 *
 * WHY THIS IS A SEPARATE MODULE
 * `scripts/restore-catalog.ts` is the counterpart to `backup-catalog.ts`, and it is the only
 * thing in the repo that can put a snapshot *back* into a database. It is also the safety net
 * for the v3 migration on a Supabase **Free** plan, where the platform provides no automatic
 * backups at all (verified 2026-09-14 — see docs/runbooks/database-backup-restore.md §3).
 *
 * The decisions that can go wrong are pure: which tables to touch and in what order, whether a
 * target is safe to write to, and how a JSON row becomes a parameterised statement. Those live
 * here so `src/test/restorePlan.test.ts` can lock them down offline — no database, no network,
 * no credentials.
 *
 * ORDERING IS LOAD-BEARING: foreign keys mean `artwork_terms` cannot be inserted before
 * `artworks`/`taxonomies`, and `settings` cannot be inserted before `profiles`.
 * See the live constraints in data/archive/schema_introspection.md.
 */

import { TargetSafetyError, classifyTarget } from './pgTarget';

/** How a restore treats a row that already exists. */
export type RestoreMode =
  /** Populate a scratch/empty database. Existing rows are left alone. */
  | 'load'
  /** Overwrite existing rows with the snapshot's values — the actual rollback. */
  | 'repair';

export interface TableSpec {
  name: string;
  /**
   * The conflict target, used by `repair` mode's `ON CONFLICT (…) DO UPDATE`.
   * Verified against the live schema's PRIMARY KEYs (data/archive/schema_introspection.md).
   */
  conflictTarget: string[];
}

/**
 * Every restorable table, with its verified primary key.
 *
 * `schema_migrations` is deliberately absent: the migration runner owns it and it is
 * reconstructible by re-running the runner.
 */
export const TABLES: Record<string, TableSpec> = {
  profiles: { name: 'profiles', conflictTarget: ['id'] },
  taxonomies: { name: 'taxonomies', conflictTarget: ['id'] },
  settings: { name: 'settings', conflictTarget: ['key'] },
  artworks: { name: 'artworks', conflictTarget: ['id'] },
  artwork_terms: { name: 'artwork_terms', conflictTarget: ['artwork_id', 'term_id'] },
  media_assets: { name: 'media_assets', conflictTarget: ['id'] },
  // v3.0.0 Phase 4 (D3 / Q16). Composite PK, and it FKs to BOTH `artworks(slug)` and
  // `media_assets(public_id)`, so it must be inserted after both.
  artwork_images: { name: 'artwork_images', conflictTarget: ['artwork_slug', 'media_public_id'] },
  pages: { name: 'pages', conflictTarget: ['slug'] },
  inquiries: { name: 'inquiries', conflictTarget: ['id'] },
  // v3.2.0 Group — releases become first-class. Inserted before `plan_items`, which FKs to it via
  // `release_id`.
  plan_releases: { name: 'plan_releases', conflictTarget: ['id'] },
  // v3.1.0 — the studio feedback & planning board. Registered here in the SAME PR that created it,
  // which is the whole point of R-07: `artwork_images` was in NO backup set until v3.0.0, so the
  // dump looked complete while the murals' cover ordering was unrestorable. A table created by a
  // migration is not backed up until someone adds it by hand — `TABLES` + `RESTORE_ORDER` is what
  // makes it dumped, because both `scripts/backup-catalog.ts` and `server/lib/catalogDump.ts` walk
  // `RESTORE_ORDER`.
  plan_items: { name: 'plan_items', conflictTarget: ['id'] },
};

/**
 * Insert order, derived from the live foreign keys:
 *   profiles.id      → auth.users(id)          (see CAVEAT below)
 *   settings.updated_by → profiles(id)
 *   artwork_terms.artwork_id → artworks(id)
 *   artwork_terms.term_id    → taxonomies(id)
 *   artwork_images.artwork_slug     → artworks(slug)
 *   artwork_images.media_public_id  → media_assets(public_id)
 *   plan_items.author_id            → profiles(id)   (v3.1.0; nullable, ON DELETE SET NULL)
 *   plan_items.release_id           → plan_releases(id)  (v3.2.0; nullable, ON DELETE SET NULL)
 *
 * CAVEAT: `profiles` references `auth.users`, which exists in Supabase but is **empty** in a
 * fresh local project. Restoring `profiles` there fails unless the matching auth users exist
 * first. That is why the catalog tables are the default set — see `CATALOG_TABLES`.
 *
 * ⚠️ SECOND CAVEAT, new in v3.1.0: `plan_items.author_id` inherits the same problem one step
 * removed. A restore into a database with no matching `profiles` rows reports a foreign-key failure
 * for every item that a staff member authored — items filed anonymously or by the seed backfill
 * carry a NULL `author_id` and restore cleanly. `author_name` / `author_email` are denormalised on
 * the table precisely so an item stays attributable when the profile does not come back.
 */
export const RESTORE_ORDER: string[] = [
  'profiles',
  'taxonomies',
  'settings',
  'artworks',
  'artwork_terms',
  'media_assets',
  'artwork_images',
  'pages',
  'inquiries',
  'plan_releases',
  'plan_items',
];

/**
 * The default restore set: the catalog itself.
 *
 * `profiles` and `settings` are deliberately excluded by default. They are *environment*
 * state, not catalog content: `profiles` needs matching `auth.users` rows, and `settings`
 * carries the live theme palette and FK-references `profiles`. Rehearsing the v3 migration
 * needs neither, so the safe default is the set that actually works everywhere.
 */
export const CATALOG_TABLES: string[] = [
  'taxonomies',
  'artworks',
  'artwork_terms',
  'media_assets',
  'artwork_images',
  'pages',
  'inquiries',
  // v3.2.0. Same reasoning as `plan_items` below, and stronger: `plan_items.release_id` FKs to
  // `plan_releases(id)`, so a catalog restore that omitted it would fail the foreign key on every
  // grouped item. Studio content, not environment state.
  'plan_releases',
  // v3.1.0. Included deliberately, against the `settings` precedent (a profiles-FK table that is
  // excluded): the board is studio *content*, not environment state, and the alternative is a
  // planning history that only comes back with `--all` — which is the failure P-06 describes.
  // The trade is explicit: on a scratch database with no `profiles`, rows with a non-null
  // `author_id` fail their foreign key and are reported in the run's `failed` count. See the
  // second caveat on `RESTORE_ORDER` above.
  'plan_items',
];

/** Environment/auth state — opt in explicitly with `--all`. */
export const ENVIRONMENT_TABLES: string[] = ['profiles', 'settings'];

/**
 * Target classification and the refusal error now live in `./pgTarget`, next to the SSL rule
 * that keys off the same classification — one definition of "is this target local", used by
 * both the write guard and the connection setup.
 *
 * Re-exported here under the original names so `scripts/restore-catalog.ts` and
 * `src/test/restorePlan.test.ts` keep working unchanged.
 */
export { classifyTarget } from './pgTarget';
export { TargetSafetyError as RestoreSafetyError } from './pgTarget';

/**
 * Throws unless the target is safe given the operator's explicit intent.
 * `allowRemote` must be passed deliberately (the CLI's `--allow-remote`).
 */
export function assertSafeTarget(rawUrl: string, allowRemote: boolean): { host: string; isRemote: boolean } {
  const target = classifyTarget(rawUrl);
  if (target.isRemote && !allowRemote) {
    throw new TargetSafetyError(
      `Refusing to write to remote host "${target.host}" without --allow-remote. ` +
        'A restore is a destructive operation; pass --allow-remote only when you intend it.'
    );
  }
  return target;
}

/**
 * Resolve the tables to restore, preserving `RESTORE_ORDER`.
 *
 * Throws on an unknown table name rather than silently ignoring it — a typo in `--tables`
 * must not look like a successful run.
 */
export function resolveTables(options: {
  requested?: string[];
  includeEnvironment?: boolean;
} = {}): TableSpec[] {
  const names = options.requested?.length
    ? options.requested
    : options.includeEnvironment
      ? RESTORE_ORDER
      : CATALOG_TABLES;

  for (const name of names) {
    if (!TABLES[name]) {
      throw new TargetSafetyError(
        `Unknown table "${name}". Known tables: ${Object.keys(TABLES).sort().join(', ')}.`
      );
    }
  }

  // Always emit in dependency order, whatever order the operator listed them in.
  return RESTORE_ORDER.filter((name) => names.includes(name)).map((name) => TABLES[name]);
}

/**
 * Coerce a value from the JSON dump into something `pg` can bind.
 *
 * `jsonb` columns (`artworks.metadata`, `media_assets.renditions`, `settings.value`) come back
 * from `JSON.parse` as objects; node-postgres needs a string for those. Everything else —
 * including ISO timestamps, which Postgres casts — passes through untouched.
 */
export function toBindable(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

/** A generated statement plus its ordered bind parameters. */
export interface Statement {
  sql: string;
  values: unknown[];
}

/**
 * Build the statement for one row.
 *
 * Column order is sorted for determinism, so the generated SQL is stable across runs and can
 * be asserted in tests without depending on JSON key order.
 *
 * - `load`  → `ON CONFLICT DO NOTHING` (no target needed) — never mutates an existing row.
 * - `repair` → `ON CONFLICT (<pk>) DO UPDATE SET … = EXCLUDED.…` — the real rollback.
 */
export function buildStatement(spec: TableSpec, row: Record<string, unknown>, mode: RestoreMode): Statement {
  const columns = Object.keys(row).sort();
  if (columns.length === 0) {
    throw new TargetSafetyError(`Row for table "${spec.name}" has no columns.`);
  }

  const values = columns.map((column) => toBindable(row[column]));
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const columnList = columns.map((c) => `"${c}"`).join(', ');

  let sql = `INSERT INTO public.${spec.name} (${columnList}) VALUES (${placeholders.join(', ')})`;

  if (mode === 'repair') {
    const target = spec.conflictTarget.map((c) => `"${c}"`).join(', ');
    // Never rewrite the primary key itself; everything else takes the snapshot's value.
    const updates = columns
      .filter((column) => !spec.conflictTarget.includes(column))
      .map((column) => `"${column}" = EXCLUDED."${column}"`);
    sql += updates.length
      ? ` ON CONFLICT (${target}) DO UPDATE SET ${updates.join(', ')}`
      : ` ON CONFLICT (${target}) DO NOTHING`;
  } else {
    sql += ' ON CONFLICT DO NOTHING';
  }

  return { sql, values };
}

/** Per-table outcome, reported by the CLI. */
export interface TableResult {
  table: string;
  inserted: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/** True when the run should be treated as unsuccessful. */
export function hasFailures(results: TableResult[]): boolean {
  return results.some((r) => r.failed > 0);
}

/** One-line summary per table, plus a total. */
export function summarise(results: TableResult[]): string[] {
  const lines = results.map(
    (r) => `  ${r.table.padEnd(14)} ${String(r.inserted).padStart(5)} inserted  ${String(r.skipped).padStart(5)} skipped  ${String(r.failed).padStart(5)} failed`
  );
  const total = results.reduce(
    (acc, r) => ({ inserted: acc.inserted + r.inserted, skipped: acc.skipped + r.skipped, failed: acc.failed + r.failed }),
    { inserted: 0, skipped: 0, failed: 0 }
  );
  lines.push(
    `  ${'TOTAL'.padEnd(14)} ${String(total.inserted).padStart(5)} inserted  ${String(total.skipped).padStart(5)} skipped  ${String(total.failed).padStart(5)} failed`
  );
  return lines;
}
