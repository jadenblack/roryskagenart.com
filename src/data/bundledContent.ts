/**
 * Bundled-content composer — the canonical offline/first-paint snapshot of the
 * catalog, composed from PORTFOLIO_POSTS_REGISTRY in one place.
 *
 * Two consumers:
 *  1. galleryStateEngine  → bootstrap ArtworkRecords before the API answers
 *  2. scripts/generate-source-of-truth-backfill.mjs → the migration that
 *     backfills narratives/image refs into Supabase (the lossless cutover)
 *
 * The DB is the source of truth; this module only ever seeds.
 */

import { PORTFOLIO_POSTS_REGISTRY, PortfolioEntryDef } from './portfolioPostsData';

/** Engine default-hero slugs (previously hardcoded in parsePostMarkdown). */
export const DEFAULT_HERO_SLUGS = [
  'greetings-from-austin',
  'godzilla-austin',
  'king-kong-austin',
  'drive-in-theatre',
  'retro-robot-sign',
  'atomic-cocktail-lounge',
  'kirunan',
  'terrordon',
  'rendezvous-in-chinatown',
  'the-cats-of-the-colloseum',
];

/** Compose the canonical bundled markdown narrative body for a registry entry. */
export function composeBundledNarrative(post: PortfolioEntryDef): string {
  const imageEmbed = post.image ? `![[${post.image}]]` : `![[art.svg]]`;

  return `[[index|← Return to Master Catalog Index]]

# ${post.title}

${imageEmbed}

> **${post.series}** — Produced ${post.date}
> **Medium & Dimensions:** ${post.medium} (${post.dimensions}) • ${post.dimensionsInches} (${post.dimensionsCm})
> **Status:** ${post.status} • **Surface:** ${post.surface}

## Artwork Description

${post.description}`;
}

/** Resolve the primary image reference for a registry entry. */
export function bundledImageRef(post: PortfolioEntryDef): string {
  return post.image || `${post.slug}.jpg`;
}

export interface BundledArtwork {
  slug: string;
  title: string;
  narrative: string;
  imageRef: string;
}

/** All bundled artworks in registry order. */
export function getBundledArtworks(): BundledArtwork[] {
  return PORTFOLIO_POSTS_REGISTRY.map((post) => ({
    slug: post.slug,
    title: post.title,
    narrative: composeBundledNarrative(post),
    imageRef: bundledImageRef(post),
  }));
}
