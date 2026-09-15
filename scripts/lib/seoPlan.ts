/**
 * Build-time SEO planning for the canonical artwork routes (roadmap Phase 2).
 *
 * WHY THIS EXISTS
 * `scripts/prerender-seo.ts` runs after `vite build` and writes one HTML file per published
 * artwork, plus `sitemap.xml`. Every decision it makes — which rows are publishable, what the title
 * and description say, what the canonical URL is, how a tag is spliced into the shell — is here
 * instead, because a decision made inside a script that talks to Supabase is a decision no test can
 * reach. This module is **pure**: no `fs`, no `pg`, no `sharp`, no network. The script injects the
 * I/O.
 *
 * THE ONE RULE THAT MATTERS MOST
 * `selectIndexable` is the exclusion rule the release is graded on. The mural load lands on the
 * order of a hundred *unpublished* records; if a draft reaches the sitemap, the site advertises
 * pages that do not exist and leaks work-in-progress. Drafts and trashed rows are excluded here,
 * and the anon-key read the script uses is excluded again by the `artworks` RLS policy
 * (`USING (trashed = false AND draft = false)`) — two independent gates, deliberately.
 *
 * NOTHING IS INVENTED
 * Titles and descriptions are assembled from the artwork's own columns (`title`, `year`, `medium`,
 * `narrative`, `description`). There is no templated marketing copy: a wrong description on a
 * catalog raisonné entry is a factual error attributed to the artist.
 */
import { artworkPath } from '../../src/lib/artworkRoute';

/** The subset of an `artworks` row this module needs. Extra columns are ignored. */
export interface ArtworkSeoRow {
  slug: string;
  title?: string | null;
  year?: string | number | null;
  medium?: string | null;
  narrative?: string | null;
  description?: string | null;
  draft?: boolean | null;
  trashed?: boolean | null;
}

export interface ArtworkMeta {
  title: string;
  description: string;
  /** Absolute URL — `${origin}/artwork/<slug>`. */
  canonical: string;
  /** Absolute URL. Falls back to the app icon when the artwork has no hero rendition. */
  ogImage: string;
}

export interface ArtworkMetaOptions {
  /** Site origin, e.g. `https://roryskagenart.com`. A trailing slash is tolerated. */
  origin: string;
  /** Absolute URL of the artwork's `hero` rendition, when one exists. */
  heroUrl?: string | null;
}

/** The site icon used when an artwork has no hero image — matches the shell's own `og:image`. */
const FALLBACK_OG_IMAGE = '/android-chrome-512x512.png';

/** `<meta name="description">` and friends read better under this; Google truncates near it. */
const DESCRIPTION_MAX = 160;

/**
 * Escape a value for interpolation into HTML text or a double-quoted attribute.
 *
 * `&` must be replaced first or the entities produced by the later replacements get double-escaped.
 */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeOrigin(origin: string): string {
  return (origin || '').trim().replace(/\/+$/, '');
}

/** The production origin, used whenever the environment does not supply a usable one. */
export const DEFAULT_ORIGIN = 'https://roryskagenart.com';

/**
 * Is this origin a loopback address? — i.e. one that only exists on a developer's machine.
 *
 * A loopback origin must never reach a canonical tag or a sitemap `<loc>`. `.env.local` sets
 * `APP_URL=http://localhost:3000` for local development, and a build that inherited that value
 * would emit `<link rel="canonical" href="http://localhost:3000/artwork/...">` on **every** page —
 * telling a crawler that the real site is a duplicate of a URL that exists on one laptop. That is
 * strictly worse than shipping no canonical at all, and it stays invisible until search traffic
 * disappears.
 */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.localhost')
    );
  } catch {
    // Not a parseable absolute URL — a relative or malformed value is equally unusable.
    return true;
  }
}

/**
 * Resolve the site origin from the environment, refusing anything a crawler must never see.
 *
 * `SITE_URL` wins over `APP_URL` (it is the name the email templates use for public links). An
 * empty, malformed or loopback value falls back to `DEFAULT_ORIGIN` and is reported in `rejected`
 * so the caller can warn rather than fail silently.
 */
export function resolveOrigin(
  siteUrl?: string | null,
  appUrl?: string | null
): { origin: string; rejected?: string } {
  const raw = normalizeOrigin(siteUrl || appUrl || '');
  if (!raw) return { origin: DEFAULT_ORIGIN };
  if (isLoopbackOrigin(raw)) return { origin: DEFAULT_ORIGIN, rejected: raw };
  return { origin: raw };
}

/**
 * The exclusion rule: a row is indexable only when it is neither a draft nor trashed, and it has a
 * non-empty slug.
 *
 * The slug check is not defensive padding — `slug` is `NOT NULL UNIQUE` in the schema, but a blank
 * slug would produce the URL `/artwork/` (the index of nothing), and a sitemap entry pointing there
 * is worse than an omission.
 *
 * `draft`/`trashed` are treated as "false unless explicitly true", matching the column defaults, so
 * a partial REST selection that omits a flag cannot accidentally publish a draft.
 */
export function selectIndexable<T extends ArtworkSeoRow>(artworks: readonly T[]): T[] {
  return artworks.filter(
    (a) => a && !a.draft && !a.trashed && typeof a.slug === 'string' && a.slug.trim().length > 0
  );
}

/**
 * Reduce a narrative (stored as markdown, per `src/types/index.ts`) to a one-line description.
 *
 * The catalog narratives open with a generated record block — `[[index|← Return to Master Catalog
 * Index]]`, a heading, an image embed, then the medium/date line. The backlink and the embeds are
 * navigation chrome, not artwork content, so they are dropped rather than allowed to consume the
 * whole description budget.
 */
function narrativeExcerpt(narrative: string): string {
  return String(narrative)
    .replace(/!\[\[[^\]]*\]\]/g, ' ') // wiki image embeds
    .replace(/\[\[\s*index\s*(\|[^\]]*)?\]\]/gi, ' ') // catalog backlink
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2') // [[target|label]] → label
    .replace(/\[\[([^\]]*)\]\]/g, '$1') // [[target]] → target
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // ![alt](url) → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) → text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // heading markers, text kept
    .replace(/^\s{0,3}>\s?/gm, '') // blockquote markers
    .replace(/[*_`~]/g, '') // emphasis / code markers
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cut to `max` characters on a word boundary, appending an ellipsis only when something was cut. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const head = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${head.trimEnd()}…`;
}

/**
 * Title and description for one artwork, assembled from its own fields.
 *
 * Order of preference for the description: the explicit `description` column, then the narrative
 * body, then a line composed from `title` / `medium` / `year`. Every branch reads only from the
 * row.
 */
export function artworkMeta(artwork: ArtworkSeoRow, options: ArtworkMetaOptions): ArtworkMeta {
  const origin = normalizeOrigin(options.origin);
  const title = (artwork.title || artwork.slug || '').trim();
  const year = artwork.year === null || artwork.year === undefined ? '' : String(artwork.year).trim();
  const medium = (artwork.medium || '').trim();

  const pageTitle = year ? `${title} (${year})` : title;

  let description = (artwork.description || '').trim();
  if (!description && artwork.narrative) description = narrativeExcerpt(artwork.narrative);
  if (!description) description = [title, medium, year].filter(Boolean).join(' · ');

  const heroUrl = (options.heroUrl || '').trim();
  const canonical = `${origin}${artworkPath(artwork.slug)}`;

  return {
    title: pageTitle,
    description: truncate(description, DESCRIPTION_MAX),
    canonical,
    // An `og:image` must be absolute — a relative one is silently dropped by most crawlers, which
    // is the state the site shipped in (index.html:15). Only an absolute hero URL is accepted.
    ogImage: /^https?:\/\//i.test(heroUrl) ? heroUrl : `${origin}${FALLBACK_OG_IMAGE}`,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replace the first match, or insert the tag just before `</head>` when the shell lacks it. */
function upsert(html: string, pattern: RegExp, tag: string): string {
  if (pattern.test(html)) return html.replace(pattern, tag);
  // A shell with no `</head>` is not a shell. Leave it untouched rather than corrupting it.
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function metaTag(attr: 'name' | 'property', value: string, content: string): string {
  return `<meta ${attr}="${value}" content="${escapeHtml(content)}" />`;
}

function metaPattern(attr: 'name' | 'property', value: string): RegExp {
  return new RegExp(`<meta\\b[^>]*\\b${attr}=["']${escapeRegExp(value)}["'][^>]*>`, 'i');
}

/**
 * Splice one artwork's metadata into the built shell.
 *
 * Every tag is *upserted*: replaced in place when the shell already carries it (the shipped
 * `index.html` has `og:*` and `twitter:*`, but no `canonical` and no `og:url`), inserted before
 * `</head>` otherwise. `upsert` replaces rather than appends, so a shell that already has a tag
 * never ends up with two — two `<link rel="canonical">` tags make a page's canonical ambiguous,
 * which is worse than having none.
 */
export function injectMeta(shellHtml: string, meta: ArtworkMeta): string {
  const title = escapeHtml(meta.title);
  let html = upsert(shellHtml, /<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);

  const pairs: Array<[('name' | 'property'), string, string]> = [
    ['name', 'description', meta.description],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['property', 'og:image', meta.ogImage],
    ['property', 'og:url', meta.canonical],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
    ['name', 'twitter:image', meta.ogImage],
  ];

  for (const [attr, value, content] of pairs) {
    html = upsert(html, metaPattern(attr, value), metaTag(attr, value, content));
  }

  return upsert(
    html,
    /<link\b[^>]*\brel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
  );
}

/**
 * `sitemap.xml` over the indexable artworks — nothing else.
 *
 * Sorted by slug so two builds of the same catalog produce byte-identical output and a diff shows
 * only real change. The single-URL `<urlset>` (no `sitemapindex`) is correct at this scale.
 */
export function buildSitemap(
  artworks: readonly ArtworkSeoRow[],
  options: { origin: string }
): string {
  const origin = normalizeOrigin(options.origin);
  const locations = selectIndexable(artworks)
    .map((a) => `${origin}${artworkPath(a.slug)}`)
    .sort((a, b) => a.localeCompare(b));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locations.map((loc) => `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n  </url>`),
    '</urlset>',
    '',
  ].join('\n');
}
