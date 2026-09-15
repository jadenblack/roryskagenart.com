/**
 * Extraction for the **recovered WordPress export** — the third v3 source (roadmap §3.D).
 *
 * WHY THIS EXISTS
 * `waybackExtract.ts` reads rendered HTML from two Wayback scrapes. The mural scrape yielded 61
 * pages of which **7 carried any image at all**, and none carried an authored body — a capture
 * saves the page, not the content. The owner then supplied a **WP Migrate 2.6.9 export of the live
 * WordPress 6.4.2 site**, which is a different kind of artifact: a real MariaDB dump plus the media
 * library. It describes *the same 61 artworks* — so this is a **source upgrade that supersedes
 * `centraltexasmurals.com-v1`**, never an append (appending is how the live catalogue gets
 * duplicate artworks — R-01).
 *
 * THE KEYSTONE: `category/slug` IS RECONSTRUCTIBLE
 * The reconciler keys everything on `<category>/<slug>` — `SEED_DIVERGENCE` and
 * `KNOWN_DEDUPE_PAIRS` are both written in that shape, and the diff against the v1 extraction is
 * the deliverable. The dump has no URL path, but it has the taxonomy, and **WordPress builds a
 * post's permalink from its lowest-term-ID category**. Verified against the scrape: that rule
 * reproduces the v1 path prefix for **60 of 60** shared posts, which is what lets this corpus flow
 * through the *unchanged* `reconcile()` and be diffed row-for-row.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * - It does not decide NEW / EXISTS / COLLISION. That is `waybackReconcile.ts`, reused verbatim so
 *   both sources produce the same shape.
 * - It does not touch the filesystem. `presentOnDisk` is stamped later by `applyDiskPresence`.
 * - It does not invent alt text. `altIsFilenameDerived` marks the strings that are just the
 *   filename, so a report can never present those as authored.
 *
 * PURE BY CONSTRUCTION: no `fs`, no `pg`, no `dotenv`.
 */
import {
  decodeEntities,
  normalizeWhitespace,
  type ArchiveId,
  type ExtractedImage,
  type ExtractedPage,
} from './waybackExtract';
import { isWordPressDerivative } from './waybackMedia';
import { optionalText, parseDump, text, toObjects, type DumpObject, type DumpValue } from './wordpressDump';

/** Directory prefix of the export under `wayback/`. Timestamp-wildcarded, so a re-export is found. */
export const RECOVERED_ARCHIVE_PREFIX = 'centraltexasmuralsbyroryskagen-';

/** Table prefix recorded in the dump header (`Database: vio_wp_centexmurals`). */
export const RECOVERED_TABLE_PREFIX = 'kZRTSN_';

/**
 * ⚠️ The real on-disk location of the media, and it is not where the column says.
 *
 * `_wp_attached_file` stores `2010/03/lunar_lander.jpg`, but the bytes live under
 * `files/wp-content/uploads/_/2010/03/lunar_lander.jpg` — there is an extra `_` partition segment.
 * Joining on the bare column resolves **0 of 358** attachments; joining through the `_` partition
 * resolves **344 of 358**. A resolver that omits it reports the entire media library as lost.
 */
export const RECOVERED_UPLOADS_DIR = 'files/wp-content/uploads/_';

/** The tables this extraction reads for content. Everything else in the dump is plugin noise. */
export const RECOVERED_TABLES = [
  'posts',
  'postmeta',
  'terms',
  'term_taxonomy',
  'term_relationships',
  'ngg_pictures',
  'ngg_gallery',
] as const;

/**
 * Read only to *measure* it, never as content.
 *
 * The export ships 423 AIOSEO rows, and the honest question for a merge that must supply "desc,
 * meta" is whether any authored SEO copy exists to recover. Measured: **0 of 423 carry a title or a
 * description**. Recording that as a number means a future run cannot silently start inventing
 * descriptions from a table that has none.
 */
export const RECOVERED_AUDIT_TABLES = ['aioseo_posts'] as const;

/**
 * Categories that are *curation flags*, not project types (owner question Q6).
 *
 * Measured over the corpus: the 11 categories in use split cleanly. Eight describe what the work
 * *is* (Interior, Exterior, Business, Restaurant, Retail, Museum, Event, Signage) and belong in a
 * `project_type` dimension. `Featured` and `Home` describe *where it is shown*; modelling them as
 * project types would put a mural in two contradictory type buckets. `Blogroll` is a WordPress
 * default that no post should carry.
 */
export const CURATION_CATEGORIES = new Set(['featured', 'home']);

/** WordPress defaults that leak into the term table and are never real taxonomy for this corpus. */
export const NOISE_CATEGORIES = new Set(['blogroll', 'uncategorized']);

export type TaxonomyRole = 'project-type' | 'curation' | 'noise';

export interface RecoveredTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
  /** WordPress's own denormalised count, kept so it can be cross-checked against the join. */
  wpCount: number;
}

export interface RecoveredGallery {
  id: number;
  slug: string;
  name: string;
  title: string;
  path: string;
}

export interface RecoveredPicture {
  id: number;
  filename: string;
  galleryId: number;
  postId: number | null;
  altText: string | null;
  description: string | null;
  /**
   * True when `altText` is nothing but the filename stem (`lunar_lander.jpg` → `lunar_lander`).
   *
   * ⚠️ This is the difference between authored and mechanical. 12 of the 25 pictures are
   * filename-derived — and 8 of those are *derivative* filenames, which are not originals at all —
   * so a report that counts `alttext` coverage as 25/25 would be claiming 25 authored descriptions
   * where 13 exist.
   */
  altIsFilenameDerived: boolean;
  /**
   * The published post this picture's alt text belongs to, resolved by normalised filename stem.
   *
   * ⚠️ There is no structural link to fall back on: `ngg_pictures.post_id` is **`0` on all 25
   * rows**, and `ngg_gallery.pageid` points at `0` or at non-post ids. NextGEN is a *second index*
   * over media the posts already reference, so the filename is the only join key that exists.
   * `null` means the stem matched no post — reported rather than guessed at.
   */
  linkedPostSlug: string | null;
}

export interface RecoveredAttachment {
  id: number;
  /** `post_parent` — the post the file was uploaded from. */
  parentId: number;
  /** `_wp_attached_file`, e.g. `2010/03/lunar_lander.jpg`. */
  file: string;
  basename: string;
  title: string;
  altText: string | null;
}

export interface RecoveredPost {
  id: number;
  slug: string;
  title: string;
  status: string;
  date: string;
  modified: string;
  /** Four-digit year from `post_date` — the real value the live `year` column lacks (Q18). */
  year: string;
  contentHtml: string;
  /** `post_content` as plain text. This is the "description" the catalogue wants. */
  body: string;
  excerpt: string | null;
  /** `_wp_old_slug`, first value. The material a divergence map is made of. Only 2 posts carry one. */
  oldSlug: string | null;
  /**
   * Every `_wp_old_slug` value on this post.
   *
   * Plural because the column is a *meta* key, not a field: WordPress appends a new row on each
   * rename, so a post renamed twice holds two. Measured over this export: 8 rows across 2 posts.
   * The duplicate-detection layer needs all of them — an alias that is not the first value would
   * otherwise be invisible, and an invisible alias is an inserted duplicate.
   */
  oldSlugs: string[];
  thumbnailId: number | null;
  /** Lowest-term-ID category slug — the value WordPress itself would have used in the permalink. */
  category: string;
  categories: string[];
  categoryNames: string[];
  /** Upload-relative refs (`2010/03/x.jpg`) found in the body. Originals, never resizes. */
  imageRefs: string[];
  attachments: RecoveredAttachment[];
  /** Authored alt strings for this post's images, from the attachment meta and NextGEN. */
  altTexts: string[];
  warnings: string[];
}

export interface RecoveredStats {
  tablesRead: string[];
  postRows: number;
  posts: number;
  drafts: number;
  postsWithBody: number;
  postsWithImages: number;
  multiImagePosts: number;
  maxImagesOnOnePost: number;
  distinctImageRefs: number;
  /** Posts that ended up with at least one authored alt string (attachment or linked NextGEN). */
  postsWithAuthoredAlt: number;
  attachments: number;
  attachmentsWithAlt: number;
  nextgenPictures: number;
  nextgenPicturesWithAuthoredAlt: number;
  /** Of those, the ones whose filename stem resolved to a published post. */
  nextgenPicturesLinkedToPost: number;
  nextgenGalleries: number;
  categoriesInUse: number;
  termRelationships: number;
  /** Total AIOSEO rows in the export — the denominator for the next figure. */
  seoRows: number;
  /** AIOSEO rows that carry an authored SEO title or description — measured 0. */
  seoRowsWithAuthoredText: number;
}

export interface RecoveredExtraction {
  /** `wayback/<archive>/` — also the `ArchiveId`, because every consumer joins on it. */
  archive: string;
  posts: RecoveredPost[];
  terms: RecoveredTerm[];
  galleries: RecoveredGallery[];
  pictures: RecoveredPicture[];
  attachments: RecoveredAttachment[];
  stats: RecoveredStats;
  warnings: string[];
}

/**
 * Every `wp-content/uploads/…` image reference in a body, as upload-relative paths.
 *
 * These are the **originals**: measured over this corpus, **0 of 174** are `-<w>x<h>` derivatives,
 * because WordPress writes the full-size file into `post_content` and generates the resizes only
 * for the rendered page. That makes the body the highest-quality media index the export holds — the
 * scrape's 14 refs were **all 14** derivatives.
 *
 * Deduplicated: posts commonly link the same file twice (once as `href`, once as `src`), and a
 * duplicate would become a second row in the media plan.
 */
const UPLOAD_IMG_RE = /wp-content\/uploads\/([^\s"'<>)]+\.(?:jpe?g|png|gif))/gi;

export function extractUploadRefs(html: string): string[] {
  const found = new Set<string>();
  UPLOAD_IMG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = UPLOAD_IMG_RE.exec(html)) !== null) {
    // Strip the cache-buster WordPress appends (`?ver=…`, `#038;h=…`) but keep the path intact.
    const clean = m[1].split(/[?#]/)[0];
    if (clean) found.add(clean);
  }
  return [...found].sort();
}

/**
 * Authored HTML → prose.
 *
 * Tags become **spaces**, never empty strings: `foo<br>bar` must not collapse to `foobar`, and
 * `</p><p>` must not weld two sentences together. Block-editor comments (`<!-- wp:paragraph -->`)
 * are dropped first, or their text would read as content.
 */
export function htmlToText(html: string): string {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, ' ');
  const withoutBlocks = withoutComments.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  return normalizeWhitespace(decodeEntities(withoutBlocks.replace(/<[^>]*>/g, ' ')));
}

/** Basename without extension, lowercased — the join key the reconciler matches on. */
export function imageBasename(ref: string): string {
  const tail = ref.split('/').pop() ?? ref;
  return tail.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
}

/**
 * Collapse the three naming variants one photograph carries in this export to a single key.
 *
 * The same image is stored as `crab.jpg` (NextGEN's name), `crab-copy.jpg` (WordPress's
 * "edit image" duplicate, which is what the post body actually references) and
 * `good-morning-austin-jpg-copy.jpg` (the same, with the extension folded into the stem). Without
 * this, **NextGEN's 13 authored alt strings cannot be attached to anything** — and `post_id` is
 * `0` on all 25 pictures, so there is no structural link to fall back on. The filename is the only
 * join key the export offers.
 *
 * Deliberately conservative: it strips one leading `copy_N_`, one trailing `-copy`, and one
 * trailing image extension. It does not do fuzzy matching, so a false link is not possible.
 */
export function normalizeImageStem(basename: string): string {
  return basename
    .toLowerCase()
    .replace(/^copy_\d+_/, '')
    .replace(/-copy$/, '')
    .replace(/-(?:jpe?g|png|gif)$/, '');
}

/** `wayback/<archive>/<archivePath>` for one body reference. */
export function recoveredArchivePath(ref: string): string {
  return `${RECOVERED_UPLOADS_DIR}/${ref}`;
}

/** Four-digit year from a MySQL `post_date`, or `''`. */
export function yearOf(date: string): string {
  const m = /^(\d{4})/.exec(date.trim());
  return m ? m[1] : '';
}

/**
 * Percent-decode a `post_name`, because WordPress stores non-ASCII slugs encoded.
 *
 * ⚠️ **THIS IS THE DIFFERENCE BETWEEN A MERGE AND A DUPLICATE.**
 *
 * `home/motorcycle-mural-%e2%80%94-california-dreamin` in the dump is
 * `home/motorcycle-mural-—-california-dreamin` once decoded — character for character what the
 * scrape recorded. Left encoded, the two sources describe **the same artwork under two different
 * source paths**, so the diff reports it as one lost and one added, and a merge keyed on the path
 * creates a second row for a work that already exists. That is R-01 arriving by a route no
 * dedupe rule would catch, because the two paths are not *similar* — they are the same path in two
 * encodings, and similarity scoring can never see that.
 *
 * Malformed input is returned unchanged rather than throwing: a lone `%` in a slug is not a reason
 * to abort an extraction.
 */
export function decodePostSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * The category WordPress would have used in the permalink: the **lowest term ID**.
 *
 * This is WordPress's own rule for a post filed under several categories, and it is the reason
 * this corpus is diffable at all — verified against the scrape, it reproduces the v1 path prefix
 * for 60 of 60 shared posts. `austin-postcard-mural` is filed under business + exterior + featured
 * and the scrape recorded `featured/`; `marcia-ball-cd-cover` is business + interior and the scrape
 * recorded `business/`. Ordering by ID (not name, not insertion order) is what gets both right.
 */
export function lowestTermIdCategory(
  assignments: { termId: number; slug: string }[]
): string | null {
  if (!assignments.length) return null;
  return [...assignments].sort((a, b) => a.termId - b.termId)[0].slug;
}

/** Which dimension a term belongs to. Drives the Q6 model rather than guessing at it. */
export function taxonomyRole(slug: string): TaxonomyRole {
  if (NOISE_CATEGORIES.has(slug)) return 'noise';
  if (CURATION_CATEGORIES.has(slug)) return 'curation';
  return 'project-type';
}

function tableOf(tables: Map<string, { name: string; columns: string[]; rows: DumpValue[][] }>, suffix: string) {
  return tables.get(`${RECOVERED_TABLE_PREFIX}${suffix}`);
}

function objectsOf(
  tables: Map<string, { name: string; columns: string[]; rows: DumpValue[][] }>,
  suffix: string
): DumpObject[] {
  const t = tableOf(tables, suffix);
  return t ? toObjects(t) : [];
}

function num(value: DumpValue): number {
  const n = Number.parseInt(text(value), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Extract the recovered export from its dump text.
 *
 * `archive` is the directory name under `wayback/` — required, because `archivePath` values are
 * resolved as `wayback/<archive>/<archivePath>` by the render and register stages.
 */
export function extractRecovered(sql: string, options: { archive: string }): RecoveredExtraction {
  const warnings: string[] = [];
  const tables = parseDump(
    sql,
    [...RECOVERED_TABLES, ...RECOVERED_AUDIT_TABLES].map((t) => `${RECOVERED_TABLE_PREFIX}${t}`)
  );

  const postRows = objectsOf(tables, 'posts');
  const metaRows = objectsOf(tables, 'postmeta');
  const termRows = objectsOf(tables, 'terms');
  const taxonomyRows = objectsOf(tables, 'term_taxonomy');
  const relationshipRows = objectsOf(tables, 'term_relationships');
  const pictureRows = objectsOf(tables, 'ngg_pictures');
  const galleryRows = objectsOf(tables, 'ngg_gallery');
  // Read only for the "no authored SEO text exists" measurement; never used as content.
  const seoRows = objectsOf(tables, 'aioseo_posts');

  if (!postRows.length) {
    throw new Error(
      `extractRecovered: no \`${RECOVERED_TABLE_PREFIX}posts\` INSERT found. ` +
        `Is this a WP Migrate dump with prefix \`${RECOVERED_TABLE_PREFIX}\`?`
    );
  }

  // --- terms ----------------------------------------------------------------------------------
  const terms: RecoveredTerm[] = termRows
    .map((t) => {
      const id = num(t.term_id);
      const tax = taxonomyRows.find((x) => num(x.term_id) === id);
      return {
        id,
        name: text(t.name),
        slug: text(t.slug),
        taxonomy: tax ? text(tax.taxonomy) : '',
        wpCount: tax ? num(tax.count) : 0,
      };
    })
    .sort((a, b) => a.id - b.id);

  const termById = new Map(terms.map((t) => [t.id, t]));
  const taxonomyById = new Map(
    taxonomyRows.map((x) => [num(x.term_taxonomy_id), { termId: num(x.term_id), taxonomy: text(x.taxonomy) }])
  );

  /** post_id → category assignments, in the order the relationships table holds them. */
  const categoryAssignments = new Map<number, { termId: number; slug: string; name: string }[]>();
  for (const r of relationshipRows) {
    const tt = taxonomyById.get(num(r.term_taxonomy_id));
    if (!tt || tt.taxonomy !== 'category') continue;
    const term = termById.get(tt.termId);
    if (!term) continue;
    const list = categoryAssignments.get(num(r.object_id)) ?? [];
    if (!list.some((x) => x.termId === term.id)) {
      list.push({ termId: term.id, slug: term.slug, name: term.name });
    }
    categoryAssignments.set(num(r.object_id), list);
  }

  // --- postmeta -------------------------------------------------------------------------------
  const metaByPost = new Map<number, DumpObject[]>();
  for (const m of metaRows) {
    const pid = num(m.post_id);
    const list = metaByPost.get(pid) ?? [];
    list.push(m);
    metaByPost.set(pid, list);
  }
  const metaValue = (postId: number, key: string): string | null => {
    const hit = (metaByPost.get(postId) ?? []).find((m) => text(m.meta_key) === key);
    return hit ? optionalText(hit.meta_value) : null;
  };

  /**
   * Every value for a meta key, in row order.
   *
   * Needed only for `_wp_old_slug`, which is append-only: a post renamed twice holds two rows and
   * `metaValue` would return just the first. Read as a list so an alias can never be missed.
   */
  const metaValues = (postId: number, key: string): string[] =>
    (metaByPost.get(postId) ?? [])
      .filter((m) => text(m.meta_key) === key)
      .map((m) => optionalText(m.meta_value))
      .filter((v): v is string => Boolean(v));

  /**
   * Published posts only, and their body image refs.
   *
   * The export's 63rd post is WordPress's `auto-draft` placeholder — no title, no body, no category
   * — which is not content and would have produced a `//index.html` source path. Filtering on
   * `publish` also makes the corpus match the scrape's content set, which is what makes the diff
   * meaningful.
   *
   * Built here rather than in the posts block because NextGEN's alt text has to be linked by
   * filename stem *before* the posts are assembled (see `normalizeImageStem`).
   */
  const publishedRows = postRows.filter(
    (p) => text(p.post_type) === 'post' && text(p.post_status) === 'publish'
  );
  const refsByPost = new Map<number, string[]>();
  const stemToSlug = new Map<string, string>();
  for (const p of publishedRows) {
    const refs = extractUploadRefs(p.post_content ?? '');
    refsByPost.set(num(p.ID), refs);
    for (const ref of refs) {
      const stem = normalizeImageStem(imageBasename(ref));
      // Decoded here as well as in the posts block, so NextGEN's filename join and the post's own
      // slug are the same string. A mismatch would silently unlink every authored alt string.
      if (stem && !stemToSlug.has(stem)) stemToSlug.set(stem, decodePostSlug(text(p.post_name)));
    }
  }

  // --- attachments + NextGEN ------------------------------------------------------------------
  const attachments: RecoveredAttachment[] = postRows
    .filter((p) => text(p.post_type) === 'attachment')
    .map((p) => {
      const id = num(p.ID);
      const file = text(metaValue(id, '_wp_attached_file'));
      return {
        id,
        parentId: num(p.post_parent),
        file,
        basename: imageBasename(file),
        title: text(p.post_title),
        altText: metaValue(id, '_wp_attachment_image_alt'),
      };
    })
    .sort((a, b) => a.id - b.id);

  const attachmentsByParent = new Map<number, RecoveredAttachment[]>();
  for (const a of attachments) {
    const list = attachmentsByParent.get(a.parentId) ?? [];
    list.push(a);
    attachmentsByParent.set(a.parentId, list);
  }

  const galleries: RecoveredGallery[] = galleryRows
    .map((g) => ({
      id: num(g.gid),
      slug: text(g.slug),
      name: text(g.name),
      title: text(g.title),
      path: text(g.path),
    }))
    .sort((a, b) => a.id - b.id);

  const pictures: RecoveredPicture[] = pictureRows
    .map((p) => {
      const filename = text(p.filename);
      const alt = optionalText(p.alttext);
      const stem = filename.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
      return {
        id: num(p.pid),
        filename,
        galleryId: num(p.galleryid),
        postId: p.post_id === null ? null : num(p.post_id),
        altText: alt,
        description: optionalText(p.description),
        altIsFilenameDerived: alt !== null && alt.toLowerCase() === stem,
        linkedPostSlug: stemToSlug.get(normalizeImageStem(imageBasename(filename))) ?? null,
      };
    })
    .sort((a, b) => a.id - b.id);

  // --- posts ----------------------------------------------------------------------------------
  const posts: RecoveredPost[] = publishedRows
    .map((p) => {
      const id = num(p.ID);
      const slug = decodePostSlug(text(p.post_name));
      const contentHtml = p.post_content ?? '';
      const refs = refsByPost.get(id) ?? [];
      const assignments = categoryAssignments.get(id) ?? [];
      const category = lowestTermIdCategory(assignments) ?? '';
      const own = attachmentsByParent.get(id) ?? [];
      const nextgenAlt = pictures
        .filter((pic) => pic.linkedPostSlug === slug && pic.altText && !pic.altIsFilenameDerived)
        .map((pic) => pic.altText as string);
      const altTexts = [
        ...new Set([...own.map((a) => a.altText).filter(Boolean), ...nextgenAlt]),
      ] as string[];

      const postWarnings: string[] = [];
      if (!category) postWarnings.push('no category assigned — the permalink prefix cannot be derived');
      if (!slug) postWarnings.push('no post_name — cannot form a source path');
      if (!contentHtml.trim()) postWarnings.push('empty post_content');
      if (nextgenAlt.length === 0 && own.every((a) => !a.altText)) {
        postWarnings.push('no authored alt text for any image');
      }

      return {
        id,
        slug,
        title: text(p.post_title),
        status: text(p.post_status),
        date: text(p.post_date),
        modified: text(p.post_modified),
        year: yearOf(text(p.post_date)),
        contentHtml,
        body: htmlToText(contentHtml),
        excerpt: optionalText(p.post_excerpt),
        oldSlug: metaValue(id, '_wp_old_slug'),
        oldSlugs: metaValues(id, '_wp_old_slug'),
        thumbnailId: metaValue(id, '_thumbnail_id') ? num(metaValue(id, '_thumbnail_id')) : null,
        category,
        categories: assignments.map((a) => a.slug).sort(),
        categoryNames: assignments.map((a) => a.name).sort(),
        imageRefs: refs,
        attachments: own,
        altTexts,
        warnings: postWarnings,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const distinctRefs = new Set<string>();
  for (const p of posts) for (const r of p.imageRefs) distinctRefs.add(r);

  const stats: RecoveredStats = {
    tablesRead: [...tables.keys()].sort(),
    postRows: postRows.length,
    posts: posts.length,
    drafts: posts.filter((p) => p.status !== 'publish').length,
    postsWithBody: posts.filter((p) => p.body.length > 0).length,
    postsWithImages: posts.filter((p) => p.imageRefs.length > 0).length,
    multiImagePosts: posts.filter((p) => p.imageRefs.length > 1).length,
    maxImagesOnOnePost: posts.reduce((max, p) => Math.max(max, p.imageRefs.length), 0),
    distinctImageRefs: distinctRefs.size,
    postsWithAuthoredAlt: posts.filter((p) => p.altTexts.length > 0).length,
    attachments: attachments.length,
    attachmentsWithAlt: attachments.filter((a) => a.altText).length,
    nextgenPictures: pictures.length,
    nextgenPicturesWithAuthoredAlt: pictures.filter((p) => p.altText && !p.altIsFilenameDerived).length,
    nextgenPicturesLinkedToPost: pictures.filter(
      (p) => p.altText && !p.altIsFilenameDerived && p.linkedPostSlug
    ).length,
    nextgenGalleries: galleries.length,
    categoriesInUse: new Set(posts.flatMap((p) => p.categories)).size,
    termRelationships: relationshipRows.length,
    seoRows: seoRows.length,
    seoRowsWithAuthoredText: seoRows.filter(
      (r) => text(r.title) !== '' || text(r.description) !== ''
    ).length,
  };

  if (stats.seoRowsWithAuthoredText === 0 && seoRows.length > 0) {
    warnings.push(
      `AIOSEO holds ${seoRows.length} rows and **zero** authored titles or descriptions — ` +
        `there is no separate SEO copy to recover, so the post body IS the description.`
    );
  }

  return {
    archive: options.archive,
    posts,
    terms,
    galleries,
    pictures,
    attachments,
    stats,
    warnings,
  };
}

/**
 * Project the extraction onto the `ExtractedPage` shape the reconciler already understands.
 *
 * This is the seam that makes the two corpora diffable: `reconcile()` is reused **verbatim**, so
 * the recovered corpus produces the same NEW / EXISTS / COLLISION shape as the scrape and the two
 * reports can be compared row for row.
 *
 * `relPath` is synthesised rather than discovered — the dump has no files. It is written in the
 * scrape's own `<category>/<slug>/index.html` shape so that a path from either source means the
 * same thing in the diff.
 */
export function toExtractedPages(extraction: RecoveredExtraction): ExtractedPage[] {
  return extraction.posts.map((post) => {
    const images: ExtractedImage[] = post.imageRefs.map((ref) => ({
      ref,
      local: true,
      remote: false,
      archivePath: recoveredArchivePath(ref),
      basename: imageBasename(ref),
    }));

    return {
      archive: extraction.archive as ArchiveId,
      relPath: `${post.category}/${post.slug}/index.html`,
      category: post.category,
      slugCandidate: post.slug,
      title: post.title,
      description: post.excerpt ?? '',
      narrative: post.body,
      categories: post.categoryNames,
      publishedAt: post.date || null,
      modifiedAt: post.modified || null,
      year: post.year || null,
      wpPostId: String(post.id),
      images,
      warnings: [...post.warnings],
    };
  });
}

/**
 * Index media basenames from a list of upload-relative paths.
 *
 * Takes paths rather than walking the filesystem, so the *logic* — which extensions count, why
 * derivatives are excluded, how a collision is represented — is pure and testable. The CLI does the
 * walk; this decides what the walk means.
 *
 * ⚠️ Two deliberate exclusions:
 *
 *  - **WordPress `-<w>x<h>` derivatives.** A resize is never an original, so indexing them would let
 *    `foo-150x150` answer for `foo` and hand the render ladder a 150 px file as the master.
 *  - **Nothing outside the uploads tree.** Callers pass only `uploads/` paths; a plugin asset with a
 *    coincidental name must never satisfy a post's image reference.
 *
 * Values are **lists**: two files with one basename in different month folders is a real ambiguity,
 * and `applyBasenameFallback` reports it rather than picking one.
 */
export function buildBasenameIndex(relPaths: string[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const rel of relPaths) {
    const name = rel.split('/').pop() ?? rel;
    if (!/\.(?:jpe?g|png|gif)$/i.test(name)) continue;
    const basename = imageBasename(name);
    // Reuses the planner's own predicate rather than a second copy of the pattern. Two definitions
    // of "is this a resize" is the `TRUSTED_MATCH_KINDS` duplication hazard again, and here the
    // consequence would be a 150 px file offered to the render ladder as a master.
    if (!basename || isWordPressDerivative(basename)) continue;
    index.set(basename, [...(index.get(basename) ?? []), rel]);
  }
  return index;
}

/**
 * Recover an image whose declared upload path is wrong but whose bytes are present.
 *
 * ⚠️ **WHY THIS IS NOT A HACK.** WordPress stores the upload **month** at upload time, but
 * `post_content` keeps whatever path was written when the post was edited. When a post is edited
 * across a month boundary — or an image is re-uploaded — the two disagree permanently. Measured
 * over this corpus, exactly one reference is affected:
 *
 *     declared  2010/03/good_morning_mural.jpg     ← does not exist
 *     actual    _/2010/04/good_morning_mural.jpg   ← the original, present
 *
 * The basename is the only stable part of the path, and here it is unambiguous. Treating that image
 * as `missing-from-archive` would report a recoverable image as lost and leave
 * `featured/good-morning-austin-mural` one image short of its media — the exact failure mode the
 * `uploads/_/` partition trap already caused once.
 *
 * PURE: the caller supplies the basename index (it needs the filesystem to build it). The function
 * takes `Map<string, string[]>` rather than a single path per basename **on purpose**: two files
 * with one basename in different month folders is a genuine ambiguity, and guessing between them
 * would silently attach the wrong photograph. Ambiguity is reported, never resolved here.
 */
export interface BasenameFallbackHit {
  basename: string;
  declared: string;
  corrected: string;
}

export interface BasenameFallbackResult {
  pages: ExtractedPage[];
  recovered: BasenameFallbackHit[];
  ambiguous: { basename: string; candidates: string[] }[];
}

export function applyBasenameFallback(
  pages: ExtractedPage[],
  uploadIndex: Map<string, string[]>
): BasenameFallbackResult {
  const recovered: BasenameFallbackHit[] = [];
  const ambiguous: { basename: string; candidates: string[] }[] = [];

  const out = pages.map((page) => {
    let recoveredOnPage = 0;
    const images = page.images.map((img) => {
      // Only a site-local reference the archive failed to contain at its declared path.
      if (!img.local || img.presentOnDisk !== false || !img.basename) return img;
      const candidates = uploadIndex.get(img.basename) ?? [];
      if (candidates.length > 1) {
        ambiguous.push({ basename: img.basename, candidates: [...candidates].sort() });
        return img;
      }
      if (candidates.length !== 1) return img;
      recoveredOnPage += 1;
      recovered.push({
        basename: img.basename,
        declared: img.archivePath ?? img.ref,
        corrected: candidates[0],
      });
      return { ...img, archivePath: candidates[0], presentOnDisk: true };
    });

    if (!recoveredOnPage) return page;
    return {
      ...page,
      images,
      warnings: [
        ...page.warnings,
        `resolved ${recoveredOnPage} image(s) by basename after the declared upload path proved ` +
          `wrong (WordPress records the upload month, not the month the post was edited in)`,
      ],
    };
  });

  return { pages: out, recovered, ambiguous };
}

/**
 * `category/slug` → extra slug-shaped names, for the duplicate-detection layer.
 *
 * The alias that matters is `_wp_old_slug`: when a post is renamed, the *old* name is the one the
 * live catalogue may still be using, so it is the only key that can connect a renamed source
 * record to an existing artwork. Nothing in the scrape path produces this, which is why it is
 * supplied to `findDuplicates` as a side input rather than added to `ExtractedPage` — the shared
 * seam stays untouched.
 */
export function recoveredAliases(extraction: RecoveredExtraction): Map<string, string[]> {
  const aliases = new Map<string, string[]>();
  for (const post of extraction.posts) {
    const path = `${post.category}/${post.slug}`;
    const extra = [...post.oldSlugs, ...(post.oldSlug ? [post.oldSlug] : [])].filter(Boolean);
    if (extra.length) aliases.set(path, [...new Set(extra)]);
  }
  return aliases;
}

/**
 * The taxonomy model for owner question Q6, derived from the corpus rather than proposed in the
 * abstract.
 *
 * Only categories actually attached to a published post are returned, with the count measured from
 * `term_relationships` (not WordPress's denormalised `count`, which includes drafts and
 * revisions).
 */
export interface TaxonomyTermModel {
  slug: string;
  name: string;
  role: TaxonomyRole;
  postCount: number;
  note: string;
}

export function buildTaxonomyModel(extraction: RecoveredExtraction): TaxonomyTermModel[] {
  const counts = new Map<string, number>();
  const names = new Map<string, string>();
  for (const post of extraction.posts) {
    post.categories.forEach((slug, i) => {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
      if (!names.has(slug)) names.set(slug, post.categoryNames[i] ?? slug);
    });
  }

  return [...counts.entries()]
    .map(([slug, postCount]) => {
      const role = taxonomyRole(slug);
      const note =
        role === 'project-type'
          ? 'describes what the work is — belongs in a `project_type` dimension'
          : role === 'curation'
            ? 'describes where the work is shown — a curation flag, not a project type'
            : 'WordPress default — no post should carry it';
      return { slug, name: names.get(slug) ?? slug, role, postCount, note };
    })
    .sort((a, b) => b.postCount - a.postCount || a.slug.localeCompare(b.slug));
}
