/**
 * The bulk media path for the v3 Wayback merge (PRD_V3 §3 Step 3 → roadmap Phase 3.B).
 *
 * WHY THIS EXISTS
 * `POST /api/media/upload` is built for a human uploading one file: it takes a `multer` stream, and
 * it is only reachable by an authenticated staff member. `POST /api/artworks` is worse — it
 * hardcodes 2024 / "Acrylic on Canvas" / 48"x60" / $9,500 / "Neon Americana", so it cannot express
 * a mural at all. Neither can carry a batch of archived images (owner decision **Q2**: v3 ingests
 * Wayback at web quality in a **pre-ingest offline pass**). This module is the plan that pass
 * executes; `scripts/wayback-render.ts` and `scripts/wayback-register.ts` are its two halves.
 *
 * THREE RULES THIS ENCODES, EACH LEARNED FROM THE REAL CORPUS
 *
 *  1. **A WordPress resize is not an image.** WordPress wrote `e1-590x410.jpg` next to `e1.jpg`;
 *     the archive captured both. Rendering both would put two `media_assets` rows behind one
 *     photograph. Measured: **0 of the 152 registered assets match `-<w>x<h>`** — every registered
 *     asset is an original — so the suffix reliably marks a server-side derivative. When the
 *     original is available the derivative is dropped; when it is not (e.g. `MESHU-TORA-590x409`,
 *     whose original was never captured) the derivative is kept, because a 590 px copy beats none.
 *
 *  2. **Uploading is safe; *linking* is not.** The bytes go to a new bucket folder and a new
 *     `media_assets` row, so nothing existing is touched. `artwork_slug` is different: the registry
 *     generator (`scripts/generate-asset-registry.ts`) is first-wins and indexes each row under its
 *     `public_id` *and* its `artwork_slug`, so attaching a wrong slug can **steal a live artwork's
 *     gallery image** (R-18). Only a trusted match is allowed to link; everything else is uploaded
 *     unlinked and linked after a human adjudicates.
 *
 *  3. **`public_id` must not be assumed unique-per-artwork.** The roadmap's shorthand
 *     (`public_id = slug`) holds only for single-image artworks. `featured/facebook-2` has three
 *     images and `business/high-5-bowling-mural` has two, and `public_id` is the bucket folder, so
 *     the shorthand would have them overwrite each other. Multi-image artworks get a suffixed id
 *     derived from the *source basename* rather than an index — an index would renumber silently if
 *     an image were ever added, orphaning the objects already in the bucket.
 *
 *  4. **An unresolved identity cannot name a file.** Rule 3's id is derived from the artwork, so a
 *     COLLISION — two source pages claiming one slug, which is the *matcher's* way of saying "I do
 *     not know what this is" — has no id to derive. Those rows are held out of the plan entirely
 *     (see `buildMediaPlan`).
 *
 * PURE BY CONSTRUCTION: no `fs`, no `sharp`, no `pg`. The render and register stages inject the
 * filesystem and the network; this module only decides.
 */
import type { ArchiveId } from './waybackExtract';
import type { ReconciledRecord } from './waybackReconcile';
import type { RenditionName } from '../../server/lib/imageRenditions';

/**
 * Match kinds whose artwork linkage may be written without a human.
 *
 * Deliberately the same set `waybackBackfill.ts` uses to decide which rows it may touch: a media
 * row that links where the artwork backfill refuses to write would be linking to a row the backfill
 * never created, or to one it flagged for review.
 */
/**
 * ⚠️ DUPLICATED IN `waybackBackfill.ts` — the two lists must be changed together.
 *
 * `known-dedupe` is trusted because PRD_V3 §2 *establishes* the pair; the confidence comes from
 * authored knowledge, not from a similarity score, so the linkage may be written immediately.
 */
export const TRUSTED_MATCH_KINDS = ['exact-slug', 'divergence-map', 'known-dedupe'] as const;

/** `e1-590x410` → stem `e1`. Anchored at the end, so `square-eggs-16x13-copy` is not a derivative. */
export const WORDPRESS_DERIVATIVE_RE = /^(.+?)-(\d+)x(\d+)$/;

export interface DerivativeParts {
  /** The basename the derivative was resized from. */
  stem: string;
  width: number;
  height: number;
}

/**
 * Parse a WordPress-generated resize name, or return null.
 *
 * Only the *shape* is checked here — whether the file is genuinely a derivative is decided by
 * whether its stem is separately available (see `buildMediaPlan`). This function stays a pure
 * syntactic test so it cannot be wrong about the corpus in a way that is hard to see.
 */
export function parseWordPressDerivative(basename: string): DerivativeParts | null {
  const m = WORDPRESS_DERIVATIVE_RE.exec(basename);
  if (!m) return null;
  return { stem: m[1], width: Number(m[2]), height: Number(m[3]) };
}

export function isWordPressDerivative(basename: string): boolean {
  return WORDPRESS_DERIVATIVE_RE.test(basename);
}

/**
 * Bucket folder / `media_assets.public_id` for one image.
 *
 * Single-image artworks keep `public_id = slug`, which is the convention all 152 migrated rows
 * already follow. Multi-image artworks are suffixed with the source basename.
 */
export function derivePublicId(artworkSlug: string, basename: string, siblingCount: number): string {
  return siblingCount > 1 ? `${artworkSlug}--${basename}` : artworkSlug;
}

export type MediaSkipReason =
  | 'artwork-collision'
  | 'derivative-of-available-original'
  | 'no-artwork-slug'
  | 'duplicate-basename';

export interface MediaPlanItem {
  /** Lowercased source filename without extension — the key the reconciler matched on. */
  basename: string;
  archive: ArchiveId;
  /** Path to the source file relative to `wayback/<archive>/`. */
  archivePath: string;
  /** `<category>/<slugCandidate>` of the page that referenced it. */
  sourcePath: string;
  /** Canonical slug for EXISTS rows, the proposed slug for NEW rows. */
  artworkSlug: string;
  /** Bucket folder and `media_assets.public_id`. */
  publicId: string;
  /**
   * Whether `artwork_slug` may be written now.
   *
   * False means the artwork does not exist yet (NEW — Phase 4 creates it) or the match needs review.
   * The image is still uploaded; only the link waits.
   */
  linkable: boolean;
  /**
   * `derivative-only` marks an image that is a WordPress resize kept because no original survives.
   * It is usable, but its own pixel width is the ceiling — the render ladder cannot enlarge it.
   */
  kind: 'original' | 'derivative-only';
  derivativeOf: string | null;
}

export interface MediaPlanSkip {
  basename: string;
  sourcePath: string;
  reason: MediaSkipReason;
  detail: string;
}

export interface MediaPlan {
  items: MediaPlanItem[];
  skipped: MediaPlanSkip[];
  /** Distinct artworks that will receive at least one image. */
  artworkCount: number;
  /** Items whose `artwork_slug` may be written immediately. */
  linkableCount: number;
}

/** Structural shape of the rendition ladder, so this module need not import `sharp`'s caller. */
export type RenditionLadder = Record<
  RenditionName,
  { readonly width: number; readonly quality: number }
>;

/**
 * One rendered image, as written by `scripts/wayback-render.ts` and consumed by
 * `scripts/wayback-register.ts`.
 *
 * The contract lives here rather than in the render script because a CLI that runs `main()` on
 * import cannot be safely imported for its types — the register stage would re-render the archive
 * as a side effect of loading a type.
 */
export interface RenderManifestEntry {
  basename: string;
  archive: ArchiveId;
  archivePath: string;
  sourcePath: string;
  artworkSlug: string;
  publicId: string;
  linkable: boolean;
  kind: 'original' | 'derivative-only';
  derivativeOf: string | null;
  /** Size of the archive file the ladder was rendered from. */
  sourceBytes: number;
  /** sha256 of that file — the idempotency key, so a re-render is skipped only for identical input. */
  sourceSha256: string;
  /** Dimensions of the *source*, before resizing. `derivative-only` items cap at these. */
  width: number;
  height: number;
  format: string;
  lqip: string;
  renditions: Record<RenditionName, { path: string; width: number; height: number; bytes: number }>;
}

export interface RenderManifest {
  generatedAt: string;
  /** The ladder in force. A mismatch means every entry is stale and must be re-rendered. */
  ladder: RenditionLadder;
  extraction: { path: string; generatedAt: string };
  entries: RenderManifestEntry[];
  skipped: MediaPlanSkip[];
}

/** A row already in `media_assets`, as far as the registry key space is concerned. */
export interface ExistingRegistryKey {
  public_id: string;
  artwork_slug: string | null;
}

/**
 * The R-18 guard: which planned `public_id`s would fight the live registry for a key.
 *
 * `scripts/generate-asset-registry.ts` indexes every row under its `public_id` **and** its
 * `artwork_slug`, and it is first-wins. So a planned id that matches either of those keys on an
 * existing row does not merely duplicate — it takes the key away from the row that had it, which
 * shows up as a live artwork silently rendering somebody else's photograph.
 *
 * This is why `vintage-appeal/jungle-tempo-2` is held out of the plan rather than filed: its
 * canonical slug `jungle-tempo` is already the `artwork_slug` of the `boyhood-explorers-6` row.
 *
 * Returns a human-readable description per offending id; **non-empty means do not write**.
 */
export function findRegistryCollisions(
  planned: string[],
  existing: ExistingRegistryKey[]
): string[] {
  const claimed = new Map<string, string>();
  for (const row of existing) {
    claimed.set(row.public_id.toLowerCase(), row.public_id);
    if (row.artwork_slug) claimed.set(row.artwork_slug.toLowerCase(), row.public_id);
  }
  const collisions: string[] = [];
  for (const id of planned) {
    const hit = claimed.get(id.toLowerCase());
    if (hit) collisions.push(`${id} (already claimed by media_assets.public_id='${hit}')`);
  }
  return collisions.sort();
}

/** A candidate before the derivative and duplicate passes have had their say. */
interface Candidate {
  basename: string;
  archive: ArchiveId;
  archivePath: string;
  sourcePath: string;
  artworkSlug: string;
  linkable: boolean;
}

/**
 * Turn reconciled records into the list of images to render, upload and register.
 *
 * Deterministic: the same extraction always yields the same plan, in the same order, so a re-run
 * can be diffed against the previous one.
 *
 * `existingMediaByArtwork` maps an artwork slug to how many rows it **already** has in
 * `media_assets`. It exists because sibling counting used to look only at the plan:
 *
 * ⚠️ `derivePublicId` mints `public_id = slug` when an artwork has one image, and that is the
 * convention the 152 migrated rows follow. But "one image" was being read as "one image *in this
 * plan*", so an artwork that already had media and gained a single new image was planned as
 * `public_id = <slug>` — the exact key its existing row holds. `findRegistryCollisions` catches it
 * and refuses the write (which is why the recovered run reported 2 collisions rather than writing
 * them), but the correct plan is the suffixed form, and it needs the live count to know that.
 *
 * Optional and defaulted, so every existing caller and test keeps its current behaviour.
 */
export function buildMediaPlan(
  records: ReconciledRecord[],
  existingMediaByArtwork: Map<string, number> = new Map()
): MediaPlan {
  const skipped: MediaPlanSkip[] = [];
  const candidates: Candidate[] = [];

  for (const record of records) {
    const sourcePath = `${record.category}/${record.slugCandidate}`;

    // A COLLISION is two source pages claiming one canonical slug, so the artwork's identity is
    // *unresolved* — and both the link and the bucket folder are derived from that identity. The
    // real corpus shows why this cannot be waved through: `vintage-appeal/jungle-tempo-2` resolves
    // to `jungle-tempo`, which is already the `artwork_slug` of a live media row
    // (`boyhood-explorers-6`). Planning it would mint `public_id = 'jungle-tempo'` and collide in
    // the registry generator's key space, silently stealing that artwork's gallery image.
    if (record.classification === 'COLLISION') {
      for (const media of record.media) {
        if (media.action !== 'needs_upload') continue;
        skipped.push({
          basename: media.basename,
          sourcePath,
          reason: 'artwork-collision',
          detail: `page collides on \`${record.canonicalSlug}\` with ${record.collidesWith
            .map((p) => `\`${p}\``)
            .join(', ')} — identity must be adjudicated before the image can be filed`,
        });
      }
      continue;
    }

    const artworkSlug = record.canonicalSlug ?? record.proposedSlug;
    const linkable =
      record.classification === 'EXISTS' &&
      (TRUSTED_MATCH_KINDS as readonly string[]).includes(record.matchKind);

    for (const media of record.media) {
      if (media.action !== 'needs_upload') continue;
      if (!artworkSlug) {
        // Cannot happen with today's reconciler (a needs_upload row always has one slug or the
        // other) but the plan must not invent a bucket folder if it ever does.
        skipped.push({
          basename: media.basename,
          sourcePath,
          reason: 'no-artwork-slug',
          detail: 'page resolved to neither a canonical nor a proposed slug',
        });
        continue;
      }
      candidates.push({
        basename: media.basename,
        archive: record.archive,
        archivePath: media.archivePath ?? '',
        sourcePath,
        artworkSlug,
        linkable,
      });
    }
  }

  // --- Pass 1: drop derivatives whose original is available from the same page ----------------
  // "Available" covers both halves of the reconciler's output: a sibling awaiting upload, and one
  // already registered (`austin-carnival` is exactly this — `austin` is registered and the page
  // additionally references `austin-590x412`).
  //
  // Availability is read from the *non-derivative* candidates only. A resize is never an original,
  // so letting one satisfy another would chain `x-150x150` into rescuing `x-590x410`.
  const bySourcePath = new Map<string, ReconciledRecord>();
  for (const record of records) bySourcePath.set(`${record.category}/${record.slugCandidate}`, record);

  const originalBasenames = new Set(
    candidates.map((c) => c.basename).filter((b) => !isWordPressDerivative(b))
  );

  const kept: Candidate[] = [];
  for (const c of candidates) {
    const derivative = parseWordPressDerivative(c.basename);
    if (!derivative) {
      kept.push(c);
      continue;
    }
    const record = bySourcePath.get(c.sourcePath);
    const registeredOriginal = record?.media.some(
      (m) => m.action === 'exists' && m.basename === derivative.stem
    );
    const siblingOriginal = originalBasenames.has(derivative.stem);
    if (registeredOriginal || siblingOriginal) {
      skipped.push({
        basename: c.basename,
        sourcePath: c.sourcePath,
        reason: 'derivative-of-available-original',
        detail: `WordPress resize of \`${derivative.stem}\`, which is ${
          registeredOriginal ? 'already registered' : 'also being uploaded'
        }`,
      });
      continue;
    }
    // No original anywhere: this resize is the best copy that exists, so it is kept — but only if
    // it is the largest one on the page. Two resizes of the same missing original would otherwise
    // become two registry rows for one photograph.
    const better = candidates.find(
      (other) =>
        other !== c &&
        other.sourcePath === c.sourcePath &&
        other.basename !== c.basename &&
        parseWordPressDerivative(other.basename)?.stem === derivative.stem &&
        (parseWordPressDerivative(other.basename)?.width ?? 0) > derivative.width
    );
    if (better) {
      skipped.push({
        basename: c.basename,
        sourcePath: c.sourcePath,
        reason: 'derivative-of-available-original',
        detail: `smaller resize of the same uncaptured original as \`${better.basename}\``,
      });
      continue;
    }
    kept.push(c);
  }

  // --- Pass 2: one row per basename ------------------------------------------------------------
  // `public_id` is the table's primary key, so a basename referenced by two pages would abort the
  // whole upsert. Same artwork ⇒ the same image, deduped silently; different artworks ⇒ a real
  // conflict that a human has to settle.
  const byBasename = new Map<string, Candidate>();
  const deduped: Candidate[] = [];
  for (const c of kept) {
    const seen = byBasename.get(c.basename);
    if (!seen) {
      byBasename.set(c.basename, c);
      deduped.push(c);
      continue;
    }
    if (seen.artworkSlug === c.artworkSlug) continue;
    skipped.push({
      basename: c.basename,
      sourcePath: c.sourcePath,
      reason: 'duplicate-basename',
      detail: `same image referenced by \`${seen.sourcePath}\` (→ \`${seen.artworkSlug}\`) and this page (→ \`${c.artworkSlug}\`)`,
    });
  }

  // --- Pass 3: derive public_id once the sibling count per artwork is known ---------------------
  // "Siblings" means every image the artwork will have after this run, not just the ones this run
  // adds — otherwise a single new image on an artwork that already has media reclaims the
  // artwork's existing `public_id` (see this function's doc comment).
  const siblingCount = new Map<string, number>();
  for (const c of deduped) siblingCount.set(c.artworkSlug, (siblingCount.get(c.artworkSlug) ?? 0) + 1);

  const totalSiblings = (artworkSlug: string): number =>
    (siblingCount.get(artworkSlug) ?? 1) + (existingMediaByArtwork.get(artworkSlug) ?? 0);

  const items: MediaPlanItem[] = deduped
    .map((c) => {
      const derivative = parseWordPressDerivative(c.basename);
      return {
        basename: c.basename,
        archive: c.archive,
        archivePath: c.archivePath,
        sourcePath: c.sourcePath,
        artworkSlug: c.artworkSlug,
        publicId: derivePublicId(c.artworkSlug, c.basename, totalSiblings(c.artworkSlug)),
        linkable: c.linkable,
        kind: derivative ? ('derivative-only' as const) : ('original' as const),
        derivativeOf: derivative ? derivative.stem : null,
      };
    })
    .sort((a, b) => a.artworkSlug.localeCompare(b.artworkSlug) || a.basename.localeCompare(b.basename));

  skipped.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath) || a.basename.localeCompare(b.basename));

  return {
    items,
    skipped,
    artworkCount: new Set(items.map((i) => i.artworkSlug)).size,
    linkableCount: items.filter((i) => i.linkable).length,
  };
}
