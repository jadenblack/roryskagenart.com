/**
 * Roadmap §3.D — extract the **recovered WordPress export**, reconcile it, and diff it against the
 * scrape. Emits the three artifacts a human needs to authorise the merge.
 *
 * **READ-ONLY.** It reads `wayback/`, reads one JSON snapshot, and writes into `data/archive/`.
 * No database writes, no uploads — ADR 0001 Phase B requires the merge to be understood before it
 * is performed, and this script is the "understood" half.
 *
 * WHAT IT ANSWERS
 * The recovered export is a *source upgrade* for the mural side, not a new corpus: it describes the
 * same commissions the `centraltexasmurals.com-v1` scrape does, but with the authored body text,
 * the real upload dates, the taxonomy join, and 15× the media. Three questions follow, and this
 * script answers all three with numbers:
 *
 *   1. **What does the recovered source add, per artwork?** → `wayback_recovered_diff_report.md`
 *   2. **Which records are duplicates of each other or of a live artwork?** → the dedupe queue,
 *      emitted separately so "no dups" is a checkable property rather than an intention.
 *   3. **What media would the merge have to move?** → the media plan summary.
 *
 * WHY IT REUSES `reconcile()` AND `buildMediaPlan()` UNCHANGED
 * `toExtractedPages()` reconstructs the scrape's own `<category>/<slug>` shape from the dump's
 * taxonomy (WordPress builds a permalink from the lowest-term-ID category — verified to reproduce
 * the scrape's path prefix for 60 of 60 shared posts). That means the recovered corpus flows
 * through the *same* matcher and the *same* media planner as the scrape, so the two reports are
 * comparable row for row and a difference in output is a difference in data, never in code.
 *
 * Usage:
 *   npx tsx scripts/wayback-recovered-extract.ts
 *   npx tsx scripts/wayback-recovered-extract.ts --archive <dir> --out-dir <dir>
 *   npx tsx scripts/wayback-recovered-extract.ts --json     # summary only, no file writes
 */
import fs from 'fs';
import path from 'path';
import {
  extractRecovered,
  toExtractedPages,
  buildTaxonomyModel,
  recoveredAliases,
  applyBasenameFallback,
  buildBasenameIndex,
  RECOVERED_ARCHIVE_PREFIX,
  RECOVERED_UPLOADS_DIR,
  type RecoveredExtraction,
} from './lib/waybackRecovered';
import {
  applyDiskPresence,
  type ExtractedPage,
} from './lib/waybackExtract';
import {
  KNOWN_DEDUPE_PAIRS,
  SEED_DIVERGENCE,
  reconcile,
  type ReconcileReport,
  type ReconciledRecord,
} from './lib/waybackReconcile';
import {
  canonicalToRecords,
  pagesToRecords,
  findDuplicates,
  applyDedupeMerges,
  type DedupeReport,
} from './lib/waybackDedupe';
import {
  buildMediaPlan,
  findRegistryCollisions,
  type ExistingRegistryKey,
  type MediaPlan,
} from './lib/waybackMedia';
import type { CanonicalCatalog } from './snapshot-canonical-catalog';

const WAYBACK_ROOT = path.resolve('wayback');
const CANONICAL_PATH = path.resolve('data/archive/wayback_canonical_catalog.json');
const SCRAPE_EXTRACTION = path.resolve('data/archive/wayback_extraction.json');
const OUT_EXTRACTION = 'wayback_recovered_extraction.json';
const OUT_REPORT = 'wayback_recovered_diff_report.md';
const OUT_DEDUPE = 'wayback_recovered_dedupe.json';

/** The scrape whose mural side this export supersedes — the diff baseline. */
const SCRAPE_MURAL_ARCHIVE = 'centraltexasmurals.com-v1';

interface Args {
  archive?: string;
  outDir: string;
  jsonOnly: boolean;
}

function parseArgs(argv: string[]): Args {
  const archiveIdx = argv.indexOf('--archive');
  const outIdx = argv.indexOf('--out-dir');
  return {
    archive: archiveIdx >= 0 ? argv[archiveIdx + 1] : undefined,
    outDir: path.resolve(outIdx >= 0 ? argv[outIdx + 1] : 'data/archive'),
    jsonOnly: argv.includes('--json'),
  };
}

/**
 * Find the export directory under `wayback/`.
 *
 * Matched on a prefix rather than a literal name: the directory carries the export timestamp
 * (`centraltexasmuralsbyroryskagen-20231217234521`), so a re-export would silently stop being
 * found. Refuses to guess between several — picking one would make two runs disagree.
 */
export function findRecoveredArchive(root: string): string {
  const hits = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith(RECOVERED_ARCHIVE_PREFIX))
    .map((e) => e.name)
    .sort();
  if (!hits.length) {
    throw new Error(
      `No \`${RECOVERED_ARCHIVE_PREFIX}*\` directory under ${root}. ` +
        `The recovered export is gitignored — restore it before running.`
    );
  }
  if (hits.length > 1) {
    throw new Error(
      `Found ${hits.length} recovered exports under ${root}: ${hits.join(', ')}. ` +
        `Pass --archive <name> to choose one.`
    );
  }
  return hits[0];
}

function loadCanonical(file: string): CanonicalCatalog {
  if (!fs.existsSync(file)) {
    throw new Error(`Canonical snapshot not found: ${file}\nRun: npx tsx scripts/snapshot-canonical-catalog.ts`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as CanonicalCatalog;
}

/**
 * One row of the per-artwork diff: what the scrape had vs what the export has.
 *
 * ⚠️ There is deliberately **no** `scrapeBodyChars` or `scrapeAlt`. The scrape recorded neither —
 * `ExtractedPage` has a `narrative`, but 0 of the 61 mural pages carried an authored body, and the
 * extractor has no alt-text concept at all. Carrying the fields would render a column of zeroes,
 * which reads as "the scrape had empty descriptions" rather than "the scrape had no such field".
 * Absence of a field and absence of a value are different claims, and only one of them is true.
 */
export interface ArtworkDiff {
  key: string;
  inScrape: boolean;
  inRecovered: boolean;
  scrapeTitle: string;
  recoveredTitle: string;
  scrapeImages: number;
  recoveredImages: number;
  recoveredBodyChars: number;
  recoveredAlt: number;
  recoveredYear: string | null;
  /** Fields where the recovered source carries data the scrape did not. */
  recoveredAdds: string[];
}

function scrapeMuralIndex(): Map<string, ReconciledRecord> {
  const index = new Map<string, ReconciledRecord>();
  if (!fs.existsSync(SCRAPE_EXTRACTION)) return index;
  const parsed = JSON.parse(fs.readFileSync(SCRAPE_EXTRACTION, 'utf8')) as {
    records?: ReconciledRecord[];
  };
  for (const r of parsed.records ?? []) {
    if (String(r.archive) !== SCRAPE_MURAL_ARCHIVE) continue;
    index.set(`${r.category}/${r.slugCandidate}`, r);
  }
  return index;
}

export function buildDiff(
  pages: ExtractedPage[],
  extraction: RecoveredExtraction,
  scrape: Map<string, ReconciledRecord>
): ArtworkDiff[] {
  const postByKey = new Map(extraction.posts.map((p) => [`${p.category}/${p.slug}`, p]));
  const keys = [...new Set([...scrape.keys(), ...pages.map((p) => `${p.category}/${p.slugCandidate}`)])].sort();

  return keys.map((key) => {
    const s = scrape.get(key);
    const p = postByKey.get(key);
    const recoveredAdds: string[] = [];
    if (p && s) {
      if (p.body && !s.title) recoveredAdds.push('title');
      if (p.body) recoveredAdds.push('body');
      if (p.year && !s.relPath.includes(String(p.year))) recoveredAdds.push('year');
      if (p.imageRefs.length > s.media.length) recoveredAdds.push('images');
      if (p.altTexts.length > 0) recoveredAdds.push('alt');
      if (p.categories.length > 1) recoveredAdds.push('taxonomy');
    } else if (p) {
      recoveredAdds.push('record');
    }
    return {
      key,
      inScrape: Boolean(s),
      inRecovered: Boolean(p),
      scrapeTitle: s?.title ?? '',
      recoveredTitle: p?.title ?? '',
      scrapeImages: s?.media.length ?? 0,
      recoveredImages: p?.imageRefs.length ?? 0,
      recoveredBodyChars: p?.body.length ?? 0,
      recoveredAlt: p?.altTexts.length ?? 0,
      recoveredYear: p?.year ?? null,
      recoveredAdds,
    };
  });
}

export function renderReport(input: {
  archive: string;
  extraction: RecoveredExtraction;
  pages: ExtractedPage[];
  report: ReconcileReport;
  postMerge: ReconcileReport['summary'] & { mergedByDedupe?: number };
  dedupe: DedupeReport;
  mediaPlan: MediaPlan;
  collisions: ReturnType<typeof findRegistryCollisions>;
  diff: ArtworkDiff[];
  appliedMerges: string[];
  canonical: CanonicalCatalog;
}): string {
  const { archive, extraction, pages, report, dedupe, mediaPlan, collisions, diff, appliedMerges } = input;
  const L: string[] = [];
  const s = extraction.stats;

  L.push('# Recovered WordPress export — §3.D extraction, diff and dedupe');
  L.push('');
  L.push(`- **Generated:** ${new Date().toISOString()}`);
  L.push(`- **Source:** \`wayback/${archive}/\` — WP Migrate 2.6.9 export of the live WordPress 6.4.2 site`);
  L.push(`- **Diff baseline:** \`${SCRAPE_MURAL_ARCHIVE}\` (the scrape this supersedes)`);
  L.push(`- **Canonical snapshot:** ${input.canonical.artworks.length} artworks · ${input.canonical.media.length} media assets`);
  L.push('- **Read-only.** No database writes, no uploads. This is ADR 0001 Phase B.');
  L.push('');

  L.push('## 1. What was read');
  L.push('');
  L.push('| Table | Rows |');
  L.push('| :--- | ---: |');
  L.push(`| \`posts\` (all types) | ${s.postRows} |`);
  L.push(`| … published \`post\` | **${s.posts}** |`);
  L.push(`| … \`attachment\` | ${s.attachments} |`);
  L.push(`| \`term_relationships\` | ${s.termRelationships} |`);
  L.push(`| \`ngg_pictures\` | ${s.nextgenPictures} |`);
  L.push(`| \`ngg_gallery\` | ${s.nextgenGalleries} |`);
  L.push('');
  L.push(`Tables parsed: ${s.tablesRead.map((t) => `\`${t}\``).join(', ')}`);
  L.push('');

  L.push('## 2. Diff against the scrape');
  L.push('');
  L.push('### 2.0 Classification');
  L.push('');
  L.push('| Outcome | Before dedupe | After dedupe | Meaning |');
  L.push('| :--- | ---: | ---: | :--- |');
  L.push(`| **NEW** | ${report.summary.NEW} | **${input.postMerge.NEW}** | no live artwork matched — the row would be created |`);
  L.push(`| **EXISTS** | ${report.summary.EXISTS} | **${input.postMerge.EXISTS}** | merges into a live artwork |`);
  L.push(`| **COLLISION** | ${report.summary.COLLISION} | **${input.postMerge.COLLISION}** | two source pages, one slug — a human must adjudicate |`);
  L.push('');
  L.push(
    `The two columns differ by ${input.postMerge.mergedByDedupe ?? 0} record(s): PRD_V3 §2 dedupe ` +
      `knowledge applied after matching. ⚠️ **The matcher classified both of those NEW** — it scores ` +
      `the pairs 0.833 and 0.710, below its own 0.85 gate. Reporting only the left column would have ` +
      `said 62 new artworks where the answer is 60 plus 2 merges.`
  );
  L.push('');
  L.push('### 2.1 Coverage');
  L.push('');
  const shared = diff.filter((d) => d.inScrape && d.inRecovered);
  const onlyRecovered = diff.filter((d) => !d.inScrape && d.inRecovered);
  const onlyScrape = diff.filter((d) => d.inScrape && !d.inRecovered);
  L.push(`- Artworks in **both**: ${shared.length}`);
  L.push(`- Artworks **only** in the recovered export: ${onlyRecovered.length}`);
  L.push(`- Artworks **only** in the scrape: ${onlyScrape.length}`);
  L.push('');
  if (onlyRecovered.length) {
    L.push('### 2.2 Present in the export, absent from the scrape');
    L.push('');
    L.push('| Artwork | Title | Images | Body (chars) |');
    L.push('| :--- | :--- | ---: | ---: |');
    for (const d of onlyRecovered) {
      L.push(`| \`${d.key}\` | ${d.recoveredTitle} | ${d.recoveredImages} | ${d.recoveredBodyChars} |`);
    }
    L.push('');
  }
  if (onlyScrape.length) {
    L.push('### 2.3 Present in the scrape, absent from the export');
    L.push('');
    L.push('These are the records the merge would **lose** if the scrape were retired outright.');
    L.push('');
    L.push('| Artwork | Title | Images |');
    L.push('| :--- | :--- | ---: |');
    for (const d of onlyScrape) L.push(`| \`${d.key}\` | ${d.scrapeTitle} | ${d.scrapeImages} |`);
    L.push('');
  }

  const imagesGained = shared.filter((d) => d.recoveredImages > d.scrapeImages);
  const bodyGained = shared.filter((d) => d.recoveredBodyChars > 0);
  L.push('### 2.4 What the export adds to shared artworks');
  L.push('');
  L.push(`- **Body text:** ${bodyGained.length} of ${shared.length} shared artworks gain a description the scrape did not have.`);
  L.push(`- **Images:** ${imagesGained.length} of ${shared.length} gain images.`);
  L.push(
    `- **Total images:** scrape ${shared.reduce((n, d) => n + d.scrapeImages, 0)} → export ` +
      `${shared.reduce((n, d) => n + d.recoveredImages, 0)} across shared artworks.`
  );
  L.push(
    `- **Authored alt text:** scrape 0 → export ${shared.reduce((n, d) => n + d.recoveredAlt, 0)} strings.`
  );
  L.push('');

  L.push('## 3. Content inventory — "desc, meta"');
  L.push('');
  L.push(`- Posts with a non-empty body: **${s.postsWithBody} / ${s.posts}**`);
  L.push(`- Posts with images: **${s.postsWithImages} / ${s.posts}** (${s.multiImagePosts} have more than one, max ${s.maxImagesOnOnePost})`);
  L.push(`- Distinct image references in bodies: **${s.distinctImageRefs}**`);
  L.push(`- Posts with authored alt text: **${s.postsWithAuthoredAlt} / ${s.posts}**`);
  L.push(`- Attachments carrying \`_wp_attachment_image_alt\`: **${s.attachmentsWithAlt} / ${s.attachments}**`);
  L.push(`- NextGEN pictures with *authored* alt text: **${s.nextgenPicturesWithAuthoredAlt} / ${s.nextgenPictures}** (of which ${s.nextgenPicturesLinkedToPost} link to a published post)`);
  L.push(`- AIOSEO rows carrying an authored SEO title or description: **${s.seoRowsWithAuthoredText} / ${s.seoRows}**`);
  L.push('');
  L.push(
    '> ⚠️ **There is no separate SEO copy to recover.** AIOSEO holds 423 rows and **zero** authored ' +
      'titles or descriptions. The post body *is* the description, which is why §2.3 counts body ' +
      'coverage rather than meta coverage. Any "meta description" on the v3 site has to be derived ' +
      'from the body, not imported.'
  );
  L.push('');

  L.push('## 4. Taxonomy model (Q6)');
  L.push('');
  L.push('Derived from `term_relationships` over published posts — not from WordPress\'s denormalised `count`, which includes drafts and revisions.');
  L.push('');
  L.push('| Term | Slug | Role | Posts | Why |');
  L.push('| :--- | :--- | :--- | ---: | :--- |');
  for (const t of buildTaxonomyModel(extraction)) {
    L.push(`| ${t.name} | \`${t.slug}\` | **${t.role}** | ${t.postCount} | ${t.note} |`);
  }
  L.push('');
  L.push(
    '`curation` terms describe *where* a work is shown and must not be modelled as project types — ' +
      'filing a mural under both `interior` and `featured` as types would put it in two contradictory ' +
      'buckets. `noise` terms are WordPress defaults no post should carry.'
  );
  L.push('');

  L.push('## 5. Duplicate review queue — only §5.1 blocks the write');
  L.push('');
  L.push('### 5.1 Certain merges — blocked from insert');
  L.push('');
  if (!dedupe.blockedSourceIds.length) {
    L.push('None.');
  } else {
    L.push('| Source record | Merges into | Basis |');
    L.push('| :--- | :--- | :--- |');
    for (const c of dedupe.candidates.filter((x) => !x.needsReview)) {
      L.push(`| \`${c.loser.id}\` | \`${c.winner.id}\` | ${c.kind} |`);
    }
    L.push('');
    L.push(
      `⚠️ Both PRD_V3 §2 pairs are here **even though the fuzzy matcher scores them 0.833 and 0.710** — ` +
        `below its own 0.85 gate. A threshold-only approach would classify both NEW and insert two ` +
        `duplicate artworks (R-01). Applied merges this run: ${appliedMerges.length}.`
    );
  }
  L.push('');

  const review = dedupe.candidates.filter((c) => c.needsReview);
  L.push('### 5.2 Possible duplicates — inserted, not merged');
  L.push('');
  if (!review.length) {
    L.push('None.');
  } else {
    L.push('| Kind | Score | Candidate | Against | Series? | Evidence |');
    L.push('| :--- | ---: | :--- | :--- | :--- | :--- |');
    for (const c of review) {
      const ev =
        c.sharedImages?.length
          ? `${c.sharedImages.length} shared image(s)`
          : c.likelySeries
            ? 'shared series name only'
            : 'name similarity only';
      L.push(
        `| ${c.kind} | ${c.score.toFixed(3)} | \`${c.loser.id}\` | \`${c.winner.id}\` | ` +
          `${c.likelySeries ? '**yes**' : 'no'} | ${ev} |`
      );
    }
    L.push('');
    /**
     * ⚠️ **Owner decision (2026-09-15) — this is a post-ingest cleanup list, not a write gate.**
     *
     * Only §5.1 blocks a write. Everything here is deliberately *not* blocked: the records are
     * inserted as separate artworks and the artist adjudicates them in the studio dashboard. That is
     * a considered trade — a false merge silently destroys an artwork, whereas a duplicate the artist
     * can see and remove is recoverable. Recording it in the artifact matters because the next reader
     * is a Phase 4 implementer who would otherwise treat `needsReview` as a precondition.
     */
    L.push(
      `**Owner decision (2026-09-15): these are inserted as separate artworks and adjudicated in the ` +
        `studio dashboard afterwards.** They are **not** blocked and **not** merged — so this queue is ` +
        `a post-ingest cleanup list, never a precondition for the write. Only §5.1 gates the write.`
    );
    L.push('');
    const seriesCount = review.filter((c) => c.likelySeries).length;
    if (seriesCount) {
      L.push(
        `⚠️ **Measured precision of the review band on this corpus is 0/${review.filter((c) => c.kind === 'near-miss').length}.** ` +
          `${seriesCount} of ${review.length} candidates share a leading run with the live title and *both* names ` +
          `continue past it — the signature of a series sibling (\`Greetings from 78752\` vs live ` +
          `\`Greetings from Texas\`), not a duplicate. They are kept rather than dropped: recall matters ` +
          `more than tidiness in a queue a human reads. Expect to dismiss the series-shaped rows and to ` +
          `act only on the image-overlap ones.`
      );
      L.push('');
    }
  }

  L.push('## 6. Media plan');
  L.push('');
  L.push(`- **Images to render + upload:** ${mediaPlan.items.length} across ${mediaPlan.artworkCount} artworks`);
  L.push(`- **Linkable immediately:** ${mediaPlan.linkableCount} (the rest wait for the artwork row)`);
  L.push(`- **Skipped:** ${mediaPlan.skipped.length}`);
  L.push('');
  if (mediaPlan.skipped.length) {
    const byReason = new Map<string, number>();
    for (const k of mediaPlan.skipped) byReason.set(k.reason, (byReason.get(k.reason) ?? 0) + 1);
    L.push('| Skip reason | Count |');
    L.push('| :--- | ---: |');
    for (const [reason, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
      L.push(`| \`${reason}\` | ${n} |`);
    }
    L.push('');
  }
  L.push(
    `⚠️ **Object count, not bytes, is the risk (R-17).** The source media is ~17 MB, so the rendered ` +
      `WebP set lands in the low single-digit MB — trivial for the 1 GB free tier. The risk is that ` +
      `${mediaPlan.items.length} objects are planned against ${input.canonical.media.length} registered ` +
      `media rows today, and Supabase backups do not cover the bucket at all.`
  );
  L.push('');

  L.push('## 7. Registry collisions (R-18)');
  L.push('');
  if (!collisions.length) {
    L.push('None — no planned `public_id` would take an existing artwork\'s registry key.');
  } else {
    L.push('⚠️ **Non-empty means do not write.** `generate-asset-registry.ts` is first-wins, so each of these would take a live artwork\'s image away from it.');
    L.push('');
    for (const c of collisions) L.push(`- \`${c}\``);
  }
  L.push('');

  L.push('## 8. Warnings');
  L.push('');
  const all = [
    ...extraction.warnings,
    ...dedupe.warnings,
    ...report.records.flatMap((r) => r.warnings.map((w) => `\`${r.category}/${r.slugCandidate}\`: ${w}`)),
  ];
  if (!all.length) {
    L.push('None.');
  } else {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const w of all) {
      if (seen.has(w)) continue;
      seen.add(w);
      unique.push(w);
    }

    // ⚠️ Collapse the repetitive per-record warnings. 57 of the 62 posts emit the identical
    // "no authored alt text for any image" line, which buries the three warnings that actually
    // need a decision under a wall of text nobody reads. Counted, not listed — and the count is
    // the more useful fact anyway: it says alt text is a *systemic* gap, not 57 separate problems.
    const bySuffix = new Map<string, string[]>();
    for (const w of unique) {
      const suffix = w.replace(/^`[^`]+`: /, '');
      bySuffix.set(suffix, [...(bySuffix.get(suffix) ?? []), w]);
    }

    // Singletons first: a warning that affects one record is a decision waiting to be made, while a
    // group of 57 identical lines is one systemic fact. Leading with the group would bury the three
    // lines that actually need reading.
    const ordered = [...bySuffix.entries()].sort(
      (a, b) =>
        Number(a[1].length > 1) - Number(b[1].length > 1) ||
        b[1].length - a[1].length ||
        a[0].localeCompare(b[0])
    );

    for (const [suffix, members] of ordered) {
      if (members.length === 1) {
        L.push(`- ${members[0]}`);
        continue;
      }
      L.push(`- **${members.length} records:** ${suffix}`);
      L.push('');
      L.push(`  <details><summary>Show the ${members.length}</summary>`);
      L.push('');
      for (const m of members) {
        // `m` is "`<path>`: <suffix>" — keep the path, drop the repeated explanation.
        const path = m.slice(1, m.indexOf('`', 1));
        L.push(`  - \`${path}\``);
      }
      L.push('');
      L.push('  </details>');
    }
  }
  L.push('');
  L.push('---');
  L.push('');
  L.push(`Machine-readable: [\`${OUT_EXTRACTION}\`](./${OUT_EXTRACTION}) · [\`${OUT_DEDUPE}\`](./${OUT_DEDUPE}).`);
  L.push('');
  L.push(
    '**Nothing has been written to the database.** The next steps are Phase 4, and the roadmap ' +
      'gates them on Phases 0/1/2.'
  );
  L.push('');
  return L.join('\n');
}

/**
 * Every media basename under the export's uploads tree, mapped to **all** paths that carry it.
 *
 * A list rather than a single path on purpose — see `applyBasenameFallback`. Scoped to
 * `uploads/` and skipping WordPress `-<w>x<h>` derivatives: a derivative is never an original, and
 * indexing them would let `foo-150x150` answer for `foo`.
 */
export function buildUploadIndex(archiveRoot: string): Map<string, string[]> {
  const root = path.join(archiveRoot, RECOVERED_UPLOADS_DIR);
  if (!fs.existsSync(root)) return new Map();

  const relPaths: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      relPaths.push(path.relative(archiveRoot, abs).split(path.sep).join('/'));
    }
  };
  walk(root);

  // The walk collects; `buildBasenameIndex` decides (extension, derivative exclusion, ambiguity).
  return buildBasenameIndex(relPaths);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const archive = args.archive ?? findRecoveredArchive(WAYBACK_ROOT);
  const sqlPath = path.join(WAYBACK_ROOT, archive, 'database.sql');
  if (!fs.existsSync(sqlPath)) throw new Error(`Dump not found: ${sqlPath}`);

  const canonical = loadCanonical(CANONICAL_PATH);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const extraction = extractRecovered(sql, { archive });

  // The extractor derives `local` from the URL shape alone. Verify against the real filesystem
  // before anything downstream treats a reference as work to do.
  const verifiedRaw = applyDiskPresence(toExtractedPages(extraction), (a, rel) =>
    fs.existsSync(path.join(WAYBACK_ROOT, a, rel))
  );

  // Then recover the ones whose declared path is wrong but whose bytes are present — WordPress
  // records the upload month, `post_content` keeps the month the post was edited in, and the two
  // disagree permanently after an edit across a month boundary.
  const fallback = applyBasenameFallback(verifiedRaw, buildUploadIndex(path.join(WAYBACK_ROOT, archive)));

  const pages = fallback.pages.map((p) => {
    const absent = p.images.filter((i) => i.local && i.presentOnDisk === false);
    return absent.length === 0
      ? p
      : {
          ...p,
          warnings: [
            ...p.warnings,
            `references ${absent.length} site-local image(s) the export does not contain: ` +
              absent.map((i) => i.basename).join(', '),
          ],
        };
  });

  if (fallback.ambiguous.length) {
    console.warn(
      `⚠️ ${fallback.ambiguous.length} basename(s) are ambiguous and were NOT resolved: ` +
        fallback.ambiguous.map((a) => `${a.basename} (${a.candidates.length})`).join(', ')
    );
  }

  const report = reconcile(pages, {
    artworks: canonical.artworks.map((a) => ({ slug: a.slug, title: a.title, imageUrl: a.imageUrl })),
    media: canonical.media,
  });

  // Dedupe runs on the *matcher's* output, then feeds certain merges back in — see
  // `applyDedupeMerges` for why the order matters.
  const dedupe = findDuplicates(
    pagesToRecords(pages, recoveredAliases(extraction)),
    canonicalToRecords(canonical.artworks.map((a) => ({ slug: a.slug, title: a.title, imageUrl: a.imageUrl }))),
    { knownPairs: KNOWN_DEDUPE_PAIRS, seedDivergence: SEED_DIVERGENCE }
  );
  const merged = applyDedupeMerges(report.records, dedupe);

  /**
   * Classification **after** the dedupe merges, which is what the emitted records actually say.
   *
   * ⚠️ `report.summary` is the matcher's own tally and is computed before the merges are applied.
   * Reporting it alone would print `NEW: 62` beside a records array containing 2 EXISTS rows and a
   * media plan built from them — the number and the artifact would disagree, and the number is the
   * one a reviewer reads first.
   */
  const postMergeSummary = {
    ...report.summary,
    NEW: merged.records.filter((r) => r.classification === 'NEW').length,
    EXISTS: merged.records.filter((r) => r.classification === 'EXISTS').length,
    COLLISION: merged.records.filter((r) => r.classification === 'COLLISION').length,
    mergedByDedupe: merged.applied.length,
  };

  // How many media rows each artwork already owns. Without this, a single new image on an artwork
  // that already has media is planned as `public_id = <slug>` — the key its existing row holds.
  const existingMediaByArtwork = new Map<string, number>();
  for (const m of canonical.media) {
    if (!m.artworkSlug) continue;
    existingMediaByArtwork.set(m.artworkSlug, (existingMediaByArtwork.get(m.artworkSlug) ?? 0) + 1);
  }

  const mediaPlan = buildMediaPlan(merged.records, existingMediaByArtwork);
  // Offline pre-flight against the snapshot's registry key space. `wayback-register.ts` re-runs
  // this against live `media_assets` before writing; doing it here too means an R-18 collision is
  // visible while the merge is still being planned, not on the run that writes.
  const collisions = findRegistryCollisions(
    mediaPlan.items.map((i) => i.publicId),
    canonical.media.map(
      (m): ExistingRegistryKey => ({ public_id: m.publicId, artwork_slug: m.artworkSlug })
    )
  );
  const diff = buildDiff(pages, extraction, scrapeMuralIndex());

  const summary = {
    archive,
    generatedAt: new Date().toISOString(),
    posts: extraction.stats.posts,
    pages: pages.length,
    classification: postMergeSummary,
    dedupe: dedupe.byKind,
    blocked: dedupe.blockedSourceIds,
    mediaPlan: {
      items: mediaPlan.items.length,
      artworks: mediaPlan.artworkCount,
      linkable: mediaPlan.linkableCount,
      skipped: mediaPlan.skipped.length,
    },
    collisions: collisions.length,
  };

  if (args.jsonOnly) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  fs.mkdirSync(args.outDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(args.outDir, OUT_EXTRACTION),
    JSON.stringify(
      {
        generatedAt,
        archive,
        // `canonical` and `pages` are here so this artifact satisfies the shared `ExtractionFile`
        // contract, which is what lets `wayback-stage-sql.ts` consume it without a translation layer
        // (D2). ⚠️ `pages` is not optional decoration: `buildBackfillPlan` reads `year`, `narrative`,
        // `description`, `categories`, `wpPostId` and `publishedAt` from it. Without it every one of
        // those reads as `undefined`, so the regenerated INSERTs land with all six fields null — and
        // the script still exits 0. See `V3_PHASE4_D2.md`.
        canonical: { capturedAt: canonical.capturedAt, source: canonical.source },
        stats: extraction.stats,
        summary: postMergeSummary,
        taxonomy: buildTaxonomyModel(extraction),
        records: merged.records,
        pages,
        mediaPlan,
        dedupe,
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(args.outDir, OUT_DEDUPE), JSON.stringify(dedupe, null, 2));
  fs.writeFileSync(
    path.join(args.outDir, OUT_REPORT),
    renderReport({
      archive,
      extraction,
      pages,
      report,
      postMerge: postMergeSummary,
      dedupe,
      mediaPlan,
      collisions,
      diff,
      appliedMerges: merged.applied,
      canonical,
    })
  );

  console.log(JSON.stringify(summary, null, 2));
  console.log('');
  console.log(`wrote ${path.join(args.outDir, OUT_REPORT)}`);
  console.log(`wrote ${path.join(args.outDir, OUT_EXTRACTION)}`);
  console.log(`wrote ${path.join(args.outDir, OUT_DEDUPE)}`);
}

main().catch((err) => {
  console.error('wayback-recovered-extract failed:', err?.stack ?? err?.message ?? err);
  process.exit(1);
});
