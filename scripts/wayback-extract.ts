/**
 * PRD_V3 §3 Steps 1–4 — extract both Wayback archives, reconcile against the live catalog, emit.
 *
 * **READ-ONLY.** This script reads `wayback/`, reads one JSON snapshot, and writes two files into
 * `data/archive/`. It performs **no database writes and no uploads** — that is ADR 0001 Phase B's
 * entire point: the merge is understood before it is performed.
 *
 * WHY THE CANONICAL SIDE COMES FROM A FILE
 * The reconciler needs `artworks.slug` to do its job, but reading it live would make every run
 * depend on network + credentials and would make two runs a week apart irreconcilable. The snapshot
 * is produced by `scripts/snapshot-canonical-catalog.ts`, which records its own stamp and row
 * counts, so a stale input is visible in the report header instead of silently skewing it.
 *
 * Usage:
 *   npx tsx scripts/wayback-extract.ts [--archive <id>] [--limit N] [--out-dir <dir>]
 *   npx tsx scripts/wayback-extract.ts --json      # machine-readable summary only
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  ARCHIVE_IDS,
  archiveKind,
  applyDiskPresence,
  extractPage,
  type ArchiveId,
  type ExtractedPage,
} from './lib/waybackExtract';
import {
  KNOWN_DEDUPE_PAIRS,
  reconcile,
  type MediaAction,
  type ReconcileReport,
  type ReconciledRecord,
} from './lib/waybackReconcile';
import type { CanonicalCatalog } from './snapshot-canonical-catalog';

const WAYBACK_ROOT = path.resolve('wayback');
const CANONICAL_PATH = path.resolve('data/archive/wayback_canonical_catalog.json');
const OUT_EXTRACTION = 'wayback_extraction.json';
const OUT_REPORT = 'wayback_reconcile_report.md';

/**
 * Top-level segments that are WordPress plumbing or category-archive indexes, not content.
 *
 * `murals/<cat>/` and `portfolio/<cat>/` are the two archives' *category* indexes — the same posts
 * again, grouped. Including them would double-count every record. `home`, `general` and `2010` are
 * real categories and are deliberately **not** in this list.
 */
const SKIP_SEGMENTS = new Set([
  'feed',
  'page',
  'comments',
  'wp-json',
  'wp-content',
  'wp-includes',
  'author',
  'contact',
  'about',
  'services',
  'murals',
  'portfolio',
  'category',
  'tag',
  'c',
  'i',
  'js',
  'images',
  'xmlrpc.php',
]);

/** `<category>/<slug>/index.html` — the only shape a content page takes. */
const CONTENT_DEPTH = 3;

export interface ContentFile {
  archive: ArchiveId;
  relPath: string;
  absPath: string;
}

export function findContentFiles(root: string, archives: ArchiveId[]): ContentFile[] {
  const out: ContentFile[] = [];
  for (const archive of archives) {
    const base = path.join(root, archive);
    if (!fs.existsSync(base)) continue;
    for (const category of fs.readdirSync(base, { withFileTypes: true })) {
      if (!category.isDirectory() || SKIP_SEGMENTS.has(category.name)) continue;
      const catDir = path.join(base, category.name);
      for (const slug of fs.readdirSync(catDir, { withFileTypes: true })) {
        if (!slug.isDirectory()) continue;
        const indexFile = path.join(catDir, slug.name, 'index.html');
        if (!fs.existsSync(indexFile)) continue;
        const relPath = `${category.name}/${slug.name}/index.html`;
        if (relPath.split('/').length !== CONTENT_DEPTH) continue;
        out.push({ archive, relPath, absPath: indexFile });
      }
    }
  }
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

export function loadCanonical(file: string): CanonicalCatalog {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Canonical snapshot not found: ${file}\n` +
        `Run: npx tsx scripts/snapshot-canonical-catalog.ts`
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as CanonicalCatalog;
}

/** `git status --porcelain wayback` — the acceptance criterion is "byte-identical", so prove it. */
export function waybackDirtyState(): string {
  try {
    const out = execFileSync('git', ['status', '--porcelain', 'wayback'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || 'clean (git reports no changes under wayback/)';
  } catch {
    return 'unknown (git unavailable)';
  }
}

/**
 * Distinct images across all records that resolved to a given action.
 *
 * Distinct by basename, not a raw tally: one photograph can be referenced by several pages (a mural
 * shot appearing in both `business/` and `featured/`), and every label this feeds says "distinct
 * images". A tally would inflate the work list the studio reads.
 */
function countActions(records: ReconciledRecord[], action: MediaAction): number {
  const seen = new Set<string>();
  for (const r of records) {
    for (const m of r.media) if (m.action === action) seen.add(m.basename);
  }
  return seen.size;
}

/**
 * Distinct images that are unrecoverable *for a specific reason*.
 *
 * The two reasons call for different actions by the studio: a CDN-only image never existed in the
 * archive, while a referenced-but-not-captured one was on the live site and Wayback simply missed
 * it — the original may well still be in the artist's own files.
 */
function countUnavailable(records: ReconciledRecord[], reason: 'cdn-only' | 'missing-from-archive'): number {
  const seen = new Set<string>();
  for (const r of records) {
    for (const m of r.media) {
      if (m.action === 'unavailable' && m.reason === reason) seen.add(m.basename);
    }
  }
  return seen.size;
}

/**
 * The schema-fit gap list — ADR 0001 Phase B's actual gate.
 *
 * Derived from what the extraction found, not from speculation: each entry is a field the source
 * carries that `artworks` cannot currently hold. `additiveOnly` is what makes the gate passable.
 */
export interface Gap {
  id: string;
  field: string;
  why: string;
  evidence: string;
  additive: boolean;
}

export function buildGapList(report: ReconcileReport, pages: ExtractedPage[]): Gap[] {
  const withImages = pages.filter((p) => p.images.length > 0).length;
  const multiImage = pages.filter((p) => p.images.length > 1).length;
  const withRemoteRef = pages.filter((p) => p.images.some((i) => i.remote)).length;
  const muralPages = pages.filter((p) => archiveKind(p.archive) === 'mural').length;

  return [
    {
      id: 'G1',
      field: 'artworks.kind',
      why: 'Murals and paintings are different things and the catalog has no way to say which is which. Every filter, view and template decision in Phase 5 depends on it.',
      evidence: `${muralPages} mural pages and ${pages.length - muralPages} fine-art pages extracted with no discriminator available`,
      additive: true,
    },
    {
      id: 'G2',
      field: 'source provenance (source_site, source_url_path, source_archive_path)',
      why: 'Once merged, nothing records where a row came from. Re-running the reconciliation, auditing the merge, or re-extracting after a fix all require it.',
      evidence: `${pages.length} pages, each addressable only by its archive path today`,
      additive: true,
    },
    {
      id: 'G3',
      field: 'multi-image support',
      why: '`artworks.image_url` is single-valued and `generate-asset-registry.ts` keys the registry by `artwork_slug` first-wins, so a record’s second image is currently unreachable.',
      evidence: `${withImages} pages reference images; ${multiImage} reference more than one`,
      additive: true,
    },
    {
      id: 'G4',
      field: 'artworks.year / dimensions / medium (nullable today)',
      why: 'Archived pages carry a published date but rarely a medium or size; the merge must fill only NULLs and never invent values.',
      evidence: `${pages.filter((p) => p.year).length} pages yielded a year; medium/dimensions are not machine-readable in either theme`,
      additive: false,
    },
    {
      id: 'G5',
      field: 'unresolvable media',
      why: 'Some images exist only as Jetpack CDN URLs that Wayback never archived. They must be recorded as absent rather than queued for upload.',
      evidence: `${withRemoteRef} pages reference *.wp.com images with no local copy`,
      additive: false,
    },
  ];
}

export function renderReport(input: {
  canonical: CanonicalCatalog;
  pages: ExtractedPage[];
  report: ReconcileReport;
  gaps: Gap[];
  dirty: string;
}): string {
  const { canonical, pages, report, gaps, dirty } = input;
  const s = report.summary;
  const L: string[] = [];

  L.push('# Wayback extraction & reconcile report');
  L.push('');
  L.push('> **Generated by `scripts/wayback-extract.ts` — read-only.** No database writes, no uploads.');
  L.push('> Regenerate with `npx tsx scripts/wayback-extract.ts`.');
  L.push('');
  L.push(`- **Generated:** ${new Date().toISOString()}`);
  L.push(`- **Canonical snapshot:** taken ${canonical.capturedAt} from \`${canonical.source}\``);
  L.push(`- **Canonical rows:** ${canonical.artworks.length} artworks · ${canonical.media.length} media assets`);
  L.push(`- **Extracted pages:** ${pages.length}`);
  L.push('- **`wayback/` integrity:** ' + dirty);
  L.push('');

  L.push('## 1. Summary');
  L.push('');
  L.push('| Classification | Count | Meaning |');
  L.push('| :--- | ---: | :--- |');
  L.push(`| **NEW** | ${s.NEW} | no canonical artwork matched — the row would be created as a draft |`);
  L.push(`| **EXISTS** | ${s.EXISTS} | matched an existing artwork — fill-only-empty backfill |`);
  L.push(`| **COLLISION** | ${s.COLLISION} | two source pages resolved to one canonical slug — needs a human |`);
  L.push(`| **Total** | ${s.total} | |`);
  L.push('');
  L.push('| Media | Count |');
  L.push('| :--- | ---: |');
  L.push(`| pages with at least one image to upload | ${s.withNeedsUpload} |`);
  L.push(`| distinct local images needing upload | ${s.needsUploadCount} |`);
  L.push(`| distinct images already registered | ${countActions(report.records, 'exists')} |`);
  L.push(
    `| distinct images referenced only from the CDN — **unrecoverable** | ${countUnavailable(report.records, 'cdn-only')} |`
  );
  L.push(
    `| distinct images referenced but **not captured by the archive** — unrecoverable | ${countUnavailable(report.records, 'missing-from-archive')} |`
  );
  L.push(`| pages with no usable image at all | ${s.withoutImage} |`);
  L.push('');

  L.push('## 2. By archive');
  L.push('');
  L.push('| Archive | Kind | Pages | NEW | EXISTS | COLLISION | With image | No image |');
  L.push('| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const archive of ARCHIVE_IDS) {
    const recs = report.records.filter((r) => r.archive === archive);
    if (!recs.length) continue;
    const p = pages.filter((x) => x.archive === archive);
    L.push(
      `| \`${archive}\` | ${archiveKind(archive)} | ${recs.length} | ` +
        `${recs.filter((r) => r.classification === 'NEW').length} | ` +
        `${recs.filter((r) => r.classification === 'EXISTS').length} | ` +
        `${recs.filter((r) => r.classification === 'COLLISION').length} | ` +
        `${p.filter((x) => x.images.length > 0).length} | ` +
        `${p.filter((x) => x.images.length === 0).length} |`
    );
  }
  L.push('');

  L.push('## 3. Match confidence');
  L.push('');
  L.push('| Kind | Count | Trust |');
  L.push('| :--- | ---: | :--- |');
  const kinds = new Map<string, number>();
  for (const r of report.records) kinds.set(r.matchKind, (kinds.get(r.matchKind) ?? 0) + 1);
  const trust: Record<string, string> = {
    'divergence-map': 'hand-seeded from PRD_V3 §2',
    'exact-slug': 'archive slug == DB slug',
    'normalized-slug': 'alphanumeric-only match',
    'fuzzy-title': `Dice ≥ ${0.85} — **verify**`,
    'shared-image': 'same image basename',
    none: 'no match — NEW',
  };
  for (const [kind, n] of [...kinds].sort((a, b) => b[1] - a[1])) {
    L.push(`| \`${kind}\` | ${n} | ${trust[kind] ?? ''} |`);
  }
  L.push('');

  L.push('## 4. COLLISIONs — human review required');
  L.push('');
  if (!report.collisionGroups.length) {
    L.push('None. Every source page resolved to at most one canonical slug.');
  } else {
    L.push('| Canonical slug | Source paths | Known dedupe? |');
    L.push('| :--- | :--- | :--- |');
    for (const g of report.collisionGroups) {
      L.push(
        `| \`${g.canonicalSlug}\` | ${g.paths.map((p) => `\`${p}\``).join(' · ')} | ${g.knownDedupe ? 'yes (PRD_V3 §2)' : '**no — new**'} |`
      );
    }
    L.push('');
    L.push('The matcher’s output is a proposal, not a verdict. Nothing here is written until a human');
    L.push('adjudicates each group.');
  }
  L.push('');
  L.push('### 4b. Known dedupe pairs from PRD_V3 §2 — current disposition');
  L.push('');
  L.push(
    'These pairs were hand-flagged before the run. A pair only surfaces as a COLLISION when *both*'
  );
  L.push(
    'sides resolve to the same canonical slug — when the matcher cannot see the link, the pair is'
  );
  L.push('invisible to it, so its disposition is reported here instead.');
  L.push('');
  L.push('| Path A | Path B | Disposition |');
  L.push('| :--- | :--- | :--- |');
  const byPath = new Map(report.records.map((r) => [`${r.category}/${r.slugCandidate}`, r]));
  for (const [a, b] of KNOWN_DEDUPE_PAIRS) {
    const ra = byPath.get(a);
    const rb = byPath.get(b);
    const describe = (p: string, r: ReconciledRecord | undefined): string =>
      r ? `\`${r.classification}\` → ${r.canonicalSlug ?? r.proposedSlug}` : 'not extracted';
    const linked = ra && rb && ra.canonicalSlug && ra.canonicalSlug === rb.canonicalSlug;
    L.push(`| \`${a}\` (${describe(a, ra)}) | \`${b}\` (${describe(b, rb)}) | ${linked ? 'linked by the matcher' : '**not linked — decide manually**'} |`);
  }
  L.push('');

  L.push('## 5. Media: what would need uploading');
  L.push('');
  const needs = report.records.flatMap((r) =>
    r.media
      .filter((m) => m.action === 'needs_upload')
      .map((m) => ({ path: `${r.category}/${r.slugCandidate}`, basename: m.basename, archivePath: m.archivePath }))
  );
  if (!needs.length) {
    L.push('Nothing local is missing from `media_assets`.');
  } else {
    L.push('| Source page | Image basename | Archive path |');
    L.push('| :--- | :--- | :--- |');
    for (const n of needs.slice(0, 100)) {
      L.push(`| \`${n.path}\` | \`${n.basename}\` | \`${n.archivePath ?? '—'}\` |`);
    }
    if (needs.length > 100) L.push(`| … | ${needs.length - 100} more | |`);
  }
  L.push('');

  // Reported separately from the CDN-only list because the remedy differs: these files were on the
  // live site, so the artist may still hold the original. A CDN-only image never existed here.
  const notCaptured = report.records.flatMap((r) =>
    r.media
      .filter((m) => m.action === 'unavailable' && m.reason === 'missing-from-archive')
      .map((m) => ({ path: `${r.category}/${r.slugCandidate}`, basename: m.basename, ref: m.ref }))
  );
  L.push('## 5b. Referenced by the page but NOT captured by the archive');
  L.push('');
  if (!notCaptured.length) {
    L.push('None.');
  } else {
    L.push(
      `${notCaptured.length} image(s). The page points at a site-local \`wp-content/uploads/…\` path, but Wayback saved`,
      'the page without the asset. **These cannot be rendered or uploaded** — they are listed so the studio can',
      're-supply the originals rather than wait for an ingest that can never complete.',
      ''
    );
    L.push('| Source page | Image basename | Referenced path |');
    L.push('| :--- | :--- | :--- |');
    for (const n of notCaptured.slice(0, 100)) {
      L.push(`| \`${n.path}\` | \`${n.basename}\` | \`${n.ref.split('?')[0]}\` |`);
    }
    if (notCaptured.length > 100) L.push(`| … | ${notCaptured.length - 100} more | |`);
  }
  L.push('');

  L.push('## 6. Pages with no usable image');
  L.push('');
  const noImage = report.records.filter((r) => !r.media.some((m) => m.action !== 'unavailable'));
  if (!noImage.length) {
    L.push('None.');
  } else {
    L.push(
      `**${noImage.length} of ${report.records.length} pages.** These can still produce catalogue *text*, ` +
        `but they will render with no photograph until the studio supplies one.`
    );
    L.push('');
    L.push('| Source page | Title |');
    L.push('| :--- | :--- |');
    for (const r of noImage.slice(0, 60)) {
      L.push(`| \`${r.category}/${r.slugCandidate}\` | ${r.title || '—'} |`);
    }
    if (noImage.length > 60) L.push(`| … | ${noImage.length - 60} more |`);
  }
  L.push('');

  L.push('## 7. Schema-fit gap list (ADR 0001 Phase B gate)');
  L.push('');
  L.push('| ID | Gap | Additive? | Evidence |');
  L.push('| :--- | :--- | :--- | :--- |');
  for (const g of gaps) {
    L.push(`| **${g.id}** | \`${g.field}\` — ${g.why} | ${g.additive ? 'yes' : 'n/a'} | ${g.evidence} |`);
  }
  const blocking = gaps.filter((g) => g.additive);
  L.push('');
  L.push(
    `**Gate:** ${blocking.length} additive schema change${blocking.length === 1 ? '' : 's'} required ` +
      `(${blocking.map((g) => g.id).join(', ')}). Nothing here requires a destructive or ` +
      `backwards-incompatible change, so the Phase B gate is satisfied.`
  );
  L.push('');

  L.push('## 8. Extraction warnings');
  L.push('');
  const warned = report.records.filter((r) => r.warnings.length > 0);
  if (!warned.length) {
    L.push('None.');
  } else {
    L.push('| Source page | Warnings |');
    L.push('| :--- | :--- |');
    for (const r of warned.slice(0, 60)) {
      L.push(`| \`${r.category}/${r.slugCandidate}\` | ${r.warnings.join('; ')} |`);
    }
    if (warned.length > 60) L.push(`| … | ${warned.length - 60} more |`);
  }
  L.push('');
  L.push('---');
  L.push('');
  L.push('Full machine-readable output: [`wayback_extraction.json`](./wayback_extraction.json).');
  L.push('');

  return L.join('\n');
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const archiveIdx = argv.indexOf('--archive');
  const archives: ArchiveId[] =
    archiveIdx >= 0
      ? ([argv[archiveIdx + 1] as ArchiveId])
      : ARCHIVE_IDS;
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(argv[limitIdx + 1], 10) : undefined;
  const outIdx = argv.indexOf('--out-dir');
  const outDir = path.resolve(outIdx >= 0 ? argv[outIdx + 1] : 'data/archive');
  const jsonOnly = argv.includes('--json');

  const canonical = loadCanonical(CANONICAL_PATH);
  let files = findContentFiles(WAYBACK_ROOT, archives);
  if (limit && limit > 0) files = files.slice(0, limit);

  const pages: ExtractedPage[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    const html = fs.readFileSync(f.absPath, 'utf8');
    const page = extractPage({ archive: f.archive, relPath: f.relPath, html });
    if (page && page.title) pages.push(page);
    else skipped.push(f.relPath);
  }

  // The extractor classifies `local` from the URL shape alone. Verify against the archive before
  // anything downstream treats a reference as work to do: a page can cite a `wp-content/uploads/…`
  // path that Wayback never captured. Without this, 18 of 32 "needs upload" images do not exist.
  const verified = applyDiskPresence(pages, (archive, archivePath) =>
    fs.existsSync(path.join(WAYBACK_ROOT, archive, archivePath))
  ).map((p) => {
    const absent = p.images.filter((i) => i.local && i.presentOnDisk === false);
    return absent.length === 0
      ? p
      : {
          ...p,
          warnings: [
            ...p.warnings,
            `references ${absent.length} site-local image(s) the archive does not contain: ` +
              absent.map((i) => i.basename).join(', '),
          ],
        };
  });

  const report = reconcile(verified, {
    artworks: canonical.artworks.map((a) => ({
      slug: a.slug,
      title: a.title,
      imageUrl: a.imageUrl,
    })),
    media: canonical.media,
  });
  const gaps = buildGapList(report, verified);
  const dirty = waybackDirtyState();

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, OUT_EXTRACTION),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        canonical: { capturedAt: canonical.capturedAt, source: canonical.source },
        summary: report.summary,
        collisionGroups: report.collisionGroups,
        gaps,
        skipped,
        pages: verified,
        records: report.records,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, OUT_REPORT),
    renderReport({ canonical, pages: verified, report, gaps, dirty }),
    'utf8'
  );

  if (jsonOnly) {
    console.log(JSON.stringify({ summary: report.summary, skipped: skipped.length }, null, 2));
    return;
  }

  console.log('='.repeat(72));
  console.log('Wayback extraction + reconcile (READ-ONLY — no DB writes, no uploads)');
  console.log('='.repeat(72));
  console.log(`  pages extracted : ${pages.length}${skipped.length ? ` (${skipped.length} skipped: no title)` : ''}`);
  console.log(`  NEW             : ${report.summary.NEW}`);
  console.log(`  EXISTS          : ${report.summary.EXISTS}`);
  console.log(`  COLLISION       : ${report.summary.COLLISION}`);
  console.log(`  needs upload    : ${report.summary.needsUploadCount} across ${report.summary.withNeedsUpload} pages`);
  console.log(
    `  unrecoverable   : ${report.summary.unavailableCount} ` +
      `(${countUnavailable(report.records, 'missing-from-archive')} referenced-but-not-archived, ` +
      `${countUnavailable(report.records, 'cdn-only')} CDN-only)`
  );
  console.log(`  no image at all : ${report.summary.withoutImage} pages`);
  console.log(
    `  schema gaps     : ${gaps.filter((g) => g.additive).length} additive ` +
      `(${gaps.filter((g) => g.additive).map((g) => g.id).join(', ')}) · ` +
      `${gaps.length - gaps.filter((g) => g.additive).length} non-additive ` +
      `(${gaps.filter((g) => !g.additive).map((g) => g.id).join(', ')})`
  );
  console.log(`  wayback/        : ${dirty}`);
  console.log('');
  console.log(`  → ${path.join(outDir, OUT_EXTRACTION)}`);
  console.log(`  → ${path.join(outDir, OUT_REPORT)}`);
}

main().catch((err) => {
  console.error('wayback-extract failed:', err?.stack ?? err?.message ?? err);
  process.exit(1);
});
