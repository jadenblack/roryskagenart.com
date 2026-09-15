/**
 * Orchestration for `POST /api/media/upload`: decode → render the ladder → store → register.
 *
 * WHY THIS EXISTS
 * The route used to do everything inline and, in doing so, did half of it: it wrote one object and
 * inserted `VALUES ($1, $2, $2, …)`, so `url === thumbnail_url` and neither `renditions` nor `lqip`
 * were ever populated. Every admin upload therefore landed in the catalog with no thumbnail — the
 * gallery grid downloaded the full-size image.
 *
 * The bug survived because it was untestable: nothing about `upload.single('file')` + a live
 * Supabase client + a live `pg` pool can be exercised offline. So the work is split here — this
 * module owns the decisions (what the object paths are, what goes in the row) and takes its I/O as
 * injected functions; `server/routes/media.ts` owns only the transport. `src/test/mediaUpload.test.ts`
 * drives this module with fakes, which is what makes "url !== thumbnail_url" an assertion instead of
 * a hope.
 *
 * Per PRD §1 Q4 the source bytes are **not** retained: full resolution is never needed in the studio,
 * so an upload stores exactly three WebP renditions and nothing else.
 */
import {
  MEDIA_BUCKET,
  RENDITION_NAMES,
  renderRenditions,
  renditionObjectPath,
  type RenderedImage,
  type RenditionName,
} from './imageRenditions';

/** Accepted upload types. Kept identical to the route's previous allow-list. */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

/** Where uploads with no artwork linkage are filed. */
export const DEFAULT_UPLOAD_FOLDER = 'uploads';

/** `artwork_slug` is a slug or nothing; anything else is rejected before it reaches the bucket. */
export const SLUG_PATTERN = /^[a-z0-9-]+$/i;

export interface UploadInput {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  /** Optional artwork linkage. Empty string is treated as absent. */
  artworkSlug?: string | null;
  /** Injectable clock, so `public_id` is deterministic in tests. */
  now?: number;
}

/** The columns written to `public.media_assets`. */
export interface MediaAssetValues {
  public_id: string;
  url: string;
  thumbnail_url: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  folder: string;
  artwork_slug: string | null;
  lqip: string;
  renditions: Record<RenditionName, { path: string; width: number; height: number; bytes: number }>;
}

/** The row returned to the client. */
export interface MediaAssetRow {
  public_id: string;
  url: string;
  thumbnail_url: string;
  format: string;
  width: number;
  height: number;
  artwork_slug: string | null;
  lqip: string;
  renditions: MediaAssetValues['renditions'];
}

/**
 * The three side effects this module needs. All three are supplied by the route.
 *
 * `uploadObject` takes only a path and bytes: content type, cache control and upsert are the
 * route's concern and are identical for every rendition.
 */
export interface MediaUploadDeps {
  uploadObject: (path: string, body: Buffer) => Promise<void>;
  publicUrl: (path: string) => string;
  insert: (values: MediaAssetValues) => Promise<MediaAssetRow>;
}

/** Returns an error message, or `null` when the upload is acceptable. */
export function validateUpload(input: Pick<UploadInput, 'mimetype' | 'artworkSlug'>): string | null {
  if (!ALLOWED_MIME_TYPES.includes(input.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
    return `Unsupported file type: ${input.mimetype}. Use JPEG, PNG, WebP, GIF, or AVIF.`;
  }
  const slug = (input.artworkSlug ?? '').trim();
  if (slug && !SLUG_PATTERN.test(slug)) return 'Invalid artwork slug.';
  return null;
}

/**
 * Deterministic `public_id` for an upload: `{artwork-slug|uploads}/{timestamp}-{name}`.
 *
 * No file extension — the stored objects are `{public_id}/{thumb|hero|full}.webp`, so an extension
 * here would produce `photo.jpg/thumb.webp`. The extension lives in `media_assets.format` instead,
 * which is where the source format belongs.
 */
export function buildPublicId(input: Pick<UploadInput, 'originalname' | 'artworkSlug' | 'now'>): string {
  const slug = (input.artworkSlug ?? '').trim();
  const baseName =
    input.originalname
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'image';
  const stamp = input.now ?? Date.now();
  return `${slug || DEFAULT_UPLOAD_FOLDER}/${stamp}-${baseName}`;
}

/**
 * The registry row for a rendered upload.
 *
 * `url` is the **hero** rendition and `thumbnail_url` is the **thumb** — the same convention the
 * Cloudinary migration used, and the reason the two are now guaranteed to differ. `bytes` records
 * the size of the *source* image the ladder was rendered from, matching the migrated rows; the
 * stored-bytes figures live per-rendition inside `renditions`.
 */
export function buildMediaAssetValues(
  rendered: RenderedImage,
  options: { publicId: string; sourceBytes: number; artworkSlug: string | null; publicUrl: (path: string) => string }
): MediaAssetValues {
  const { publicId, sourceBytes, artworkSlug, publicUrl } = options;

  return {
    public_id: publicId,
    url: publicUrl(renditionObjectPath(publicId, 'hero')),
    thumbnail_url: publicUrl(renditionObjectPath(publicId, 'thumb')),
    format: rendered.format,
    bytes: sourceBytes,
    width: rendered.width,
    height: rendered.height,
    folder: MEDIA_BUCKET,
    artwork_slug: artworkSlug || null,
    lqip: rendered.lqip,
    renditions: rendered.renditions,
  };
}

/**
 * Decode the upload, store its three renditions, and register the row.
 *
 * Renditions are uploaded in ladder order (`thumb`, `hero`, `full`) so that a partial failure leaves
 * the smaller, more likely-to-be-referenced objects in place rather than the reverse. A failure
 * here throws before any row is written — an asset that is in `media_assets` but missing from the
 * bucket is a broken image on the public site, which is strictly worse than an upload that failed.
 *
 * @throws `UnreadableImageError` when the bytes are not a decodable image.
 */
export async function registerUploadedImage(
  input: UploadInput,
  deps: MediaUploadDeps
): Promise<MediaAssetRow> {
  const publicId = buildPublicId(input);
  const rendered = await renderRenditions(input.buffer, publicId);

  for (const name of RENDITION_NAMES) {
    await deps.uploadObject(renditionObjectPath(publicId, name), rendered.buffers[name]);
  }

  const values = buildMediaAssetValues(rendered, {
    publicId,
    sourceBytes: input.buffer.length,
    artworkSlug: (input.artworkSlug ?? '').trim() || null,
    publicUrl: deps.publicUrl,
  });

  return deps.insert(values);
}
