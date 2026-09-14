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

/**
 * A dump in the store, richer than the `DumpSummary` retention consumes.
 *
 * `hasManifest` is the difference between a dump and debris: objects are uploaded one at a time and
 * `manifest.json` goes last, so a stamp without one is a run that was interrupted.
 */
export interface OffsiteDumpSummary extends DumpSummary {
  /** Objects under this stamp. */
  files: number;
  /** False ⇒ unfinished and unrestorable. See `incompleteStamps`. */
  hasManifest: boolean;
}

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

export function dumpsFromBlobs(blobs: BlobRef[]): OffsiteDumpSummary[] {
  const byStamp = new Map<string, { uploadedAt: Date | null; files: number; hasManifest: boolean }>();

  for (const blob of blobs) {
    const stamp = stampFromBlobPath(blob.pathname);
    if (stamp === null) continue;
    const existing = byStamp.get(stamp);
    if (!existing) {
      byStamp.set(stamp, { uploadedAt: blob.uploadedAt, files: 1, hasManifest: blob.pathname.endsWith('/manifest.json') });
      continue;
    }
    existing.files += 1;
    if (blob.pathname.endsWith('/manifest.json')) existing.hasManifest = true;
    // The dump is only complete once its manifest has landed, so the newest object is the best
    // available answer to "when was this dump finished?". An invalid date never wins.
    const current = existing.uploadedAt?.getTime();
    const next = blob.uploadedAt?.getTime();
    if (!Number.isFinite(current) || (Number.isFinite(next) && (next as number) > (current as number))) {
      existing.uploadedAt = blob.uploadedAt;
    }
  }

  const dumps: OffsiteDumpSummary[] = [];
  for (const [name, entry] of byStamp) {
    dumps.push({
      name,
      createdAt: isoOrNull(entry.uploadedAt) ?? stampToIso(name) ?? '',
      files: entry.files,
      hasManifest: entry.hasManifest,
    });
  }

  return dumps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Stamps that have objects but no `manifest.json` — a run that died part-way through its upload.
 *
 * These are the worst kind of debris: `scripts/verify-offsite-backup.ts` refuses to verify one, so
 * while an incomplete stamp is the newest thing in the store **every** verification fails and the
 * scheduled backup looks broken for as long as retention takes to clear it (up to 14 days). They
 * are also unrestorable by definition, so nothing of value is lost by deleting them.
 */
export function incompleteStamps(dumps: readonly OffsiteDumpSummary[]): string[] {
  return dumps.filter((dump) => dump.hasManifest === false).map((dump) => dump.name);
}

/**
 * The UTC calendar day a stamp belongs to (`2026-09-14T20-08-20-091Z` → `2026-09-14`).
 * Stamps are always UTC, so the leading date is the day without any timezone arithmetic.
 */
export function dumpUtcDate(stamp: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(stamp);
  return match ? match[1] : null;
}

/**
 * Is there already a **complete** dump for this UTC day?
 *
 * Used to make the backup route idempotent: Vercel's cron delivery is best-effort and
 * **can invoke the same scheduled run more than once** (vercel.com/docs/cron-jobs/manage-cron-jobs).
 * A duplicate dump is not dangerous, but it is 406 KB of pointless storage and it burns part of the
 * Hobby Blob allowance twice a day.
 *
 * ⚠️ An **incomplete** stamp does not satisfy a day. A run that died mid-upload leaves objects
 * behind, and skipping subsequent runs because of them would leave the day with no restorable dump
 * at all — the opposite of what idempotency is for. (`hasManifest` is `undefined` for callers that
 * only know names and timestamps; only an explicit `false` means "known to be unfinished".)
 */
export function hasDumpForDate(dumps: readonly DumpSummary[], isoDate: string): boolean {
  return dumps.some(
    (dump) => dumpUtcDate(dump.name) === isoDate && (dump as OffsiteDumpSummary).hasManifest !== false
  );
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
 * How long an unfinished stamp is left alone before it is treated as debris.
 *
 * Not zero: two runs can overlap (a manual `?force=true` while a scheduled run is mid-upload), and
 * pruning a sibling's in-flight objects would turn a recoverable retry into real data loss. 24 h is
 * far longer than any run takes and far shorter than the 14 days an incomplete stamp would
 * otherwise poison verification for.
 */
export const DEFAULT_INCOMPLETE_GRACE_HOURS = 24;

/**
 * Which dumps to keep, and which to delete.
 *
 * `selectForRetention` already encodes the policy; this adds the invariants the route cannot be
 * trusted to remember:
 *
 *   1. **The dump that was just written is never deleted**, whatever the policy says. A retention
 *      rule that can delete the thing you just backed up is not a retention rule, it is a
 *      data-loss bug.
 *   2. **An incomplete stamp is deleted once it is past its grace period**, regardless of
 *      `minAgeDays`. The age floor exists to protect *good* dumps from a run of bad ones; an
 *      unfinished stamp is not a dump, and leaving it in place is what makes verification fail
 *      continuously. See `incompleteStamps`.
 *
 * `dumps` is typed as the plain `DumpSummary` so callers that only know names and timestamps still
 * work; incomplete handling simply does nothing for them, because `hasManifest` is undefined
 * rather than `false`.
 */
export function planPrune(
  dumps: DumpSummary[],
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION,
  protectedStamp?: string,
  options: { incompleteGraceHours?: number } = {}
): { keep: string[]; remove: string[] } {
  const { keep, remove } = selectForRetention(dumps, policy, now);

  const graceHours = options.incompleteGraceHours ?? DEFAULT_INCOMPLETE_GRACE_HOURS;
  const graceMs = graceHours * 3_600_000;
  // `Partial` because a caller that only knows names and timestamps passes a plain `DumpSummary`;
  // `hasManifest` is then `undefined`, and only an explicit `false` means "known to be unfinished".
  const unfinished = (dumps as readonly Partial<OffsiteDumpSummary>[])
    .filter((dump) => dump.hasManifest === false)
    .filter((dump) => {
      const created = Date.parse(dump.createdAt);
      // An unparseable timestamp is not a reason to delete; retention can still reach it by name.
      return Number.isFinite(created) && now.getTime() - created > graceMs;
    })
    .map((dump) => dump.name);

  const merged = [...new Set([...remove, ...unfinished])];

  if (!protectedStamp) return { keep, remove: merged };

  if (!keep.includes(protectedStamp)) keep.push(protectedStamp);
  return { keep, remove: merged.filter((name) => name !== protectedStamp) };
}
