/**
 * Studio permission vocabulary — shared by the browser bundle and the server.
 *
 * This module is deliberately dependency-free and side-effect-free so it can be
 * imported from React components (nav visibility, role pickers, legend copy) and
 * from Express routes (validation, guards) without pulling Node APIs into the
 * client bundle.
 */

export type CmsRole = 'admin' | 'editor' | 'viewer';

export const CMS_ROLES: CmsRole[] = ['admin', 'editor', 'viewer'];

/** Numeric ordering used for "at least this role" checks. */
export const ROLE_ORDER: Record<CmsRole, number> = { viewer: 0, editor: 1, admin: 2 };

export const ROLE_LABELS: Record<CmsRole, string> = {
  admin: 'Administrator',
  editor: 'Editor',
  viewer: 'Viewer',
};

/** Plain-language description of what each role unlocks — shown in the UI and in emails. */
export const ROLE_DESCRIPTIONS: Record<CmsRole, string> = {
  admin: 'Full control: catalog, pages, media, settings, design and studio users.',
  editor: 'Manages catalog entries, pages, media and the gallery design.',
  viewer: 'Read-only access to the studio dashboard and catalog.',
};

/** True when `role` is at least `minimum`. Unknown roles rank below every level. */
export function roleAtLeast(role: string | undefined | null, minimum: CmsRole): boolean {
  const current = ROLE_ORDER[role as CmsRole];
  if (current === undefined) return false;
  return current >= ROLE_ORDER[minimum];
}

export function normalizeRole(value: unknown): CmsRole | null {
  return typeof value === 'string' && (CMS_ROLES as string[]).includes(value)
    ? (value as CmsRole)
    : null;
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as CmsRole] || 'Viewer';
}
