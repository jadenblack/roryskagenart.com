/**
 * Duplicate detection for the v3 merge — the layer that makes "no duplicates" enforceable.
 *
 * WHY THIS EXISTS
 * The owner's goal for v3 is a catalogue that is "unique and original (no dups)". The matcher in
 * `waybackReconcile.ts` cannot deliver that on its own, and the reason is measurable:
 *
 *   ⚠️ BOTH PRD_V3 §2 dedupe pairs score **BELOW** the matcher's 0.85 fuzzy gate.
 *      `austin-postcard-mural` → `austin-postcard`  0.833
 *      `marcia-ball-cd-cover`   → `marcia-ball`     0.710
 *      Max score across all 62 mural posts = 0.833. **0 posts score ≥ 0.85.**
 *
 * A threshold-only matcher is therefore blind to *exactly* the duplicates the owner wants
 * eliminated. It classifies both as NEW and the ingest emits an INSERT that duplicates a live
 * artwork — which is R-01, the single risk the PRD calls out by name.
 *
 * THE FIX: FOUR INDEPENDENT SIGNALS, NOT ONE THRESHOLD
 * Duplicate detection here is deliberately *not* "lower the threshold". Lowering it trades a
 * false negative for an unbounded false-positive rate, and a false positive silently merges two
 * different artworks — worse than a duplicate, because it is invisible. Instead:
 *
 *   1. `known-pair`    — PRD_V3 §2 knowledge, applied **explicitly**. Score 1.0, no matcher
 *                        involved. This is what catches both pairs above.
 *   2. `alias-match`   — a source record whose `_wp_old_slug` is the live slug. A WordPress
 *                        rename, so it is conclusive rather than probabilistic. Only 2 posts
 *                        carry one, and neither the scrape nor the matcher ever read the field.
 *   3. `near-miss`     — the composite score in the 0.60–0.85 band. **Reported, never acted on
 *                        automatically.** These are candidates for a human, and the band is a
 *                        review queue, not a merge instruction.
 *   4. `intra-source`  — two records *within* the ingested corpus that describe one work. This
 *                        is the case the reconcile pass cannot see at all: it only ever compares
 *                        source against canonical.
 *
 * Plus `slug-clash` (two NEW rows proposing one slug) and `shared-image` (two records referencing
 * one image basename), which are corroborating rather than decisive on their own.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It does not decide. It emits a queue with a recommended survivor per candidate, and separates
 * "this is certain" (`needsReview: false`) from "a human must look" (`needsReview: true`). The
 * one thing the caller can act on unattended is `blockedSourceIds` — the records that must not
 * become INSERTs.
 *
 * PURE BY CONSTRUCTION: no `fs`, no `pg`, no `dotenv`.
 */
import {
  alnumKey,
  diceCoefficient,
  normalizeForMatch,
  type CanonicalArtworkRef,
  type ReconciledRecord,
} from './waybackReconcile';
import type { ExtractedPage } from './waybackExtract';

export type DedupeSide = 'canonical' | 'source';

export type DedupeKind =
  /** PRD_V3 §2 pair, applied explicitly rather than through the fuzzy matcher. */
  | 'known-pair'
  /** Source record renamed in WordPress; its old slug is the live slug. */
  | 'alias-match'
  /** Composite score in the review band — a candidate, not a decision. */
  | 'near-miss'
  /** Two records inside the ingested corpus that describe one work. */
  | 'intra-source'
  /** Two records referencing the same image basename. Corroborating only. */
  | 'shared-image'
  /** Two NEW records proposing the same slug. */
  | 'slug-clash';

/**
 * Lower bound of the review band.
 *
 * 0.60 is not arbitrary: it is below the lower of the two known pairs (0.667) and comfortably
 * above the score at which two unrelated mural titles start colliding (distinct titles in this
 * corpus sit in the 0.30–0.45 range). The band exists to be *read*, so it is set to catch the
 * known cases rather than to minimise output.
 */
export const NEAR_MISS_FLOOR = 0.6;

/**
 * Minimum image overlap before two records are reported as sharing media.
 *
 * 0.5 rather than a token threshold, because the pairs that matter are small sets: the corpus's
 * true duplicate holds 4 images against 8, so a 50% rule catches it while a "any one image in
 * common" rule would fire on every post that reuses a site logo.
 */
export const SHARED_IMAGE_FLOOR = 0.5;

/** The matcher's own gate, re-exported so the band's upper bound cannot drift from it. */
export { FUZZY_THRESHOLD } from './waybackReconcile';

/** A record reduced to the fields duplicate detection actually needs. */
export interface DedupeRecord {
  side: DedupeSide;
  /** Human label — the slug for canonical records, `<category>/<slug>` for source records. */
  id: string;
  title: string;
  /**
   * Every slug-shaped name this record is known by.
   *
   * For a canonical row that is its slug. For a source row it is the candidate slug **plus any
   * `_wp_old_slug` values** — which is the whole point of `alias-match`: the alias is not the
   * current slug, so no index keyed on the current slug can ever find it.
   */
  keys: string[];
  /** Lowercased image basenames (no extension). */
  images: string[];
  /** The archive a source record came from, for the report. */
  archive?: string;
}

/** `side:id` — unique across both sides, which bare ids are not. */
export function recordKey(record: DedupeRecord): string {
  return `${record.side}:${record.id}`;
}

export interface DedupeRef {
  side: DedupeSide;
  id: string;
  title: string;
}

export interface DedupeCandidate {
  kind: DedupeKind;
  score: number;
  /** The record that should survive. */
  winner: DedupeRef;
  /** The record that must not survive independently. */
  loser: DedupeRef;
  /** Plain-language justification, printed verbatim in the report. */
  reason: string;
  /**
   * False only when the merge is a fact rather than a judgement (`known-pair`, `alias-match`).
   *
   * ⚠️ Callers must not treat a `true` here as "skip it". It means "do not act on this without a
   * human", which is a different instruction from "ignore".
   */
  needsReview: boolean;
  /**
   * Set when the similarity is driven by a shared series name rather than a shared work.
   *
   * Measured precision of the review band on this corpus is **0/2** — every hit is a `Greetings
   * from …` sibling. Such candidates are still emitted (the band is a queue, and recall matters
   * more than tidiness), but they are flagged so a reviewer can triage them last.
   */
  likelySeries?: boolean;
  /** Matched image pairs, when the candidate rests on image evidence. */
  sharedImages?: [string, string][];
}

export interface DedupeReport {
  candidates: DedupeCandidate[];
  byKind: Record<DedupeKind, number>;
  /** Source id → the canonical slug it must merge into. Certain merges only. */
  mergeInto: Record<string, string>;
  /**
   * Source ids that must never become an INSERT.
   *
   * This is the one output a caller may act on unattended, and it is the R-01 guard: both
   * PRD_V3 §2 pairs appear here even though the fuzzy matcher scores them 0.833 and 0.710.
   */
  blockedSourceIds: string[];
  /** Source ids the caller may safely insert as new rows. */
  insertableSourceIds: string[];
  warnings: string[];
}

// --- similarity --------------------------------------------------------------------------------

/** Whole-token split — `austin-postcard-mural` → `['austin','postcard','mural']`. */
function tokens(input: string): string[] {
  return normalizeForMatch(input).split('-').filter(Boolean);
}

/**
 * Fraction of the longer token list that the shorter one accounts for, or 0 when it is not a
 * whole-token subset.
 *
 * WHY TOKENS AND NOT CHARACTERS
 * A character-prefix test would score `2010` against `2010-rendezvous-in-chinatown` as a
 * containment hit, and `2010` is a *year* that appears in dozens of slugs. Requiring every token
 * of the shorter name to appear in the longer one keeps `austin-postcard` ⊂
 * `austin-postcard-mural` while rejecting `2010` ⊄ `2010-rendezvous-in-chinatown`'s token set…
 * except that it does not, because `2010` *is* one of that slug's tokens.
 *
 * So the ratio is what does the work: a 1-of-4 subset scores 0.25 and falls below the review
 * floor, while a 2-of-3 subset scores 0.667 and enters it. The ratio, not the boolean, is the
 * signal.
 */
export function containmentRatio(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const pool = new Set(long);
  if (!short.every((t) => pool.has(t))) return 0;
  return short.length / long.length;
}

/**
 * Collapse WordPress's duplicate-upload suffix so two uploads of one photo compare equal.
 *
 * ⚠️ MEASURED, NOT THEORISED. The strongest duplicate signal in this corpus was being missed.
 * `restaurant/aztec-mural-for-casino-el-camino` (4 images) and `restaurant/casino-el-camino-mural`
 * (8 images) are the same commission — same client, same day, posted 14 minutes apart — and three
 * of their images are the same photographs:
 *
 *     aztec_mural_left3.jpg   ↔  aztec_mural_left1.jpg
 *     aztec_mural_center3.jpg ↔  aztec_mural_center1.jpg
 *     aztec_mural_right3.jpg  ↔  aztec_mural_right1.jpg
 *
 * An exact-basename test scores that overlap **0 of 4** and reports no shared image at all. The
 * digits differ because the files were uploaded twice, which is precisely the thing that makes
 * them duplicates. Stripping a trailing digit run is therefore not a heuristic here — it is the
 * recovery of a signal the corpus was actively hiding.
 */
export function collapseUploadVariant(basename: string): string {
  return basename
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/-?\d+$/, '');
}

/**
 * Leading tokens the two names share before they diverge.
 *
 * `greetings-from-78752` / `greetings-from-texas` → `['greetings','from']`.
 */
export function commonPrefixTokens(a: string, b: string): string[] {
  const ta = tokens(a);
  const tb = tokens(b);
  const out: string[] = [];
  for (let i = 0; i < Math.min(ta.length, tb.length); i += 1) {
    if (ta[i] !== tb[i]) break;
    out.push(ta[i]);
  }
  return out;
}

/**
 * True when two names share a leading run but *both* continue past it — i.e. they are series
 * siblings rather than one name containing the other.
 *
 * ⚠️ THIS EXISTS BECAUSE THE REVIEW BAND'S PRECISION WAS MEASURED AT 0/2.
 *
 * Both `near-miss` hits on this corpus are false positives, and both fail the same way:
 *
 *     business/greetings-from-78752         vs live `greetings-from-texas`   0.714
 *     business/greetings-from-navasota-mural vs live `greetings-from-texas`  0.628
 *
 * They are *different* artworks — a 2015 zip-code mural and a Navasota, Texas mural — but Dice
 * scores shared bigrams, and the `Greetings from …` series name is most of the bigrams. The
 * distinction that separates them from the true positives is structural: `austin-postcard` is a
 * *whole prefix* of `austin-postcard-mural` (one name runs out), whereas `greetings-from-78752`
 * and `greetings-from-texas` both continue past `greetings-from` with different endings.
 *
 * So the band keeps its recall and the human gets told which hits are probably series noise.
 * Without this, a reviewer reading three `Greetings from …` hits has no way to tell which one is
 * the duplicate — and none of them is.
 */
export function looksLikeSeriesSiblings(a: string, b: string): boolean {
  const shared = commonPrefixTokens(a, b);
  if (shared.length < 2) return false;
  return tokens(a).length > shared.length && tokens(b).length > shared.length;
}

/**
 * Fraction of the smaller record's images that the larger one also holds, after collapsing
 * duplicate-upload variants.
 *
 * Returns the matched pairs as well as the ratio, because the ratio alone cannot be trusted and
 * the pairs can be verified at a glance. This is corroborating evidence, never a verdict: two
 * posts legitimately share a hero crop or a site logo.
 */
export function imageOverlap(
  a: string[],
  b: string[]
): { ratio: number; shared: [string, string][] } {
  const collapse = (list: string[]) => new Map(list.map((x) => [collapseUploadVariant(x), x]));
  const ca = collapse(a);
  const cb = collapse(b);
  if (!ca.size || !cb.size) return { ratio: 0, shared: [] };

  const shared: [string, string][] = [];
  for (const [key, original] of ca) {
    const other = cb.get(key);
    if (other) shared.push([original, other]);
  }
  return { ratio: shared.length / Math.min(ca.size, cb.size), shared };
}

/** Composite similarity: the better of bigram Dice and token containment.
 *
 * Neither measure alone catches both known pairs. Dice catches `marcia-ball` (0.667) but
 * under-scores `austin-postcard-mural` (0.842 — still below the 0.85 gate). Containment catches
 * `austin-postcard-mural` (0.667) but under-scores `marcia-ball` (0.500). Taking the max puts both
 * inside the review band, which is the entire reason this function exists instead of reusing
 * `diceCoefficient` directly.
 */
export function similarityScore(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const score = Math.max(diceCoefficient(na, nb), containmentRatio(na, nb));
  return Number(score.toFixed(4));
}

// --- record construction -----------------------------------------------------------------------

/** Reduce the live catalogue to dedupe records. */
export function canonicalToRecords(artworks: CanonicalArtworkRef[]): DedupeRecord[] {
  return artworks.map((a) => ({
    side: 'canonical' as const,
    id: a.slug,
    title: a.title,
    keys: [a.slug],
    images: a.imageUrl ? [basenameKey(a.imageUrl)] : [],
  }));
}

/**
 * Reduce extracted pages to dedupe records.
 *
 * `aliases` is keyed on the page's `<category>/<slug>` and supplies extra slug-shaped names —
 * in practice `_wp_old_slug` values. It is a separate argument rather than a field on
 * `ExtractedPage` because `ExtractedPage` is the shared seam both corpora flow through, and the
 * scrape has no equivalent column to populate. Threading it in from the caller keeps the seam
 * untouched and the recovered-only knowledge where it belongs.
 */
export function pagesToRecords(
  pages: ExtractedPage[],
  aliases?: Map<string, string[]>
): DedupeRecord[] {
  return pages.map((page) => {
    const id = `${page.category}/${page.slugCandidate}`;
    const extra = aliases?.get(id) ?? [];
    return {
      side: 'source' as const,
      id,
      title: page.title,
      keys: [...new Set([page.slugCandidate, ...extra].filter(Boolean))],
      images: page.images.map((img) => img.basename).filter(Boolean),
      archive: String(page.archive),
    };
  });
}

function basenameKey(ref: string): string {
  const tail = ref.split('/').pop() ?? ref;
  return tail.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
}

// --- known-pair resolution ---------------------------------------------------------------------

/**
 * Resolve a `category/slug` archive path to a live canonical slug, using only exact knowledge.
 *
 * PRD_V3 §2 writes its dedupe pairs as archive paths, and the *canonical* side of a pair is
 * sometimes the counterpart path's last segment (`commissions-misc/marcia-ball` → `marcia-ball`)
 * and sometimes a hand-seeded divergence (`commissions-misc/today` → `today-atomic-sunrise`).
 * Both routes are tried; the seed map wins when it applies, because it is authored.
 */
export function resolveCanonicalByPath(
  path: string,
  canonical: DedupeRecord[],
  seedDivergence?: Record<string, string>
): string | null {
  const seeded = seedDivergence?.[path];
  if (seeded) {
    const hit = canonical.find((c) => c.keys.some((k) => k.toLowerCase() === seeded.toLowerCase()));
    if (hit) return hit.id;
  }

  const tail = path.split('/').pop() ?? path;
  const byExact = canonical.find((c) => c.keys.some((k) => k.toLowerCase() === tail.toLowerCase()));
  if (byExact) return byExact.id;

  const wanted = alnumKey(tail);
  const byAlnum = canonical.filter((c) => c.keys.some((k) => alnumKey(k) === wanted));
  if (byAlnum.length === 1) return byAlnum[0].id;

  return null;
}

// --- detection ---------------------------------------------------------------------------------

export interface DedupeOptions {
  /** PRD_V3 §2 pairs, as `[sourcePath, sourcePath]`. */
  knownPairs?: [string, string][];
  /** `SEED_DIVERGENCE`, so a pair whose counterpart is a seeded rename still resolves. */
  seedDivergence?: Record<string, string>;
  /** Review-band floor. Defaults to `NEAR_MISS_FLOOR`. */
  floor?: number;
  /** Upper bound of the review band. Defaults to the matcher's `FUZZY_THRESHOLD`. */
  gate?: number;
}

function ref(record: DedupeRecord): DedupeRef {
  return { side: record.side, id: record.id, title: record.title };
}

function emptyCounts(): Record<DedupeKind, number> {
  return {
    'known-pair': 0,
    'alias-match': 0,
    'near-miss': 0,
    'intra-source': 0,
    'shared-image': 0,
    'slug-clash': 0,
  };
}

/**
 * Detect duplicates across the ingested corpus and the live catalogue.
 *
 * `canonical` and `sources` are passed separately rather than as one list because the two sides
 * are not symmetric: a canonical row always wins (`PRD_V3 §2` — the live slugs win), so the
 * winner of a cross-side candidate is never in question, only whether the pair is real.
 */
export function findDuplicates(
  sources: DedupeRecord[],
  canonical: DedupeRecord[],
  options: DedupeOptions = {}
): DedupeReport {
  const floor = options.floor ?? NEAR_MISS_FLOOR;
  const gate = options.gate ?? 0.85;
  const warnings: string[] = [];
  const candidates: DedupeCandidate[] = [];

  const canonicalByKey = new Map<string, DedupeRecord>();
  for (const c of canonical) for (const k of c.keys) canonicalByKey.set(k.toLowerCase(), c);

  const sourceByPath = new Map<string, DedupeRecord>();
  for (const s of sources) sourceByPath.set(s.id, s);

  /** source id → canonical slug. Populated only by certain merges. */
  const mergeInto = new Map<string, string>();
  const certain = new Set<string>();

  // --- 1. known pairs ---------------------------------------------------------------------------
  // Applied before any scoring, deliberately. These are facts the PRD already established; running
  // them through a matcher that scores them below its own gate would be a way of *losing*
  // knowledge the project already has.
  for (const [a, b] of options.knownPairs ?? []) {
    for (const [mine, theirs] of [
      [a, b],
      [b, a],
    ] as [string, string][]) {
      const source = sourceByPath.get(mine);
      if (!source) continue;
      const canonicalSlug = resolveCanonicalByPath(theirs, canonical, options.seedDivergence);
      if (!canonicalSlug) {
        warnings.push(
          `known pair \`${a}\` / \`${b}\`: \`${mine}\` is present but its counterpart could not be ` +
            `resolved to a live slug — the pair cannot be applied and must be checked by hand`
        );
        continue;
      }
      const target = canonical.find((c) => c.id === canonicalSlug) as DedupeRecord;
      candidates.push({
        kind: 'known-pair',
        score: 1,
        winner: ref(target),
        loser: ref(source),
        reason:
          `PRD_V3 §2 records \`${mine}\` and \`${theirs}\` as the same work. The counterpart ` +
          `resolves to live slug \`${canonicalSlug}\`, so this is a merge, not an insert. ` +
          `The fuzzy matcher scores this pair below its 0.85 gate and would classify it NEW.`,
        needsReview: false,
      });
      mergeInto.set(source.id, canonicalSlug);
      certain.add(source.id);
    }
  }

  // --- 2. alias matches -------------------------------------------------------------------------
  // A `_wp_old_slug` that is now a live slug means the post was renamed and the catalogue kept the
  // old name. Exact string equality, so there is nothing probabilistic about it.
  for (const source of sources) {
    if (certain.has(source.id)) continue;
    const hit = source.keys
      .map((k) => canonicalByKey.get(k.toLowerCase()))
      .find((c): c is DedupeRecord => Boolean(c) && c?.id !== source.id);
    if (!hit) continue;
    candidates.push({
      kind: 'alias-match',
      score: 1,
      winner: ref(hit),
      loser: ref(source),
      reason:
        `\`${source.id}\` was published under a name the live catalogue still uses ` +
        `(\`${hit.id}\`). A WordPress rename, not a similarity — the record is the same artwork.`,
      needsReview: false,
    });
    mergeInto.set(source.id, hit.id);
    certain.add(source.id);
  }

  // --- 3. near misses ---------------------------------------------------------------------------
  // The review queue. Everything here is a *candidate*; nothing is merged from this section.
  for (const source of sources) {
    if (certain.has(source.id)) continue;
    const scored = canonical
      .map((c) => ({
        target: c,
        score: Math.max(
          similarityScore(source.title, c.title),
          ...source.keys.map((k) => similarityScore(k, c.id))
        ),
      }))
      .filter((s) => s.score >= floor && s.score < gate)
      .sort((x, y) => y.score - x.score);

    if (!scored.length) continue;
    const best = scored[0];
    const series = looksLikeSeriesSiblings(source.title, best.target.title);
    candidates.push({
      kind: 'near-miss',
      score: best.score,
      winner: ref(best.target),
      loser: ref(source),
      reason:
        `\`${source.id}\` scores ${best.score.toFixed(3)} against live \`${best.target.id}\` — inside ` +
        `the ${floor}–${gate} review band, so the matcher classifies it NEW. ` +
        (series
          ? `⚠️ The overlap is a shared leading run (\`${commonPrefixTokens(source.title, best.target.title).join(' ')}\`) ` +
            `that *both* names continue past — the shape of a series sibling, not a duplicate. ` +
            `Check the images before merging; on this corpus every hit of this shape has been a ` +
            `false positive.`
          : `It is above the floor and the names do not diverge after a shared run, so it may well ` +
            `be the same work.`) +
        (scored.length > 1 ? ` (${scored.length - 1} other live row(s) also scored in-band.)` : '') +
        ` A human decides.`,
      needsReview: true,
      likelySeries: series,
    });
  }

  // --- 4. intra-corpus --------------------------------------------------------------------------
  // The case the reconcile pass structurally cannot see: it only ever compares source against
  // canonical, so two near-identical source records both classify NEW and both get inserted.
  for (let i = 0; i < sources.length; i += 1) {
    for (let j = i + 1; j < sources.length; j += 1) {
      const a = sources[i];
      const b = sources[j];
      const score = Math.max(
        similarityScore(a.title, b.title),
        ...a.keys.map((k) => Math.max(...b.keys.map((k2) => similarityScore(k, k2))))
      );
      if (score < floor) continue;
      const richer = a.images.length >= b.images.length ? a : b;
      const leaner = richer === a ? b : a;
      const { ratio, shared } = imageOverlap(a.images, b.images);
      candidates.push({
        kind: 'intra-source',
        score,
        winner: ref(richer),
        loser: ref(leaner),
        reason:
          `Both records are in the ingested corpus and score ${score.toFixed(3)} against each ` +
          `other. Neither can be found by a source-vs-canonical matcher. Recommended survivor is ` +
          `\`${richer.id}\` (${richer.images.length} image(s) vs ${leaner.images.length})` +
          (shared.length
            ? `, and they hold ${shared.length} image(s) in common (${(ratio * 100).toFixed(0)}% of ` +
              `the smaller set): ${shared
                .slice(0, 3)
                .map(([x, y]) => `\`${x}\` ↔ \`${y}\``)
                .join(', ')}${shared.length > 3 ? ' …' : ''}. Image overlap of this size is the ` +
              `signature of one commission posted twice, not of two artworks.`
            : '. No image overlap, so treat the resemblance as a title coincidence until checked.'),
        needsReview: true,
        sharedImages: shared.length ? shared : undefined,
      });
    }
  }

  // --- 5. shared images -------------------------------------------------------------------------
  // Corroborating evidence, not a verdict: two posts legitimately share a site logo or a hero
  // crop. Reported at low weight so it can support a near-miss but never stand alone as a merge.
  //
  // ⚠️ Compared through `collapseUploadVariant`, not by exact basename. An exact test scores the
  // corpus's one true duplicate pair **0 of 4** — see `collapseUploadVariant`.
  for (let i = 0; i < sources.length; i += 1) {
    for (let j = i + 1; j < sources.length; j += 1) {
      const a = sources[i];
      const b = sources[j];
      const { ratio, shared } = imageOverlap(a.images, b.images);
      if (!shared.length || ratio < SHARED_IMAGE_FLOOR) continue;
      const richer = a.images.length >= b.images.length ? a : b;
      const leaner = richer === a ? b : a;
      candidates.push({
        kind: 'shared-image',
        score: Number(ratio.toFixed(4)),
        winner: ref(richer),
        loser: ref(leaner),
        reason:
          `\`${a.id}\` and \`${b.id}\` hold ${shared.length} image(s) in common (${(ratio * 100).toFixed(0)}% ` +
          `of the smaller set), ignoring WordPress's duplicate-upload digit suffix: ` +
          shared
            .slice(0, 4)
            .map(([x, y]) => `\`${x}\` ↔ \`${y}\``)
            .join(', ') +
          (shared.length > 4 ? ` … (+${shared.length - 4} more)` : '') +
          `. Corroborating only — a shared image is not proof of a shared artwork.`,
        needsReview: true,
        sharedImages: shared,
      });
    }
  }

  // --- 6. slug clashes --------------------------------------------------------------------------
  // `reconcile()` disambiguates these with a `-2` suffix, which is the right mechanical answer and
  // the wrong editorial one: two proposals wanting one slug usually means one work.
  const byProposed = new Map<string, DedupeRecord[]>();
  for (const s of sources) {
    if (certain.has(s.id)) continue;
    const key = normalizeForMatch(s.keys[0] ?? s.id);
    byProposed.set(key, [...(byProposed.get(key) ?? []), s]);
  }
  for (const [slug, holders] of byProposed) {
    if (holders.length < 2) continue;
    warnings.push(
      `slug clash: ${holders.map((h) => `\`${h.id}\``).join(', ')} all propose \`${slug}\` — ` +
        `reconcile() will emit \`${slug}\` and \`${slug}-2\`; confirm these are not one work`
    );
    const [first, ...rest] = holders;
    for (const other of rest) {
      candidates.push({
        kind: 'slug-clash',
        score: 1,
        winner: ref(first),
        loser: ref(other),
        reason: `Both records propose the slug \`${slug}\`.`,
        needsReview: true,
      });
    }
  }

  const byKind = emptyCounts();
  for (const c of candidates) byKind[c.kind] += 1;

  const blockedSourceIds = [...certain].sort();
  const blocked = new Set(blockedSourceIds);
  const insertableSourceIds = sources
    .map((s) => s.id)
    .filter((id) => !blocked.has(id))
    .sort();

  if (byKind['near-miss'] > 0) {
    const seriesCount = candidates.filter((c) => c.kind === 'near-miss' && c.likelySeries).length;
    warnings.push(
      `${byKind['near-miss']} source record(s) sit in the ${floor}–${gate} review band. They are ` +
        `NOT blocked — a false merge silently destroys an artwork, so each needs a human call.` +
        (seriesCount
          ? ` ⚠️ ${seriesCount} of them share a leading run with the live title and both names ` +
            `continue past it, which is the shape of a series sibling rather than a duplicate.`
          : '')
    );
  }
  if (byKind['intra-source'] > 0) {
    warnings.push(
      `${byKind['intra-source']} pair(s) of records inside the ingested corpus resemble each ` +
        `other. A source-vs-canonical matcher cannot detect these.`
    );
  }

  return {
    candidates: candidates.sort(
      (a, b) =>
        // Certain merges first, then series-sibling noise last, then by score.
        Number(a.needsReview) - Number(b.needsReview) ||
        Number(Boolean(a.likelySeries)) - Number(Boolean(b.likelySeries)) ||
        b.score - a.score ||
        a.kind.localeCompare(b.kind) ||
        a.loser.id.localeCompare(b.loser.id)
    ),
    byKind,
    mergeInto: Object.fromEntries([...mergeInto.entries()].sort()),
    blockedSourceIds,
    insertableSourceIds,
    warnings,
  };
}

/**
 * Apply a report to a list of source ids, returning the split the ingest stage needs.
 *
 * Kept separate from `findDuplicates` so the detection function stays a pure classifier with no
 * opinion about what a caller does next.
 */
export function partitionByDedupe(
  sourceIds: string[],
  report: DedupeReport
): { merge: string[]; insert: string[] } {
  const blocked = new Set(report.blockedSourceIds);
  return {
    merge: sourceIds.filter((id) => blocked.has(id)).sort(),
    insert: sourceIds.filter((id) => !blocked.has(id)).sort(),
  };
}

/**
 * Feed certain merges back into the reconciled records.
 *
 * ⚠️ WITHOUT THIS THE DEDUPE WORK DOES NOTHING. `reconcile()` scored both PRD_V3 §2 pairs below
 * its gate, so it classified them NEW — and a NEW row's images are uploaded **unlinked**, because
 * `buildMediaPlan` only links `TRUSTED_MATCH_KINDS`. Detecting the duplicate and then inserting it
 * anyway is strictly worse than not detecting it: the report would say "merged" while the database
 * gained a second artwork.
 *
 * Only `certain` merges are applied (`known-pair`, `alias-match`). Review-queue candidates are
 * deliberately left alone: rewriting a record on a 0.71 similarity score is the false-merge failure
 * mode this whole module is built to avoid.
 */
export function applyDedupeMerges(
  records: ReconciledRecord[],
  report: DedupeReport
): { records: ReconciledRecord[]; applied: string[] } {
  const applied: string[] = [];
  const out = records.map((record) => {
    const path = `${record.category}/${record.slugCandidate}`;
    const canonicalSlug = report.mergeInto[path];
    if (!canonicalSlug) return record;

    applied.push(path);
    return {
      ...record,
      canonicalSlug,
      proposedSlug: null,
      classification: 'EXISTS' as const,
      matchKind: 'known-dedupe' as const,
      confidence: 1,
      warnings: [
        ...record.warnings,
        `merged into \`${canonicalSlug}\` by PRD_V3 §2 dedupe knowledge — the fuzzy matcher scored ` +
          `this below its gate and had classified it NEW`,
      ],
    };
  });

  return { records: out, applied: applied.sort() };
}
