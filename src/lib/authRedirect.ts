/**
 * Capture the Supabase auth hand-off before `supabase-js` consumes it.
 *
 * When an invited or resetting user clicks the link in their email, Supabase
 * redirects them to the site origin with the session in the URL **fragment**:
 *
 *   https://roryskagenart.com/#access_token=…&type=invite&…
 *
 * `supabase-js` reads that fragment during its own async initialization and
 * then blanks `window.location.hash` (GoTrueClient `_getSessionFromURL` →
 * `window.location.hash = ''`). By the time React mounts, the `type` — the only
 * signal that tells us the visitor must choose a password before anything else
 * — is gone.
 *
 * This module is therefore intentionally dependency-free and must be imported
 * *first* in `src/main.tsx`, so its module body runs before the Supabase client
 * is constructed.
 */

export type AuthHandoff = 'invite' | 'recovery' | null;

function readFragment(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  const hash = window.location.hash || '';
  // Hash routing means the fragment is usually a route ("#/admin"), which
  // yields no usable params — that is expected and handled by the callers.
  return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
}

function readHandoff(): AuthHandoff {
  const type = readFragment().get('type');
  if (type === 'invite' || type === 'signup') return 'invite';
  if (type === 'recovery') return 'recovery';
  return null;
}

function readError(): string | null {
  const params = readFragment();
  const code = params.get('error_code') || params.get('error');
  if (!code) return null;
  const description = params.get('error_description');
  return description ? description.replace(/\+/g, ' ') : code;
}

let handoff: AuthHandoff = readHandoff();
let handoffError: string | null = readError();

/** The pending invite/recovery hand-off, or null for an ordinary visit. */
export function getAuthHandoff(): AuthHandoff {
  return handoff;
}

/** A Supabase-reported link failure (expired or already-used token). */
export function getAuthHandoffError(): string | null {
  return handoffError;
}

/** Called once the user has set a password (or dismissed the screen). */
export function clearAuthHandoff(): void {
  handoff = null;
  handoffError = null;
}

/**
 * A bare origin, safe to hand to Supabase as `redirectTo`.
 *
 * The redirect target must not contain a `#`: the app is a hash-router SPA, so
 * a target like `…/#/admin` produces `…/#/admin#access_token=…`, which
 * `supabase-js` cannot parse and which silently drops the session.
 */
export function bareOrigin(url: string): string {
  return url.replace(/#.*$/, '').replace(/\/+$/, '') + '/';
}
