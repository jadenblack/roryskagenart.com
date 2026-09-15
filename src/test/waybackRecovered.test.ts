/**
 * Offline tests for the recovered-WordPress-export reader and the SQL dump parser.
 *
 * Two things here are load-bearing beyond ordinary correctness:
 *
 *  1. **Whitespace between SQL tokens is insignificant.** The first parser pass accumulated it
 *     instead of discarding it, so `post_type` read as `' attachment'` and every attachment was
 *     filtered out of the corpus. That is a silent, total data loss, so it is pinned twice.
 *
 *  2. **`category/slug` must be reconstructible.** The dump holds no URL path, but WordPress
 *     builds a permalink from a post's *lowest-term-ID* category. That rule reproduces the scrape's
 *     path prefix for 60 of 60 shared posts, and it is the only reason this corpus can flow through
 *     the unchanged reconciler and be diffed against the scrape row for row.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { optionalText, parseDump, text, toObjects } from '../../scripts/lib/wordpressDump';
import {
  CURATION_CATEGORIES,
  decodePostSlug,
  NOISE_CATEGORIES,
  RECOVERED_TABLE_PREFIX,
  RECOVERED_UPLOADS_DIR,
  applyBasenameFallback,
  buildBasenameIndex,
  buildTaxonomyModel,
  extractUploadRefs,
  htmlToText,
  imageBasename,
  lowestTermIdCategory,
  normalizeImageStem,
  recoveredAliases,
  recoveredArchivePath,
  taxonomyRole,
  yearOf,
} from '../../scripts/lib/waybackRecovered';
import type { ExtractedImage, ExtractedPage } from '../../scripts/lib/waybackExtract';

const ROOT = path.resolve(__dirname, '../..');

// --- fixtures -----------------------------------------------------------------------------------

/** The minimum `ExtractedPage` the fallback and index helpers actually read. */
function pageOf(images: Partial<ExtractedImage>[]): ExtractedPage {
  return {
    archive: 'centraltexasmuralsbyroryskagen-20260915' as ExtractedPage['archive'],
    relPath: 'featured/good-morning-austin-mural/index.html',
    category: 'featured',
    slugCandidate: 'good-morning-austin-mural',
    title: 'Good Morning Austin Mural',
    description: '',
    narrative: '',
    categories: ['featured'],
    publishedAt: null,
    modifiedAt: null,
    year: null,
    wpPostId: '1',
    images: images.map((img) => ({
      ref: 'https://centraltexasmurals.com/wp-content/uploads/2010/03/good_morning_mural.jpg',
      local: true,
      remote: false,
      basename: 'good_morning_mural',
      ...img,
    })),
    warnings: [],
  };
}

// --- the dump parser ---------------------------------------------------------------------------

const P = RECOVERED_TABLE_PREFIX;

describe('wordpressDump — parseDump', () => {
  it('discards insignificant whitespace between tokens instead of accumulating it', () => {
    // ⚠️ THE TRAP THAT COST A FULL PASS. With whitespace accumulated, `b` reads as `' y'` and the
    // next test's real-world equivalent (`post_type` = `' attachment'`) drops the whole media
    // library. Pinned here so it can never regress silently.
    const sql = `INSERT INTO \`${P}posts\` (\`a\`,\`b\`) VALUES\n  ( 1 , 'x' ) ,\n  (2,'y');\n`;
    const rows = toObjects(parseDump(sql, [`${P}posts`]).get(`${P}posts`)!);
    expect(rows.map((r) => text(r.b))).toEqual(['x', 'y']);
  });

  it('reads a real-world INSERT with a newline before VALUES', () => {
    const sql =
      `INSERT INTO \`${P}posts\` (\`ID\`, \`post_type\`, \`post_status\`) VALUES\n` +
      `(1,'attachment','inherit'),\n(2,'post','publish');\n`;
    const rows = toObjects(parseDump(sql, [`${P}posts`]).get(`${P}posts`)!);
    expect(rows.map((r) => text(r.post_type))).toEqual(['attachment', 'post']);
    expect(text(rows[0].post_type)).not.toContain(' ');
  });

  it('decodes backslash escapes and keeps embedded quotes', () => {
    const sql = `INSERT INTO \`${P}posts\` (\`a\`) VALUES ('it\\'s a \\"test\\"'),('line\\nbreak');`;
    const rows = toObjects(parseDump(sql, [`${P}posts`]).get(`${P}posts`)!);
    expect(text(rows[0].a)).toBe('it\'s a "test"');
    expect(text(rows[1].a)).toBe('line\nbreak');
  });

  it('represents NULL as null, and optionalText maps it to null', () => {
    const sql = `INSERT INTO \`${P}posts\` (\`a\`,\`b\`) VALUES (NULL,'x');`;
    const rows = toObjects(parseDump(sql, [`${P}posts`]).get(`${P}posts`)!);
    expect(rows[0].a).toBeNull();
    expect(optionalText(rows[0].a)).toBeNull();
    expect(text(rows[0].a)).toBe('');
  });

  it('reads only the requested tables', () => {
    const sql =
      `INSERT INTO \`${P}posts\` (\`a\`) VALUES ('1');\n` +
      `INSERT INTO \`${P}postmeta\` (\`a\`) VALUES ('2');\n`;
    const tables = parseDump(sql, [`${P}posts`]);
    expect([...tables.keys()]).toEqual([`${P}posts`]);
  });

  it('tolerates a dump with no matching INSERT', () => {
    expect(parseDump('SELECT 1;', [`${P}posts`]).size).toBe(0);
  });

  it('trims a token, including whitespace that came from inside the literal', () => {
    const sql = `INSERT INTO \`${P}posts\` (\`a\`,\`b\`) VALUES ('  padded  ','  ');`;
    const rows = toObjects(parseDump(sql, [`${P}posts`]).get(`${P}posts`)!);
    // Deliberate: no column in these eight tables treats edge whitespace as content, and WordPress
    // stores `' '` as a value that has to read as absent rather than as a one-character field.
    expect(rows[0].a).toBe('padded');
    expect(text(rows[0].a)).toBe('padded');
    // A whitespace-only value is absent, not a one-space title.
    expect(rows[0].b).toBeNull();
    expect(text('   ')).toBe('');
    expect(optionalText('   ')).toBeNull();
  });

  it('keeps interior whitespace, because only the edges are insignificant', () => {
    const sql = `INSERT INTO \`${P}posts\` (\`a\`) VALUES (' two  spaces ');`;
    const rows = toObjects(parseDump(sql, [`${P}posts`]).get(`${P}posts`)!);
    expect(rows[0].a).toBe('two  spaces');
  });
});

// --- the permalink keystone --------------------------------------------------------------------

describe('lowestTermIdCategory — the permalink rule', () => {
  it('picks the lowest term ID, not the first or the alphabetically first', () => {
    // `austin-postcard-mural` is filed under business + exterior + featured and the scrape recorded
    // `featured/`; `marcia-ball-cd-cover` is business + interior and the scrape recorded
    // `business/`. Ordering by ID gets both right; ordering by name gets neither.
    expect(
      lowestTermIdCategory([
        { termId: 12, slug: 'featured' },
        { termId: 3, slug: 'business' },
        { termId: 9, slug: 'exterior' },
      ])
    ).toBe('business');
  });

  it('returns null for a post with no category', () => {
    expect(lowestTermIdCategory([])).toBeNull();
  });

  it('does not mutate its input', () => {
    const input = [
      { termId: 9, slug: 'b' },
      { termId: 1, slug: 'a' },
    ];
    lowestTermIdCategory(input);
    expect(input[0].termId).toBe(9);
  });
});

// --- text helpers ------------------------------------------------------------------------------

describe('htmlToText', () => {
  it('turns tags into spaces so words do not weld together', () => {
    // `foo<br>bar` must not become `foobar`, and `</p><p>` must not join two sentences.
    expect(htmlToText('<p>foo</p><p>bar</p>')).toBe('foo bar');
    expect(htmlToText('foo<br>bar')).toBe('foo bar');
  });

  it('drops block-editor comments rather than reading them as content', () => {
    expect(htmlToText('<!-- wp:paragraph --><p>real</p><!-- /wp:paragraph -->')).toBe('real');
  });

  it('drops script and style bodies', () => {
    expect(htmlToText('<style>a{color:red}</style><p>keep</p><script>x=1</script>')).toBe('keep');
  });

  it('decodes entities and collapses runs of whitespace', () => {
    expect(htmlToText('<p>a &amp; b&nbsp;&#8212;&nbsp;c</p>')).toBe('a & b — c');
  });
});

describe('extractUploadRefs', () => {
  it('deduplicates a file referenced as both href and src', () => {
    const html =
      '<a href="http://x/wp-content/uploads/2010/03/a.jpg">' +
      '<img src="/wp-content/uploads/2010/03/a.jpg"></a>';
    expect(extractUploadRefs(html)).toEqual(['2010/03/a.jpg']);
  });

  it('strips the cache-buster but keeps the path', () => {
    expect(extractUploadRefs('<img src="/wp-content/uploads/2010/03/a.jpg?ver=2">')).toEqual([
      '2010/03/a.jpg',
    ]);
  });

  it('finds nothing in a body with no uploads', () => {
    expect(extractUploadRefs('<p>no images here</p>')).toEqual([]);
  });

  it('returns sorted, deduplicated refs', () => {
    const html =
      '/wp-content/uploads/b/b.jpg /wp-content/uploads/a/a.jpg /wp-content/uploads/b/b.jpg';
    expect(extractUploadRefs(html)).toEqual(['a/a.jpg', 'b/b.jpg']);
  });
});

describe('filename helpers', () => {
  it('lowercases the basename and drops the extension', () => {
    expect(imageBasename('2010/03/Lunar_Lander.JPG')).toBe('lunar_lander');
    expect(imageBasename('bare')).toBe('bare');
  });

  it('collapses the three naming variants one photograph carries', () => {
    // NextGEN's name, WordPress's edit-image duplicate, and the same with the extension folded in.
    expect(normalizeImageStem('crab')).toBe('crab');
    expect(normalizeImageStem('crab-copy')).toBe('crab');
    expect(normalizeImageStem('copy_2_crab')).toBe('crab');
    expect(normalizeImageStem('good-morning-austin-jpg-copy')).toBe('good-morning-austin');
  });

  it('does not fuzzy-match, so a false link is impossible', () => {
    expect(normalizeImageStem('crab')).not.toBe(normalizeImageStem('crabby'));
  });

  it('extracts a four-digit year, or empty', () => {
    expect(yearOf('2010-03-19 16:16:38')).toBe('2010');
    expect(yearOf('')).toBe('');
    expect(yearOf('not a date')).toBe('');
  });

  it('percent-decodes a post slug, because the two sources must agree on one path', () => {
    // ⚠️ Left encoded, `%e2%80%94` and `—` are the same artwork under two source paths — so the
    // diff says "one lost, one added" and a path-keyed merge creates a duplicate. Similarity
    // scoring can never catch it: the two strings are not similar, they are identical modulo
    // encoding.
    expect(decodePostSlug('motorcycle-mural-%e2%80%94-california-dreamin')).toBe(
      'motorcycle-mural-—-california-dreamin'
    );
    expect(decodePostSlug('beerland-mural')).toBe('beerland-mural');
  });

  it('returns a malformed slug unchanged rather than aborting the extraction', () => {
    expect(decodePostSlug('100%-cotton')).toBe('100%-cotton');
  });

  it('resolves a body ref to the uploads tree, not the bare attached-file path', () => {
    // ⚠️ The bare `_wp_attached_file` path resolves 0 of 358; the real prefix carries an extra `_`.
    expect(recoveredArchivePath('2010/03/lunar_lander.jpg')).toBe(
      `${RECOVERED_UPLOADS_DIR}/2010/03/lunar_lander.jpg`
    );
    expect(RECOVERED_UPLOADS_DIR.endsWith('uploads/_')).toBe(true);
  });
});

// --- taxonomy model ----------------------------------------------------------------------------

describe('taxonomyRole', () => {
  it('classifies curation flags apart from project types', () => {
    // Filing a mural under both `interior` and `featured` as types would put it in two
    // contradictory buckets, so `featured`/`home` are a separate dimension.
    expect(taxonomyRole('featured')).toBe('curation');
    expect(taxonomyRole('home')).toBe('curation');
    expect(CURATION_CATEGORIES.has('featured')).toBe(true);
  });

  it('classifies WordPress defaults as noise', () => {
    expect(taxonomyRole('blogroll')).toBe('noise');
    expect(taxonomyRole('uncategorized')).toBe('noise');
    expect(NOISE_CATEGORIES.has('blogroll')).toBe(true);
  });

  it('classifies the eight descriptive categories as project types', () => {
    for (const slug of ['interior', 'exterior', 'business', 'restaurant', 'retail', 'museum', 'event', 'signage']) {
      expect(taxonomyRole(slug)).toBe('project-type');
    }
  });
});

describe('buildTaxonomyModel', () => {
  it('counts from the relationships, not from WordPress denormalised count', () => {
    const model = buildTaxonomyModel({
      posts: [
        { categories: ['business', 'exterior'], categoryNames: ['Business', 'Exterior'] },
        { categories: ['business'], categoryNames: ['Business'] },
      ],
    } as never);
    const business = model.find((t) => t.slug === 'business');
    expect(business?.postCount).toBe(2);
    expect(business?.role).toBe('project-type');
    // Sorted by count desc, so the most-used term leads.
    expect(model[0].slug).toBe('business');
  });

  it('returns an empty model for an empty corpus', () => {
    expect(buildTaxonomyModel({ posts: [] } as never)).toEqual([]);
  });
});

// --- against the committed extraction ----------------------------------------------------------

describe('waybackRecovered — against the committed extraction', () => {
  const extraction = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data/archive/wayback_recovered_extraction.json'), 'utf8')
  ) as {
    stats: Record<string, number>;
    taxonomy: { slug: string; role: string; postCount: number }[];
    records: { category: string; slugCandidate: string }[];
  };

  it('kept every published post and derived a category and a slug for each', () => {
    // A post with no category cannot form a source path, so it would be invisible to the diff.
    expect(extraction.records.length).toBe(62);
    expect(extraction.records.every((r) => r.category && r.slugCandidate)).toBe(true);
    expect(extraction.stats.posts).toBe(62);
  });

  it('measured zero authored SEO copy rather than assuming it', () => {
    // AIOSEO holds 423 rows and no titles or descriptions — the post body IS the description.
    expect(extraction.stats.seoRows).toBeGreaterThan(0);
    expect(extraction.stats.seoRowsWithAuthoredText).toBe(0);
  });

  it('found a body for every post and an image for every post', () => {
    expect(extraction.stats.postsWithBody).toBe(62);
    expect(extraction.stats.postsWithImages).toBe(62);
  });

  it('separates curation terms from project types in the emitted model', () => {
    const curation = extraction.taxonomy.filter((t) => t.role === 'curation').map((t) => t.slug).sort();
    expect(curation).toEqual(['featured', 'home']);
    const projectTypes = extraction.taxonomy.filter((t) => t.role === 'project-type');
    expect(projectTypes.length).toBeGreaterThanOrEqual(8);
  });

  it('reconstructs the scrape path for a percent-encoded slug', () => {
    // The one path where the export and the scrape disagreed, and it was an encoding difference.
    expect(
      extraction.records.some((r) => r.slugCandidate === 'motorcycle-mural-—-california-dreamin')
    ).toBe(true);
    // No record may keep a percent-escape, or the diff and the merge both treat it as a new work.
    expect(extraction.records.filter((r) => r.slugCandidate.includes('%'))).toEqual([]);
  });

  it('counts NextGEN alt text as authored only where it is not the filename', () => {
    // 13 of 25 carry a real string; counting all 25 would claim 12 authored descriptions that are
    // just filenames (8 of them derivative filenames, which are not originals at all).
    expect(extraction.stats.nextgenPictures).toBe(25);
    expect(extraction.stats.nextgenPicturesWithAuthoredAlt).toBe(13);
    expect(extraction.stats.nextgenPicturesLinkedToPost).toBe(13);
  });
});

// --- the upload-basename index ------------------------------------------------------------------

describe('buildBasenameIndex', () => {
  it('indexes the original and refuses to index its WordPress resizes', () => {
    // ⚠️ If a resize were indexed under its own name it would shadow nothing — but if the *original*
    // were absent and only `photo-1024x768` survived, a naive index would offer a 1024 px file to the
    // render ladder as a master. The ladder's job is to downscale, never to guess.
    const index = buildBasenameIndex([
      'uploads/_/2010/03/photo.jpg',
      'uploads/_/2010/03/photo-150x150.jpg',
      'uploads/_/2010/03/photo-1024x768.jpg',
    ]);
    expect([...index.keys()]).toEqual(['photo']);
  });

  it('keeps every path for one basename, because that is a real ambiguity', () => {
    // Values are lists precisely so `applyBasenameFallback` can decline. A single-value map would
    // make the choice silently, and the wrong photograph would attach with no trace.
    const index = buildBasenameIndex([
      'uploads/_/2010/03/photo.jpg',
      'uploads/_/2010/04/photo.jpg',
    ]);
    expect(index.get('photo')).toEqual(['uploads/_/2010/03/photo.jpg', 'uploads/_/2010/04/photo.jpg']);
  });

  it('ignores non-image files, so a plugin asset cannot answer for a post image', () => {
    const index = buildBasenameIndex([
      'uploads/_/2010/03/readme.txt',
      'uploads/_/2010/03/style.css',
      'uploads/_/2010/03/photo.svg',
    ]);
    // `.svg` is excluded deliberately: the archive's logos are SVG and must never satisfy a
    // reference to a photograph.
    expect(index.size).toBe(0);
  });

  it('keys on the same normalised stem ExtractedImage carries, so the join can hit', () => {
    const index = buildBasenameIndex(['uploads/_/2010/03/Good_Morning_Mural.JPG']);
    expect(index.has(imageBasename('Good_Morning_Mural.JPG'))).toBe(true);
    expect(index.has('good_morning_mural')).toBe(true);
  });
});

// --- the basename fallback ----------------------------------------------------------------------

describe('applyBasenameFallback', () => {
  const DECLARED = 'uploads/_/2010/03/good_morning_mural.jpg';
  const ACTUAL = 'uploads/_/2010/04/good_morning_mural.jpg';

  it('repairs a declared path the archive does not hold, and says so on the page', () => {
    // The one real instance: WordPress records the upload month, but `post_content` keeps the path
    // written when the post was last edited. The two disagree across a month boundary, permanently.
    const result = applyBasenameFallback(
      [pageOf([{ archivePath: DECLARED, presentOnDisk: false }])],
      buildBasenameIndex([ACTUAL])
    );
    expect(result.recovered).toEqual([
      { basename: 'good_morning_mural', declared: DECLARED, corrected: ACTUAL },
    ]);
    expect(result.ambiguous).toEqual([]);
    const image = result.pages[0].images[0];
    expect(image.archivePath).toBe(ACTUAL);
    expect(image.presentOnDisk).toBe(true);
    expect(result.pages[0].warnings.at(-1)).toContain('resolved 1 image(s) by basename');
  });

  it('reports two candidates as ambiguous instead of picking one', () => {
    const page = pageOf([{ archivePath: DECLARED, presentOnDisk: false }]);
    const result = applyBasenameFallback(
      [page],
      buildBasenameIndex([ACTUAL, 'uploads/_/2011/07/good_morning_mural.jpg'])
    );
    expect(result.recovered).toEqual([]);
    expect(result.ambiguous).toEqual([
      {
        basename: 'good_morning_mural',
        candidates: ['uploads/_/2010/04/good_morning_mural.jpg', 'uploads/_/2011/07/good_morning_mural.jpg'],
      },
    ]);
    // Untouched: an ambiguous image must still read as missing so a human sees it, not as resolved.
    expect(result.pages[0].images[0].archivePath).toBe(DECLARED);
    expect(result.pages[0].images[0].presentOnDisk).toBe(false);
    expect(result.pages[0].warnings).toEqual([]);
  });

  it('leaves an image the archive already holds completely alone', () => {
    const result = applyBasenameFallback(
      [pageOf([{ archivePath: DECLARED, presentOnDisk: true }])],
      buildBasenameIndex([DECLARED])
    );
    expect(result.recovered).toEqual([]);
    expect(result.pages[0].warnings).toEqual([]);
    expect(result.pages[0].images[0].presentOnDisk).toBe(true);
  });

  it('ignores a remote Jetpack image, which no local path can satisfy', () => {
    // `local: false` means the reference points at the CDN, not the uploads tree. Substituting a
    // same-named local file would be a different photograph that happens to share a name.
    const result = applyBasenameFallback(
      [
        pageOf([
          { local: false, remote: true, basename: 'good_morning_mural', presentOnDisk: false },
        ]),
      ],
      buildBasenameIndex([ACTUAL])
    );
    expect(result.recovered).toEqual([]);
    expect(result.pages[0].images[0].presentOnDisk).toBe(false);
  });

  it('leaves an image with no candidate alone rather than inventing one', () => {
    const result = applyBasenameFallback(
      [pageOf([{ archivePath: DECLARED, presentOnDisk: false }])],
      buildBasenameIndex(['uploads/_/2010/04/something-else.jpg'])
    );
    expect(result.recovered).toEqual([]);
    expect(result.ambiguous).toEqual([]);
    expect(result.pages[0].images[0].archivePath).toBe(DECLARED);
  });

  it('does not mutate the page it was handed', () => {
    const page = pageOf([{ archivePath: DECLARED, presentOnDisk: false }]);
    applyBasenameFallback([page], buildBasenameIndex([ACTUAL]));
    expect(page.images[0].archivePath).toBe(DECLARED);
    expect(page.images[0].presentOnDisk).toBe(false);
    expect(page.warnings).toEqual([]);
  });

  it('falls back to the raw ref as `declared` when no archivePath was resolved', () => {
    const result = applyBasenameFallback(
      [pageOf([{ archivePath: undefined, presentOnDisk: false }])],
      buildBasenameIndex([ACTUAL])
    );
    expect(result.recovered[0].declared).toBe(
      'https://centraltexasmurals.com/wp-content/uploads/2010/03/good_morning_mural.jpg'
    );
  });
});

// --- the plan the render stage must reuse -------------------------------------------------------

describe('the render stage must not recompute the media plan', () => {
  // ⚠️ **Regression, measured.** `wayback-render.ts` used to rebuild the plan from `records` alone.
  // `buildMediaPlan` also needs `existingMediaByArtwork` (how many media rows an artwork already
  // owns) to decide between `public_id = <slug>` and `{slug}--{basename}`. Rebuilding from records
  // silently loses that input, so the manifest carried `publicId='marcia-ball'` with
  // `linkable=true` where the extractor's plan said `marcia-ball--f-e1423423465404`.
  //
  // `marcia-ball` is a LIVE artwork's slug and its media row holds that `public_id`, and
  // `generate-asset-registry.ts` is first-wins — so rendering would have taken a live artwork's
  // registry key (R-18) and made it render somebody else's photograph. `wayback-register.ts`'s
  // pre-flight caught it against the live database and refused; the fix is to prefer the plan the
  // extractor already embedded, falling back to recomputation only for sources that carry none.
  const read = (rel: string) =>
    JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as {
      mediaPlan?: { items: { publicId: string }[] };
    };

  it('embeds the plan in the recovered extraction', () => {
    expect(read('data/archive/wayback_recovered_extraction.json').mediaPlan?.items.length).toBe(168);
  });

  it('keeps the suffixed public_id for an image landing on an artwork that already has media', () => {
    const ids = read('data/archive/wayback_recovered_extraction.json').mediaPlan!.items.map(
      (i) => i.publicId
    );
    expect(ids).toContain('marcia-ball--f-e1423423465404');
    expect(ids).not.toContain('marcia-ball');
  });

  it('leaves the scrape extraction without an embedded plan, so the fallback stays exercised', () => {
    // Not a defect — the scrape CLI never planned its media, so this pins the `??` branch.
    expect(read('data/archive/wayback_extraction.json').mediaPlan).toBeUndefined();
  });
});
