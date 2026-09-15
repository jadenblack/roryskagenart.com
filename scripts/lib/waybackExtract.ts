/**
 * Pure extraction logic for the v3 Wayback merge (PRD_V3 §3 Step 1).
 *
 * WHY THIS EXISTS
 * The two archived sites are WordPress static captures from ~2011–2016, and they were captured by
 * two *different* themes — "Modularity" (murals) and "Berlin" (fine art). They disagree about
 * almost every detail that matters to a parser:
 *
 *   |              | murals (Modularity)                    | fine art (Berlin)                  |
 *   | :----------- | :------------------------------------- | :--------------------------------- |
 *   | attributes   | **unquoted** (`content=… name=description`) | quoted                          |
 *   | `<title>`    | `Beerland Mural | Central Texas Murals…`   | newline-padded `Beaver Holiday :: …` |
 *   | heading      | `<h2>Beerland Mural</h2>`               | `<h2><a rel=bookmark>Beaver Holiday</a></h2>` |
 *   | post id      | `class="post-99 post … postid-99"`      | `class="post-383 …" id="post-383"` |
 *   | images       | **usually none**                        | `og:image` + `<img>`              |
 *
 * A regex written against one theme silently returns nothing for the other — which is how a
 * migration "finds" 59 mural pages with no images and concludes the archive is empty. Everything
 * here therefore goes through one attribute parser rather than per-theme patterns.
 *
 * PURE BY CONSTRUCTION: no `fs`, no `pg`, no `dotenv`. `src/test/bundleSafety.test.ts` enforces
 * that boundary for `scripts/lib/`, and it is what lets the extractor be tested against inline
 * HTML fixtures instead of the 557-file archive.
 */

/** The two HTML scrape directories. These are the ones `wayback-extract.ts` walks by default. */
export type ScrapeArchiveId = 'centraltexasmurals.com-v1' | 'roryskagen.com-v1';

/**
 * Any archive directory under `wayback/`.
 *
 * Deliberately open-ended rather than a closed union: v3 gained a **third** source — the recovered
 * WordPress export (`wayback/centraltexasmuralsbyroryskagen-<stamp>/`) — and its directory name
 * carries the export timestamp, so it cannot be a literal type without breaking on a re-export.
 * Every consumer joins `wayback/<archive>/<archivePath>`, so the value is a directory name first
 * and a label second.
 */
export type ArchiveId = ScrapeArchiveId | (string & {});

export const ARCHIVE_IDS: ScrapeArchiveId[] = ['centraltexasmurals.com-v1', 'roryskagen.com-v1'];

/**
 * Which site a source came from, in the words the studio uses.
 *
 * Keyed off the site name rather than an allow-list so a newly-discovered source is classified the
 * moment it is named — the recovered WordPress export is the mural site, and a default of
 * `fine-art` would have mislabelled all 62 of its posts.
 */
export function archiveKind(archive: ArchiveId): 'mural' | 'fine-art' {
  return archive.startsWith('roryskagen.com') ? 'fine-art' : 'mural';
}

export interface ExtractedImage {
  /** The reference exactly as it appears in the HTML. */
  ref: string;
  /** True when it points into the archive's `wp-content/uploads` tree. */
  local: boolean;
  /** True when it points at `*.wp.com` — the Jetpack CDN, which Wayback never archived. */
  remote: boolean;
  /** Path relative to the archive root, when `local`. */
  archivePath?: string;
  /** Lowercased filename without extension — the join key for image-based matching. */
  basename: string;
  /**
   * Whether the archive actually contains this file. `undefined` means "not yet verified".
   *
   * ⚠️ `local` is **not** proof the file exists. It is derived from the URL shape alone
   * (`extractImages` is pure and has no filesystem access), and Wayback saved the *page*, not
   * necessarily every asset the page referenced. 18 of the 32 images this archive reports as
   * "needs upload" are referenced but absent from disk — the render stage would fail on them.
   * `applyDiskPresence()` stamps this field from the real filesystem.
   */
  presentOnDisk?: boolean;
}

export interface ExtractedPage {
  archive: ArchiveId;
  /** `business/beerland-mural/index.html` — relative to the archive root. */
  relPath: string;
  /** First path segment: the WordPress category, e.g. `business`, `ad-lands`. */
  category: string;
  /** Last path segment: the wayback-slug, which is *not* authoritative (see PRD_V3 §2). */
  slugCandidate: string;
  title: string;
  description: string;
  narrative: string;
  categories: string[];
  publishedAt: string | null;
  modifiedAt: string | null;
  year: string | null;
  wpPostId: string | null;
  images: ExtractedImage[];
  /** Every reason this record may need a human look. Never fatal. */
  warnings: string[];
}

/** Headings that are sidebar widgets, not post titles. Both themes emit them as `<h2>`. */
const NON_TITLE_HEADINGS = new Set([
  'categories',
  'mural categories',
  'recent projects',
  'recent posts',
  'archives',
  'meta',
  'blogroll',
  'search',
  'pages',
  'tags',
  'recent comments',
  'site admin',
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#8217': '’',
  '#8216': '‘',
  '#8220': '“',
  '#8221': '”',
  '#8211': '–',
  '#8212': '—',
  '#8230': '…',
  '#038': '&',
  '#39': "'",
};

/** Decode the handful of entities these archives actually contain. Numeric refs included. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    if (named) return named;
    const alias = NAMED_ENTITIES[`#${body}`];
    return alias ?? match;
  });
}

/** Collapse all whitespace runs (these pages are newline- and tab-padded) and trim. */
export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function stripTags(html: string): string {
  return normalizeWhitespace(decodeEntities(html.replace(/<[^>]*>/g, ' ')));
}

/**
 * Parse a tag's attributes, quoted **or** unquoted.
 *
 * This is the single most load-bearing function in the module. The mural theme emits
 * `content="…" name=description` — attribute order and quoting both differ from the fine-art
 * theme's `name="description" content="…"` — so any pattern that assumes either shape returns
 * nothing for half the corpus.
 */
export function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

/** Every `<meta …>` tag's attributes, in document order. */
export function metaAttrs(html: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const re = /<meta\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(parseAttrs(m[1]));
  return out;
}

/**
 * Read a meta value by `name` **or** `property`, ignoring attribute order and quoting.
 * Returns `null` when absent — never `''`, so callers can distinguish "missing" from "empty".
 */
export function metaContent(html: string, key: string): string | null {
  const wanted = key.toLowerCase();
  for (const attrs of metaAttrs(html)) {
    const name = (attrs.name ?? '').toLowerCase();
    const property = (attrs.property ?? '').toLowerCase();
    if (name === wanted || property === wanted) {
      const value = normalizeWhitespace(decodeEntities(attrs.content ?? ''));
      if (value) return value;
    }
  }
  return null;
}

/**
 * Strip a site-name suffix off an `<title>`/`<og:title>`.
 * `Beerland Mural | Central Texas Murals by Rory Skagen` → `Beerland Mural`
 * `Beaver Holiday :: Rory Skagen Art`                    → `Beaver Holiday`
 */
export function stripSiteSuffix(raw: string): string {
  const parts = raw.split(/\s*(?:\||::|—|–)\s*/);
  return normalizeWhitespace(parts[0] ?? raw);
}

/** All `<h2>` texts that are not sidebar widgets. */
export function headingTitles(html: string): string[] {
  const out: string[] = [];
  const re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]);
    if (!text) continue;
    if (NON_TITLE_HEADINGS.has(text.toLowerCase())) continue;
    out.push(text);
  }
  return out;
}

export function extractTitle(html: string, fallbackHeading: string[]): string {
  const og = metaContent(html, 'og:title');
  if (og) return stripSiteSuffix(og);
  const heading = fallbackHeading[0];
  if (heading) return heading;
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleTag) {
    const text = normalizeWhitespace(decodeEntities(stripTags(titleTag[1])));
    if (text) return stripSiteSuffix(text);
  }
  return '';
}

export const NARRATIVE_SENTINELS = [
  'This entry was posted',
  'This entry is filed',
  'You can follow any responses',
  'Posted in',
  'Tagged',
  'Comments are closed',
  'Recent Projects',
  'Mural Categories',
  'Leave a Reply',
  '←',
  '→',
];

/**
 * Index of the `<h2>` that carries the post title, or -1.
 *
 * Needed because "start at the post block" is not enough: the mural theme's post container opens
 * *before* the site navigation, so a window taken from it begins with "Services Contact". Anchoring
 * on the title heading instead is what keeps the nav out of the narrative.
 */
function titleHeadingIndex(cleaned: string, title: string): number {
  const re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  let firstUsable = -1;
  while ((m = re.exec(cleaned)) !== null) {
    const text = stripTags(m[1]);
    if (!text || NON_TITLE_HEADINGS.has(text.toLowerCase())) continue;
    if (title && text === title) return m.index;
    if (firstUsable < 0) firstUsable = m.index;
  }
  return firstUsable;
}

/**
 * The post body as plain text.
 *
 * Neither theme wraps the body in a reliable container, so this anchors on the title `<h2>` (falling
 * back to the WordPress `post-<id>` block, and then to the document start), takes a bounded window,
 * and cuts at the first footer sentinel. Bounded deliberately: a 14 KB page can hold a 10 KB
 * sidebar, and a narrative that swallowed the sidebar would be worse than no narrative.
 */
export function extractNarrative(html: string, title = ''): string {
  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  let start = titleHeadingIndex(cleaned, title);
  if (start < 0) {
    const anchor = /class\s*=\s*["']?[^"']*\b(?:post|postid)-(\d+)/i.exec(cleaned);
    if (anchor) {
      // Back up to the '<' that opens the tag carrying the class, or the attribute text leaks
      // into the output as if it were prose.
      const open = cleaned.lastIndexOf('<', anchor.index);
      start = open >= 0 ? open : anchor.index;
    } else {
      start = 0;
    }
  }
  const window = cleaned.slice(start, start + 8000);

  let text = stripTags(window);
  for (const sentinel of NARRATIVE_SENTINELS) {
    const at = text.indexOf(sentinel);
    if (at >= 0) text = text.slice(0, at);
  }
  return normalizeWhitespace(text).slice(0, 4000);
}

export function extractCategories(html: string): string[] {
  const out = new Set<string>();
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    const rel = (attrs.rel ?? '').toLowerCase();
    if (!rel.includes('category')) continue;
    const text = stripTags(m[2]);
    if (text) out.add(text);
  }
  return [...out].sort();
}

export function extractPostId(html: string): string | null {
  const postid = /\bpostid-(\d+)\b/i.exec(html);
  if (postid) return postid[1];
  const idAttr = /\bid\s*=\s*["']?post-(\d+)/i.exec(html);
  if (idAttr) return idAttr[1];
  const cls = /\bclass\s*=\s*["']?[^"']*\bpost-(\d+)/i.exec(html);
  return cls ? cls[1] : null;
}

const IMAGE_EXT = /\.(?:jpe?g|png|gif)(?:$|[?#])/i;
const ASSET_NOISE = /(?:wp-content\/(?:themes|plugins)|wp-includes|\/emoji\/|site-logo|site-icon|avatar|smilies|quote(?:-end)?\.png)/i;

/**
 * Every image the page references, classified.
 *
 * `local` means "Wayback actually saved the bytes". `remote` means the page pointed at the Jetpack
 * CDN (`*.wp.com`) — those bytes are **not** in the archive and never will be, so an ingest plan
 * must not count them as available. Distinguishing the two is the whole point: a report that says
 * "68 pages have images" when 24 of them are unresolvable CDN links would send the media step
 * looking for files that do not exist.
 */
export function extractImages(html: string): ExtractedImage[] {
  const found = new Map<string, ExtractedImage>();
  const re = /(?:src|href|content)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const ref = m[1] ?? m[2] ?? m[3] ?? '';
    if (!ref || !IMAGE_EXT.test(ref)) continue;
    if (ASSET_NOISE.test(ref)) continue;

    const remote = /(^|\/\/)[a-z0-9-]+\.wp\.com\//i.test(ref) || /^https?:\/\//i.test(ref);
    const local = !remote && /wp-content\/uploads\//i.test(ref);

    const basename = (ref.split('/').pop() ?? ref)
      .split('?')[0]
      .replace(/\.[a-z0-9]+$/i, '')
      .toLowerCase();
    if (!basename) continue;

    const existing = found.get(basename);
    if (existing && existing.local && !local) continue; // a local copy wins over the CDN alias
    found.set(basename, {
      ref,
      local,
      remote,
      archivePath: local ? normalizeArchivePath(ref) : undefined,
      basename,
    });
  }
  return [...found.values()].sort((a, b) => a.basename.localeCompare(b.basename));
}

/**
 * Stamp every locally-referenced image with whether the archive actually holds its file.
 *
 * `extractImages` decides `local` from the URL shape and nothing else — it is pure, so it cannot
 * know what is on disk. That is fine as a *classification*, but it is not sufficient to plan an
 * upload: a `wp-content/uploads/…` reference means the page pointed there, not that Wayback
 * captured the asset. Measured against this archive, 18 of 32 such references are absent, so a
 * render stage built on `local` alone fails on more than half its work.
 *
 * The predicate is injected rather than imported so this stays pure and offline-testable; the CLI
 * passes a real `fs.existsSync`. Returns new page objects — callers keep the pre-verification data.
 */
export function applyDiskPresence(
  pages: ExtractedPage[],
  exists: (archive: string, archivePath: string) => boolean
): ExtractedPage[] {
  return pages.map((page) => ({
    ...page,
    images: page.images.map((img) =>
      !img.local || !img.archivePath
        ? img
        : { ...img, presentOnDisk: exists(page.archive, img.archivePath) }
    ),
  }));
}

/** Resolve `../../art/wp-content/uploads/…` against the page's own directory. */
export function normalizeArchivePath(ref: string): string {
  const cleaned = ref.split('?')[0].replace(/^https?:\/\/[^/]+\//i, '');
  const parts = cleaned.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** `<category>/<slug>/index.html` → `{ category, slugCandidate }`, or null for any other shape. */
export function parseRelPath(relPath: string): { category: string; slugCandidate: string } | null {
  const parts = relPath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length !== 3) return null;
  if (parts[2].toLowerCase() !== 'index.html') return null;
  return { category: parts[0], slugCandidate: parts[1] };
}

const YEAR_RE = /^\s*(\d{4})-\d{2}-\d{2}/;

/**
 * Extract one page.
 *
 * Never throws and never returns a page with an empty title — a record with no title cannot be
 * reconciled, so it is reported as a warning on the *caller's* side instead (see the CLI's
 * `pagesSkipped`).
 */
export function extractPage(input: {
  archive: ArchiveId;
  relPath: string;
  html: string;
}): ExtractedPage | null {
  const parsed = parseRelPath(input.relPath);
  if (!parsed) return null;

  const { html } = input;
  const headings = headingTitles(html);
  const title = extractTitle(html, headings);
  const description =
    metaContent(html, 'description') ?? metaContent(html, 'og:description') ?? '';
  const narrative = extractNarrative(html, title);

  const publishedAt = metaContent(html, 'article:published_time');
  const modifiedAt = metaContent(html, 'article:modified_time');
  const yearMatch = YEAR_RE.exec(publishedAt ?? modifiedAt ?? '');
  const images = extractImages(html);
  const categories = extractCategories(html);

  const warnings: string[] = [];
  if (!title) warnings.push('no title found (og:title, <h2> and <title> all empty)');
  if (!description && !narrative) warnings.push('no description and no body text');
  if (!images.some((i) => i.local)) {
    warnings.push(
      images.some((i) => i.remote)
        ? 'no local image — only remote *.wp.com references, which Wayback did not archive'
        : 'no image reference of any kind'
    );
  }
  if (!categories.length) warnings.push('no categories found');

  return {
    archive: input.archive,
    relPath: input.relPath,
    category: parsed.category,
    slugCandidate: parsed.slugCandidate,
    title,
    description,
    narrative,
    categories,
    publishedAt,
    modifiedAt,
    year: yearMatch ? yearMatch[1] : null,
    wpPostId: extractPostId(html),
    images,
    warnings,
  };
}
