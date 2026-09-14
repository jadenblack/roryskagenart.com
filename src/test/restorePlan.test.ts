/**
 * Coverage for the catalog restore path (scripts/restore-catalog.ts).
 *
 * WHY THIS EXISTS
 * The Supabase project was verified to be on the **Free** plan on 2026-09-14 — Free projects get
 * **no automatic backups at all** (docs/runbooks/database-backup-restore.md §3). The repo dump is
 * therefore the only recovery path the project has, which makes the restore script one of the
 * two highest-consequence pieces of code in the repo (the migration runner being the other).
 *
 * It cannot be imported in a test — it opens a pg Pool in main() and reads argv — so its decisions
 * live in scripts/lib/restorePlan.ts, which is pure. These tests lock down the things that would
 * turn a safety net into a footgun:
 *
 *   1. THE TARGET GUARD — a restore must never silently write to a remote database.
 *   2. THE DEFAULT SET — must be the catalog tables, never `profiles`/`settings`.
 *   3. THE ORDER — foreign keys make this load-bearing.
 *   4. THE GENERATED SQL — column binding, jsonb encoding, and load-vs-repair semantics.
 *
 * Zero tokens: no database, no network.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  CATALOG_TABLES,
  ENVIRONMENT_TABLES,
  RESTORE_ORDER,
  RestoreSafetyError,
  TABLES,
  assertSafeTarget,
  buildStatement,
  classifyTarget,
  hasFailures,
  resolveTables,
  summarise,
  toBindable,
} from '../../scripts/lib/restorePlan';

describe('classifyTarget', () => {
  it('treats loopback hosts as local', () => {
    for (const url of [
      'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      'postgresql://postgres:postgres@localhost:54322/postgres',
      'postgresql://postgres:postgres@host.docker.internal:54322/postgres',
    ]) {
      expect(classifyTarget(url).isRemote).toBe(false);
    }
  });

  it('treats the production Supabase host as remote', () => {
    const target = classifyTarget('postgresql://postgres:pw@db.orphcusijzkxpxkzapjp.supabase.co:5432/postgres');
    expect(target.isRemote).toBe(true);
    expect(target.host).toBe('db.orphcusijzkxpxkzapjp.supabase.co');
  });

  it('throws on an unparseable connection string', () => {
    expect(() => classifyTarget('not-a-url')).toThrow(RestoreSafetyError);
  });
});

describe('assertSafeTarget — the guard that must never regress', () => {
  const remote = 'postgresql://postgres:pw@db.orphcusijzkxpxkzapjp.supabase.co:5432/postgres';
  const local = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  it('REFUSES a remote target unless explicitly allowed', () => {
    expect(() => assertSafeTarget(remote, false)).toThrow(/Refusing to write to remote host/);
  });

  it('permits a remote target when --allow-remote was passed deliberately', () => {
    expect(assertSafeTarget(remote, true).isRemote).toBe(true);
  });

  it('permits a local target without the flag', () => {
    expect(assertSafeTarget(local, false).isRemote).toBe(false);
  });
});

describe('resolveTables', () => {
  it('defaults to the catalog set — never profiles or settings', () => {
    const names = resolveTables().map((t) => t.name);
    expect(names).toEqual(CATALOG_TABLES);
    expect(names).not.toContain('profiles');
    expect(names).not.toContain('settings');
  });

  it('includes the environment tables only when asked', () => {
    expect(resolveTables({ includeEnvironment: true }).map((t) => t.name)).toEqual(RESTORE_ORDER);
  });

  it('honours an explicit subset, still in dependency order', () => {
    // Passed in the wrong order on purpose.
    const names = resolveTables({ requested: ['artwork_terms', 'artworks', 'taxonomies'] }).map((t) => t.name);
    expect(names).toEqual(['taxonomies', 'artworks', 'artwork_terms']);
  });

  it('throws on an unknown table rather than silently skipping it', () => {
    expect(() => resolveTables({ requested: ['artwroks'] })).toThrow(/Unknown table "artwroks"/);
  });
});

describe('table metadata locks down the live schema', () => {
  it('every restorable table appears exactly once in RESTORE_ORDER', () => {
    expect([...RESTORE_ORDER].sort()).toEqual(Object.keys(TABLES).sort());
    expect(new Set(RESTORE_ORDER).size).toBe(RESTORE_ORDER.length);
  });

  it('catalog and environment sets partition RESTORE_ORDER', () => {
    expect([...CATALOG_TABLES, ...ENVIRONMENT_TABLES].sort()).toEqual([...RESTORE_ORDER].sort());
  });

  it('records the real primary keys (pages uses slug, settings uses key)', () => {
    expect(TABLES.pages.conflictTarget).toEqual(['slug']);
    expect(TABLES.settings.conflictTarget).toEqual(['key']);
    expect(TABLES.artwork_terms.conflictTarget).toEqual(['artwork_id', 'term_id']);
    expect(TABLES.artworks.conflictTarget).toEqual(['id']);
  });

  it('orders parents before the rows that reference them', () => {
    const at = (name: string) => RESTORE_ORDER.indexOf(name);
    // artwork_terms FKs to both artworks and taxonomies.
    expect(at('artworks')).toBeLessThan(at('artwork_terms'));
    expect(at('taxonomies')).toBeLessThan(at('artwork_terms'));
    // settings.updated_by FKs to profiles.
    expect(at('profiles')).toBeLessThan(at('settings'));
  });
});

describe('toBindable', () => {
  it('serialises objects and arrays for jsonb columns', () => {
    expect(toBindable({ tags: ['a'] })).toBe('{"tags":["a"]}');
    expect(toBindable(['x', 'y'])).toBe('["x","y"]');
  });

  it('maps null and undefined to null', () => {
    expect(toBindable(null)).toBeNull();
    expect(toBindable(undefined)).toBeNull();
  });

  it('passes scalars through untouched', () => {
    expect(toBindable('gianondor.jpg')).toBe('gianondor.jpg');
    expect(toBindable(42)).toBe(42);
    expect(toBindable(false)).toBe(false);
  });
});

describe('buildStatement — load mode', () => {
  it('builds an INSERT that can never overwrite an existing row', () => {
    const statement = buildStatement(TABLES.pages, { slug: 'about', title: 'About', content: 'x' }, 'load');
    expect(statement.sql).toBe(
      'INSERT INTO public.pages ("content", "slug", "title") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING'
    );
    expect(statement.values).toEqual(['x', 'about', 'About']);
  });

  it('orders columns deterministically regardless of key order', () => {
    const a = buildStatement(TABLES.pages, { slug: 's', title: 't', content: 'c' }, 'load');
    const b = buildStatement(TABLES.pages, { content: 'c', title: 't', slug: 's' }, 'load');
    expect(a.sql).toBe(b.sql);
  });

  it('encodes a jsonb metadata object and binds nulls', () => {
    const statement = buildStatement(
      TABLES.artworks,
      { id: 'a-1', slug: 'today-atomic-sunrise', metadata: { tags: ['mural'] }, narrative: null },
      'load'
    );
    expect(statement.sql).toContain('INSERT INTO public.artworks');
    expect(statement.sql).toContain('ON CONFLICT DO NOTHING');
    expect(statement.values).toContain('{"tags":["mural"]}');
    expect(statement.values).toContain(null);
  });

  it('rejects a row with no columns', () => {
    expect(() => buildStatement(TABLES.pages, {}, 'load')).toThrow(/has no columns/);
  });
});

describe('buildStatement — repair mode', () => {
  it('upserts on the primary key and leaves the key itself alone', () => {
    const statement = buildStatement(TABLES.pages, { slug: 'about', title: 'About' }, 'repair');
    expect(statement.sql).toBe(
      'INSERT INTO public.pages ("slug", "title") VALUES ($1, $2) ' +
        'ON CONFLICT ("slug") DO UPDATE SET "title" = EXCLUDED."title"'
    );
  });

  it('handles a composite primary key', () => {
    const statement = buildStatement(
      TABLES.artwork_terms,
      { artwork_id: 'a-1', term_id: 't-1' },
      'repair'
    );
    // Nothing left to update, so it degrades to DO NOTHING rather than emitting an empty SET.
    expect(statement.sql).toBe(
      'INSERT INTO public.artwork_terms ("artwork_id", "term_id") VALUES ($1, $2) ' +
        'ON CONFLICT ("artwork_id", "term_id") DO NOTHING'
    );
  });

  it('updates only the non-key columns of a multi-column table', () => {
    const statement = buildStatement(
      TABLES.artworks,
      { id: 'a-1', slug: 's', title: 'New title' },
      'repair'
    );
    expect(statement.sql).toContain('ON CONFLICT ("id") DO UPDATE SET');
    expect(statement.sql).toContain('"slug" = EXCLUDED."slug"');
    expect(statement.sql).toContain('"title" = EXCLUDED."title"');
    expect(statement.sql).not.toContain('"id" = EXCLUDED."id"');
  });
});

describe('reporting', () => {
  it('flags a run with failures and not one without', () => {
    expect(hasFailures([{ table: 'pages', inserted: 4, skipped: 0, failed: 0, errors: [] }])).toBe(false);
    expect(hasFailures([{ table: 'profiles', inserted: 0, skipped: 0, failed: 4, errors: ['fk'] }])).toBe(true);
  });

  it('totals every column', () => {
    const lines = summarise([
      { table: 'pages', inserted: 3, skipped: 1, failed: 0, errors: [] },
      { table: 'artworks', inserted: 10, skipped: 2, failed: 1, errors: [] },
    ]);
    expect(lines[lines.length - 1]).toContain('13 inserted');
    expect(lines[lines.length - 1]).toContain('3 skipped');
    expect(lines[lines.length - 1]).toContain('1 failed');
  });
});

/**
 * The strongest available check short of a live database: generate a statement for every row of
 * a real dump. It proves the generator copes with production shapes — jsonb columns, nulls,
 * ISO timestamps and composite keys — without needing a Postgres to talk to.
 *
 * Skipped when no dump is present, since data/backups/ is gitignored.
 */
describe('against a real dump (skipped when none exists)', () => {
  const root = path.resolve(process.cwd(), 'data', 'backups');
  const dirs = fs.existsSync(root)
    ? fs
        .readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        // A snapshot is identified by its manifest.json — the same rule newestDumpDir() uses in
        // scripts/restore-catalog.ts. Without it a stray scratch directory under data/backups/
        // sorts last and this test silently checks nothing.
        .filter((name) => fs.existsSync(path.join(root, name, 'manifest.json')))
        .sort()
    : [];
  const newest = dirs.length ? path.join(root, dirs[dirs.length - 1]) : undefined;

  it.runIf(newest)('generates valid SQL for every row of the newest snapshot', () => {
    let rowsSeen = 0;
    for (const name of CATALOG_TABLES) {
      const file = path.join(newest!, `${name}.json`);
      if (!fs.existsSync(file)) continue;
      const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>[];
      for (const row of rows) {
        const statement = buildStatement(TABLES[name], row, 'load');
        expect(statement.sql.startsWith(`INSERT INTO public.${name} (`)).toBe(true);
        expect(statement.sql.endsWith('ON CONFLICT DO NOTHING')).toBe(true);
        // One bind parameter per column, and none missing.
        expect(statement.values.length).toBe(Object.keys(row).length);
        rowsSeen += 1;
      }
    }
    expect(rowsSeen).toBeGreaterThan(0);
  });
});
