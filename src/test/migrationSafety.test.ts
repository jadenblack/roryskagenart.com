/**
 * Schema-as-code safety net for supabase/migrations/.
 *
 * These are static-analysis tests: they read the SQL files as text and assert the
 * invariants the project relies on. They are not a substitute for applying migrations to
 * a real database — they are the guard that stops a future migration from quietly breaking
 * reproducibility, which is exactly the failure mode documented in docs/adr/0001.
 *
 * The invariant that matters most is the last one: before the baseline migration existed,
 * `artworks`, `media_assets`, `pages` and `inquiries` had RLS enabled and policies defined
 * with no `CREATE TABLE` anywhere in the repo, so `run-migrations.ts` could not build a
 * fresh database. That test would have failed then and will fail if it ever regresses.
 *
 * Zero tokens: reads local files only.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');

/** The baseline that brings the four core domain tables into version control. */
const BASELINE = '2026_09_01_baseline_core_tables.sql';

/** Tables that existed only in the live project before the baseline was written. */
const CORE_TABLES = ['artworks', 'media_assets', 'pages', 'inquiries'];

function migrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Drop full-line SQL comments before analysing. Header prose legitimately mentions
 * `DROP POLICY IF EXISTS` and friends, and matching those would create false positives.
 */
function stripLineComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
}

function read(file: string): string {
  return stripLineComments(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
}

function tablesCreatedBy(sql: string): string[] {
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(?:public\.)?(\w+)/g)].map((m) => m[1]);
}

/**
 * The *effective* definition of every policy, keyed `"<table> :: <policy>"` with the schema
 * qualifier stripped. Migrations are walked in the order the runner applies them, so the last
 * `CREATE POLICY` for a given pair wins — which is what lets a later migration legitimately
 * replace a blanket policy created earlier without tripping the assertions below.
 */
function finalPolicyDefinitions(): Map<string, { file: string; body: string }> {
  const defs = new Map<string, { file: string; body: string }>();
  for (const file of migrationFiles()) {
    for (const m of read(file).matchAll(
      /CREATE POLICY\s+"([^"]+)"\s+ON\s+([\w.]+)([\s\S]*?);/g
    )) {
      const table = m[2].replace(/^public\./, '');
      defs.set(`${table} :: ${m[1]}`, { file, body: m[3] });
    }
  }
  return defs;
}

describe('migration set', () => {
  it('is non-empty and contains the baseline', () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain(BASELINE);
  });
});

describe('the baseline migration', () => {
  const sql = read(BASELINE);

  it('creates all four core domain tables', () => {
    expect(tablesCreatedBy(sql).sort()).toEqual([...CORE_TABLES].sort());
  });

  it('enables RLS on all four core tables', () => {
    for (const table of CORE_TABLES) {
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE\\s+public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`)
      );
    }
  });

  it('defines at least one policy per core table', () => {
    for (const table of CORE_TABLES) {
      expect(sql).toMatch(new RegExp(`CREATE POLICY\\s+"[^"]+"[\\s\\S]{0,120}?ON\\s+public\\.${table}\\b`));
    }
  });
});

describe('idempotency (migrations must be safe to re-run)', () => {
  it('guards every CREATE TABLE with IF NOT EXISTS', () => {
    const offenders: string[] = [];
    for (const file of migrationFiles()) {
      for (const m of read(file).matchAll(/CREATE TABLE(?!\s+IF NOT EXISTS)/g)) {
        offenders.push(`${file} → ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('guards every CREATE INDEX with IF NOT EXISTS', () => {
    const offenders: string[] = [];
    for (const file of migrationFiles()) {
      for (const m of read(file).matchAll(/CREATE (?:UNIQUE )?INDEX(?!\s+IF NOT EXISTS)/g)) {
        offenders.push(`${file} → ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('guards every ADD COLUMN with IF NOT EXISTS', () => {
    const offenders: string[] = [];
    for (const file of migrationFiles()) {
      for (const m of read(file).matchAll(/ADD COLUMN(?!\s+IF NOT EXISTS)/g)) {
        offenders.push(`${file} → ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('drops every policy it creates', () => {
    const offenders: string[] = [];
    for (const file of migrationFiles()) {
      const sql = read(file);
      const dropped = new Set(
        [...sql.matchAll(/DROP POLICY IF EXISTS\s+"([^"]+)"\s+ON\s+([\w.]+)/g)].map(
          (m) => `${m[1]} ON ${m[2]}`
        )
      );
      for (const m of sql.matchAll(/CREATE POLICY\s+"([^"]+)"[\s\S]{0,120}?ON\s+([\w.]+)/g)) {
        const key = `${m[1]} ON ${m[2]}`;
        if (!dropped.has(key)) offenders.push(`${file} → ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('drops every trigger it creates', () => {
    const offenders: string[] = [];
    for (const file of migrationFiles()) {
      const sql = read(file);
      const dropped = new Set(
        [...sql.matchAll(/DROP TRIGGER IF EXISTS\s+(\w+)/g)].map((m) => m[1])
      );
      for (const m of sql.matchAll(/CREATE TRIGGER\s+(\w+)/g)) {
        if (!dropped.has(m[1])) offenders.push(`${file} → ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('reproducibility (a fresh database can be built from this repo)', () => {
  it('never creates the same table from two different migrations', () => {
    const owners = new Map<string, string[]>();
    for (const file of migrationFiles()) {
      for (const table of tablesCreatedBy(read(file))) {
        owners.set(table, [...(owners.get(table) ?? []), file]);
      }
    }
    const duplicated = [...owners.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([table, files]) => `${table}: ${files.join(', ')}`);
    expect(duplicated).toEqual([]);
  });

  it('enables RLS only on tables that some migration actually creates', () => {
    const created = new Set<string>();
    for (const file of migrationFiles()) {
      for (const table of tablesCreatedBy(read(file))) created.add(table);
    }

    const offenders: string[] = [];
    for (const file of migrationFiles()) {
      for (const m of read(file).matchAll(
        /ALTER TABLE\s+(?:public\.)?(\w+)\s+ENABLE ROW LEVEL SECURITY/g
      )) {
        if (!created.has(m[1])) offenders.push(`${file} → ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('orders the baseline before every migration that alters a core table', () => {
    const files = migrationFiles();

    // Exactly one file may create the core tables, and it must be the baseline.
    const creators = files.filter((f) =>
      CORE_TABLES.some((t) => read(f).includes(`CREATE TABLE IF NOT EXISTS public.${t} (`))
    );
    expect(creators).toEqual([BASELINE]);

    // Every file that ALTERs a core table must sort after the baseline — the runner
    // applies files in lexicographic order, so this is what makes the baseline effective.
    const alters = files.filter(
      (f) =>
        f !== BASELINE &&
        CORE_TABLES.some((t) =>
          new RegExp(`ALTER TABLE\\s+(?:public\\.)?${t}\\b`).test(read(f))
        )
    );
    expect(alters.length).toBeGreaterThan(0);
    for (const file of alters) {
      expect(file > BASELINE).toBe(true);
    }
  });
});

describe('authorization (v2.12.1 regression guard)', () => {
  /**
   * `TO authenticated` is the Postgres role every Supabase session assumes — it carries no role
   * claim. A policy that is `TO authenticated USING (true)` therefore grants the table to *any*
   * logged-in user, including the lowest `viewer` role, and silently bypasses the whole matrix in
   * src/lib/roles.ts. Four such policies shipped unnoticed (artworks, media_assets, pages,
   * inquiries) and were fixed in v2.12.1.
   *
   * This walks the migrations in the order the runner applies them and keeps only the LAST
   * definition of each (table, policy) pair, so a later migration that fixes an earlier blanket
   * policy is not flagged — only the effective end state is judged.
   *
   * `TO public USING (true)` is deliberately allowed: anonymous read of published artworks, pages,
   * settings and media URLs is the intended behaviour, as is the public inquiry INSERT.
   */
  it('leaves no policy that grants blanket access to the authenticated role', () => {
    const finalDefs = finalPolicyDefinitions();

    // Guard against the regex silently matching nothing and the assertion passing vacuously.
    expect(finalDefs.size).toBeGreaterThanOrEqual(10);

    const offenders: string[] = [];
    for (const [key, { file, body }] of finalDefs) {
      if (!/\bTO\s+authenticated\b/i.test(body)) continue;
      if (/USING\s*\(\s*true\s*\)/i.test(body) || /WITH\s+CHECK\s*\(\s*true\s*\)/i.test(body)) {
        offenders.push(`${key} — last set by ${file}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('scopes the four staff-only tables to the definer helper, not a bare predicate', () => {
    const finalDefs = finalPolicyDefinitions();
    const staffScoped: Array<[string, string]> = [
      ['artworks', 'Admins full access to artworks'],
      ['media_assets', 'Admins full access to media assets'],
      ['pages', 'Admins full access to pages'],
      ['inquiries', 'Admins can view and manage inquiries'],
    ];

    for (const [table, policy] of staffScoped) {
      const def = finalDefs.get(`${table} :: ${policy}`);
      expect(def, `${policy} on ${table} must exist`).toBeDefined();
      expect(def!.body).toMatch(/public\.is_admin_or_editor\(\)/);
    }
  });
});
