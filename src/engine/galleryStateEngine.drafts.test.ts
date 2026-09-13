import { describe, it, expect } from 'vitest';
import { GalleryStateEngine } from './galleryStateEngine';
import type { ArtworkDbRow } from './galleryStateEngine';

/**
 * Phase 3 draft gate (PRD §4 Phase 3): the engine's rowToRecord is the single
 * choke point — a draft row forces enabled=false, so every public query
 * (getCatalogCount, getFilteredItems, slug lookup consumers) excludes it with
 * no per-view special cases. These tests pin that invariant.
 *
 * rowToRecord is private; we reach it through the exported class via a cast —
 * the tests stay zero-token (no DB, no network) because the method is pure.
 */

const engine = GalleryStateEngine.prototype as unknown as {
  rowToRecord(row: ArtworkDbRow): ReturnType<GalleryStateEngine['getDraftItems']>[number] & { enabled?: boolean };
};

const mkRow = (over: Partial<ArtworkDbRow> = {}): ArtworkDbRow => ({
  slug: 'wip-piece',
  title: 'Work In Progress',
  year: 2026,
  medium: 'Acrylic',
  dimensions: '48" x 60"',
  price: '$5,200',
  status: 'Available',
  gallery_series: 'Neon Americana',
  edition: 'Original Painting',
  location: 'Austin Studio',
  image_url: null,
  hero_slider: false,
  enabled: true,
  draft: true,
  archived: false,
  trashed: false,
  trashed_at: null,
  narrative: '',
  metadata: {},
  ...over,
});

describe('engine draft gate', () => {
  it('draft row forces enabled=false regardless of the DB enabled value', () => {
    const rec = engine.rowToRecord(mkRow({ draft: true, enabled: true }));
    expect(rec.draft).toBe(true);
    expect(rec.enabled).toBe(false);
  });

  it('draft record keeps the draft flag and normal status', () => {
    const rec = engine.rowToRecord(mkRow());
    expect(rec.draft).toBe(true);
    expect(rec.status).toBe('Available');
    expect(rec.trashed).toBe(false);
  });

  it('published (draft=false) row stays enabled as before — no regression', () => {
    const rec = engine.rowToRecord(mkRow({ draft: false, enabled: true }));
    expect(rec.draft).toBe(false);
    expect(rec.enabled).toBe(true);
  });

  it('draft flag survives the record mapping for every row variant', () => {
    // getDraftItems is the admin-facing query; a trashed draft is not a draft
    // for admin purposes (it lives in trash instead)
    const e = Object.create(GalleryStateEngine.prototype) as GalleryStateEngine;
    (e as unknown as { items: GalleryStateEngine['items'] }).items = [
      engine.rowToRecord(mkRow({ slug: 'd1', title: 'D1' })),
      engine.rowToRecord(mkRow({ slug: 'd2', title: 'D2', trashed: true, status: 'Trashed' })),
      engine.rowToRecord(mkRow({ slug: 'p1', title: 'P1', draft: false })),
    ] as GalleryStateEngine['items'];
    const drafts = e.getDraftItems();
    expect(drafts.map((d) => d.slug)).toEqual(['d1']);
  });
});
