/**
 * Tests for the dump-directory I/O edge (`scripts/lib/dumpDir.ts`).
 *
 * Unlike its sibling `backupManifest.test.ts`, this module touches the disk by design — it is the
 * thin edge that lets the pure verifier stay pure. These tests write into a throwaway directory
 * under the OS temp dir and remove it afterwards, so they need no database, no network and no
 * tokens.
 *
 * The behaviour worth pinning is the *filtering*: the verifier must not be handed a stray folder
 * (a `tmp/`, a hand-made copy) as though it were a dump, because "the newest backup" is exactly the
 * thing an automated job reports on.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listDumpDirs, readDumpDir } from '../../scripts/lib/dumpDir';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'roryskagen-dumpdir-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** Create a directory with the given files (name → content). */
function makeDir(name: string, files: Record<string, string> = {}): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [fileName, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, fileName), content);
  }
  return dir;
}

describe('readDumpDir', () => {
  it('reads every .json file into a name → content map', () => {
    const dir = makeDir('2026-09-14T17-27-10-591Z', {
      'artworks.json': '[{"id":1}]',
      'manifest.json': '{"formatVersion":2}',
    });

    const files = readDumpDir(dir);

    expect([...files.keys()].sort()).toEqual(['artworks.json', 'manifest.json']);
    expect(files.get('artworks.json')).toBe('[{"id":1}]');
  });

  it('ignores non-JSON files rather than treating them as tables', () => {
    const dir = makeDir('2026-09-14T17-27-10-591Z', {
      'artworks.json': '[]',
      'README.txt': 'not a table',
      '.DS_Store': '',
    });

    expect([...readDumpDir(dir).keys()]).toEqual(['artworks.json']);
  });

  it('ignores subdirectories', () => {
    const dir = makeDir('2026-09-14T17-27-10-591Z', { 'artworks.json': '[]' });
    fs.mkdirSync(path.join(dir, 'nested.json'));

    expect([...readDumpDir(dir).keys()]).toEqual(['artworks.json']);
  });

  it('returns an empty map for an empty directory', () => {
    expect(readDumpDir(makeDir('2026-09-14T17-27-10-591Z')).size).toBe(0);
  });
});

describe('listDumpDirs', () => {
  it('returns dump directories oldest → newest', () => {
    makeDir('2026-09-14T17-27-10-591Z');
    makeDir('2026-09-01T08-00-00-000Z');
    makeDir('2026-09-10T12-30-00-000Z');

    expect(listDumpDirs(root)).toEqual([
      '2026-09-01T08-00-00-000Z',
      '2026-09-10T12-30-00-000Z',
      '2026-09-14T17-27-10-591Z',
    ]);
  });

  it('ignores directories that are not in the writer’s timestamp format', () => {
    makeDir('2026-09-14T17-27-10-591Z');
    makeDir('tmp');
    makeDir('latest');
    makeDir('2026-09-14'); // date only — not what the writer produces

    expect(listDumpDirs(root)).toEqual(['2026-09-14T17-27-10-591Z']);
  });

  it('ignores loose files at the root', () => {
    fs.writeFileSync(path.join(root, '2026-09-14T17-27-10-591Z'), 'a file, not a directory');
    expect(listDumpDirs(root)).toEqual([]);
  });

  it('returns an empty list for a missing root instead of throwing', () => {
    expect(listDumpDirs(path.join(root, 'does-not-exist'))).toEqual([]);
  });
});
