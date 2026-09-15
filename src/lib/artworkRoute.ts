/**
 * Canonical artwork path routing (`/artwork/<slug>`).
 *
 * WHY THIS EXISTS
 * Every artwork used to live at a fragment URL (`#/artwork/<slug>`). A fragment is not a distinct
 * document to a crawler — Google fetches `/` and sees one page — so none of the catalog was
 * indexable. `/artwork/<slug>` is a real path: `scripts/prerender-seo.ts` emits a real file at that
 * path at build time, and this module is what the SPA uses to resolve it at runtime.
 *
 * Two directions, both here so they can be tested offline:
 *   - `artworkPath` — slug → the path to push into the address bar.
 *   - `parseArtworkPath` / `parseLegacyArtworkHash` — URL → slug, so a boot, a back button, or a
 *     bookmark predating the release all land on the same artwork.
 *
 * ENCODING IS NOT COSMETIC
 * Slugs are not ASCII-safe by assumption: the live catalog contains
 * `motorcycle-mural-—-california-dreamin` (U+2014 EM DASH). Left raw, that character is re-encoded
 * by the browser in ways that differ between pushState, the address bar and the `Location` header,
 * so `artworkPath` always percent-encodes and the parsers always decode. Both directions are total:
 * a malformed escape (`/%`) returns null rather than throwing, because a bad URL is a routing
 * miss, not a crash.
 */

/** Path prefix shared by the canonical route and the prerendered files on disk. */
const ARTWORK_PREFIX = '/artwork/';

/** `motorcycle-mural-—-california-dreamin` → `/artwork/motorcycle-mural-%E2%80%94-california-dreamin`. */
export function artworkPath(slug: string): string {
  return `${ARTWORK_PREFIX}${encodeURIComponent(slug)}`;
}

/** Decode a percent-encoded segment, or null when it is not a well-formed escape sequence. */
function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Extract the slug from a pathname, or null when the path is not an artwork route.
 *
 * Query and fragment are stripped first so this works on the raw `location.href` tail as well as a
 * bare `location.pathname` — the callers pass the latter, but tests and future edge middleware
 * should not have to know that. A trailing slash is tolerated (`/artwork/foo/` ≡ `/artwork/foo`)
 * because hand-typed and copy-pasted URLs pick one up, and the prerender writes a directory.
 */
export function parseArtworkPath(pathname: string): string | null {
  if (!pathname) return null;
  const path = pathname.split(/[?#]/)[0];
  if (!path.startsWith(ARTWORK_PREFIX)) return null;

  const raw = path.slice(ARTWORK_PREFIX.length).replace(/\/+$/, '');
  if (!raw) return null;

  const slug = safeDecode(raw);
  return slug && slug.trim() ? slug : null;
}

/**
 * Extract the slug from a legacy fragment URL, or null.
 *
 * Handles both forms the site has shipped:
 *   `#/artwork/<slug>` — what `navigateTo` wrote and what "Copy share link" produced.
 *   `#artwork/<slug>`  — what `AdminApp` wrote for the catalog row's View action.
 *
 * These are exactly the URLs in circulation before v3.0.0, so this is the seam that keeps old
 * bookmarks and social shares resolving (roadmap Phase 2, item 5).
 */
export function parseLegacyArtworkHash(hash: string): string | null {
  if (!hash) return null;
  // `#/artwork/x` → `/artwork/x`; `#artwork/x` → `artwork/x` → `/artwork/x`.
  const tail = hash.replace(/^#/, '').replace(/^\/?/, '/');
  return parseArtworkPath(tail);
}

/**
 * The slug the canonical path route should render, or null when the hash names a different route.
 *
 * WHY THIS IS A SEPARATE FUNCTION
 * The pathname and the fragment are two address spaces, and a page can carry both — a `pushState`
 * path change leaves the previous hash behind, and the Dashboard link used to write the hash
 * directly. Deciding which one wins is the one genuinely subtle part of the wiring, so it lives
 * here where it can be tested offline rather than inline in a `useEffect`.
 *
 * The rule, in order:
 *   1. No artwork in the pathname → the path route does not apply at all.
 *   2. The hash is a legacy artwork link → it names the *same* route, so it supplies the slug
 *      (this is what makes an old `#/artwork/<slug>` bookmark render the artwork it names).
 *   3. The hash names any other route → that route wins, even though the pathname still says
 *      `/artwork/<slug>`. A stale path must not shadow what the visitor actually asked for.
 *   4. The hash is empty or bare `#` → the path is all there is; render it.
 */
export function resolvePathArtwork(pathname: string, hash: string): string | null {
  const pathSlug = parseArtworkPath(pathname);
  if (!pathSlug) return null;

  const legacySlug = parseLegacyArtworkHash(hash);
  if (legacySlug) return legacySlug;

  const namesAnotherRoute = (hash || '').replace(/^#/, '').replace(/^\/+/, '').trim().length > 0;
  return namesAnotherRoute ? null : pathSlug;
}
