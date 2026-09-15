/**
 * Phase 4 step 3 — the linkage plan: which `media_assets` rows join which artwork, in what order.
 *
 * WHY THIS IS A SEPARATE, PURE MODULE
 * Step 3 is the step that makes 165 previously-orphaned media rows belong to something. Getting it
 * wrong is not a visible error — it silently attaches a photograph to the wrong mural, and nothing
 * in the UI says so. So the whole decision is here, with no `fs`, no `pg`, no network, and it is
 * unit-tested against fixtures that include the three failure modes below.
 *
 * WHY LINKAGE IS A SEPARATE ACT FROM REGISTRATION
 * `wayback-register.ts` writes `artwork_slug` only for a *trusted* match (`exact-slug`,
 * `divergence-map`, `known-dedupe`) — 3 of 168 entries. The other 165 belong to artworks that did
 * not exist at registration time. Registering them unlinked is correct: an unadjudicated image is
 * uploaded but not attached. This is the act that attaches them, and it runs *after* the artwork
 * backfill so there is something to attach them to.
 *
 * THE THREE WAYS THIS CAN GO WRONG, ALL REFUSED RATHER THAN REPAIRED
 *   1. `unknownArtwork` — the manifest names a slug the backfill did not create. Linking would
 *      violate the `artwork_images.artwork_slug` foreign key, and would mean the backfill and the
 *      media plan disagree about what exists.
 *   2. `missingMedia` — the manifest names a `public_id` with no `media_assets` row. That means
 *      registration did not finish.
 *   3. `conflicts` — a row is already linked to a *different* artwork than the manifest says. This
 *      is the dangerous one: silently re-pointing it would move a photograph off a live artwork.
 *      It is reported and never overwritten.
 */

/** One manifest entry, reduced to what linkage needs. Manifest order is significant — see `planLinks`. */
export interface LinkEntry {
  publicId: string;
  artworkSlug: string;
}

/** One `media_assets` row, reduced to what linkage needs. */
export interface LinkMediaRow {
  public_id: string;
  artwork_slug: string | null;
}

export interface PlannedLink {
  publicId: string;
  artworkSlug: string;
  /** Zero-based index within its artwork, in manifest order. `0` is the cover. */
  position: number;
}

export interface LinkPlan {
  /** Rows whose `artwork_slug` is NULL and should be set. */
  links: PlannedLink[];
  /** Rows already carrying the manifest's slug — no write needed. */
  alreadyLinked: PlannedLink[];
  /** A row linked to a different artwork than the manifest claims. NEVER overwritten. */
  conflicts: { publicId: string; expected: string; actual: string }[];
  /** Manifest slugs with no matching artwork. */
  unknownArtworks: string[];
  /** Manifest public_ids with no `media_assets` row. */
  missingMedia: string[];
  /** Every `(artwork_slug, public_id, position)` the join table should hold. */
  joins: PlannedLink[];
}

/**
 * Build the linkage plan.
 *
 * **Position comes from manifest order, and manifest order is authored order.** The render manifest
 * walks each artwork's images in the order WordPress stored them, so the first entry for an artwork
 * is the cover — the image the gallery shows in the grid. `position = 0` is therefore not an
 * arbitrary tie-break: it is what makes `generate-asset-registry.ts`'s cover selection deterministic
 * instead of "whichever `public_id` sorted first" (R-18).
 *
 * `alreadyLinked` still contributes a `join` — the join table is populated for every linkable entry,
 * not only the newly-linked ones, or a re-run after a partial failure would leave the covers of the
 * three already-linked artworks missing.
 */
export function planLinks(
  entries: readonly LinkEntry[],
  mediaRows: readonly LinkMediaRow[],
  existingArtworkSlugs: Iterable<string>
): LinkPlan {
  const artworkSlugs = new Set(existingArtworkSlugs);
  const rowByPublicId = new Map(mediaRows.map((r) => [r.public_id, r]));

  const links: PlannedLink[] = [];
  const alreadyLinked: PlannedLink[] = [];
  const conflicts: LinkPlan['conflicts'] = [];
  const unknownArtworks = new Set<string>();
  const missingMedia: string[] = [];

  // Count per artwork in manifest order, so `position` is stable across runs.
  const seen = new Map<string, number>();

  for (const entry of entries) {
    const position = seen.get(entry.artworkSlug) ?? 0;
    seen.set(entry.artworkSlug, position + 1);

    if (!artworkSlugs.has(entry.artworkSlug)) {
      unknownArtworks.add(entry.artworkSlug);
      continue;
    }

    const row = rowByPublicId.get(entry.publicId);
    if (!row) {
      missingMedia.push(entry.publicId);
      continue;
    }

    const planned: PlannedLink = {
      publicId: entry.publicId,
      artworkSlug: entry.artworkSlug,
      position,
    };

    if (row.artwork_slug === null) {
      links.push(planned);
    } else if (row.artwork_slug === entry.artworkSlug) {
      alreadyLinked.push(planned);
    } else {
      conflicts.push({
        publicId: entry.publicId,
        expected: entry.artworkSlug,
        actual: row.artwork_slug,
      });
    }
  }

  // Every non-conflicting entry gets a join row, whether or not its `artwork_slug` needed setting.
  const joins = [...links, ...alreadyLinked].sort(
    (a, b) => a.artworkSlug.localeCompare(b.artworkSlug) || a.position - b.position
  );

  return {
    links,
    alreadyLinked,
    conflicts,
    unknownArtworks: [...unknownArtworks].sort(),
    missingMedia: missingMedia.sort(),
    joins,
  };
}

/** True when the plan is safe to write — no conflict, no unknown artwork, no missing media row. */
export function isWritable(plan: LinkPlan): boolean {
  return (
    plan.conflicts.length === 0 && plan.unknownArtworks.length === 0 && plan.missingMedia.length === 0
  );
}

/** Distinct artworks the plan touches, for the report. */
export function artworksCovered(plan: LinkPlan): number {
  return new Set(plan.joins.map((j) => j.artworkSlug)).size;
}
