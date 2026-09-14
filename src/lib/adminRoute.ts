/**
 * Admin hash-route parsing.
 *
 * Admin paths arrive as the raw hash tail, e.g.
 *
 *   "/admin"                      → { subPath: '',            editSlug: null }
 *   "/admin/catalog"              → { subPath: 'catalog',     editSlug: null }
 *   "/admin/catalog?edit=the-cats"→ { subPath: 'catalog',     editSlug: 'the-cats' }
 *
 * The `edit` parameter is what "Edit in Studio" on a public artwork dossier
 * uses, so the curator lands in that entry's editor instead of the full catalog
 * list. Parsing lives here rather than in the component so it can be tested
 * offline.
 */

export interface AdminRoute {
  /** Route segment after `/admin`, e.g. `catalog`, `users`, or '' for the dashboard. */
  subPath: string;
  /** Slug from `?edit=`, or null when absent or empty. */
  editSlug: string | null;
}

export function parseAdminPath(path: string): AdminRoute {
  const raw = (path || '').startsWith('/admin') ? path : `/admin${path || ''}`;
  const [pathOnly, queryOnly] = raw.split('?');
  const subPath = pathOnly.replace(/^\/admin\/?/, '').replace(/\/+$/, '');

  let editSlug: string | null = null;
  try {
    const value = new URLSearchParams(queryOnly || '').get('edit');
    editSlug = value && value.trim() ? value.trim() : null;
  } catch {
    editSlug = null;
  }

  return { subPath, editSlug };
}

/** Build the hash path that opens a catalog entry's editor. */
export function buildEditPath(slug: string): string {
  return `/admin/catalog?edit=${encodeURIComponent(slug)}`;
}
