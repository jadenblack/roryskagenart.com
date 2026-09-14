/**
 * Scripted restore from a `backup-catalog.ts` snapshot.
 *
 * WHY THIS EXISTS
 * `docs/runbooks/database-backup-restore.md` §4a recorded that there was **no scripted restore**
 * — row-level recovery was manual — and that Phase C of the v3 migration had to add one and
 * exercise it against a non-production database. This is that script.
 *
 * It matters more than it did when the runbook was written: the Supabase project was verified to
 * be on the **Free** plan on 2026-09-14, and Free projects have **no automatic backups at all**.
 * The repo dump is therefore the only recovery path that exists.
 *
 * SAFETY MODEL — read this before running it
 *   1. **It never writes unless you pass `--apply`.** The default is a plan you can read.
 *   2. **It refuses remote targets** unless you pass `--allow-remote`. A dump is the *pre-change*
 *      state, so writing one into a remote database is either a deliberate rollback or a mistake,
 *      and it must never be a default.
 *   3. **It defaults to the catalog tables only.** `profiles` and `settings` are environment
 *      state (see the CAVEAT in scripts/lib/restorePlan.ts); opt in with `--all`.
 *   4. **Each row is its own implicit transaction**, so one bad row cannot abort a table. Failures
 *      are reported, and the run exits non-zero unless you pass `--best-effort`.
 *
 * Usage:
 *   # Rehearse locally (the v3 migration's non-production database)
 *   npx tsx scripts/restore-catalog.ts --from data/backups/<ts> \
 *     --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres --apply
 *
 *   # Plan only — the default; prints what would happen and writes nothing
 *   npx tsx scripts/restore-catalog.ts --from data/backups/<ts> --db-url <url>
 *
 *   # Deliberate production rollback of one table
 *   npx tsx scripts/restore-catalog.ts --from <ts> --db-url "$PROD" \
 *     --tables artworks --mode repair --allow-remote --apply
 *
 * ⚠️ Never pass a production connection string you have not read twice. The script prints the
 * resolved target host before doing anything.
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  RestoreMode,
  RestoreSafetyError,
  TableResult,
  assertSafeTarget,
  buildStatement,
  hasFailures,
  resolveTables,
  summarise,
} from './lib/restorePlan';
import { resolvePoolTarget } from './lib/pgTarget';

interface Args {
  from?: string;
  dbUrl?: string;
  apply: boolean;
  mode: RestoreMode;
  tables?: string[];
  all: boolean;
  allowRemote: boolean;
  bestEffort: boolean;
  help: boolean;
}

const HELP = `
Restore a catalog snapshot produced by scripts/backup-catalog.ts.

  --from <dir>        Dump directory (default: the newest under data/backups/)
  --db-url <url>      Target database. REQUIRED. Loopback hosts are treated as local.
  --apply             Actually write. Without it, the script only prints a plan.
  --mode <m>          load (default, ON CONFLICT DO NOTHING) | repair (DO UPDATE — real rollback)
  --tables a,b,c      Restore only these tables (default: the catalog set)
  --all               Include the environment tables (profiles, settings)
  --allow-remote      Permit a non-loopback target. Required for any remote host.
  --best-effort       Exit 0 even if some rows failed.
  --help              This text.
`;

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false, mode: 'load', all: false, allowRemote: false, bestEffort: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--from': args.from = argv[++i]; break;
      case '--db-url': args.dbUrl = argv[++i]; break;
      case '--apply': args.apply = true; break;
      case '--mode': args.mode = argv[++i] as RestoreMode; break;
      case '--tables': args.tables = (argv[++i] || '').split(',').map((t) => t.trim()).filter(Boolean); break;
      case '--all': args.all = true; break;
      case '--allow-remote': args.allowRemote = true; break;
      case '--best-effort': args.bestEffort = true; break;
      case '--help': case '-h': args.help = true; break;
      default: throw new RestoreSafetyError(`Unknown argument "${arg}". Use --help.`);
    }
  }
  return args;
}

/** Newest timestamped directory under data/backups/, or undefined when there are none. */
/**
 * The most recent snapshot directory, or undefined.
 *
 * A directory only counts as a snapshot if it contains a `manifest.json`. Without that test a
 * stray directory under `data/backups/` silently becomes the default restore source — which is
 * exactly what happened on 2026-09-14, when a scratch directory sorted after the real snapshots
 * and broke both this default and `src/test/restorePlan.test.ts`.
 */
function newestDumpDir(): string | undefined {
  const root = path.resolve(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(root)) return undefined;
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(root, name, 'manifest.json')))
    .sort();
  return dirs.length ? path.join(root, dirs[dirs.length - 1]) : undefined;
}

function readJson<T>(file: string): T | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP.trim());
    return;
  }

  if (!args.dbUrl) throw new RestoreSafetyError('--db-url is required. Refusing to guess a target.');
  if (args.mode !== 'load' && args.mode !== 'repair') {
    throw new RestoreSafetyError(`--mode must be "load" or "repair", got "${args.mode}".`);
  }

  const dumpDir = args.from ? path.resolve(process.cwd(), args.from) : newestDumpDir();
  if (!dumpDir || !fs.existsSync(dumpDir)) {
    throw new RestoreSafetyError('No dump directory found. Pass --from <dir>, or run scripts/backup-catalog.ts first.');
  }

  // Safety decision happens before any connection is opened.
  const target = assertSafeTarget(args.dbUrl, args.allowRemote);
  const tables = resolveTables({ requested: args.tables, includeEnvironment: args.all });

  const manifest = readJson<{ createdAt?: string; target?: string; tables?: Record<string, { rows: number }> }>(
    path.join(dumpDir, 'manifest.json')
  );

  console.log(`Snapshot   ${path.relative(process.cwd(), dumpDir)}`);
  if (manifest?.createdAt) console.log(`Taken      ${manifest.createdAt} (from ${manifest.target ?? 'unknown'})`);
  console.log(`Target     ${target.host}${target.isRemote ? '  ⚠ REMOTE' : '  (local)'}`);
  console.log(`Mode       ${args.mode}`);
  console.log(`Tables     ${tables.map((t) => t.name).join(', ')}`);

  if (!args.apply) {
    console.log('\nPlan only — nothing was written. Re-run with --apply to execute.');
    for (const spec of tables) {
      const rows = readJson<unknown[]>(path.join(dumpDir, `${spec.name}.json`));
      const count = Array.isArray(rows) ? rows.length : manifest?.tables?.[spec.name]?.rows;
      console.log(`  ${spec.name.padEnd(14)} ${count === undefined ? 'MISSING from snapshot' : `${count} rows`}`);
    }
    return;
  }

  // The SSL decision is shared with the other scripts — see scripts/lib/pgTarget.ts.
  const poolTarget = resolvePoolTarget(args.dbUrl);
  const pool = new Pool({ connectionString: poolTarget.connectionString, ssl: poolTarget.ssl });

  try {
    const results: TableResult[] = [];
    for (const spec of tables) {
      const rows = readJson<Record<string, unknown>[]>(path.join(dumpDir, `${spec.name}.json`));
      if (!Array.isArray(rows)) {
        console.log(`- ${spec.name} (absent from snapshot, skipped)`);
        continue;
      }

      const result: TableResult = { table: spec.name, inserted: 0, skipped: 0, failed: 0, errors: [] };
      for (const row of rows) {
        const statement = buildStatement(spec, row, args.mode);
        try {
          // No explicit transaction: each statement commits on its own, so a single bad row
          // (e.g. profiles → a missing auth.users row) cannot roll back the whole table.
          const res = await pool.query(statement.sql, statement.values);
          if (res.rowCount && res.rowCount > 0) result.inserted += 1;
          else result.skipped += 1;
        } catch (err: any) {
          result.failed += 1;
          if (result.errors.length < 3) result.errors.push(err?.message || String(err));
        }
      }
      results.push(result);
      console.log(`+ ${spec.name}`);
      for (const message of result.errors) console.log(`    ! ${message}`);
    }

    console.log('');
    for (const line of summarise(results)) console.log(line);

    if (hasFailures(results) && !args.bestEffort) {
      console.error('\nSome rows failed. Re-run with --best-effort to ignore, or fix the cause first.');
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  if (err instanceof RestoreSafetyError) {
    console.error(`Refused: ${err.message}`);
    process.exit(2);
  }
  console.error('Restore error:', err?.message || err);
  process.exit(1);
});
