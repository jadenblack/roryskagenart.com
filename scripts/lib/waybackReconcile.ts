/**
 * Pure reconcile logic for the v3 Wayback merge (PRD_V3 §3 Steps 2–3).
 *
 * WHY THIS EXISTS
 * This is a MERGE, not a cold seed. 138 `artworks` rows already exist and **their slugs win**; the
 * archived pages are proposals. The whole risk of the merge is a mural record silently attaching
 * itself to the wrong fine-art row (R-01) — so matching has to be deterministic, explainable, and
 * able to say "I don't know" instead of guessing.
 *
 * Three properties the studio depends on:
 *
 *  1. **Every match carries its kind and its confidence.** "This is the same work" is a claim the
 *     report has to justify, not an assertion it gets to make.
 *  2. **COLLISION is a first-class outcome, not an error.** Two source pages resolving to one
 *     canonical slug is exactly the dedupe case the PRD calls out (`business/marcia-ball-cd-cover`
 *     vs `commissions-misc/marcia-ball`). The matcher's output is a *proposal*; a human adjudicates.
 *  3. **"Unavailable" is distinguishable from "missing".** A page may reference an image on the
 *     Jetpack CDN (`*.wp.com`) that Wayback never saved. That image is not "needed for upload" —
 *     it does not exist in any copy we hold. Conflating the two would put unresolvable entries on
 *     the ingest list.
 *
 * PURE BY CONSTRUCTION: no `fs`, no `pg`, no `dotenv`.
 */
import type { ExtractedPage, ExtractedImage } from './waybackExtract';

export type Classification = 'NEW' | 'EXISTS' | 'COLLISION';

export type MatchKind =
  | 'divergence-map'
  | 'exact-slug'
  | 'normalized-slug'
  | 'fuzzy-title'
  | 'shared-image'
  | 'none';

/** PRD_V3 §2 — wayback `<category>/<slug>` → canonical DB slug. Seeded by hand, deliberately. */
export const SEED_DIVERGENCE: Record<string, string> = {
  'commissions-misc/today': 'today-atomic-sunrise',
  'commissions-misc/78704': 'austin-78704-south-austin-zip',
  'commissions-misc/austin-2019': 'austin-skyline-2019',
  'commissions-misc/the-martian-2': 'the-martian-ii',
  'commissions-misc/the-balloon-cats-2': 'the-balloon-cats-ii',
  'monster-paintings/regador-5': 'regador-v',
  'monster-paintings/kelzon-5': 'kelzon-v',
  'ad-lands/issy': 'issy-the-atomic-companion',
  '2010/2010': '2010-rendezvous-in-chinatown',
};

/**
 * PRD_V3 §2 — pairs known to be the same work published under two archive paths.
 * These are the *expected* COLLISIONs; the report says so, so a human is not surprised by them.
 */
export const KNOWN_DEDUPE_PAIRS: [string, string][] = [
  ['business/marcia-ball-cd-cover', 'commissions-misc/marcia-ball'],
  ['featured/austin-postcard-mural', 'commissions-misc/austin-postcard'],
];

/** PRD_V3 §2 — "fuzzy title ≥ 0.85". */
export const FUZZY_THRESHOLD = 0.85;

export interface CanonicalArtworkRef {
  slug: string;
  title: string;
  imageUrl: string | null;
}

export interface CanonicalMediaRef {
  publicId: string;
  artworkSlug: string | null;
  basename: string;
}

export type MediaAction = 'exists' | 'needs_upload' | 'unavailable';

export interface MediaResolution {
  basename: string;
  ref: string;
  action: MediaAction;
  /** Set when `action === 'exists'`. */
  matchedPublicId?: string;
  /** Set when `action === 'needs_upload'`. */
  archivePath?: string;
  /**
   * Set when `action === 'unavailable'`, to distinguish the two very different reasons.
   *
   * `cdn-only` — the image only ever lived on the Jetpack CDN; Wayback never had a copy.
   * `missing-from-archive` — the page referenced a site-local path, but the file was not captured.
   * Both are unrecoverable from this archive, but only the second one is a *surprise*, and it is
   * the one that would otherwise be reported as work to do.
   */
  reason?: 'cdn-only' | 'missing-from-archive';
}

export interface ReconciledRecord {
  archive: ExtractedPage['archive'];
  relPath: string;
  title: string;
  category: string;
  slugCandidate: string;
  canonicalSlug: string | null;
  /** Populated for NEW rows only — the slug the backfill would propose. */
  proposedSlug: string | null;
  classification: Classification;
  matchKind: MatchKind;
  confidence: number;
  /** Other source paths that resolved to the same canonical slug. Non-empty ⇒ COLLISION. */
  collidesWith: string[];
  /** True when this pair is already known from PRD_V3 §2, so it is expected rather than new. */
  knownDedupe: boolean;
  media: MediaResolution[];
  warnings: string[];
}

export interface ReconcileSummary {
  total: number;
  NEW: number;
  EXISTS: number;
  COLLISION: number;
  /** Source pages with at least one image that exists locally and is not yet registered. */
  withNeedsUpload: number;
  /** Distinct local images that would need rendering + upload. */
  needsUploadCount: number;
  /** Distinct images referenced only from the Jetpack CDN — not recoverable from this archive. */
  unavailableCount: number;
  /** Pages with no usable image in any form. */
  withoutImage: number;
}

export interface ReconcileReport {
  records: ReconciledRecord[];
  collisionGroups: { canonicalSlug: string; paths: string[]; knownDedupe: boolean }[];
  summary: ReconcileSummary;
}

/** Lowercase, non-alphanumerics to single dashes — the shape DB slugs are written in. */
export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Alphanumerics only — catches `regador-5` vs `regadorv`, and `GreetingsfromAustin` forms. */
export function alnumKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function bigrams(input: string): string[] {
  const s = ` ${normalizeForMatch(input)} `;
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) out.push(s.slice(i, i + 2));
  return out;
}

/**
 * Sørensen–Dice coefficient over character bigrams.
 *
 * Chosen over a dependency: it is deterministic, dependency-free, and the threshold (0.85) came
 * from the PRD, so the matcher's behaviour is reproducible without pinning another package.
 */
export function diceCoefficient(a: string, b: string): number {
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.length || !right.length) return 0;
  const pool = new Map<string, number>();
  for (const g of left) pool.set(g, (pool.get(g) ?? 0) + 1);
  let hits = 0;
  for (const g of right) {
    const n = pool.get(g) ?? 0;
    if (n > 0) {
      pool.set(g, n - 1);
      hits += 1;
    }
  }
  return (2 * hits) / (left.length + right.length);
}

export function slugifyTitle(input: string): string {
  return normalizeForMatch(input) || 'untitled';
}

interface Indexes {
  bySlug: Map<string, CanonicalArtworkRef>;
  byAlnum: Map<string, CanonicalArtworkRef[]>;
  byTitle: CanonicalArtworkRef[];
  byMediaBasename: Map<string, CanonicalMediaRef>;
  byImageBasename: Map<string, CanonicalArtworkRef>;
}

function basenameOf(ref: string): string {
  const tail = ref.split('/').pop() ?? ref;
  return tail.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
}

function buildIndexes(
  artworks: CanonicalArtworkRef[],
  media: CanonicalMediaRef[]
): Indexes {
  const bySlug = new Map<string, CanonicalArtworkRef>();
  const byAlnum = new Map<string, CanonicalArtworkRef[]>();
  const byImageBasename = new Map<string, CanonicalArtworkRef>();
  const byMediaBasename = new Map<string, CanonicalMediaRef>();

  for (const a of artworks) {
    bySlug.set(a.slug.toLowerCase(), a);
    const key = alnumKey(a.slug);
    byAlnum.set(key, [...(byAlnum.get(key) ?? []), a]);
    if (a.imageUrl) {
      const base = basenameOf(a.imageUrl);
      if (base && !byImageBasename.has(base)) byImageBasename.set(base, a);
    }
  }
  for (const m of media) {
    if (m.basename && !byMediaBasename.has(m.basename)) byMediaBasename.set(m.basename, m);
  }

  return { bySlug, byAlnum, byTitle: [...artworks], byMediaBasename, byImageBasename };
}

/**
 * Decide what has to happen to one image.
 *
 * ⚠️ **Order is load-bearing: the registry is consulted BEFORE the filesystem.**
 *
 * The question this answers is "does this image need an upload?" — and a registry hit settles it
 * regardless of what the archive holds. Ten images in this corpus are referenced by a page, absent
 * from `wayback/`, and *already registered* in `media_assets` (Cloudinary-era assets such as
 * `normal-gods-copy`): the studio has them, so there is nothing to do. Checking disk presence first
 * would label all ten `unavailable`, i.e. tell the studio to re-supply images it already owns.
 *
 * `presentOnDisk` therefore only ever *downgrades* an image the registry does not know about — it
 * is the difference between "we must render this file" and "we cannot, the file was never
 * captured".
 */
function resolveMedia(page: ExtractedPage, ix: Indexes): MediaResolution[] {
  return page.images.map((img: ExtractedImage) => {
    if (img.local) {
      const hit = ix.byMediaBasename.get(img.basename) ?? ix.byImageBasename.get(img.basename);
      if (hit) {
        return {
          basename: img.basename,
          ref: img.ref,
          action: 'exists' as MediaAction,
          matchedPublicId: 'publicId' in hit ? hit.publicId : hit.slug,
        };
      }
      // Not registered — so the archive's copy is the only one there is. `local` describes the URL;
      // `presentOnDisk` describes reality, and Wayback saved the page without necessarily saving
      // every asset it referenced.
      if (img.presentOnDisk === false) {
        return {
          basename: img.basename,
          ref: img.ref,
          action: 'unavailable' as MediaAction,
          reason: 'missing-from-archive' as const,
        };
      }
      return {
        basename: img.basename,
        ref: img.ref,
        action: 'needs_upload' as MediaAction,
        archivePath: img.archivePath,
      };
    }
    return {
      basename: img.basename,
      ref: img.ref,
      action: 'unavailable' as MediaAction,
      reason: 'cdn-only' as const,
    };
  });
}

function matchPage(
  page: ExtractedPage,
  ix: Indexes
): { canonicalSlug: string | null; matchKind: MatchKind; confidence: number } {
  const seedKey = `${page.category}/${page.slugCandidate}`;
  const seeded = SEED_DIVERGENCE[seedKey];
  if (seeded && ix.bySlug.has(seeded.toLowerCase())) {
    return { canonicalSlug: seeded, matchKind: 'divergence-map', confidence: 1 };
  }

  const exact = ix.bySlug.get(page.slugCandidate.toLowerCase());
  if (exact) return { canonicalSlug: exact.slug, matchKind: 'exact-slug', confidence: 1 };

  const alnum = ix.byAlnum.get(alnumKey(page.slugCandidate));
  if (alnum && alnum.length === 1) {
    return { canonicalSlug: alnum[0].slug, matchKind: 'normalized-slug', confidence: 0.95 };
  }

  if (page.title) {
    let best: { ref: CanonicalArtworkRef; score: number } | null = null;
    for (const ref of ix.byTitle) {
      const score = diceCoefficient(page.title, ref.title);
      if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) best = { ref, score };
    }
    if (best) {
      return { canonicalSlug: best.ref.slug, matchKind: 'fuzzy-title', confidence: best.score };
    }
  }

  for (const img of page.images) {
    const byMedia = ix.byMediaBasename.get(img.basename);
    if (byMedia?.artworkSlug && ix.bySlug.has(byMedia.artworkSlug.toLowerCase())) {
      return {
        canonicalSlug: byMedia.artworkSlug,
        matchKind: 'shared-image',
        confidence: 0.9,
      };
    }
    const byArt = ix.byImageBasename.get(img.basename);
    if (byArt) return { canonicalSlug: byArt.slug, matchKind: 'shared-image', confidence: 0.9 };
  }

  return { canonicalSlug: null, matchKind: 'none', confidence: 0 };
}

/**
 * Reconcile every extracted page against the canonical catalog.
 *
 * Two passes, deliberately. Pass one resolves each page independently; pass two groups the results
 * by canonical slug and upgrades anything shared to COLLISION. A single-page matcher cannot see a
 * collision — by definition it takes two pages to make one — which is why this is not inlined.
 */
export function reconcile(
  pages: ExtractedPage[],
  canonical: { artworks: CanonicalArtworkRef[]; media: CanonicalMediaRef[] }
): ReconcileReport {
  const ix = buildIndexes(canonical.artworks, canonical.media);

  const drafts = pages.map((page) => {
    const match = matchPage(page, ix);
    return {
      page,
      match,
      media: resolveMedia(page, ix),
      warnings: [...page.warnings],
    };
  });

  // Pass 2 — group by resolved slug, and by proposed slug for the NEW rows.
  const groups = new Map<string, string[]>();
  for (const d of drafts) {
    const key = d.match.canonicalSlug;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), `${d.page.category}/${d.page.slugCandidate}`]);
  }

  const usedProposed = new Set<string>(canonical.artworks.map((a) => a.slug.toLowerCase()));
  const records: ReconciledRecord[] = drafts.map((d) => {
    const sourcePath = `${d.page.category}/${d.page.slugCandidate}`;
    const group = d.match.canonicalSlug ? (groups.get(d.match.canonicalSlug) ?? []) : [];
    const collidesWith = group.filter((p) => p !== sourcePath).sort();
    const knownDedupe = KNOWN_DEDUPE_PAIRS.some(
      ([a, b]) =>
        (a === sourcePath && collidesWith.includes(b)) ||
        (b === sourcePath && collidesWith.includes(a))
    );

    let classification: Classification;
    let proposedSlug: string | null = null;

    if (collidesWith.length > 0) {
      classification = 'COLLISION';
    } else if (d.match.canonicalSlug) {
      classification = 'EXISTS';
    } else {
      const base = slugifyTitle(d.page.slugCandidate);
      let candidate = base;
      let n = 2;
      while (usedProposed.has(candidate.toLowerCase())) {
        candidate = `${base}-${n}`;
        n += 1;
      }
      usedProposed.add(candidate.toLowerCase());
      proposedSlug = candidate;
      classification = 'NEW';
    }

    const warnings = [...d.warnings];
    if (classification === 'COLLISION' && !knownDedupe) {
      warnings.push('unexpected collision — not in PRD_V3 §2; needs human adjudication');
    }
    if (d.match.matchKind === 'fuzzy-title') {
      warnings.push(
        `matched by fuzzy title at ${d.match.confidence.toFixed(2)} — verify before relying on it`
      );
    }

    return {
      archive: d.page.archive,
      relPath: d.page.relPath,
      title: d.page.title,
      category: d.page.category,
      slugCandidate: d.page.slugCandidate,
      canonicalSlug: d.match.canonicalSlug,
      proposedSlug,
      classification,
      matchKind: d.match.matchKind,
      confidence: Number(d.match.confidence.toFixed(4)),
      collidesWith,
      knownDedupe,
      media: d.media,
      warnings,
    };
  });

  const collisionGroups = [...groups.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([canonicalSlug, paths]) => ({
      canonicalSlug,
      paths: [...paths].sort(),
      knownDedupe: KNOWN_DEDUPE_PAIRS.some(
        ([a, b]) => paths.includes(a) && paths.includes(b)
      ),
    }))
    .sort((a, b) => a.canonicalSlug.localeCompare(b.canonicalSlug));

  const needsUpload = new Set<string>();
  const unavailable = new Set<string>();
  let withNeedsUpload = 0;
  let withoutImage = 0;

  for (const r of records) {
    let hasUsable = false;
    let localNeeds = false;
    for (const m of r.media) {
      if (m.action === 'exists') hasUsable = true;
      if (m.action === 'needs_upload') {
        hasUsable = true;
        localNeeds = true;
        needsUpload.add(m.basename);
      }
      if (m.action === 'unavailable') unavailable.add(m.basename);
    }
    if (localNeeds) withNeedsUpload += 1;
    if (!hasUsable) withoutImage += 1;
  }

  const summary: ReconcileSummary = {
    total: records.length,
    NEW: records.filter((r) => r.classification === 'NEW').length,
    EXISTS: records.filter((r) => r.classification === 'EXISTS').length,
    COLLISION: records.filter((r) => r.classification === 'COLLISION').length,
    withNeedsUpload,
    needsUploadCount: needsUpload.size,
    unavailableCount: unavailable.size,
    withoutImage,
  };

  return { records, collisionGroups, summary };
}
