/**
 * Split a catalog record's stored markdown into its useful parts.
 *
 * `artworks.narrative` is the full Obsidian-style source document, not a
 * description. A typical record looks like this:
 *
 *   [[index|← Return to Master Catalog Index]]
 *
 *   # Gianondor
 *
 *   ![[gianondor.jpg]]
 *
 *   > **Pop Surrealism & Mid-Century Neo-Retro** — Produced 2019-07-12
 *   > **Medium & Dimensions:** Enamel (3.5ft x 5ft) • 42 × 60 in (107 × 152 cm)
 *   > **Status:** Available • **Surface:** Enamel on steel plate with UV topcoat
 *
 *   ## Artwork Description
 *
 *   Original masterwork by Rory Skagen created on 2019-07-12. …
 *
 * Rendering that document verbatim on the artwork page repeats the title and
 * the hero image that are already on screen — the duplication the studio asked
 * us to remove. This module separates the record into:
 *
 *   - `description` — the prose a visitor actually wants, shown near the top;
 *   - `metaLines`   — the blockquote spec lines (already in the spec matrix);
 *   - `notes`       — any genuine extra prose, kept so nothing is lost;
 *   - `markdown`    — the untouched source, for the provenance panel.
 *
 * Pure and dependency-free: unit-tested offline in `src/test/narrative.test.ts`.
 */

export interface ArtworkNarrative {
  /** The "Artwork Description" section, markdown, or '' when absent. */
  description: string;
  /** Blockquote spec lines with the leading `>` stripped. */
  metaLines: string[];
  /** Remaining prose after the duplicated scaffolding is removed. */
  notes: string;
  /** The original stored markdown, unmodified. */
  markdown: string;
  /**
   * True when the record is only the generated stub the backfill wrote for rows
   * with no bundled content — the UI should invite the curator to write one.
   */
  isPlaceholder: boolean;
}

const RE_INDEX_LINK = /^\s*\[\[index(\|[^\]]*)?\]\]\s*$/i;
const RE_EMBED = /^\s*!\[\[.*?\]\]\s*$/;
const RE_MD_IMAGE = /^\s*!\[[^\]]*\]\([^)]*\)\s*$/;
const RE_BLOCKQUOTE = /^\s*>\s?(.*)$/;
const RE_HEADING = /^(#{1,6})\s+(.*?)\s*$/;
const RE_DESCRIPTION_HEADING = /^#{1,6}\s*artwork\s+description\s*:?\s*$/i;
const RE_PLACEHOLDER = /^original painting from the rory skagen studio catalog\.?$/i;

function squeeze(lines: string[]): string {
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function parseArtworkNarrative(narrative: string | null | undefined): ArtworkNarrative {
  const markdown = (narrative || '').replace(/\r\n?/g, '\n');
  if (!markdown.trim()) {
    return { description: '', metaLines: [], notes: '', markdown, isPlaceholder: false };
  }

  const lines = markdown.split('\n');
  const descriptionLines: string[] = [];
  const kept: string[] = [];

  /** Heading level of the "Artwork Description" section, when open. */
  let descriptionLevel: number | null = null;
  /** The record's own H1 is scaffolding — the page already renders the title. */
  let titleHeadingSeen = false;

  for (const line of lines) {
    const heading = line.match(RE_HEADING);

    if (heading) {
      const level = heading[1].length;

      // The description is a prose block: any heading ends it. Deeper headings
      // are treated as a new section rather than folded into the description,
      // which keeps the description free of markup the inline renderer styles
      // for a dark background only.
      if (descriptionLevel !== null) {
        descriptionLevel = null;
      }

      if (RE_DESCRIPTION_HEADING.test(line)) {
        descriptionLevel = level;
        continue;
      }

      // Drop the record's own H1. Every catalog record opens with `# <title>`,
      // and the page already renders the title in the header — keeping it here
      // is exactly the duplication the studio reported.
      if (level === 1 && !titleHeadingSeen) {
        titleHeadingSeen = true;
        continue;
      }

      if (descriptionLevel !== null) {
        descriptionLines.push(line);
        continue;
      }

      kept.push(line);
      continue;
    }

    if (descriptionLevel !== null) {
      descriptionLines.push(line);
      continue;
    }

    // Navigation + media scaffolding: the page supplies both.
    if (RE_INDEX_LINK.test(line) || RE_EMBED.test(line) || RE_MD_IMAGE.test(line)) {
      continue;
    }

    kept.push(line);
  }

  // Pull the blockquote spec block out of what remains.
  const metaLines: string[] = [];
  const notesLines: string[] = [];
  for (const line of kept) {
    const quote = line.match(RE_BLOCKQUOTE);
    if (quote) {
      const text = quote[1].trim();
      if (text) metaLines.push(text);
      continue;
    }
    notesLines.push(line);
  }

  const descriptionSection = squeeze(descriptionLines);
  const notes = squeeze(notesLines);
  // Most records carry an explicit "## Artwork Description" section; the ones
  // that don't (short records, and the generated stub) keep their prose in
  // whatever is left over, so fall back to it rather than showing nothing.
  const description = descriptionSection || notes;

  return {
    description,
    metaLines,
    notes,
    markdown,
    isPlaceholder: metaLines.length === 0 && RE_PLACEHOLDER.test(description),
  };
}

/**
 * A one-line, plain-text summary of the record for lists and previews.
 * Markdown emphasis, links and embeds are stripped; returns '' when there is
 * nothing worth showing.
 */
export function narrativeExcerpt(
  narrative: string | null | undefined,
  maxLength = 180
): string {
  const { description, notes } = parseArtworkNarrative(narrative);
  const source = description || notes;
  const plain = source
    .replace(/!\[\[.*?\]\]/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[\[([^\]|]*)\|?([^\]]*)\]\]/g, (_m, target, label) => label || target)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  const clipped = plain.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped) + '…';
}
