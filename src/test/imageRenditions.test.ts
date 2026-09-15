/**
 * Tests for the shared rendition ladder (`server/lib/imageRenditions.ts`).
 *
 * WHY THIS EXISTS
 * This ladder is the contract between three things that otherwise drift: the 151 assets migrated
 * from Cloudinary, every photo the studio uploads from now on, and `src/data/assetRegistry.ts`,
 * which turns `renditions.{thumb,hero,full}.path` into the URLs the public gallery renders. If the
 * encoder changes shape, the gallery breaks — and nothing else in the suite would notice.
 *
 * These are real encodes (sharp, in-process, no network). That is deliberate: the point of the
 * ladder is the bytes it produces, so a mocked encoder would assert nothing.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  LQIP_WIDTH,
  RENDITIONS,
  RENDITION_NAMES,
  UnreadableImageError,
  normalizeFormat,
  renderRenditions,
  renditionObjectPath,
} from '../../server/lib/imageRenditions';

/** A synthetic image of an exact size, PNG-encoded so no encoder shortcuts apply. */
function makeImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 60, b: 60 } },
  })
    .png()
    .toBuffer();
}

describe('rendition contract', () => {
  it('is thumb < hero < full, and full is capped (PRD §1 Q4)', () => {
    expect(RENDITION_NAMES).toEqual(['thumb', 'hero', 'full']);
    expect(RENDITIONS.thumb.width).toBeLessThan(RENDITIONS.hero.width);
    expect(RENDITIONS.hero.width).toBeLessThan(RENDITIONS.full.width);
    expect(RENDITIONS.full.width).toBeLessThanOrEqual(2048);
  });

  it('lays objects out as {public_id}/{name}.webp — the shape the asset registry builds URLs from', () => {
    expect(renditionObjectPath('the-balloon-cats-ii', 'thumb')).toBe('the-balloon-cats-ii/thumb.webp');
    expect(renditionObjectPath('a/b', 'full')).toBe('a/b/full.webp');
  });

  it('spells jpeg as jpg, so `format` never has two names for one thing', () => {
    expect(normalizeFormat('jpeg')).toBe('jpg');
    expect(normalizeFormat('png')).toBe('png');
    expect(normalizeFormat(undefined)).toBe('unknown');
  });
});

describe('renderRenditions', () => {
  it('renders the full ladder at the contracted widths', async () => {
    const source = await makeImage(3000, 1500);
    const rendered = await renderRenditions(source, 'big-painting');

    expect(rendered.renditions.thumb.width).toBe(640);
    expect(rendered.renditions.hero.width).toBe(1280);
    expect(rendered.renditions.full.width).toBe(2048);
    // Aspect ratio is preserved by the resize, not approximated afterwards.
    expect(rendered.renditions.full.height).toBe(1024);
    expect(rendered.renditions.thumb.height).toBe(320);
  });

  it('records the source dimensions and format, not the largest rendition', async () => {
    const source = await makeImage(3000, 1500);
    const rendered = await renderRenditions(source, 'big-painting');

    expect(rendered.width).toBe(3000);
    expect(rendered.height).toBe(1500);
    expect(rendered.format).toBe('png');
  });

  it('never upscales — a small source yields small renditions (the 79 "broken" assets are not broken)', async () => {
    // Median migrated source is ~624px: below the 640px thumb target. Every rendition is capped at
    // the source, which is correct behaviour, not a defective ladder.
    const source = await makeImage(480, 300);
    const rendered = await renderRenditions(source, 'small-painting');

    expect(rendered.renditions.thumb.width).toBe(480);
    expect(rendered.renditions.hero.width).toBe(480);
    expect(rendered.renditions.full.width).toBe(480);
    // capping is exact: no arithmetic drift in the height either
    expect(rendered.renditions.full.height).toBe(300);
  });

  it('publishes measured bytes for every rendition', async () => {
    const rendered = await renderRenditions(await makeImage(3000, 1500), 'big-painting');

    for (const name of RENDITION_NAMES) {
      const meta = rendered.renditions[name];
      expect(meta.bytes).toBeGreaterThan(0);
      // The recorded size must be the size of the buffer actually uploaded.
      expect(meta.bytes).toBe(rendered.buffers[name].length);
    }
    // A real ladder, not three copies of one image.
    expect(rendered.renditions.thumb.bytes).toBeLessThan(rendered.renditions.hero.bytes);
    expect(rendered.renditions.hero.bytes).toBeLessThan(rendered.renditions.full.bytes);
  });

  it('emits a webp lqip data URI small enough to inline on every grid card', async () => {
    const rendered = await renderRenditions(await makeImage(3000, 1500), 'big-painting');

    expect(rendered.lqip.startsWith('data:image/webp;base64,')).toBe(true);
    // 20px wide at q40 is a few hundred bytes; 4 KB would mean the placeholder is not a placeholder.
    expect(rendered.lqip.length).toBeLessThan(4096);
    const pixels = await sharp(
      Buffer.from(rendered.lqip.split(',')[1], 'base64')
    ).metadata();
    expect(pixels.width).toBe(LQIP_WIDTH);
  });

  it('rejects bytes that are not an image rather than registering a row with no dimensions', async () => {
    await expect(renderRenditions(Buffer.from('not an image at all'), 'nope')).rejects.toBeInstanceOf(
      UnreadableImageError
    );
  });

  it('rejects an empty buffer', async () => {
    await expect(renderRenditions(Buffer.alloc(0), 'nope')).rejects.toBeInstanceOf(
      UnreadableImageError
    );
  });
});
