/**
 * Scheduled off-site catalog backup — Vercel Cron → this route → Vercel Blob.
 *
 * WHY THIS EXISTS
 * The Supabase project is on the **Free plan: no automatic backups and no PITR** (verified
 * 2026-09-14, see docs/runbooks/database-backup-restore.md §3). `scripts/backup-catalog.ts` is
 * therefore the only recovery path this project has — and until now it produced a dump on one
 * laptop. A backup that lives on the same machine as the thing it protects is not a backup.
 *
 * This route runs the same dump on a schedule and writes it off-site, then prunes old dumps so the
 * store cannot grow without bound.
 *
 * SECURITY — this endpoint exfiltrates the entire database, including `profiles` (studio member
 * emails) and `inquiries` (collector name/email/phone/message). Three rules follow from that and
 * must not be relaxed:
 *   1. **It is gated on `CRON_SECRET`** (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
 *      If the secret is unset the route refuses everything — it fails closed rather than open.
 *   2. **Objects are written with `access: 'private'`.** A public URL would put collector PII on
 *      the open internet. Never change this to `'public'`.
 *   3. **The response carries metadata only** — counts and paths, never row data. The dump itself
 *      must never be readable from an HTTP response.
 */
import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { del, list, put } from '@vercel/blob';
import { query } from '../../src/server/db';
import { buildCatalogDump } from '../lib/catalogDump';
import {
  BLOB_PREFIX,
  DEFAULT_RETENTION,
  blobPathFor,
  dumpsFromBlobs,
  planPrune,
  stampFromBlobPath,
  summarizeBlobs,
  type BlobRef,
} from '../lib/blobBackup';

const router = Router();

/** Fail-closed check of the shared secret Vercel Cron presents. */
function authorized(req: { get(name: string): string | undefined }): { ok: boolean; status?: number; error?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, status: 503, error: 'CRON_SECRET is not configured; the backup endpoint is disabled.' };
  }

  const provided = Buffer.from(req.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  // Length first, because timingSafeEqual throws on a length mismatch.
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, error: 'Unauthorized.' };
  }
  return { ok: true };
}

/**
 * Every object under the backup prefix.
 *
 * `list` is paginated (1,000 per page), and pruning that only saw the first page would both
 * miscount usage and eventually stop cleaning up. Walk the cursor to the end.
 */
async function listAll(): Promise<BlobRef[]> {
  const found: BlobRef[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: BLOB_PREFIX, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      found.push({ pathname: blob.pathname, size: blob.size, uploadedAt: blob.uploadedAt });
    }
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);

  return found;
}

router.get('/backup', async (req, res) => {
  const auth = authorized(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res
      .status(503)
      .json({ success: false, error: 'BLOB_READ_WRITE_TOKEN is not configured; nowhere to write the dump.' });
  }

  try {
    const startedAt = Date.now();
    const dump = await buildCatalogDump(async (sql) => (await query(sql)).rows);

    // Upload first, prune second. If an upload fails the run aborts with a 500 and no dump is
    // deleted — a partial dump is a nuisance, but deleting history because a write failed is not.
    const written: { pathname: string; size: number }[] = [];
    for (const file of dump.files) {
      const pathname = blobPathFor(dump.stamp, file.name);
      const result = await put(pathname, file.content, {
        // Private: see the SECURITY note in the header. Never make a dump publicly readable.
        access: 'private',
        contentType: 'application/json',
        // Deterministic paths — the timestamped stamp already prevents collisions, and a random
        // suffix would break the path→dump grouping that retention depends on.
        addRandomSuffix: false,
      });
      // `PutBlobResult` carries no size, so measure what we sent. It is the same value the
      // manifest hashed, so the byte count reported here and the checksum in the manifest agree.
      // The pathname is echoed back because `addRandomSuffix: false` is what makes it predictable —
      // if the store ever suffixes anyway, retention's path→dump grouping would silently break.
      written.push({ pathname: result.pathname, size: Buffer.byteLength(file.content, 'utf8') });
    }

    const blobs = await listAll();
    const usage = summarizeBlobs(blobs);
    const dumps = dumpsFromBlobs(blobs);
    const { keep, remove } = planPrune(dumps, new Date(), DEFAULT_RETENTION, dump.stamp);

    let deletedFiles = 0;
    for (const stamp of remove) {
      const paths = blobs.filter((blob) => stampFromBlobPath(blob.pathname) === stamp).map((blob) => blob.pathname);
      if (paths.length === 0) continue;
      await del(paths);
      deletedFiles += paths.length;
    }

    return res.json({
      success: true,
      stamp: dump.stamp,
      tables: dump.files.length - 1,
      rows: dump.manifest.totalRows,
      migrations: dump.manifest.appliedMigrations.length,
      uploaded: written.length,
      retainedDumps: keep.length,
      removedDumps: remove.length,
      deletedFiles,
      storeBytes: usage.bytes,
      storeDumps: usage.dumps,
      // Surfaced so the Hobby 1 GB allowance is visible before it becomes an outage — see
      // server/lib/blobBackup.ts for why that limit matters more than a billing overage.
      allowanceUsed: Number(usage.fractionOfHobbyAllowance.toFixed(4)),
      durationMs: Date.now() - startedAt,
    });
  } catch (err: any) {
    console.error('[cron/backup] failed:', err?.message ?? err);
    return res.status(500).json({ success: false, error: err?.message ?? 'Backup failed.' });
  }
});

export { router as cronRouter };
