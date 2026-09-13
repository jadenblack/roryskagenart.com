/**
 * Legacy Portfolio Entry Definitions.
 *
 * NOTE: The authoritative source of truth for all artworks and catalog entries
 * is now live in the Supabase PostgreSQL `public.artworks` table.
 * This registry is preserved as a typed interface and empty fallback.
 */

export interface PortfolioEntryDef {
  slug: string;
  title: string;
  date: string;
  medium: string;
  dimensions: string;
  dimensionsInches: string;
  dimensionsCm: string;
  status: string;
  price: string;
  surface: string;
  image: string;
  series: string;
  description: string;
  heroSlider?: boolean;
  location?: string;
  tags?: string[];
}

/**
 * Retained for backward-compatibility during hydration before Supabase records load.
 */
export const PORTFOLIO_POSTS_REGISTRY: PortfolioEntryDef[] = [];

export function generateFullIndexMd(): string {
  return '# Rory Skagen Studio Master Archive\n\nLive database synchronization active.';
}

export function generateAllPostsRecord(): Record<string, string> {
  return {};
}
