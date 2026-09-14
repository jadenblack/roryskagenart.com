/**
 * Write-path coverage for the migration runner (scripts/run-migrations.ts).
 *
 * The runner itself cannot be imported in a test — it opens a pg Pool at module load — so
 * its decisions were extracted into scripts/lib/migrationPlan.ts, which is pure and fully
 * offline. These tests lock down the two things that can silently break a release:
 *
 *   1. WHICH files get applied (skip-if-tracked semantics).
 *   2. IN WHAT ORDER (plain lexicographic filename sort — load-bearing, see docs/adr/0001).
 *
 * Zero tokens: no database, no network.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MIGRATIONS_DIR,
  assertExist,
  listMigrationFiles,
  resolveTargets,
  selectPending,
} from '../../scripts/lib/migrationPlan';

describe('listMigrationFiles', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rory-migrations-'));
    // Deliberately created out of order to prove the sort is not filesystem-dependent.
    for (const f of ['2026_09_12_b.sql', '2026_09_01_baseline.sql', '2026_09_02_a.sql']) {
      fs.writeFileSync(path.join(tmp, f), '');
    }
    // Non-SQL files must be ignored.
    fs.writeFileSync(path.join(tmp, 'README.md'), '');
    fs.writeFileSync(path.join(tmp, 'notes.txt'), '');
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns only .sql files, in lexicographic order', () => {
    expect(listMigrationFiles(tmp)).toEqual([
      '2026_09_01_baseline.sql',
      '2026_09_02_a.sql',
      '2026_09_12_b.sql',
    ]);
  });

  it('defaults to the real supabase/migrations directory', () => {
    expect(MIGRATIONS_DIR.endsWith(path.join('supabase', 'migrations'))).toBe(true);
    const files = listMigrationFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.endsWith('.sql'))).toBe(true);
    expect([...files].sort()).toEqual(files);
  });
});

describe('selectPending', () => {
  const all = ['2026_09_01_baseline.sql', '2026_09_12_a.sql', '2026_09_13_b.sql'];

  it('excludes already-applied files and preserves order', () => {
    expect(selectPending(all, ['2026_09_12_a.sql'])).toEqual([
      '2026_09_01_baseline.sql',
      '2026_09_13_b.sql',
    ]);
  });

  it('returns everything when the ledger is empty', () => {
    expect(selectPending(all, [])).toEqual(all);
  });

  it('returns nothing when every file is recorded', () => {
    expect(selectPending(all, all)).toEqual([]);
  });

  it('ignores ledger entries that no longer exist on disk', () => {
    // A deleted migration file must not resurrect or block anything.
    expect(selectPending(all, ['2026_09_99_deleted.sql'])).toEqual(all);
  });

  it('accepts a Set as well as an array', () => {
    expect(selectPending(all, new Set(['2026_09_01_baseline.sql']))).toEqual([
      '2026_09_12_a.sql',
      '2026_09_13_b.sql',
    ]);
  });
});

describe('resolveTargets', () => {
  it('prefers explicit CLI arguments verbatim', () => {
    expect(resolveTargets(['2026_09_12_a.sql'])).toEqual(['2026_09_12_a.sql']);
    // Explicit args bypass the directory listing entirely (no fs access, no filtering).
    expect(resolveTargets(['weird-name.sql', 'another.sql'])).toEqual([
      'weird-name.sql',
      'another.sql',
    ]);
  });

  it('falls back to every migration on disk when no arguments are given', () => {
    expect(resolveTargets([])).toEqual(listMigrationFiles());
  });
});

describe('assertExist', () => {
  it('passes when every named file is on disk', () => {
    const [first] = listMigrationFiles();
    expect(() => assertExist([first])).not.toThrow();
  });

  it('throws a descriptive error for a missing file', () => {
    expect(() => assertExist(['2026_09_99_does_not_exist.sql'])).toThrow(
      /Migration file not found: 2026_09_99_does_not_exist\.sql/
    );
  });
});
