/**
 * Offline tests for the Wayback extractor.
 *
 * The fixtures below are trimmed copies of real pages — one per theme — because the two themes
 * disagree about attribute quoting, `<title>` shape and where the title lives. A test suite built
 * only from the mural shape would pass while silently returning nothing for all 136 fine-art pages,
 * which is the exact failure this module exists to prevent.
 */
import { describe, expect, it } from 'vitest';
import {
  applyDiskPresence,
  archiveKind,
  decodeEntities,
  extractCategories,
  extractImages,
  extractNarrative,
  extractPage,
  extractPostId,
  extractTitle,
  headingTitles,
  metaContent,
  normalizeArchivePath,
  normalizeWhitespace,
  parseAttrs,
  parseRelPath,
  stripSiteSuffix,
  type ExtractedImage,
  type ExtractedPage,
} from '../../scripts/lib/waybackExtract';

/** Murals — Modularity theme: unquoted attributes, `<h2>` title, no images. */
const MURAL_PAGE = `<!doctype html><html><head>
<meta content="This mural for Beerland Texas was painted on the wall behind this nightclubs stage." name=description>
<meta content=2010-03-19T16:35:40+00:00 property=article:published_time>
<meta content=2014-02-16T22:03:24+00:00 property=article:modified_time>
<meta content="Beerland Mural | Central Texas Murals by Rory Skagen" property=og:title>
<title>Beerland Mural | Central Texas Murals by Rory Skagen</title>
</head><body>
<div class="post-99 post type-post status-publish format-standard hentry category-business">
<h2>Beerland Mural</h2>
<p>This mural for Beerland Texas was painted on the wall behind this nightclubs stage. It&#8217;s convincing.<p>
<p class="postmetadata alt"><small> This entry was posted on Friday, March 19th, 2010 at 4:35 pm. It is filed under
<a rel="category tag" href=../../murals/business/index.html>Business</a>,
<a rel="category tag" href=../../murals/event/index.html>Event</a>,
<a rel="category tag" href=../../murals/interior/index.html>Interior</a>.
You can follow any responses to this entry through the RSS 2.0 feed. </small>
<h2 class="widgettitle">Mural Categories</h2><ul><li>Business</ul>
</div></body></html>`;

/** Fine art — Berlin theme: quoted attributes, multi-line `<title>`, `<h2><a rel=bookmark>`. */
const FINE_ART_PAGE = `<!DOCTYPE html><html><head>
<meta content="text/html; charset=utf-8" http-equiv="Content-Type"/>
<title>
  Beaver Holiday		::
Rory Skagen Art	</title>
<meta content="Beaver Holiday" property="og:title"/>
<meta content="2011-01-27T23:42:55+00:00" property="article:modified_time"/>
<meta content="../../art/wp-content/uploads/2011/01/Beaver-Holiday-copy.jpg" property="og:image"/>
</head><body>
<h1> <a class="logo" href="../../index.html" title="Rory Skagen Art">Rory Skagen Art</a> </h1>
<div class="post-383 post type-post status-publish format-standard has-post-thumbnail hentry category-ad-lands" id="post-383">
<h2><a href="index.html" rel="bookmark" title="Permanent Link: Beaver Holiday">  Beaver Holiday  </a></h2>
<p class="small">January 27th, 2011</p>
<p>An illustration for the ad-lands series.</p>
</div>
<h2 class="widgettitle">Categories</h2>
<ul><li class="cat-item cat-item-5"><a rel="category tag" href="../../portfolio/ad-lands/index.html">Ad Lands</a></li></ul>
</body></html>`;

describe('waybackExtract — primitives', () => {
  it('parses unquoted attributes, which is the whole reason it has its own parser', () => {
    const attrs = parseAttrs(' content="a b" name=description disabled');
    expect(attrs.content).toBe('a b');
    expect(attrs.name).toBe('description');
  });

  it('captures unquoted values, which is what the mural theme emits', () => {
    expect(parseAttrs(' property=og:title content=Beerland_Mural ')).toEqual({
      property: 'og:title',
      content: 'Beerland_Mural',
    });
    // A valueless attribute produces no key at all, so it cannot be mistaken for an empty value.
    expect(parseAttrs('disabled')).toEqual({});
  });

  it('reads a meta value regardless of attribute order or quoting', () => {
    expect(metaContent(MURAL_PAGE, 'description')).toBe(
      'This mural for Beerland Texas was painted on the wall behind this nightclubs stage.'
    );
    expect(metaContent(MURAL_PAGE, 'og:title')).toBe(
      'Beerland Mural | Central Texas Murals by Rory Skagen'
    );
  });

  it('returns null — not empty string — when a meta is absent', () => {
    expect(metaContent(MURAL_PAGE, 'og:image')).toBeNull();
  });

  it('strips the site-name suffix from either separator', () => {
    expect(stripSiteSuffix('Beerland Mural | Central Texas Murals by Rory Skagen')).toBe(
      'Beerland Mural'
    );
    expect(stripSiteSuffix('Beaver Holiday :: Rory Skagen Art')).toBe('Beaver Holiday');
  });

  it('decodes the entities these archives actually contain', () => {
    expect(decodeEntities('It&#8217;s convincing')).toBe('It’s convincing');
    expect(decodeEntities('a &amp; b')).toBe('a & b');
    expect(decodeEntities('&nbsp;')).toBe(' ');
  });

  it('collapses the newline- and tab-padding both themes emit', () => {
    expect(normalizeWhitespace('  a \n\t b  ')).toBe('a b');
  });

  it('ignores sidebar widget headings when collecting title candidates', () => {
    expect(headingTitles(MURAL_PAGE)).toEqual(['Beerland Mural']);
    expect(headingTitles(FINE_ART_PAGE)).toEqual(['Beaver Holiday']);
  });

  it('resolves a relative upload path against the page directory', () => {
    expect(normalizeArchivePath('../../art/wp-content/uploads/2011/01/x.jpg')).toBe(
      'art/wp-content/uploads/2011/01/x.jpg'
    );
  });

  it('accepts only <category>/<slug>/index.html', () => {
    expect(parseRelPath('business/beerland-mural/index.html')).toEqual({
      category: 'business',
      slugCandidate: 'beerland-mural',
    });
    expect(parseRelPath('business/index.html')).toBeNull();
    expect(parseRelPath('business/beerland-mural/feed/index.html')).toBeNull();
  });
});

describe('waybackExtract — titles', () => {
  it('takes the mural title from og:title with the site suffix removed', () => {
    expect(extractTitle(MURAL_PAGE, headingTitles(MURAL_PAGE))).toBe('Beerland Mural');
  });

  it('takes the fine-art title from og:title, not the padded <title>', () => {
    expect(extractTitle(FINE_ART_PAGE, headingTitles(FINE_ART_PAGE))).toBe('Beaver Holiday');
  });

  it('falls back to a heading, then to a cleaned <title>', () => {
    const noOg = '<title>Plain Title | Site Name</title><h2>Heading Title</h2>';
    expect(extractTitle(noOg, headingTitles(noOg))).toBe('Heading Title');
    expect(extractTitle('<title>Only Title | Site Name</title>', [])).toBe('Only Title');
  });
});

describe('waybackExtract — post id, categories, images', () => {
  it('finds the WordPress post id in both themes', () => {
    expect(extractPostId(MURAL_PAGE)).toBe('99');
    expect(extractPostId(FINE_ART_PAGE)).toBe('383');
  });

  it('collects category anchor text', () => {
    expect(extractCategories(MURAL_PAGE)).toEqual(['Business', 'Event', 'Interior']);
  });

  it('separates locally-archived images from Jetpack CDN references', () => {
    const html = `<meta property="og:image" content="../../art/wp-content/uploads/2011/01/local-copy.jpg"/>
      <img src="https://i1.wp.com/roryskagen.com/art/wp-content/uploads/2011/01/remote.jpg"/>
      <img src="../../wp-content/themes/berlin/images/logo.png"/>`;
    const images = extractImages(html);
    expect(images).toHaveLength(2);
    expect(images.find((i) => i.basename === 'local-copy')).toMatchObject({
      local: true,
      remote: false,
      archivePath: 'art/wp-content/uploads/2011/01/local-copy.jpg',
    });
    const remote = images.find((i) => i.basename === 'remote');
    expect(remote).toMatchObject({ local: false, remote: true });
    expect(remote?.archivePath).toBeUndefined();
  });

  it('drops theme/plugin chrome that would otherwise be mistaken for artwork', () => {
    expect(extractImages('<img src="../../wp-content/themes/x/site-logo.png"/>')).toEqual([]);
    expect(extractImages('<img src="../../wp-includes/emoji/x.png"/>')).toEqual([]);
  });

  it('prefers the local copy when a page has both a local and a CDN alias of one image', () => {
    const images = extractImages(
      `<img src="https://i0.wp.com/x/uploads/same.jpg"/><img src="wp-content/uploads/same.jpg"/>`
    );
    expect(images).toHaveLength(1);
    expect(images[0].local).toBe(true);
  });
});

describe('waybackExtract — narrative', () => {
  it('starts at the title heading, so the nav does not leak in', () => {
    const narrative = extractNarrative(MURAL_PAGE, 'Beerland Mural');
    expect(narrative).toContain('This mural for Beerland Texas');
    expect(narrative).not.toContain('postmetadata');
    expect(narrative).not.toMatch(/^class=/);
  });

  it('cuts at the post footer instead of swallowing the sidebar', () => {
    const narrative = extractNarrative(MURAL_PAGE, 'Beerland Mural');
    expect(narrative).not.toContain('You can follow any responses');
    expect(narrative).not.toContain('Mural Categories');
  });

  it('copes with a page that has no post block at all', () => {
    expect(extractNarrative('<html><body><p>Just text.</p></body></html>', '')).toContain(
      'Just text.'
    );
  });
});

describe('waybackExtract — extractPage', () => {
  it('extracts a mural page end to end', () => {
    const page = extractPage({
      archive: 'centraltexasmurals.com-v1',
      relPath: 'business/beerland-mural/index.html',
      html: MURAL_PAGE,
    });
    expect(page).not.toBeNull();
    expect(page).toMatchObject({
      category: 'business',
      slugCandidate: 'beerland-mural',
      title: 'Beerland Mural',
      year: '2010',
      wpPostId: '99',
    });
    expect(page?.categories).toEqual(['Business', 'Event', 'Interior']);
    expect(page?.publishedAt).toBe('2010-03-19T16:35:40+00:00');
    // No local image and no CDN reference at all — the honest warning for 54 of the 61 murals.
    expect(page?.warnings).toContain('no image reference of any kind');
  });

  it('extracts a fine-art page end to end', () => {
    const page = extractPage({
      archive: 'roryskagen.com-v1',
      relPath: 'ad-lands/beaver-holiday/index.html',
      html: FINE_ART_PAGE,
    });
    expect(page).toMatchObject({
      category: 'ad-lands',
      slugCandidate: 'beaver-holiday',
      title: 'Beaver Holiday',
      year: '2011',
      wpPostId: '383',
    });
    expect(page?.images[0]).toMatchObject({ basename: 'beaver-holiday-copy', local: true });
    expect(page?.warnings).toEqual([]);
  });

  it('warns, rather than fabricating, when a page references only the CDN', () => {
    const page = extractPage({
      archive: 'roryskagen.com-v1',
      relPath: 'ad-lands/x/index.html',
      html: '<html><head><meta property="og:title" content="X"/></head><body>' +
        '<div class="post-1"><h2>X</h2>' +
        '<img src="https://i1.wp.com/roryskagen.com/art/wp-content/uploads/2011/01/x.jpg"/>' +
        '</div></body></html>',
    });
    expect(page?.warnings).toContain(
      'no local image — only remote *.wp.com references, which Wayback did not archive'
    );
  });

  it('rejects a path that is not a content page', () => {
    expect(
      extractPage({ archive: 'centraltexasmurals.com-v1', relPath: 'business/index.html', html: '' })
    ).toBeNull();
  });

  it('maps each archive to the kind the studio uses', () => {
    expect(archiveKind('centraltexasmurals.com-v1')).toBe('mural');
    expect(archiveKind('roryskagen.com-v1')).toBe('fine-art');
  });
});

describe('applyDiskPresence', () => {
  /**
   * The regression this guards: `extractImages` sets `local` from the URL shape alone, so a
   * `wp-content/uploads/…` reference reads as "an image we can upload". Measured against the real
   * archive, 18 of 32 such references have no file — Wayback saved the page but not the asset.
   * Without this pass the render stage fails on more than half its work.
   */
  function pageWithImages(images: Partial<ExtractedImage>[]): ExtractedPage {
    return {
      archive: 'roryskagen.com-v1',
      relPath: 'a/one/index.html',
      title: 'One',
      description: '',
      narrative: '',
      categories: [],
      publishedAt: null,
      modifiedAt: null,
      year: null,
      wpPostId: null,
      warnings: [],
      images: images.map((i) => ({
        ref: '../../art/wp-content/uploads/2017/06/x.jpg',
        local: true,
        remote: false,
        archivePath: 'art/wp-content/uploads/2017/06/x.jpg',
        basename: 'x',
        ...i,
      })),
    } as ExtractedPage;
  }

  it('stamps presentOnDisk from the injected predicate', () => {
    const [page] = applyDiskPresence([pageWithImages([{ basename: 'a' }])], () => true);
    expect(page.images[0].presentOnDisk).toBe(true);
  });

  it('records absence rather than assuming the reference is usable', () => {
    const [page] = applyDiskPresence([pageWithImages([{ basename: 'a' }])], () => false);
    expect(page.images[0].presentOnDisk).toBe(false);
  });

  it('leaves non-local references unverified', () => {
    const [page] = applyDiskPresence(
      [pageWithImages([{ basename: 'cdn', local: false, remote: true, archivePath: undefined }])],
      () => false
    );
    expect(page.images[0].presentOnDisk).toBeUndefined();
  });

  it('does not mutate the input pages', () => {
    const original = pageWithImages([{ basename: 'a' }]);
    applyDiskPresence([original], () => false);
    expect(original.images[0].presentOnDisk).toBeUndefined();
  });

  it('passes the archive through so the predicate can resolve per archive', () => {
    const seen: string[] = [];
    applyDiskPresence([pageWithImages([{ basename: 'a' }])], (archive, archivePath) => {
      seen.push(`${archive}|${archivePath}`);
      return true;
    });
    expect(seen).toEqual(['roryskagen.com-v1|art/wp-content/uploads/2017/06/x.jpg']);
  });
});
