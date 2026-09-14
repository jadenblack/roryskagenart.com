/**
 * Pure logic for the off-site backup: Blob layout, dump grouping, usage and retention.
 *
 * WHY THIS EXISTS
 * The scheduled dump has two jobs that are easy to get wrong in opposite directions: keep enough
 * history to be useful, and never grow without bound. On the Vercel Hobby plan a Blob store is
 * capped at **1 GB/month, and exceeding it cuts off access for 30 days instead of billing** —
 * which for a backup sink is a worse failure than being overcharged, because the thing you need
 * during an incident is the thing that just got switched off. Retention is therefore not a
 * clean-up nicety here; it is what keeps the backup available.
 *
 * Everything in this module is pure — no `@vercel/blob` import, no network, no clock — so the
 * rules are locked down in `src/test/blobBackup.test.ts` offline. The route owns the I/O.
 */
import { selectForRetention, type DumpSummary, type RetentionPolicy } from '../../scripts/lib/backupManifest';
import { stampToIso } from './catalogDump';

/** Every off-site object lives under this prefix, so the store can hold other things later. */
export const BLOB_PREFIX = 'catalog-backups';

export interface BlobRef {
  /** Full path in the store, e.g. `catalog-backups/2026-09-14T17-27-10-591Z/artworks.json`. */
  pathname: string;
  size: number;
  /** When the object was written. Used as the dump's timestamp in preference to the stamp. */
  uploadedAt: Date;
}

/**
 * The default retention policy: two weeks of daily dumps, plus one per month for the long tail.
 *
 * `minAgeDays` is the safety catch. Without a floor on age, a bug that produced a run of empty or
 * broken dumps would let those newest dumps push every *good* dump out of the `keepRecent` window
 * and delete them. With it, nothing written in the last week is ever a deletion candidate.
 */
export const DEFAULT_RETENTION: RetentionPolicy = {
  keepRecent: 14,
  keepMonthly: true,
  minAgeDays: 7,
};

/** Where one file of one dump lives in the store. */
export function blobPathFor(stamp: string, fileName: string): string {
  return `${BLOB_PREFIX}/${stamp}/${fileName}`;
}

/** The dump a path belongs to, or `null` if the path is not an off-site dump object. */
export function stampFromBlobPath(pathname: string): string | null {
  const prefix = `${BLOB_PREFIX}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return rest.slice(0, slash);
}

/**
 * Group objects into the dumps they belong to, newest first.
 *
 * `uploadedAt` is the preferred timestamp because it is a real `Date` from the store. The stamp is
 * the fallback — and it has to be **converted** first (`stampToIso`), because a raw stamp does not
 * parse as a date and an unparseable `createdAt` silently opts a dump out of the minimum-age
 * protection. A dump whose timestamp cannot be determined at all is still listed, so it is visible
 * and eventually prunable, rather than being invisible to retention forever.
 */
/** A `Date` is only usable if it is a real instant — `new Date('')` is not, and `.toISOString()` throws. */
function isoOrNull(date: Date | null | undefined): string | null {
  if (!date) return null;
  const time = date.getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function dumpsFromBlobs(blobs: BlobRef[]): DumpSummary[] {
  const byStamp = new Map<string, { uploadedAt: Date | null }>();

  for (const blob of blobs) {
    const stamp = stampFromBlobPath(blob.pathname);
    if (stamp === null) continue;
    const existing = byStamp.get(stamp);
    if (!existing) {
      byStamp.set(stamp, { uploadedAt: blob.uploadedAt });
      continue;
    }
    // The dump is only complete once its manifest has landed, so the newest object is the best
    // available answer to "when was this dump finished?". An invalid date never wins.
    const current = existing.uploadedAt?.getTime();
    const next = blob.uploadedAt?.getTime();
    if (!Number.isFinite(current) || (Number.isFinite(next) && (next as number) > (current as number))) {
      existing.uploadedAt = blob.uploadedAt;
    }
  }

  const dumps: DumpSummary[] = [];
  for (const [name, entry] of byStamp) {
    dumps.push({ name, createdAt: isoOrNull(entry.uploadedAt) ?? stampToIso(name) ?? '' });
  }

  return dumps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface BlobUsage {
  dumps: number;
  files: number;
  bytes: number;
  /** Share of the Hobby plan's 1 GB monthly storage allowance, 0–1. */
  fractionOfHobbyAllowance: number;
}

export const HOBBY_STORAGE_ALLOWANCE_BYTES = 1024 * 1024 * 1024;

/** How much of the store the off-site dumps are using. Logged on every run so drift is visible. */
export function summarizeBlobs(blobs: BlobRef[]): BlobUsage {
  const dumpBlobs = blobs.filter((blob) => stampFromBlobPath(blob.pathname) !== null);
  const bytes = dumpBlobs.reduce((sum, blob) => sum + blob.size, 0);
  return {
    dumps: new Set(dumpBlobs.map((blob) => stampFromBlobPath(blob.pathname))).size,
    files: dumpBlobs.length,
    bytes,
    fractionOfHobbyAllowance: bytes / HOBBY_STORAGE_ALLOWANCE_BYTES,
  };
}

/**
 * Which dumps to keep, and which to delete.
 *
 * `selectForRetention` already encodes the policy; this only adds the one invariant the route
 * cannot be trusted to remember: **the dump that was just written is never deleted**, whatever the
 * policy says. A retention rule that can delete the thing you just backed up is not a retention
 * rule, it is a data-loss bug.
 */
export function planPrune(
  dumps: DumpSummary[],
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION,
  protectedStamp?: string
): { keep: string[]; remove: string[] } {
  const { keep, remove } = selectForRetention(dumps, policy, now);
  if (!protectedStamp) return { keep, remove };

  if (!keep.includes(protectedStamp)) keep.push(protectedStamp);
  return { keep, remove: remove.filter((name) => name !== protectedStamp) };
}
