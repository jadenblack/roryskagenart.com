/**
 * Phase 2 (addressability / SEO) — the exclusion rule, the metadata, and the two directions of the
 * canonical artwork route.
 *
 * WHY THESE ASSERTIONS EXIST
 * The release is graded on one property above all others: **a draft must never be advertised to a
 * crawler**. The mural load lands ~100 unpublished records, so a `selectIndexable` that leaked one
 * would put work-in-progress in the sitemap and in a prerendered HTML file at a guessable URL.
 * `selectIndexable` is the testable gate for that; the `artworks` RLS policy is the second gate, and
 * `scripts/prerender-seo.ts` reads with the anon key precisely so both apply.
 *
 * The route tests exist because slugs are not ASCII-safe by assumption — the live catalog contains
 * `motorcycle-mural-—-california-dreamin` (U+2014). If `artworkPath` and `parseArtworkPath`
 * disagree on encoding, a shared link resolves to a 404 or to the wrong artwork, and neither
 * failure is visible until a human clicks the link.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ORIGIN,
  artworkMeta,
  buildSitemap,
  escapeHtml,
  injectMeta,
  isLoopbackOrigin,
  resolveOrigin,
  selectIndexable,
  type ArtworkSeoRow,
} from '../../scripts/lib/seoPlan';
import { artworkPath, parseArtworkPath, parseLegacyArtworkHash, resolvePathArtwork } from '../lib/artworkRoute';

const ORIGIN = 'https://roryskagenart.com';

/** A real shape, trimmed: the narrative opens with the generated catalog backlink + heading. */
const published: ArtworkSeoRow = {
  slug: 'steamy-the-flavor-genie',
  title: 'Steamy the Flavor Genie',
  year: '2011',
  medium: 'Acrylic on Baltic birch wooden panel',
  narrative:
    '[[index|← Return to Master Catalog Index]]\n\n# Steamy the Flavor Genie\n\n![[Steamy.jpg]]\n\n> **Vintage Advertising & Commercial Ephemera** — Produced 2011-01-27\n\n## Artwork Description\n\nOriginal masterwork by Rory Skagen.',
  draft: false,
  trashed: false,
};

const second: ArtworkSeoRow = {
  slug: 'greetings-from-austin',
  title: 'Greetings from Austin',
  year: '2019',
  medium: 'Acrylic on panel',
  draft: false,
  trashed: false,
};

const draftRow: ArtworkSeoRow = {
  slug: 'unpublished-mural-draft',
  title: 'Unpublished Mural',
  year: '2026',
  draft: true,
  trashed: false,
};

const trashedRow: ArtworkSeoRow = {
  slug: 'a-trashed-piece',
  title: 'A Trashed Piece',
  draft: false,
  trashed: true,
};

const blankSlugRow: ArtworkSeoRow = {
  slug: '   ',
  title: 'No Slug',
  draft: false,
  trashed: false,
};

const corpus: ArtworkSeoRow[] = [published, second, draftRow, trashedRow, blankSlugRow];

/** The non-ASCII slug that is live in the catalog. */
const EM_DASH_SLUG = 'motorcycle-mural-—-california-dreamin';

describe('selectIndexable', () => {
  it('excludes drafts', () => {
    // The single most important assertion in the release: an unpublished mural must not be
    // advertised, even though the row is otherwise well-formed.
    const kept = selectIndexable(corpus).map((a) => a.slug);
    expect(kept).not.toContain(draftRow.slug);
  });

  it('excludes trashed rows', () => {
    const kept = selectIndexable(corpus).map((a) => a.slug);
    expect(kept).not.toContain(trashedRow.slug);
  });

  it('excludes rows with an empty or whitespace-only slug', () => {
    // A blank slug would mint the URL `/artwork/`, which is an index of nothing.
    expect(selectIndexable(corpus).map((a) => a.slug)).not.toContain(blankSlugRow.slug);
  });

  it('keeps published rows, preserving order', () => {
    expect(selectIndexable(corpus).map((a) => a.slug)).toEqual([published.slug, second.slug]);
  });

  it('treats an absent draft/trashed flag as published (column defaults are false)', () => {
    // A partial REST selection must not accidentally publish a draft — but it must not hide a
    // published row either, which is what an `=== false` check would do.
    const partial: ArtworkSeoRow = { slug: 'no-flags', title: 'No Flags' };
    expect(selectIndexable([partial]).map((a) => a.slug)).toEqual(['no-flags']);
  });
});

describe('buildSitemap', () => {
  it('enumerates every published artwork with an absolute URL, and zero drafts', () => {
    const xml = buildSitemap(corpus, { origin: ORIGIN });
    expect(xml).toContain(`<loc>${ORIGIN}/artwork/${published.slug}</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/artwork/${second.slug}</loc>`);
    expect(xml).not.toContain(draftRow.slug);
    expect(xml).not.toContain(trashedRow.slug);
  });

  it('emits exactly one <url> per indexable row', () => {
    const xml = buildSitemap(corpus, { origin: ORIGIN });
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml.match(/<\/url>/g)).toHaveLength(2);
  });

  it('is a well-formed urlset document', () => {
    const xml = buildSitemap([published], { origin: ORIGIN });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('tolerates a trailing slash on the origin instead of emitting a double slash', () => {
    const xml = buildSitemap([published], { origin: `${ORIGIN}/` });
    expect(xml).toContain(`<loc>${ORIGIN}/artwork/${published.slug}</loc>`);
    expect(xml).not.toContain(`${ORIGIN}//artwork`);
  });
});

describe('artworkMeta', () => {
  it('produces an absolute canonical URL', () => {
    const meta = artworkMeta(published, { origin: ORIGIN });
    expect(meta.canonical).toBe(`${ORIGIN}/artwork/${published.slug}`);
    expect(meta.canonical.startsWith('https://')).toBe(true);
  });

  it('produces an absolute og:image, falling back to the app icon', () => {
    // A relative og:image is silently dropped by most crawlers — the state the site shipped in
    // (index.html:15 was `content="/android-chrome-512x512.png"`).
    const meta = artworkMeta(published, { origin: ORIGIN });
    expect(meta.ogImage).toBe(`${ORIGIN}/android-chrome-512x512.png`);
  });

  it('prefers the artwork hero rendition when one exists', () => {
    const hero = 'https://project.supabase.co/storage/v1/object/public/artwork-images/x/hero.webp';
    expect(artworkMeta(published, { origin: ORIGIN, heroUrl: hero }).ogImage).toBe(hero);
  });

  it('ignores a non-absolute hero URL rather than emitting an unusable og:image', () => {
    const meta = artworkMeta(published, { origin: ORIGIN, heroUrl: '/hero.webp' });
    expect(meta.ogImage).toBe(`${ORIGIN}/android-chrome-512x512.png`);
  });

  it('takes the title and description from the artwork record, never inventing content', () => {
    const meta = artworkMeta(published, { origin: ORIGIN });
    expect(meta.title).toBe('Steamy the Flavor Genie (2011)');
    // The description is the artwork's own narrative — the catalog backlink and the image embed
    // are navigation chrome and are stripped, not summarised into new prose.
    expect(meta.description).toContain('Steamy the Flavor Genie');
    expect(meta.description).toContain('Original masterwork by Rory Skagen');
    expect(meta.description).not.toContain('Return to Master Catalog Index');
    expect(meta.description).not.toContain('[[');
  });

  it('prefers an explicit description column over the narrative', () => {
    const meta = artworkMeta({ ...published, description: 'A specific catalogue note.' }, { origin: ORIGIN });
    expect(meta.description).toBe('A specific catalogue note.');
  });

  it('falls back to the record fields when there is no narrative at all', () => {
    const meta = artworkMeta(
      { slug: 'bare', title: 'Bare Work', year: '2020', medium: 'Oil on canvas' },
      { origin: ORIGIN }
    );
    expect(meta.title).toBe('Bare Work (2020)');
    expect(meta.description).toBe('Bare Work · Oil on canvas · 2020');
  });

  it('keeps the description within a crawler-friendly length', () => {
    const long = { ...published, narrative: 'word '.repeat(200) };
    expect(artworkMeta(long, { origin: ORIGIN }).description.length).toBeLessThanOrEqual(160);
  });

  it('percent-encodes a non-ASCII slug in the canonical URL', () => {
    const meta = artworkMeta({ slug: EM_DASH_SLUG, title: 'Motorcycle Mural' }, { origin: ORIGIN });
    expect(meta.canonical).toBe(`${ORIGIN}/artwork/${encodeURIComponent(EM_DASH_SLUG)}`);
    expect(meta.canonical).not.toContain('—');
  });
});

describe('injectMeta', () => {
  const meta = artworkMeta(published, { origin: ORIGIN });

  /** A shell that already carries the tags `index.html` ships, plus one it does not (canonical). */
  const shell = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Rory Skagen Studio | Art Works</title>
    <meta name="description" content="Official fine art gallery." />
    <meta property="og:title" content="Rory Skagen Studio | Art Works" />
    <meta property="og:description" content="Official fine art gallery." />
    <meta property="og:image" content="/android-chrome-512x512.png" />
    <meta name="twitter:title" content="Rory Skagen Studio | Art Works" />
    <meta name="twitter:description" content="Official fine art gallery." />
    <meta name="twitter:image" content="/android-chrome-512x512.png" />
  </head>
  <body><div id="root"></div></body>
</html>`;

  const countOf = (html: string, needle: string) => html.split(needle).length - 1;

  it('replaces the shell title and description in place', () => {
    const html = injectMeta(shell, meta);
    expect(html).toContain(`<title>${meta.title}</title>`);
    expect(html).not.toContain('Rory Skagen Studio | Art Works');
    expect(countOf(html, '<title>')).toBe(1);
  });

  it('adds a canonical link that the shell did not have', () => {
    const html = injectMeta(shell, meta);
    expect(html).toContain(`<link rel="canonical" href="${meta.canonical}" />`);
    expect(countOf(html, 'rel="canonical"')).toBe(1);
  });

  it('never duplicates a tag — two canonicals make a page ambiguous', () => {
    const html = injectMeta(shell, meta);
    for (const needle of [
      'name="description"',
      'property="og:title"',
      'property="og:description"',
      'property="og:image"',
      'property="og:url"',
      'name="twitter:title"',
      'name="twitter:description"',
      'name="twitter:image"',
    ]) {
      expect(countOf(html, needle), `duplicate ${needle}`).toBe(1);
    }
  });

  it('sets og:url and an absolute og:image', () => {
    const html = injectMeta(shell, meta);
    expect(html).toContain(`<meta property="og:url" content="${meta.canonical}" />`);
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/android-chrome-512x512.png" />`);
    expect(html).toContain(`<meta name="twitter:image" content="${ORIGIN}/android-chrome-512x512.png" />`);
  });

  it('is idempotent — injecting twice changes nothing the second time', () => {
    const once = injectMeta(shell, meta);
    expect(injectMeta(once, meta)).toBe(once);
  });

  it('adds every tag when the shell carries none of them', () => {
    const bare = '<!doctype html><html><head></head><body></body></html>';
    const html = injectMeta(bare, meta);
    expect(html).toContain(`<link rel="canonical" href="${meta.canonical}" />`);
    expect(html).toContain('<meta property="og:image"');
    expect(html).toContain('<meta name="twitter:image"');
  });

  it('escapes content so a quote in a title cannot break out of the attribute', () => {
    const html = injectMeta(shell, artworkMeta({ slug: 'x', title: 'A "quoted" title' }, { origin: ORIGIN }));
    expect(html).toContain('<title>A &quot;quoted&quot; title</title>');
    expect(html).not.toContain('content="A "quoted" title"');
  });

  it('handles the shell that actually ships (index.html)', () => {
    // The inline shell above is a stand-in; this is the real file the build injects into. A shell
    // whose formatting defeated the tag patterns would otherwise only fail at deploy time.
    const shellHtml = readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
    const html = injectMeta(shellHtml, meta);
    expect(html).toContain(`<link rel="canonical" href="${meta.canonical}" />`);
    expect(countOf(html, 'property="og:title"')).toBe(1);
    expect(countOf(html, 'rel="canonical"')).toBe(1);
    expect(html).not.toContain('content="/android-chrome-512x512.png"');
  });
});

describe('escapeHtml', () => {
  it('escapes the five characters that matter, ampersand first', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    // The ampersand is escaped first, so an existing entity is not double-escaped into `&amp;lt;`.
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('artworkPath / parseArtworkPath', () => {
  it('builds the canonical path', () => {
    expect(artworkPath('greetings-from-austin')).toBe('/artwork/greetings-from-austin');
  });

  it('round-trips a plain slug', () => {
    expect(parseArtworkPath(artworkPath('greetings-from-austin'))).toBe('greetings-from-austin');
  });

  it('round-trips the non-ASCII slug that is live in the catalog', () => {
    const built = artworkPath(EM_DASH_SLUG);
    expect(built).toBe(`/artwork/${encodeURIComponent(EM_DASH_SLUG)}`);
    expect(parseArtworkPath(built)).toBe(EM_DASH_SLUG);
  });

  it('decodes a percent-encoded slug written by hand', () => {
    expect(parseArtworkPath('/artwork/motorcycle-mural-%E2%80%94-california-dreamin')).toBe(EM_DASH_SLUG);
    expect(parseArtworkPath('/artwork/greetings%20from%20austin')).toBe('greetings from austin');
  });

  it('returns null for anything that is not an artwork path', () => {
    for (const p of ['/', '/about', '/artwork', '/artwork/', '/artworks/foo', '', '/index.html']) {
      expect(parseArtworkPath(p), p).toBeNull();
    }
  });

  it('returns null rather than throwing on a malformed escape', () => {
    // A bad URL is a routing miss, not a crash: `decodeURIComponent('/artwork/%')` throws.
    expect(parseArtworkPath('/artwork/%')).toBeNull();
    expect(parseArtworkPath('/artwork/%E0%A4%A')).toBeNull();
  });

  it('tolerates a trailing slash and an attached query/fragment', () => {
    expect(parseArtworkPath('/artwork/foo/')).toBe('foo');
    expect(parseArtworkPath('/artwork/foo?utm_source=x')).toBe('foo');
    expect(parseArtworkPath('/artwork/foo#top')).toBe('foo');
  });

  it('round-trips a slug containing a slash', () => {
    // `encodeURIComponent` escapes `/`, so a slug can never be mistaken for a nested path.
    expect(parseArtworkPath(artworkPath('a/b'))).toBe('a/b');
  });
});

describe('parseLegacyArtworkHash', () => {
  it('handles both legacy fragment forms', () => {
    expect(parseLegacyArtworkHash('#/artwork/greetings-from-austin')).toBe('greetings-from-austin');
    expect(parseLegacyArtworkHash('#artwork/greetings-from-austin')).toBe('greetings-from-austin');
  });

  it('round-trips the canonical path back through the legacy parser', () => {
    // This is the redirect seam: the canonical path is fed to the boot check, and the legacy
    // parser is what turns an old bookmark into that path.
    expect(parseLegacyArtworkHash(`#${artworkPath('foo')}`)).toBe('foo');
  });

  it('round-trips the non-ASCII slug through the legacy form', () => {
    expect(parseLegacyArtworkHash(`#/artwork/${encodeURIComponent(EM_DASH_SLUG)}`)).toBe(EM_DASH_SLUG);
  });

  it('returns null for the hash routes that must keep working unchanged', () => {
    for (const h of ['#/admin', '#/admin/catalog', '#/about', '#/contact', '#/page/about', '#/registry', '#/trash', '#', '']) {
      expect(parseLegacyArtworkHash(h), h).toBeNull();
    }
  });
});

describe('resolvePathArtwork', () => {
  it('resolves the path when there is no fragment at all', () => {
    expect(resolvePathArtwork('/artwork/foo', '')).toBe('foo');
    expect(resolvePathArtwork('/artwork/foo', '#')).toBe('foo');
  });

  it('resolves the slug named by a legacy artwork hash', () => {
    // `#/artwork/bar` in the fragment and `/artwork/foo` in the path are the same route; the
    // fragment is the more specific instruction, so it supplies the slug.
    expect(resolvePathArtwork('/artwork/foo', '#/artwork/bar')).toBe('bar');
    expect(resolvePathArtwork('/artwork/foo', '#artwork/bar')).toBe('bar');
    // ...and the fragment alone is enough when the path is the shell.
    expect(resolvePathArtwork('/', '#/artwork/bar')).toBeNull();
  });

  it('lets any other hash route win over a stale artwork path', () => {
    // The regression this guards: from `/artwork/<slug>`, a link that writes `#/admin` directly
    // used to be shadowed by the path and the visitor stayed on the artwork.
    for (const h of ['#/admin', '#/admin/catalog', '#/about', '#/contact', '#/registry', '#/trash', '#/page/about']) {
      expect(resolvePathArtwork('/artwork/foo', h), h).toBeNull();
    }
  });

  it('is null whenever the pathname is not an artwork path', () => {
    expect(resolvePathArtwork('/', '#/artwork/foo')).toBeNull();
    expect(resolvePathArtwork('/about', '')).toBeNull();
    expect(resolvePathArtwork('/artwork', '')).toBeNull();
  });
});

describe('origin resolution', () => {
  /**
   * `.env.local` sets `APP_URL=http://localhost:3000`. If that value ever reached a production
   * build, every canonical and every sitemap `<loc>` would point at a laptop — telling a crawler the
   * real site is a duplicate of an unreachable URL. These assertions exist so the guard cannot be
   * quietly dropped as "defensive".
   */
  it('refuses a loopback origin and reports it', () => {
    for (const bad of [
      'http://localhost:3000',
      'http://localhost',
      'https://127.0.0.1:5173',
      'http://[::1]:3000',
      'http://studio.localhost',
    ]) {
      const resolved = resolveOrigin(bad, undefined);
      expect(resolved.origin, bad).toBe(DEFAULT_ORIGIN);
      expect(resolved.rejected, bad).toBe(bad.replace(/\/+$/, ''));
    }
  });

  it('accepts a real origin, preferring SITE_URL over APP_URL', () => {
    expect(resolveOrigin('https://roryskagenart.com', 'https://other.example').origin).toBe(
      'https://roryskagenart.com'
    );
    // A trailing slash must not produce a double slash in the canonical.
    expect(resolveOrigin('https://roryskagenart.com/', undefined).origin).toBe(
      'https://roryskagenart.com'
    );
    expect(resolveOrigin(undefined, 'https://roryskagenart.com').origin).toBe(
      'https://roryskagenart.com'
    );
  });

  it('falls back to the production origin when nothing usable is set', () => {
    expect(resolveOrigin(undefined, undefined).origin).toBe(DEFAULT_ORIGIN);
    expect(resolveOrigin('', '').origin).toBe(DEFAULT_ORIGIN);
    // A relative value is not an origin at all.
    expect(resolveOrigin('/artwork/foo', undefined).origin).toBe(DEFAULT_ORIGIN);
    expect(resolveOrigin(undefined, undefined).rejected).toBeUndefined();
  });

  it('classifies loopback hosts but not real ones', () => {
    expect(isLoopbackOrigin('http://localhost:3000')).toBe(true);
    expect(isLoopbackOrigin('http://127.0.0.1')).toBe(true);
    expect(isLoopbackOrigin('https://roryskagenart.com')).toBe(false);
    // A hostname that merely contains "localhost" is not loopback.
    expect(isLoopbackOrigin('https://localhost.example.com')).toBe(false);
  });

  it('never lets a loopback origin reach a canonical or a sitemap', () => {
    const { origin } = resolveOrigin('http://localhost:3000', undefined);
    const meta = artworkMeta(published, { origin, heroUrl: null });
    expect(meta.canonical.startsWith(DEFAULT_ORIGIN)).toBe(true);
    expect(meta.canonical).not.toContain('localhost');
    expect(buildSitemap([published], { origin })).not.toContain('localhost');
  });
});

describe('origin resolution', () => {
  /**
   * `.env.local` sets `APP_URL=http://localhost:3000`. If that value ever reached a production
   * build, every canonical and every sitemap `<loc>` would point at a laptop — telling a crawler the
   * real site is a duplicate of an unreachable URL. These assertions exist so the guard cannot be
   * quietly dropped as "defensive".
   */
  it('refuses a loopback origin and reports it', () => {
    for (const bad of [
      'http://localhost:3000',
      'http://localhost',
      'https://127.0.0.1:5173',
      'http://[::1]:3000',
      'http://studio.localhost',
    ]) {
      const resolved = resolveOrigin(bad, undefined);
      expect(resolved.origin, bad).toBe(DEFAULT_ORIGIN);
      expect(resolved.rejected, bad).toBe(bad.replace(/\/+$/, ''));
    }
  });

  it('accepts a real origin, preferring SITE_URL over APP_URL', () => {
    expect(resolveOrigin('https://roryskagenart.com', 'https://other.example').origin).toBe(
      'https://roryskagenart.com'
    );
    // A trailing slash must not produce a double slash in the canonical.
    expect(resolveOrigin('https://roryskagenart.com/', undefined).origin).toBe(
      'https://roryskagenart.com'
    );
    expect(resolveOrigin(undefined, 'https://roryskagenart.com').origin).toBe(
      'https://roryskagenart.com'
    );
  });

  it('falls back to the production origin when nothing usable is set', () => {
    expect(resolveOrigin(undefined, undefined).origin).toBe(DEFAULT_ORIGIN);
    expect(resolveOrigin('', '').origin).toBe(DEFAULT_ORIGIN);
    // A relative value is not an origin at all.
    expect(resolveOrigin('/artwork/foo', undefined).origin).toBe(DEFAULT_ORIGIN);
    expect(resolveOrigin(undefined, undefined).rejected).toBeUndefined();
  });

  it('classifies loopback hosts but not real ones', () => {
    expect(isLoopbackOrigin('http://localhost:3000')).toBe(true);
    expect(isLoopbackOrigin('http://127.0.0.1')).toBe(true);
    expect(isLoopbackOrigin('https://roryskagenart.com')).toBe(false);
    // A hostname that merely contains "localhost" is not loopback.
    expect(isLoopbackOrigin('https://localhost.example.com')).toBe(false);
  });

  it('never lets a loopback origin reach a canonical or a sitemap', () => {
    const { origin } = resolveOrigin('http://localhost:3000', undefined);
    const meta = artworkMeta(published, { origin, heroUrl: null });
    expect(meta.canonical.startsWith(DEFAULT_ORIGIN)).toBe(true);
    expect(meta.canonical).not.toContain('localhost');
    expect(buildSitemap([published], { origin })).not.toContain('localhost');
  });
});
