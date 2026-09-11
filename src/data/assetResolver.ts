/**
 * PRD_V3_CLOUDINARY_EXIT.md — Stage v3.2: dual-read resolution chain.
 *
 * Resolution order (never removes a working source — see PRD §3.3):
 *   1. Supabase asset registry hit   -> serve rendition URLs
 *   2. Cloudinary map (frozen)       -> serve legacy URL + log migration miss
 *   3. Caller fallback (SVG)
 *
 * The `[asset-migration]` warnings are the v3.4 deletion gate telemetry:
 * seven consecutive days of zero misses in production clears Cloudinary
 * for removal.
 */

import { ASSET_REGISTRY, AssetRegistryEntry, AssetRendition } from './assetRegistry';
import { resolveCloudinaryUrl } from './cloudinaryMap';

export { type AssetRegistryEntry, type AssetRendition };

const MIGRATION_LOG_FLAG = true; // flip off after the v3.4 gate window

function warnMiss(kind: string, ref: string | undefined, slugHint: string | undefined): void {
  if (!MIGRATION_LOG_FLAG) return;
  // Grep anchor for the v3.4 gate: "[asset-migration] cloudinary fallback"
  console.warn(`[asset-migration] cloudinary fallback (${kind}): ${ref ?? '-'} slug=${slugHint ?? '-'}`);
}

/** Normalize any filename/path/slug into candidate registry keys. */
export function candidateKeys(ref: string | undefined, slugHint: string | undefined): string[] {
  const out: string[] = [];
  const push = (s?: string) => {
    if (!s) return;
    const k = s.toLowerCase().trim();
    if (k && !out.includes(k)) out.push(k);
  };

  push(ref);
  push(slugHint);

  if (ref) {
    const filename = ref.split('/').pop() || ref;
    push(filename);
    push(filename.replace(/\.(jpg|jpeg|png|svg|webp|tif|tiff)$/i, ''));
    // Legacy Cloudinary naming: "-copy"/"-copy-2" suffixed variants of a slug
    push(filename.replace(/\.(jpg|jpeg|png|svg|webp|tif|tiff)$/i, '').replace(/-copy(-\d+)?$/i, ''));
  }
  if (slugHint) {
    push(slugHint.replace(/\.(jpg|jpeg|png|svg|webp)$/i, ''));
  }

  // Alias forms so slug-style lookups hit assets whose public_id uses legacy
  // filenames (e.g. slug "greetings-from-austin" vs public_id "GreetingsfromAustin")
  for (const c of [...out]) {
    const alnum = c.replace(/[^a-z0-9]/g, '');
    if (alnum && !out.includes(alnum)) out.push(alnum);
    const dashed = c.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (dashed && !out.includes(dashed)) out.push(dashed);
  }
  return out;
}

/** Registry lookup by any reference (path, filename, public id, or slug). */
export function lookupRegistryEntry(ref?: string, slugHint?: string): AssetRegistryEntry | null {
  for (const key of candidateKeys(ref, slugHint)) {
    const hit = ASSET_REGISTRY[key];
    if (hit) return hit;
  }
  return null;
}

export interface ResolvedRenditions {
  thumb: AssetRendition | null;
  hero: AssetRendition | null;
  full: AssetRendition | null;
  lqip: string | null;
  source: 'supabase' | 'cloudinary';
}

/**
 * Full rendition bundle for an artwork. Returns null when the asset is not in
 * the Supabase registry (caller then falls back to the legacy single URL).
 */
export function resolveRenditions(ref?: string, slugHint?: string): ResolvedRenditions | null {
  const entry = lookupRegistryEntry(ref, slugHint);
  if (entry && (entry.thumb || entry.hero)) {
    return {
      thumb: entry.thumb,
      hero: entry.hero,
      full: entry.full,
      lqip: entry.lqip,
      source: 'supabase',
    };
  }
  return null;
}

/**
 * Single-URL resolution with the dual-read chain. `size` picks the rendition
 * when Supabase has the asset; Cloudinary hits return the one legacy URL.
 */
export function resolveAssetUrl(
  ref?: string,
  slugHint?: string,
  size: 'thumb' | 'hero' | 'full' = 'hero'
): string | null {
  const entry = lookupRegistryEntry(ref, slugHint);
  if (entry) {
    const rend = entry[size] ?? entry.hero ?? entry.thumb ?? entry.full;
    if (rend) return rend.url;
  }

  const cloudUrl = resolveCloudinaryUrl(ref, slugHint);
  if (cloudUrl) {
    warnMiss(size, ref, slugHint);
    return cloudUrl;
  }
  return null;
}

/** Intrinsic dimensions for aspect-ratio boxes (Supabase assets only). */
export function resolveIntrinsicSize(
  ref?: string,
  slugHint?: string
): { width: number; height: number } | null {
  const entry = lookupRegistryEntry(ref, slugHint);
  if (entry && entry.srcWidth > 0 && entry.srcHeight > 0) {
    return { width: entry.srcWidth, height: entry.srcHeight };
  }
  return null;
}
