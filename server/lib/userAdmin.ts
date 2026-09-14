/**
 * Pure user-administration rules.
 *
 * Everything in this file is side-effect free and unit-tested offline
 * (`src/test/userAdmin.test.ts`). The Express router in
 * `server/routes/adminUsers.ts` owns the database and Supabase Auth calls; it
 * delegates every *decision* — what counts as a pending invite, what a valid
 * patch looks like, and whether a mutation would lock the studio out — here.
 *
 * The lockout rules exist because the Users screen is operated by studio staff,
 * not engineers: it must be impossible to remove the last administrator, or to
 * change your own access, from the UI.
 */

import {
  CMS_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_ORDER,
  normalizeRole,
  type CmsRole,
} from '../../src/lib/roles';

// The permission vocabulary itself lives in `src/lib/roles.ts` so the browser
// bundle and the server share one definition. Re-exported here for convenience.
export { CMS_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER, normalizeRole };
export type { CmsRole };

/** Minimal email sanity check — deliberately permissive, normalized to lowercase. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export interface UserStateInput {
  invited_at?: string | null;
  confirmation_sent_at?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
}

export interface UserState {
  /** The address has been verified and the account can sign in. */
  confirmed: boolean;
  /** Invited but never accepted — the row the studio still has to chase. */
  invitePending: boolean;
  /** Currently under an active ban window (deactivated). */
  banned: boolean;
}

/**
 * Derive the account lifecycle state from a Supabase `auth.users` record.
 * `now` is injected so the ban comparison stays deterministic in tests.
 */
export function classifyUserState(input: UserStateInput, now: number = Date.now()): UserState {
  const confirmed = Boolean(input.email_confirmed_at || input.confirmed_at);
  const banned = input.banned_until ? new Date(input.banned_until).getTime() > now : false;
  return {
    confirmed,
    invitePending: !confirmed && Boolean(input.invited_at || input.confirmation_sent_at),
    banned,
  };
}

export interface UserPatch {
  role?: CmsRole;
  isActive?: boolean;
  name?: string;
  email?: string;
}

export type PatchResult = { patch: UserPatch; error?: undefined } | { patch?: undefined; error: string };

/**
 * Validate an incoming PATCH body. Unknown keys are ignored rather than
 * rejected so the client can send a whole row back without ceremony.
 */
export function buildUserPatch(body: unknown): PatchResult {
  if (!body || typeof body !== 'object') {
    return { error: 'No fields provided.' };
  }
  const raw = body as Record<string, unknown>;
  const patch: UserPatch = {};

  if ('role' in raw) {
    const role = normalizeRole(raw.role);
    if (!role) return { error: 'Invalid role. Expected admin, editor or viewer.' };
    patch.role = role;
  }

  if ('isActive' in raw) {
    if (typeof raw.isActive !== 'boolean') return { error: 'isActive must be true or false.' };
    patch.isActive = raw.isActive;
  }

  if ('name' in raw) {
    if (raw.name !== null && typeof raw.name !== 'string') return { error: 'Name must be text.' };
    const name = String(raw.name ?? '').trim();
    if (name.length > 120) return { error: 'Name must be 120 characters or fewer.' };
    patch.name = name;
  }

  if ('email' in raw) {
    const email = normalizeEmail(raw.email);
    if (!email) return { error: 'A valid email address is required.' };
    patch.email = email;
  }

  if (Object.keys(patch).length === 0) {
    return { error: 'No updatable fields provided.' };
  }

  return { patch };
}

export type MutationAction = 'role' | 'deactivate' | 'delete' | 'reset-password';

export interface MutationContext {
  action: MutationAction;
  /** The signed-in administrator performing the action. */
  actorId: string;
  target: { id: string; email: string; role: string; isActive: boolean };
  /** How many administrators are currently active (including the target). */
  activeAdminCount: number;
  /** For `role`: the role being assigned. */
  nextRole?: CmsRole;
}

export interface MutationDecision {
  allowed: boolean;
  /** Present only when `allowed` is false. */
  reason?: string;
}

const SELF_BLOCKED: Partial<Record<MutationAction, string>> = {
  role: 'You cannot change your own role. Ask another administrator.',
  deactivate: 'You cannot deactivate your own account.',
  delete: 'You cannot delete your own account.',
};

/**
 * Decide whether an administrator may mutate a target account.
 *
 * Two invariants are enforced, both aimed at preventing a studio lockout:
 *   1. an administrator cannot change their own role or access;
 *   2. the last remaining active administrator cannot be demoted, deactivated
 *      or deleted by anyone.
 */
export function decideMutation(ctx: MutationContext): MutationDecision {
  const isSelf = ctx.actorId === ctx.target.id;

  if (isSelf && SELF_BLOCKED[ctx.action]) {
    return { allowed: false, reason: SELF_BLOCKED[ctx.action]! };
  }

  const targetIsActiveAdmin = ctx.target.role === 'admin' && ctx.target.isActive;
  if (!targetIsActiveAdmin) return { allowed: true };
  const targetLeavesAdmin =
    ctx.action === 'delete' ||
    ctx.action === 'deactivate' ||
    (ctx.action === 'role' && ctx.nextRole !== undefined && ctx.nextRole !== 'admin');

  if (targetLeavesAdmin && ctx.activeAdminCount <= 1) {
    return {
      allowed: false,
      reason:
        ctx.target.email +
        ' is the only active administrator. Promote another user to administrator first.',
    };
  }

  return { allowed: true };
}

/** Result of asking Supabase for a link. */
export interface ActionLink {
  url: string;
  /** How the link reached the user. */
  delivery: 'email' | 'supabase-mailer' | 'manual';
  /** Set when the branded email could not be sent. */
  warning?: string;
}

/**
 * Pull the verification URL out of a `generateLink` response. Returns null when
 * the SDK returned an unexpected shape, so callers can degrade to the manual
 * copy-link path instead of throwing.
 */
export function extractActionLink(response: unknown): string | null {
  const data = (response as { data?: { properties?: { action_link?: unknown } } })?.data;
  const link = data?.properties?.action_link;
  return typeof link === 'string' && link.startsWith('http') ? link : null;
}

/**
 * Build the URL an invited or resetting user should land on after Supabase
 * verifies their token.
 *
 * The site is a hash-router SPA and `supabase-js` reads the session out of the
 * URL *fragment*, so the redirect target must be a bare origin. Appending a
 * hash route would produce `…/#/admin#access_token=…`, which the SDK cannot
 * parse and which silently drops the session.
 */
export function buildAuthRedirect(siteUrl: string): string {
  return siteUrl.replace(/#.*$/, '').replace(/\/+$/, '') + '/';
}
