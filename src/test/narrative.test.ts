import { describe, it, expect } from 'vitest';
import { narrativeExcerpt, parseArtworkNarrative } from '../lib/narrative';

/**
 * The records below are copied from the real backfill
 * (`supabase/migrations/2026_09_13_cms_v2_source_of_truth_backfill.sql`), which
 * is what makes the duplication visible on the artwork page: the stored
 * markdown re-states the title and re-embeds the hero image.
 */
const FULL_RECORD = `[[index|← Return to Master Catalog Index]]

# Gianondor

![[gianondor.jpg]]

> **Pop Surrealism & Mid-Century Neo-Retro** — Produced 2019-07-12
> **Medium & Dimensions:** Enamel (3.5ft x 5ft) • 42 × 60 in (107 × 152 cm)
> **Status:** Available • **Surface:** Enamel on steel plate with protective UV topcoat

## Artwork Description

Original masterwork by Rory Skagen created on 2019-07-12. Rendered in Enamel (3.5ft x 5ft) exploring themes of pop surrealism.`;

const STUB_RECORD = `# The Balloon Cats II

Original painting from the Rory Skagen Studio catalog.`;

describe('parseArtworkNarrative', () => {
  it('extracts the description section without the scaffolding', () => {
    const parsed = parseArtworkNarrative(FULL_RECORD);

    expect(parsed.description).toContain('Original masterwork by Rory Skagen');
    // The duplication the studio reported must be gone.
    expect(parsed.description).not.toContain('Gianondor');
    expect(parsed.description).not.toContain('![[gianondor.jpg]]');
    expect(parsed.description).not.toContain('Return to Master Catalog Index');
    expect(parsed.description).not.toContain('Artwork Description');
  });

  it('keeps the blockquote spec lines separate from the prose', () => {
    const parsed = parseArtworkNarrative(FULL_RECORD);

    expect(parsed.metaLines).toHaveLength(3);
    expect(parsed.metaLines[0]).toContain('Produced 2019-07-12');
    expect(parsed.metaLines[2]).toContain('Surface');
    // Spec lines belong in the spec matrix, not in the notes block.
    expect(parsed.notes).toBe('');
  });

  it('never puts an image embed or the H1 into any rendered part', () => {
    const parsed = parseArtworkNarrative(FULL_RECORD);
    const rendered = [parsed.description, parsed.notes, ...parsed.metaLines].join('\n');

    expect(rendered).not.toMatch(/!\[\[/);
    expect(rendered).not.toMatch(/^# /m);
  });

  it('preserves the untouched source for the provenance panel', () => {
    expect(parseArtworkNarrative(FULL_RECORD).markdown).toBe(FULL_RECORD);
  });

  it('falls back to the leftover prose when there is no description heading', () => {
    const parsed = parseArtworkNarrative(STUB_RECORD);

    expect(parsed.description).toBe('Original painting from the Rory Skagen Studio catalog.');
    expect(parsed.isPlaceholder).toBe(true);
  });

  it('flags a real description as not a placeholder', () => {
    expect(parseArtworkNarrative(FULL_RECORD).isPlaceholder).toBe(false);
  });

  it('handles empty and missing narratives without throwing', () => {
    for (const input of ['', null, undefined, '   \n  ']) {
      const parsed = parseArtworkNarrative(input as string);
      expect(parsed.description).toBe('');
      expect(parsed.metaLines).toEqual([]);
      expect(parsed.notes).toBe('');
      expect(parsed.isPlaceholder).toBe(false);
    }
  });

  it('keeps genuine extra prose as notes instead of discarding it', () => {
    const withNotes = `${FULL_RECORD}

## Exhibition history

Shown at the East Austin Studio Tour in 2021.`;

    const parsed = parseArtworkNarrative(withNotes);
    expect(parsed.notes).toContain('Exhibition history');
    expect(parsed.notes).toContain('East Austin Studio Tour');
    // The description stops at the next heading.
    expect(parsed.description).not.toContain('East Austin');
  });

  it('stops the description at any heading, including a deeper one', () => {
    const parsed = parseArtworkNarrative(
      `# Work\n\n## Artwork Description\n\nMain prose.\n\n### Condition report\n\nMinor craquelure.`
    );
    expect(parsed.description).toBe('Main prose.');
    expect(parsed.notes).toContain('Condition report');
  });

  it('strips a standard markdown image as well as an Obsidian embed', () => {
    const parsed = parseArtworkNarrative(
      `# Work\n\n![hero](images/hero.jpg)\n\n## Artwork Description\n\nA painting.`
    );
    expect(parsed.description).toBe('A painting.');
    expect(parsed.notes).toBe('');
  });
});

describe('narrativeExcerpt', () => {
  it('returns plain prose with markdown removed', () => {
    const excerpt = narrativeExcerpt(FULL_RECORD);
    expect(excerpt).toContain('Original masterwork by Rory Skagen');
    expect(excerpt).not.toMatch(/[*_`>#]/);
  });

  it('truncates long descriptions with an ellipsis', () => {
    const long = `## Artwork Description\n\n${'word '.repeat(80)}`;
    const excerpt = narrativeExcerpt(long, 60);
    expect(excerpt.length).toBeLessThanOrEqual(61);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('returns an empty string when there is nothing to summarise', () => {
    expect(narrativeExcerpt('')).toBe('');
    expect(narrativeExcerpt(null)).toBe('');
  });
});
