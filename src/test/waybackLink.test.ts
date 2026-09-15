/**
 * Phase 4 step 3 — the linkage plan.
 *
 * The plan decides which photograph belongs to which mural, and a wrong answer is invisible: the
 * page renders, it just shows the wrong image. So these tests pin the three refusal modes, and the
 * one piece of ordering that the registry's cover selection depends on.
 */
import { describe, expect, it } from 'vitest';
import { artworksCovered, isWritable, planLinks } from '../../scripts/lib/waybackLink';

const entries = [
  { publicId: 'mural-a--one', artworkSlug: 'mural-a' },
  { publicId: 'mural-a--two', artworkSlug: 'mural-a' },
  { publicId: 'mural-a--three', artworkSlug: 'mural-a' },
  { publicId: 'mural-b', artworkSlug: 'mural-b' },
];

const rows = (spec: Record<string, string | null>) =>
  Object.entries(spec).map(([public_id, artwork_slug]) => ({ public_id, artwork_slug }));

describe('planLinks', () => {
  it('links the rows registration deliberately left unlinked', () => {
    const plan = planLinks(entries, rows({ 'mural-a--one': null, 'mural-a--two': null, 'mural-a--three': null, 'mural-b': null }), [
      'mural-a',
      'mural-b',
    ]);
    expect(plan.links).toHaveLength(4);
    expect(plan.conflicts).toEqual([]);
    expect(isWritable(plan)).toBe(true);
    expect(artworksCovered(plan)).toBe(2);
  });

  /**
   * `position = 0` is the cover. The registry used to pick a cover by "whichever public_id sorted
   * first", which is arbitrary; this ordering is what replaces it (R-18). If the manifest order were
   * ever sorted instead of preserved, a mural's cover would change — silently.
   */
  it('numbers position in manifest order, so position 0 is the authored cover', () => {
    const plan = planLinks(entries, rows({ 'mural-a--one': null, 'mural-a--two': null, 'mural-a--three': null, 'mural-b': null }), [
      'mural-a',
      'mural-b',
    ]);
    const a = plan.joins.filter((j) => j.artworkSlug === 'mural-a');
    expect(a.map((j) => j.publicId)).toEqual(['mural-a--one', 'mural-a--two', 'mural-a--three']);
    expect(a.map((j) => j.position)).toEqual([0, 1, 2]);
    // A second artwork's numbering restarts at 0 — position is per-artwork, not global.
    expect(plan.joins.find((j) => j.artworkSlug === 'mural-b')!.position).toBe(0);
  });

  it('treats an already-correct link as done, but still writes its join row', () => {
    // The three entries registration linked itself (`exact-slug` / `divergence-map` / `known-dedupe`)
    // must still get a join row, or a re-run after a partial failure would lose their covers.
    const plan = planLinks(entries, rows({ 'mural-a--one': 'mural-a', 'mural-a--two': null, 'mural-a--three': null, 'mural-b': null }), [
      'mural-a',
      'mural-b',
    ]);
    expect(plan.links.map((l) => l.publicId)).toEqual(['mural-a--two', 'mural-a--three', 'mural-b']);
    expect(plan.alreadyLinked.map((l) => l.publicId)).toEqual(['mural-a--one']);
    expect(plan.joins).toHaveLength(4);
  });

  it('reports a row linked to a DIFFERENT artwork as a conflict, and never re-points it', () => {
    // Silently re-pointing this would move a photograph off a live artwork.
    const plan = planLinks(entries, rows({ 'mural-a--one': 'some-other-artwork', 'mural-a--two': null, 'mural-a--three': null, 'mural-b': null }), [
      'mural-a',
      'mural-b',
    ]);
    expect(plan.conflicts).toEqual([
      { publicId: 'mural-a--one', expected: 'mural-a', actual: 'some-other-artwork' },
    ]);
    expect(plan.links.map((l) => l.publicId)).not.toContain('mural-a--one');
    expect(plan.joins.map((j) => j.publicId)).not.toContain('mural-a--one');
    expect(isWritable(plan)).toBe(false);
  });

  it('reports a manifest slug the backfill did not create', () => {
    const plan = planLinks(entries, rows({ 'mural-a--one': null, 'mural-a--two': null, 'mural-a--three': null, 'mural-b': null }), ['mural-a']);
    expect(plan.unknownArtworks).toEqual(['mural-b']);
    expect(isWritable(plan)).toBe(false);
    // The rest of the plan is still built — the run reports everything wrong, not just the first.
    expect(plan.links).toHaveLength(3);
  });

  it('reports a manifest public_id with no media row (registration did not finish)', () => {
    const plan = planLinks(entries, rows({ 'mural-a--one': null, 'mural-b': null }), ['mural-a', 'mural-b']);
    // `missingMedia` is reported **sorted**, not in manifest order — and lexicographically
    // 'three' precedes 'two' ('h' < 'w'), which is why this is not the authored order.
    expect(plan.missingMedia).toEqual(['mural-a--three', 'mural-a--two']);
    expect(isWritable(plan)).toBe(false);
  });

  it('is a no-op when everything is already linked', () => {
    const plan = planLinks(
      entries,
      rows({ 'mural-a--one': 'mural-a', 'mural-a--two': 'mural-a', 'mural-a--three': 'mural-a', 'mural-b': 'mural-b' }),
      ['mural-a', 'mural-b']
    );
    expect(plan.links).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.alreadyLinked).toHaveLength(4);
    expect(isWritable(plan)).toBe(true);
  });

  it('handles an empty manifest without throwing', () => {
    const plan = planLinks([], [], []);
    expect(plan.links).toEqual([]);
    expect(artworksCovered(plan)).toBe(0);
    expect(isWritable(plan)).toBe(true);
  });
});
