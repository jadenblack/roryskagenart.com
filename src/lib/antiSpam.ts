/**
 * Anti-spam vocabulary — shared by the browser bundle and the server.
 *
 * The honeypot is a form field that a human never sees and never fills. A bot that
 * scrapes the markup and fills every input it finds will fill it, and the server can
 * then drop the submission. For that to work, the *name* the server reads and the name
 * the forms render must be one string defined in one place — this file, following the
 * `src/lib/roles.ts` precedent exactly: a dependency-free module both bundles can
 * import, so a rename cannot desynchronise them.
 *
 * ⚠️ WHY THE NAME IS `company_website` AND NOT `website`.
 * Browser autofill and password managers recognise field names. A field called
 * `website`, `url` or `email2` is one a real collector's browser may helpfully fill in
 * — which would silently drop a genuine inquiry. `company_website` is a name those
 * heuristics do not target, and `autoComplete: 'off'` plus `tabIndex: -1` (in
 * `HONEYPOT_PROPS`) closes the remaining paths.
 *
 * ⚠️ THE HONEYPOT IS ONLY APPLIED TO THE **PUBLIC** DOORS.
 * It is a heuristic, and a false positive on an *authenticated* submission would
 * silently discard a staff member's work with no error to explain it. The staff door
 * is already gated by a session and a per-user rate limit, so it needs no heuristic.
 * See `server/lib/requestGuards.ts`.
 */

/** The honeypot input's `name`. Read by the server, rendered by every form. */
export const HONEYPOT_FIELD = 'company_website';

/**
 * Spread onto the honeypot `<input>` so the footer modal and the contact form cannot
 * drift apart. Deliberately positioned off-screen by the caller rather than
 * `display: none`, because some bots skip inputs that are not rendered.
 */
export const HONEYPOT_PROPS = {
  type: 'text',
  name: HONEYPOT_FIELD,
  autoComplete: 'off',
  tabIndex: -1,
  'aria-hidden': true,
} as const;
