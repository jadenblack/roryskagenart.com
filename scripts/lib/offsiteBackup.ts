/**
 * Off-site dump selection — the pure half of `scripts/verify-offsite-backup.ts`.
 *
 * WHY THIS EXISTS
 * v2.13.0 made the project write catalog dumps to Vercel Blob on a schedule, but shipped no
 * committed way to check them. A backup you cannot verify is a hope, not a backup — and on the
 * Hobby plan the only other evidence (runtime logs) disappears after one hour.
 *
 * WHY THE MANIFEST IS REQUIRED
 * `server/lib/blobBackup.ts` groups objects into dumps by stamp alone. That is correct for
 * retention, but it means a run that died mid-upload still looks like a dump — a stamp with no
 * `manifest.json` would sit in the store as "the newest" for 14 days. Verification must not
 * accept one, so `requiresManifest` is enforced here.
 *
 * Pure by design: no I/O, no `@vercel/blob`, no database. The script owns all of that.
 */

export interface OffsiteBlobRef {
  /** Full path in the store, e.g. `catalog-backups/2026-09-14T17-27-10-591Z/artworks.json`. */
  pathname: string;
  size: number;
  uploadedAt: Date | string;
}

export interface OffsiteDump {
  /** The stamp directory name, e.g. `2026-09-14T17-27-10-591Z`. */
  name: string;
  /** ISO timestamp — object `uploadedAt` when known, otherwise parsed from the stamp. */
  createdAt: string;
  files: number;
  bytes: number;
  hasManifest: boolean;
}

export type OffsiteProblem =
  | 'no-dumps'
  | 'stamp-not-found'
  | 'incomplete-dump'
  | 'stale-dump';

export interface OffsiteSelection {
  ok: boolean;
  dump?: OffsiteDump;
  problem?: OffsiteProblem;
  message?: string;
}

function stampFromPath(pathname: string): string | null {
  // `catalog-backups/<stamp>/<file>` — anything shallower is not a dump object.
  const parts = pathname.split('/');
  return parts.length >= 3 ? parts[1] : null;
}

/** ISO-ish stamp (`2026-09-14T17-27-10-591Z`) → a comparable ISO string. */
function stampToIso(stamp: string): string | null {
  const m = stamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z`;
}

function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Group objects by stamp, newest first. `hasManifest` is what separates a real dump from debris. */
export function groupOffsiteDumps(blobs: OffsiteBlobRef[]): OffsiteDump[] {
  const byName = new Map<
    string,
    { files: number; bytes: number; hasManifest: boolean; latest: Date | null }
  >();

  for (const blob of blobs) {
    const name = stampFromPath(blob.pathname);
    if (!name) continue;

    const entry =
      byName.get(name) ?? { files: 0, bytes: 0, hasManifest: false, latest: null as Date | null };
    entry.files += 1;
    entry.bytes += blob.size;
    if (blob.pathname.endsWith('/manifest.json')) entry.hasManifest = true;

    // A dump is only complete once its manifest has landed, so the newest object is the best
    // available answer to "when did this dump finish?".
    const uploaded = toDate(blob.uploadedAt);
    if (uploaded && (!entry.latest || uploaded.getTime() > entry.latest.getTime())) {
      entry.latest = uploaded;
    }
    byName.set(name, entry);
  }

  const dumps: OffsiteDump[] = [];
  for (const [name, entry] of byName) {
    dumps.push({
      name,
      createdAt: (entry.latest?.toISOString() ?? stampToIso(name) ?? ''),
      files: entry.files,
      bytes: entry.bytes,
      hasManifest: entry.hasManifest,
    });
  }
  // Newest first; the stamp breaks ties because it is deterministic.
  return dumps.sort((a, b) => (a.createdAt === b.createdAt ? b.name.localeCompare(a.name) : b.createdAt.localeCompare(a.createdAt)));
}

/**
 * Pick the dump to verify.
 *
 * A dump is only eligible once `manifest.json` exists. If the newest candidate is incomplete the
 * selection fails loudly rather than falling back to an older dump — silently verifying something
 * other than the newest is how a broken nightly run goes unnoticed.
 */
export function selectOffsiteDump(
  dumps: OffsiteDump[],
  options: { stamp?: string; now?: Date; maxAgeHours?: number } = {}
): OffsiteSelection {
  if (dumps.length === 0) {
    return { ok: false, problem: 'no-dumps', message: 'No dumps found in the off-site store.' };
  }

  const sorted = [...dumps].sort((a, b) =>
    a.createdAt === b.createdAt ? b.name.localeCompare(a.name) : b.createdAt.localeCompare(a.createdAt)
  );

  if (options.stamp) {
    const match = sorted.find((d) => d.name === options.stamp);
    if (!match) {
      return {
        ok: false,
        problem: 'stamp-not-found',
        message: `No dump with stamp "${options.stamp}". Known: ${sorted.map((d) => d.name).join(', ')}`,
      };
    }
    if (!match.hasManifest) {
      return {
        ok: false,
        problem: 'incomplete-dump',
        message: `Dump "${match.name}" has ${match.files} object(s) but no manifest.json — the run did not finish.`,
      };
    }
    return { ok: true, dump: match };
  }

  const newest = sorted[0];
  if (!newest.hasManifest) {
    return {
      ok: false,
      problem: 'incomplete-dump',
      message:
        `The newest dump "${newest.name}" has ${newest.files} object(s) but no manifest.json — ` +
        'the run did not finish. Nothing was verified.',
    };
  }

  const maxAgeHours = options.maxAgeHours ?? 0;
  if (maxAgeHours > 0 && options.now) {
    const created = toDate(newest.createdAt);
    if (!created) {
      return {
        ok: false,
        problem: 'stale-dump',
        message: `The newest dump "${newest.name}" has no usable timestamp.`,
      };
    }
    const ageHours = (options.now.getTime() - created.getTime()) / 3_600_000;
    if (ageHours > maxAgeHours) {
      return {
        ok: false,
        problem: 'stale-dump',
        message:
          `The newest dump "${newest.name}" is ${ageHours.toFixed(1)} h old, ` +
          `which exceeds the ${maxAgeHours} h threshold. The scheduled backup is not running.`,
      };
    }
  }

  return { ok: true, dump: newest };
}

/** Object paths belonging to one dump, in upload order (manifest last is expected but not required). */
export function filesForDump(blobs: OffsiteBlobRef[], stamp: string): string[] {
  return blobs
    .filter((b) => stampFromPath(b.pathname) === stamp)
    .map((b) => b.pathname)
    .sort();
}
