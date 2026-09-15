/**
 * Tests for the studio upload pipeline (`server/lib/mediaUpload.ts`).
 *
 * WHY THIS EXISTS
 * Through v2.15.0 `POST /api/media/upload` inserted `VALUES ($1, $2, $2, …)` — one object, `url`
 * identical to `thumbnail_url`, `renditions` and `lqip` left null — so every photo an admin uploaded
 * was served at full size in the gallery grid. The bug was invisible to the suite because nothing
 * between `multer` and a live Supabase client can be exercised offline.
 *
 * These tests are the missing layer: the module takes its three side effects as injected functions,
 * so "three objects uploaded" and "url !== thumbnail_url" are assertions rather than intentions.
 * Real encodes, fake storage — no network, no database.
 */
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { UnreadableImageError, RENDITION_MIME } from '../../server/lib/imageRenditions';
import {
  ALLOWED_MIME_TYPES,
  DEFAULT_UPLOAD_FOLDER,
  buildMediaAssetValues,
  buildPublicId,
  registerUploadedImage,
  validateUpload,
  type MediaAssetRow,
  type MediaAssetValues,
  type MediaUploadDeps,
} from '../../server/lib/mediaUpload';

const PUBLIC_ID = 'the-balloon-cats-ii/1700000000000-cats';
const ORIGIN = 'https://orphcusijzkxpxkzapjp.supabase.co/storage/v1/object/public/artwork-images';

function makeImage(width = 3000, height = 1500): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 90, g: 120, b: 200 } } })
    .png()
    .toBuffer();
}

/** Records what the route would have done, and answers like Supabase would. */
function fakeDeps() {
  const uploaded: { path: string; bytes: number }[] = [];
  const inserted: MediaAssetValues[] = [];

  const deps: MediaUploadDeps = {
    uploadObject: async (path, body) => {
      uploaded.push({ path, bytes: body.length });
    },
    publicUrl: (path) => `${ORIGIN}/${path}`,
    insert: async (values) => {
      inserted.push(values);
      return {
        public_id: values.public_id,
        url: values.url,
        thumbnail_url: values.thumbnail_url,
        format: values.format,
        width: values.width,
        height: values.height,
        artwork_slug: values.artwork_slug,
        lqip: values.lqip,
        renditions: values.renditions,
      } satisfies MediaAssetRow;
    },
  };

  return { deps, uploaded, inserted };
}

describe('validateUpload', () => {
  it('accepts every type the route advertises', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(validateUpload({ mimetype: mime, artworkSlug: '' })).toBeNull();
    }
  });

  it('rejects a type outside the allow-list, naming it', () => {
    const message = validateUpload({ mimetype: 'application/pdf', artworkSlug: '' });
    expect(message).toContain('Unsupported file type: application/pdf');
  });

  it('rejects a slug that is not slug-shaped, before it reaches the bucket', () => {
    expect(validateUpload({ mimetype: 'image/png', artworkSlug: 'not a slug' })).toBe('Invalid artwork slug.');
    expect(validateUpload({ mimetype: 'image/png', artworkSlug: 'ok-slug-2' })).toBeNull();
  });
});

describe('buildPublicId', () => {
  it('files linked uploads under the artwork slug and unlinked ones under uploads/', () => {
    expect(buildPublicId({ originalname: 'Cats.JPG', artworkSlug: 'the-cats', now: 1 })).toBe(
      'the-cats/1-cats'
    );
    expect(buildPublicId({ originalname: 'Cats.JPG', artworkSlug: '', now: 1 })).toBe(
      `${DEFAULT_UPLOAD_FOLDER}/1-cats`
    );
  });

  it('carries no file extension — objects are {public_id}/{name}.webp', () => {
    const id = buildPublicId({ originalname: 'photo.final.jpg', artworkSlug: '', now: 1 });
    expect(id.endsWith('.jpg')).toBe(false);
    expect(id).toBe('uploads/1-photo-final');
  });

  it('sanitizes a filename down to safe path characters', () => {
    // Runs of non-alphanumerics collapse to one dash, and the leading/trailing dash is stripped —
    // `Résumé (draft)!` therefore ends on "draft", not on a dangling dash.
    expect(buildPublicId({ originalname: 'Résumé (draft)!.png', artworkSlug: '', now: 1 })).toBe(
      'uploads/1-r-sum-draft'
    );
  });

  it('falls back to a usable name rather than an empty path segment', () => {
    expect(buildPublicId({ originalname: '.jpg', artworkSlug: '', now: 1 })).toBe('uploads/1-image');
  });
});

describe('buildMediaAssetValues', () => {
  it('points url at hero and thumbnail_url at thumb — the two are never the same object', async () => {
    const rendered = await (async () => {
      const { renderRenditions } = await import('../../server/lib/imageRenditions');
      return renderRenditions(await makeImage(), PUBLIC_ID);
    })();

    const values = buildMediaAssetValues(rendered, {
      publicId: PUBLIC_ID,
      sourceBytes: 123456,
      artworkSlug: 'the-cats',
      publicUrl: (path) => `${ORIGIN}/${path}`,
    });

    expect(values.url).toBe(`${ORIGIN}/${PUBLIC_ID}/hero.webp`);
    expect(values.thumbnail_url).toBe(`${ORIGIN}/${PUBLIC_ID}/thumb.webp`);
    expect(values.url).not.toBe(values.thumbnail_url);
  });

  it('populates the renditions document the asset registry consumes', async () => {
    const { renderRenditions } = await import('../../server/lib/imageRenditions');
    const rendered = await renderRenditions(await makeImage(), PUBLIC_ID);

    const values = buildMediaAssetValues(rendered, {
      publicId: PUBLIC_ID,
      sourceBytes: 123456,
      artworkSlug: null,
      publicUrl: (path) => `${ORIGIN}/${path}`,
    });

    expect(Object.keys(values.renditions).sort()).toEqual(['full', 'hero', 'thumb']);
    expect(values.renditions.thumb.path).toBe(`${PUBLIC_ID}/thumb.webp`);
    expect(values.artwork_slug).toBeNull();
    expect(values.folder).toBe('artwork-images');
    expect(values.bytes).toBe(123456);
    expect(values.lqip.startsWith('data:image/webp;base64,')).toBe(true);
  });
});

describe('registerUploadedImage', () => {
  it('stores exactly three renditions and registers one row', async () => {
    const { deps, uploaded, inserted } = fakeDeps();

    const row = await registerUploadedImage(
      {
        buffer: await makeImage(),
        mimetype: 'image/png',
        originalname: 'cats.png',
        artworkSlug: 'the-cats',
        now: 1700000000000,
      },
      deps
    );

    expect(uploaded.map((u) => u.path)).toEqual([
      'the-cats/1700000000000-cats/thumb.webp',
      'the-cats/1700000000000-cats/hero.webp',
      'the-cats/1700000000000-cats/full.webp',
    ]);
    // Each object is a real, distinct encode.
    expect(new Set(uploaded.map((u) => u.bytes)).size).toBe(3);
    expect(inserted).toHaveLength(1);

    // The acceptance criterion for v2.16.0 S2.
    expect(row.url).not.toBe(row.thumbnail_url);
    expect(row.renditions.hero).toBeTruthy();
    expect(row.renditions.thumb).toBeTruthy();
    expect(row.renditions.full).toBeTruthy();
    expect(row.lqip).toContain('base64');
  });

  it('takes width, height and format from the decoded image, not from client form data', async () => {
    const { deps, inserted } = fakeDeps();

    await registerUploadedImage(
      {
        buffer: await makeImage(2000, 1000),
        mimetype: 'image/png',
        originalname: 'cats.png',
        now: 1,
      },
      deps
    );

    expect(inserted[0].width).toBe(2000);
    expect(inserted[0].height).toBe(1000);
    expect(inserted[0].format).toBe('png');
  });

  it('writes nothing when the bytes are not an image — no half-registered asset', async () => {
    const { deps, uploaded, inserted } = fakeDeps();
    const uploadObject = vi.spyOn(deps, 'uploadObject');

    await expect(
      registerUploadedImage(
        { buffer: Buffer.from('definitely not a png'), mimetype: 'image/png', originalname: 'x.png', now: 1 },
        deps
      )
    ).rejects.toBeInstanceOf(UnreadableImageError);

    expect(uploadObject).not.toHaveBeenCalled();
    expect(uploaded).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it('records the source size as bytes even though the source itself is not retained (PRD Q4)', async () => {
    const { deps, inserted } = fakeDeps();
    const source = await makeImage();

    await registerUploadedImage(
      { buffer: source, mimetype: 'image/png', originalname: 'cats.png', now: 1 },
      deps
    );

    expect(inserted[0].bytes).toBe(source.length);
    // ...and the stored objects are strictly smaller than the source they came from.
    expect(inserted[0].renditions.full.bytes).toBeLessThan(source.length);
  });

  it('uploads renditions as webp regardless of the source format', async () => {
    const { deps, inserted } = fakeDeps();
    const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#333' } })
      .jpeg()
      .toBuffer();

    await registerUploadedImage(
      { buffer: jpeg, mimetype: 'image/jpeg', originalname: 'cats.jpg', now: 1 },
      deps
    );

    expect(inserted[0].format).toBe('jpg');
    for (const name of ['thumb', 'hero', 'full'] as const) {
      expect(inserted[0].renditions[name].path.endsWith('.webp')).toBe(true);
    }
    expect(RENDITION_MIME).toBe('image/webp');
  });
});
