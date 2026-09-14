/**
 * Pure logic for reconciling `media_assets` against the objects actually in Supabase Storage.
 *
 * WHY THIS EXISTS
 * Database backups do **not** contain Storage objects — only metadata about them (verified against
 * the Supabase docs, 2026-09-14; see docs/runbooks/database-backup-restore.md §6). So the 605
 * irreplaceable image files in the `artwork-images` bucket have a completely separate failure mode
 * from the 152 rows that describe them, and nothing in the repo checked either direction:
 *
 *   - a row whose object is **gone** is a broken image on the live gallery, and a DB restore will
 *     not bring it back;
 *   - an object with **no row** is invisible to the catalog — the bytes are paid for, backed up
 *     nowhere, and referenced by nothing.
 *
 * A backup you have never compared against reality is a belief, not a backup. This is the
 * comparison.
 *
 * Everything here is pure — no `pg`, no `@supabase/supabase-js`, no filesystem — so the rules are
 * testable offline in `src/test/mediaReconcile.test.ts`. `scripts/verify-media-backup.ts` owns I/O.
 */
export const BUCKET = 'artwork-images';

/** The marker in a Supabase public object URL that precedes the path within the bucket. */
export const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`;

export interface MediaAssetRow {
  id: string;
  public_id: string | null;
  url: string | null;
  thumbnail_url: string | null;
  folder: string | null;
  /** jsonb: `{ thumb: { path, bytes, width, height }, hero: {…}, full: {…}, … }` when present. */
  renditions: unknown;
}

export interface StorageObject {
  /** Path within the bucket, e.g. `kirunan/hero.webp`. */
  path: string;
  bytes: number | null;
}

/**
 * Pull the in-bucket path out of a media URL.
 *
 * Three shapes occur in `media_assets`:
 *   1. a full public URL (`…/storage/v1/object/public/artwork-images/kirunan/hero.webp`),
 *   2. a bare relative path (`kirunan/hero.webp`) — used by newer single-object uploads,
 *   3. an external URL from before the Cloudinary exit.
 *
 * (3) returns `null` and is **not** reported as a problem: those rows predate Supabase Storage and
 * are resolved by the asset registry, not by this bucket.
 */
export function pathFromMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const markerAt = trimmed.indexOf(PUBLIC_URL_MARKER);
  if (markerAt !== -1) {
    const path = decodeURIComponent(trimmed.slice(markerAt + PUBLIC_URL_MARKER.length).split(/[?#]/)[0]);
    return path || null;
  }

  // Not a URL at all — treat it as a path already relative to the bucket.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, '').replace(/^artwork-images\//, '') || null;
  }

  return null;
}

/** Every rendition path recorded in a row's `renditions` jsonb. Tolerates any shape. */
export function renditionPaths(renditions: unknown): { path: string; bytes: number | null }[] {
  if (!renditions || typeof renditions !== 'object' || Array.isArray(renditions)) return [];

  const found: { path: string; bytes: number | null }[] = [];
  for (const value of Object.values(renditions as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as { path?: unknown; bytes?: unknown };
    if (typeof entry.path !== 'string' || !entry.path) continue;
    found.push({ path: entry.path, bytes: typeof entry.bytes === 'number' ? entry.bytes : null });
  }
  return found;
}

export interface ExpectedPath {
  path: string;
  /** Byte size the row claims, when it claims one. */
  bytes: number | null;
}

/**
 * Every Storage path a row points at.
 *
 * `renditions` is the richer source and wins, but it is **not** always present: uploads made
 * through `POST /api/media/upload` write a single object and set `url` and `thumbnail_url` to the
 * same value, with no `renditions` and no `lqip`. A reconciliation that only read `renditions`
 * would silently skip exactly the newest assets — the ones added since the Cloudinary exit.
 */
export function expectedPathsForRow(row: MediaAssetRow): ExpectedPath[] {
  const byPath = new Map<string, ExpectedPath>();

  for (const rendition of renditionPaths(row.renditions)) {
    if (!byPath.has(rendition.path)) byPath.set(rendition.path, { path: rendition.path, bytes: rendition.bytes });
  }

  // `bytes` is unknown from a URL alone, so an existing rendition entry (which knows it) is kept.
  for (const url of [row.url, row.thumbnail_url]) {
    const path = pathFromMediaUrl(url);
    if (path && !byPath.has(path)) byPath.set(path, { path, bytes: null });
  }

  return [...byPath.values()];
}

/**
 * The migration from Cloudinary stored four objects per asset — `thumb`, `hero`, `full` and
 * `original` — but `media_assets.renditions` records only the first three. So an object named
 * `original.*` is expected to be unreferenced, and calling it a problem would bury the real signal
 * in 151 lines of noise.
 *
 * It is still **reported**, under its own kind, because the conclusion is not "ignore it" — it is
 * that the highest-resolution master of every artwork is the one object in the bucket no database
 * row points at. If one disappeared, nothing in the catalog would notice, and no database restore
 * would bring it back. Expected is not the same as protected.
 */
export const ORIGINAL_BASENAME = 'original';

export function isOriginalObject(path: string): boolean {
  const base = path.split('/').pop() ?? '';
  return base.replace(/\.[^.]*$/, '').toLowerCase() === ORIGINAL_BASENAME;
}

export type MediaProblemKind =
  /** A row points at an object that is not in the bucket — a broken image, and unrestorable. */
  | 'missing-object'
  /** An object no row references, other than a known `original.*` master. */
  | 'unreferenced-object'
  /** An `original.*` master, in the bucket but referenced by no row. Expected — see above. */
  | 'unreferenced-original'
  /** A row yields no in-bucket path at all (e.g. a still-external URL). Informational. */
  | 'external-or-unresolved'
  /** The row records a size and the object on disk disagrees — possible truncation. */
  | 'size-mismatch';

export interface MediaProblem {
  kind: MediaProblemKind;
  publicId?: string;
  path?: string;
  detail: string;
}

export interface MediaReport {
  rows: number;
  objects: number;
  objectBytes: number;
  referencedPaths: number;
  missing: number;
  /** Unreferenced objects that are NOT `original.*` masters — genuinely unexpected. */
  unreferenced: number;
  /** Unreferenced `original.*` masters. Expected, reported, and not treated as a failure. */
  unreferencedOriginals: number;
  external: number;
  sizeMismatches: number;
  /** Problems that should fail a run. Everything not counted here is informational. */
  blocking: number;
  problems: MediaProblem[];
}

/** Kinds that mean "do not trust the bucket" rather than "worth knowing". */
export const BLOCKING_KINDS: MediaProblemKind[] = ['missing-object', 'unreferenced-object', 'size-mismatch'];

/**
 * Compare rows against objects.
 *
 * `missing-object` and `unreferenced-object` are the two that matter; the other two are reported so
 * the picture is complete rather than flattering. Every problem is collected, never thrown — the
 * useful output of a reconciliation is the list.
 */
export function reconcileMedia(rows: MediaAssetRow[], objects: StorageObject[]): MediaReport {
  const present = new Map<string, StorageObject>();
  for (const object of objects) present.set(object.path, object);

  const referenced = new Set<string>();
  const problems: MediaProblem[] = [];

  for (const row of rows) {
    const expected = expectedPathsForRow(row);

    if (expected.length === 0) {
      problems.push({
        kind: 'external-or-unresolved',
        publicId: row.public_id ?? undefined,
        detail: `Row ${row.id} (${row.public_id ?? 'no public_id'}) resolves to no path in the ${BUCKET} bucket.`,
      });
      continue;
    }

    for (const want of expected) {
      referenced.add(want.path);
      const actual = present.get(want.path);

      if (!actual) {
        problems.push({
          kind: 'missing-object',
          publicId: row.public_id ?? undefined,
          path: want.path,
          detail: `${want.path} is referenced by row ${row.id} but is not in the bucket.`,
        });
        continue;
      }

      if (want.bytes !== null && actual.bytes !== null && want.bytes !== actual.bytes) {
        problems.push({
          kind: 'size-mismatch',
          publicId: row.public_id ?? undefined,
          path: want.path,
          detail: `${want.path} is ${actual.bytes} B in the bucket; the row records ${want.bytes} B.`,
        });
      }
    }
  }

  for (const object of objects) {
    if (referenced.has(object.path)) continue;
    const original = isOriginalObject(object.path);
    problems.push({
      kind: original ? 'unreferenced-original' : 'unreferenced-object',
      path: object.path,
      detail: original
        ? `${object.path} is an unreferenced master — in the bucket, but no media_assets row points at it.`
        : `${object.path} is in the bucket but no media_assets row references it.`,
    });
  }

  const count = (kind: MediaProblemKind) => problems.filter((p) => p.kind === kind).length;

  return {
    rows: rows.length,
    objects: objects.length,
    objectBytes: objects.reduce((sum, o) => sum + (o.bytes ?? 0), 0),
    referencedPaths: referenced.size,
    missing: count('missing-object'),
    unreferenced: count('unreferenced-object'),
    unreferencedOriginals: count('unreferenced-original'),
    external: count('external-or-unresolved'),
    sizeMismatches: count('size-mismatch'),
    blocking: problems.filter((p) => BLOCKING_KINDS.includes(p.kind)).length,
    problems,
  };
}

/** MiB with one decimal — the unit the bucket's size has always been quoted in. */
export function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
