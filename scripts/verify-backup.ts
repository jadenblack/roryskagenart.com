/**
 * Verify a logical backup dump against its own manifest.
 *
 * WHY THIS EXISTS
 * `scripts/backup-catalog.ts` has always written a `manifest.json`, but until format v2 nothing ever
 * read it back — so a truncated file, a corrupted file, or a table silently missing from the dump
 * would go unnoticed, and `restore-catalog.ts` would insert whatever partial data it found. This
 * script is the answer to the question "is this backup actually usable?", which is the only question
 * that matters when you are about to trust it with a restore.
 *
 * It is STRICTLY READ-ONLY — it opens files, never a database, and never modifies a dump.
 *
 * Usage:
 *   npx tsx scripts/verify-backup.ts                        # the newest dump under data/backups/
 *   npx tsx scripts/verify-backup.ts data/backups/<stamp>   # one specific dump directory
 *   npx tsx scripts/verify-backup.ts --all                  # every dump, newest first
 *   npx tsx scripts/verify-backup.ts --all --json           # machine-readable
 *
 * Exit codes:
 *   0  every dump checked verified clean
 *   1  at least one dump has a problem (do NOT restore from it)
 *   2  nothing to check, or the arguments were unusable
 */
import fs from 'fs';
import path from 'path';
import { listDumpDirs, readDumpDir } from './lib/dumpDir';
import { verifyDump, type BackupManifest, type VerifyProblem } from './lib/backupManifest';

const BACKUP_ROOT = path.resolve(process.cwd(), 'data', 'backups');

interface Report {
  /** Path as given, relative to the working directory where possible. */
  dir: string;
  ok: boolean;
  problems: VerifyProblem[];
  createdAt?: string;
  tables?: number;
  rows?: number;
}

function relative(target: string): string {
  const rel = path.relative(process.cwd(), target);
  return rel && !rel.startsWith('..') ? rel : target;
}

/** Verify one dump directory. Every failure mode returns a Report; nothing throws. */
function verifyDir(dir: string): Report {
  const shown = relative(dir);

  if (!fs.existsSync(dir)) {
    return { dir: shown, ok: false, problems: [{ kind: 'missing-file', detail: `${shown} does not exist.` }] };
  }

  const files = readDumpDir(dir);
  const rawManifest = files.get('manifest.json');

  if (rawManifest === undefined) {
    return {
      dir: shown,
      ok: false,
      problems: [{ kind: 'missing-file', detail: 'manifest.json is missing — this is not a dump directory.' }],
    };
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(rawManifest);
  } catch {
    return {
      dir: shown,
      ok: false,
      problems: [{ kind: 'unusable-manifest', detail: 'manifest.json is not valid JSON.' }],
    };
  }

  const problems = verifyDump(manifest, files);
  const m = manifest as Partial<BackupManifest>;
  const tableEntries = m.tables && typeof m.tables === 'object' ? Object.values(m.tables) : undefined;

  return {
    dir: shown,
    ok: problems.length === 0,
    problems,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : undefined,
    tables: tableEntries?.length,
    rows: tableEntries?.reduce((sum, entry) => sum + entry.rows, 0),
  };
}

function printReport(report: Report, verbose: boolean): void {
  const status = report.ok ? 'OK' : `FAILED (${report.problems.length} problem${report.problems.length === 1 ? '' : 's'})`;
  console.log(`${report.dir}`);
  if (verbose) {
    if (report.createdAt) console.log(`  created  ${report.createdAt}`);
    if (report.tables !== undefined) console.log(`  tables   ${report.tables}`);
    if (report.rows !== undefined) console.log(`  rows     ${report.rows}`);
  }
  console.log(`  status   ${status}`);
  for (const problem of report.problems) {
    const scope = problem.table ? ` ${problem.table}:` : '';
    console.log(`    - [${problem.kind}]${scope} ${problem.detail}`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const all = args.includes('--all');
  const target = args.find((arg) => !arg.startsWith('--'));

  let dirs: string[];

  if (target) {
    dirs = [path.resolve(process.cwd(), target)];
  } else {
    // listDumpDirs returns oldest → newest; report newest first because that is the one you care
    // about, and the one an automated job most recently wrote.
    const found = listDumpDirs(BACKUP_ROOT).reverse();
    if (found.length === 0) {
      console.error(`No dump directories under ${relative(BACKUP_ROOT)}.`);
      console.error('Take one first: npx tsx scripts/backup-catalog.ts');
      process.exit(2);
    }
    if (!all && found.length > 1) {
      console.log(`Checking the newest of ${found.length} dumps (use --all for every dump).\n`);
    }
    dirs = all ? found.map((name) => path.join(BACKUP_ROOT, name)) : [path.join(BACKUP_ROOT, found[0])];
  }

  const reports = dirs.map(verifyDir);
  const failed = reports.filter((report) => !report.ok);

  if (asJson) {
    console.log(JSON.stringify({ ok: failed.length === 0, checked: reports.length, failed: failed.length, reports }, null, 2));
  } else {
    reports.forEach((report, index) => {
      if (index > 0) console.log('');
      printReport(report, dirs.length === 1 || all);
    });

    if (reports.length > 1) {
      console.log('');
      console.log(
        failed.length === 0
          ? `All ${reports.length} dumps verified.`
          : `${reports.length - failed.length}/${reports.length} dumps verified — ${failed.length} FAILED:`
      );
      for (const report of failed) console.log(`  ${report.dir}`);
    }
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main();
