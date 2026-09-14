/**
 * Filesystem helpers for a backup dump directory.
 *
 * WHY THIS EXISTS
 * `scripts/lib/backupManifest.ts` deliberately holds no `fs`, so it can be unit-tested with no
 * disk, no database and no network. That leaves the actual reading to a caller — and there are now
 * two: the writer (`scripts/backup-catalog.ts`, which verifies what it just wrote) and the verifier
 * CLI (`scripts/verify-backup.ts`). This module is the shared I/O edge, so the two cannot drift
 * apart on what "the dump directory" means.
 */
import fs from 'fs';
import path from 'path';

/**
 * The writer's dump-directory name: an ISO timestamp with `:` and `.` replaced by `-`
 * (`2026-09-14T17-27-10-591Z`). Fixed width, so a lexicographic sort is a chronological sort.
 */
const DUMP_DIR_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

/**
 * Every `.json` file in a dump directory as file name → exact content.
 *
 * `manifest.json` is included; the verifier needs it and skips it explicitly in its stray-file
 * check. Contents are read as UTF-8 strings, which is exactly the encoding `sha256Hex` hashes, so
 * the checksum computed here matches the one the writer recorded.
 */
export function readDumpDir(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.json')) continue;
    files.set(entry.name, fs.readFileSync(path.join(dir, entry.name), 'utf8'));
  }
  return files;
}

/**
 * Dump directories directly under `root`, oldest → newest.
 *
 * Only directories matching the writer's timestamp format are returned. A stray folder (a `tmp/`, a
 * hand-made copy) is ignored rather than sorted arbitrarily — it must not silently become "the
 * newest backup" and be the thing a verifier reports on.
 */
export function listDumpDirs(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && DUMP_DIR_NAME.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}
