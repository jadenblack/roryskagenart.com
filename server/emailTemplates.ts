/**
 * Branded transactional email layer for Rory Skagen Art.
 *
 * Every message the studio sends — collector inquiries, studio notifications,
 * staff invitations and password resets — is rendered through one shared shell
 * so the brand mark, palette and footer never drift between senders.
 *
 * The templates are deliberately table-based with inline styles: that is what
 * Gmail, Outlook and Apple Mail actually render reliably. No external CSS, no
 * web fonts, no JavaScript.
 *
 * The same shell is exported as static HTML for the Supabase Auth mailer
 * templates (see `supabase/email-templates/` and
 * `docs/runbooks/supabase-email-branding.md`).
 */

// Role copy is shared with the admin UI (`src/lib/roles.ts`) so an email and
// the Users screen can never disagree about what an Editor may do.
import { ROLE_DESCRIPTIONS, roleLabel } from '../src/lib/roles';
export { ROLE_DESCRIPTIONS, roleLabel };

/** Public site origin used for every absolute link and asset in an email. */
export function resolveSiteUrl(): string {
  const raw =
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    process.env.VITE_SITE_URL ||
    '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed) return trimmed;
  return 'https://roryskagenart.com';
}

/**
 * Absolute URL of the brand mark. Email clients cannot resolve relative paths,
 * and most of them block remote images by default — hence the width/height
 * attributes and the text alt fallback.
 */
export function resolveBrandLogoUrl(): string {
  const override = (process.env.BRAND_LOGO_URL || '').trim();
  if (override) return override;
  return `${resolveSiteUrl()}/android-chrome-192x192.png`;
}

export const BRAND = {
  name: 'Rory Skagen Art',
  studio: 'Rory Skagen Art',
  tagline: 'Fine Art · Murals · Austin, Texas · Est. 1985',
  city: 'Austin, Texas',
  address: 'Austin, TX 78704',
  ink: '#111111',
  gold: '#d4af37',
  paper: '#f8f8f6',
  card: '#ffffff',
  line: '#e5e5e0',
  muted: '#888888',
  body: '#333333',
} as const;

export interface BrandedEmailOptions {
  /** Bold headline inside the dark header band. */
  heading: string;
  /** Small monospace line under the headline. */
  eyebrow?: string;
  /** Short lead paragraph shown above the body. */
  intro?: string;
  /** Main body HTML. Already escaped by the caller. */
  bodyHtml?: string;
  /** Optional primary call-to-action button. */
  cta?: { label: string; url: string };
  /** Plain-text fallback shown under the button when a button is present. */
  ctaFallbackNote?: string;
  /** Small print above the footer. */
  note?: string;
}

/**
 * The one shared shell. Every studio email is this function plus content.
 */
export function renderBrandedEmail(options: BrandedEmailOptions): string {
  const {
    heading,
    eyebrow,
    intro,
    bodyHtml,
    cta,
    ctaFallbackNote,
    note,
  } = options;

  const logoUrl = resolveBrandLogoUrl();
  const siteUrl = resolveSiteUrl();

  const ctaBlock = cta
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
                <tr>
                  <td align="center" bgcolor="${BRAND.ink}" style="border-radius:3px;">
                    <a href="${cta.url}"
                       style="display:inline-block;padding:15px 34px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#ffffff;text-decoration:none;">
                      ${cta.label}
                    </a>
                  </td>
                </tr>
              </table>${
                ctaFallbackNote
                  ? `
              <p style="margin:14px 0 0;font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.7;color:${BRAND.muted};word-break:break-all;">
                ${ctaFallbackNote}<br>
                <a href="${cta.url}" style="color:#0066cc;text-decoration:none;word-break:break-all;">${cta.url}</a>
              </p>`
                  : ''
              }`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.paper};">
    <!-- Preheader: shown in the inbox preview, hidden in the body. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${eyebrow || heading} — ${BRAND.studio}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.paper};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:4px;overflow:hidden;">

            <!-- Brand header -->
            <tr>
              <td bgcolor="${BRAND.ink}" style="background:${BRAND.ink};padding:22px 28px;border-bottom:3px solid ${BRAND.gold};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="46" valign="middle" style="padding-right:14px;">
                      <img src="${logoUrl}" alt="${BRAND.name}" width="42" height="42"
                           style="display:block;width:42px;height:42px;border-radius:8px;border:0;outline:none;text-decoration:none;">
                    </td>
                    <td valign="middle">
                      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:17px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;line-height:1.25;">
                        ${BRAND.name}
                      </div>
                      <div style="font-family:'Courier New',Courier,monospace;font-size:11px;color:#a0a0a0;margin-top:3px;">
                        ${BRAND.tagline}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Headline -->
            <tr>
              <td style="padding:30px 28px 0;">
                ${
                  eyebrow
                    ? `<div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.muted};margin-bottom:8px;">${eyebrow}</div>`
                    : ''
                }
                <h1 style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:bold;line-height:1.3;color:${BRAND.ink};">
                  ${heading}
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:18px 28px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:${BRAND.body};">
                ${intro ? `<p style="margin:0 0 16px;">${intro}</p>` : ''}
                ${bodyHtml || ''}
                ${ctaBlock}
                ${
                  note
                    ? `<p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #f0f0ec;font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.7;color:${BRAND.muted};">${note}</p>`
                    : ''
                }
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td bgcolor="#f5f5f0" style="background:#f5f5f0;padding:16px 28px;text-align:center;font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.8;color:${BRAND.muted};">
                ${BRAND.name} · ${BRAND.city}<br>
                <a href="${siteUrl}" style="color:${BRAND.muted};text-decoration:underline;">roryskagenart.com</a>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Escape untrusted text before it enters an email body. */
export function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface StaffEmailContext {
  name?: string | null;
  email: string;
  role?: string | null;
  actionUrl: string;
  invitedBy?: string | null;
}

/** Studio staff invitation. */
export function renderInviteEmail(ctx: StaffEmailContext): string {  const greetingName = (ctx.name || '').trim();
  const role = ctx.role || 'editor';
  const invitedBy = (ctx.invitedBy || '').trim();

  return renderBrandedEmail({
    heading: "You're invited to the Rory Skagen Art studio",
    eyebrow: 'Studio invitation',
    intro: `${greetingName ? `Hello ${escapeHtml(greetingName)},` : 'Hello,'} you have been invited to the studio workspace at <strong>roryskagenart.com</strong>.`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Your account will be created as <strong>${escapeHtml(roleLabel(role))}</strong> — ${escapeHtml(ROLE_DESCRIPTIONS[role] || ROLE_DESCRIPTIONS.viewer)}</p>
      <p style="margin:0 0 16px;">Choose a password to activate your account. The link below can only be used once and expires shortly, so please complete this step soon.</p>`,
    cta: { label: 'Set my password', url: ctx.actionUrl },
    ctaFallbackNote: 'Button not working? Copy and paste this link into your browser:',
    note: invitedBy
      ? `Invited by ${escapeHtml(invitedBy)} · Sent to ${escapeHtml(ctx.email)}. If you were not expecting this invitation, you can safely ignore this email.`
      : `Sent to ${escapeHtml(ctx.email)}. If you were not expecting this invitation, you can safely ignore this email.`,
  });
}

/** Admin-triggered password reset. */
export interface PasswordResetEmailContext {
  name?: string | null;
  email: string;
  actionUrl: string;
  /** The administrator who triggered the reset. */
  requestedBy?: string | null;
}

export function renderPasswordResetEmail(ctx: PasswordResetEmailContext): string {
  const greetingName = (ctx.name || '').trim();

  return renderBrandedEmail({
    heading: 'Reset your studio password',
    eyebrow: 'Password reset',
    intro: `${greetingName ? `Hello ${escapeHtml(greetingName)},` : 'Hello,'} a password reset was requested for your Rory Skagen Art studio account.`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Click the button below to choose a new password. This link can only be used once and expires shortly.</p>
      <p style="margin:0 0 16px;">If you did not request this, you can ignore this email — your current password will keep working.</p>`,
    cta: { label: 'Choose a new password', url: ctx.actionUrl },
    ctaFallbackNote: 'Button not working? Copy and paste this link into your browser:',
    note: `Requested by ${escapeHtml(ctx.requestedBy || 'a studio administrator')} · Sent to ${escapeHtml(ctx.email)}.`,
  });
}

/** Admin-triggered confirmation that a user's access changed. */
export function renderAccessChangedEmail(ctx: {
  name?: string | null;
  email: string;
  role: string;
  active: boolean;
  changedBy?: string | null;
}): string {
  const siteUrl = resolveSiteUrl();
  return renderBrandedEmail({
    heading: ctx.active ? 'Your studio access was updated' : 'Your studio access was paused',
    eyebrow: 'Account update',
    intro: ctx.active
      ? 'Your Rory Skagen Art studio account has been updated.'
      : 'Your Rory Skagen Art studio account has been deactivated, so sign-in is temporarily disabled.',
    bodyHtml: ctx.active
      ? `<p style="margin:0 0 16px;">Your role is now <strong>${escapeHtml(roleLabel(ctx.role))}</strong> — ${escapeHtml(ROLE_DESCRIPTIONS[ctx.role] || '')}</p>`
      : `<p style="margin:0 0 16px;">A studio administrator can restore your access at any time — no action is needed from you right now.</p>`,
    cta: ctx.active ? { label: 'Open the studio', url: `${siteUrl}/#/admin` } : undefined,
    note: ctx.changedBy ? `Updated by ${escapeHtml(ctx.changedBy)}.` : undefined,
  });
}

/** Admin-triggered confirmation that a user's email address changed. */
export function renderEmailChangedEmail(ctx: {
  name?: string | null;
  email: string;
  previousEmail?: string | null;
  changedBy?: string | null;
}): string {
  const siteUrl = resolveSiteUrl();
  return renderBrandedEmail({
    heading: 'Your studio email address was updated',
    eyebrow: 'Account update',
    intro: `The email address on your Rory Skagen Art studio account is now <strong>${escapeHtml(ctx.email)}</strong>.`,
    bodyHtml: ctx.previousEmail
      ? `<p style="margin:0 0 16px;">It was previously <strong>${escapeHtml(ctx.previousEmail)}</strong>. Use the new address the next time you sign in.</p>`
      : `<p style="margin:0 0 16px;">Use this address the next time you sign in.</p>`,
    cta: { label: 'Open the studio', url: `${siteUrl}/#/admin` },
    note: ctx.changedBy
      ? `Updated by ${escapeHtml(ctx.changedBy)}. If this was not expected, contact a studio administrator immediately.`
      : 'If this was not expected, contact a studio administrator immediately.',
  });
}

/** Delivery self-test. */
export function renderTestEmail(ctx: { domain: string; fromAddress: string }): string {
  return renderBrandedEmail({
    heading: 'Resend email delivery verified',
    eyebrow: 'Configuration test',
    intro: 'This message confirms the studio email pipeline is configured and delivering.',
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#fbfbf9;border-left:3px solid ${BRAND.gold};padding:0;">
        <tr>
          <td style="padding:14px 16px;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.9;color:${BRAND.body};">
            <strong>From:</strong> ${escapeHtml(ctx.fromAddress)}<br>
            <strong>Domain:</strong> ${escapeHtml(ctx.domain)}<br>
            <strong>Timestamp:</strong> ${new Date().toISOString()}
          </td>
        </tr>
      </table>`,
    note: 'If this landed in spam, add the studio sender address to your contacts.',
  });
}
