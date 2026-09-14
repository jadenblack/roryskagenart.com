#!/usr/bin/env npx tsx
/**
 * Verify an off-site (Vercel Blob) catalog dump.
 *
 *   npx tsx scripts/verify-offsite-backup.ts                 # newest complete dump
 *   npx tsx scripts/verify-offsite-backup.ts --list          # what is in the store
 *   npx tsx scripts/verify-offsite-backup.ts --stamp <stamp> # one specific dump
 *   npx tsx scripts/verify-offsite-backup.ts --max-age-hours 26 --json
 *
 * Exit codes: 0 = verified · 1 = problems found · 2 = nothing to check / unusable selection.
 *
 * This is the missing half of v2.13.0. Until it existed the project produced off-site backups it
 * had no committed way to check. Downloads are read-only: nothing is written to Blob.
 *
 * Requires BLOB_READ_WRITE_TOKEN (a `.env.local` copy is what `vercel env pull` produces).
 * ⚠️ `.env.local` also carries VERCEL_OIDC_TOKEN; `@vercel/blob` prefers OIDC and then rejects the
 * development environment, so it is removed below and the token is passed explicitly.
 */
import dotenv from 'dotenv';
import { get, list } from '@vercel/blob';
import { BLOB_PREFIX } from '../server/lib/blobBackup';
import {
  filesForDump,
  groupOffsiteDumps,
  selectOffsiteDump,
  type OffsiteBlobRef,
} from './lib/offsiteBackup';
import { verifyDump, type VerifyProblem } from './lib/backupManifest';

dotenv.config({ path: '.env.local' });
delete process.env.VERCEL_OIDC_TOKEN;

const blobOptions = () => ({ token: process.env.BLOB_READ_WRITE_TOKEN, access: 'private' as const });

async function listAll(): Promise<OffsiteBlobRef[]> {
  const found: OffsiteBlobRef[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: BLOB_PREFIX, cursor, limit: 1000, ...blobOptions() });
    for (const blob of page.blobs) {
      found.push({ pathname: blob.pathname, size: blob.size, uploadedAt: blob.uploadedAt });
    }
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
  return found;
}

/**
 * `get()` needs `access: 'private'` explicitly — it does not infer it from the object.
 *
 * In @vercel/blob 2.x the result is `{ statusCode, stream, … }`, not a Blob: there is no `.text()`,
 * so the stream is wrapped in a `Response` to read it.
 */
async function download(pathname: string): Promise<string> {
  const result = await get(pathname, blobOptions());
  if (!result) throw new Error(`Object ${pathname} is missing from the store.`);
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`Object ${pathname} returned status ${result.statusCode}.`);
  }
  return await new Response(result.stream).text();
}

function relativeName(pathname: string): string {
  return pathname.split('/').slice(2).join('/');
}

function main(): void {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const value = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
  };

  const json = flag('--json');
  const listOnly = flag('--list');
  const stamp = value('--stamp');
  const maxAgeHours = Number(value('--max-age-hours') ?? '0') || 0;

  void (async () => {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN is not set — cannot read the off-site store.');
      process.exit(2);
    }

    const blobs = await listAll();
    const dumps = groupOffsiteDumps(blobs);

    if (listOnly) {
      if (json) {
        console.log(JSON.stringify({ dumps }, null, 2));
      } else {
        console.log(`${dumps.length} dump(s) in ${BLOB_PREFIX}/`);
        for (const d of dumps) {
          console.log(
            `  ${d.name}  files=${d.files}  bytes=${d.bytes}  manifest=${d.hasManifest}  at=${d.createdAt}`
          );
        }
      }
      process.exit(0);
    }

    const selection = selectOffsiteDump(dumps, { stamp, now: new Date(), maxAgeHours });
    if (!selection.ok || !selection.dump) {
      console.error(`✗ ${selection.message}`);
      process.exit(selection.problem === 'no-dumps' ? 2 : 1);
    }

    const target = selection.dump;
    const paths = filesForDump(blobs, target.name);
    const files = new Map<string, string>();
    for (const pathname of paths) {
      files.set(relativeName(pathname), await download(pathname));
    }

    const manifestRaw = files.get('manifest.json');
    if (!manifestRaw) {
      console.error(`✗ Dump ${target.name} has no manifest.json.`);
      process.exit(1);
    }
    const manifest = JSON.parse(manifestRaw);
    const problems: VerifyProblem[] = verifyDump(manifest, files);

    const summary = {
      stamp: target.name,
      createdAt: target.createdAt,
      objects: paths.length,
      bytes: target.bytes,
      // `tables` is a Record<string, TableEntry>, not an array.
      tables: manifest?.tables && typeof manifest.tables === 'object' ? Object.keys(manifest.tables).length : 0,
      rows: manifest?.totalRows ?? 0,
      migrations: Array.isArray(manifest?.appliedMigrations) ? manifest.appliedMigrations.length : 0,
      ok: problems.length === 0,
      problems,
    };

    if (json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(`Dump ${summary.stamp}`);
      console.log(`  written      ${summary.createdAt}`);
      console.log(`  objects      ${summary.objects} (${summary.bytes} bytes)`);
      console.log(`  tables/rows  ${summary.tables} tables, ${summary.rows} rows`);
      console.log(`  migrations   ${summary.migrations}`);
      if (problems.length === 0) {
        console.log('  result       OK — every table matches its manifest checksum');
      } else {
        console.log(`  result       FAILED — ${problems.length} problem(s)`);
        for (const p of problems) console.log(`    - ${p.kind}: ${p.detail ?? p.table ?? ''}`);
      }
    }

    process.exit(problems.length === 0 ? 0 : 1);
  })().catch((err: unknown) => {
    console.error('✗ Off-site verification failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

main();
