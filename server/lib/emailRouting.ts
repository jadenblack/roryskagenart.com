/**
 * Outbound email routing — one place that decides *who actually receives* a message.
 *
 * WHY THIS EXISTS
 * A preview deployment shares the production database and the production collector list. Before
 * this module, handing a preview deployment a Resend key meant a staging test could email a real
 * collector from a real address. Every send therefore passes through `applyEmailRouting()`, which
 * can redirect or suppress mail without any caller having to remember to.
 *
 * MODES (env `EMAIL_MODE`, case-insensitive)
 *   live      — deliver to the real recipients. Production only.
 *   redirect  — deliver to `EMAIL_REDIRECT_TO` instead, subject prefixed `[PREVIEW]`, and a banner
 *               in the body naming the recipients who were originally addressed.
 *   off       — send nothing; report the suppression so the caller can say so.
 *
 * If `EMAIL_MODE` is unset the mode is inferred from `VERCEL_ENV`:
 *   production -> live · preview -> redirect · anything else (local dev) -> live
 * so local development keeps sending real mail, while no preview deployment ever can.
 *
 * FAIL-CLOSED: `redirect` without `EMAIL_REDIRECT_TO` suppresses the message rather than falling
 * back to the real recipients. A missed notification is recoverable; emailing a collector from
 * staging is not.
 *
 * Pure by design: no I/O, no imports beyond this file, so it can be unit-tested offline and can
 * never pull a server-only dependency into a browser bundle.
 */

export type EmailMode = 'live' | 'redirect' | 'off';

export interface EmailRoutingEnv {
  EMAIL_MODE?: string;
  EMAIL_REDIRECT_TO?: string;
  VERCEL_ENV?: string;
}

const MODES: EmailMode[] = ['live', 'redirect', 'off'];

/** Explicit `EMAIL_MODE` wins; otherwise infer from `VERCEL_ENV` (previews never send for real). */
export function resolveEmailMode(env: EmailRoutingEnv = process.env): EmailMode {
  const raw = (env.EMAIL_MODE || '').trim().toLowerCase();
  if (raw) {
    return (MODES as string[]).includes(raw) ? (raw as EmailMode) : 'redirect';
  }
  return env.VERCEL_ENV === 'preview' ? 'redirect' : 'live';
}

/** Split a comma/semicolon-separated address list into trimmed, de-duplicated, non-empty entries. */
export function parseAddressList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const address = part.trim();
    if (address && !out.some((a) => a.toLowerCase() === address.toLowerCase())) out.push(address);
  }
  return out;
}

export interface OutboundEmail {
  to: string | string[];
  subject: string;
  html: string;
}

export interface RoutedEmail extends OutboundEmail {
  mode: EmailMode;
  /** True when the message must not be handed to the provider at all. */
  suppressed: boolean;
  /** Why it was suppressed — safe to log and to show in the studio UI. */
  reason?: string;
  /** The recipients the caller asked for, before routing. */
  originalTo: string[];
}

/**
 * HTML banner naming the real recipients. Injected immediately after `<body …>`; if a template
 * ever ships without a body tag the banner is prepended instead, so the notice is never lost.
 */
function redirectBanner(originalTo: string[]): string {
  const escaped = originalTo.map((a) => a.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`)).join(', ');
  return (
    '<div style="background:#fff4d6;border:1px solid #e0b400;color:#5c4400;' +
    'font:12px/1.5 Arial,Helvetica,sans-serif;padding:10px 14px;margin:0 0 16px;">' +
    'Test message from a non-production environment. No mail was sent to the real recipients' +
    (escaped ? ` (<strong>${escaped}</strong>)` : '') +
    '.</div>'
  );
}

export function applyEmailRouting(email: OutboundEmail, env: EmailRoutingEnv = process.env): RoutedEmail {
  const mode = resolveEmailMode(env);
  const originalTo = Array.isArray(email.to) ? [...email.to] : [email.to];

  if (mode === 'off') {
    return {
      ...email,
      mode,
      suppressed: true,
      reason: 'Outbound email is disabled (EMAIL_MODE=off).',
      originalTo,
    };
  }

  if (mode === 'live') {
    return { ...email, mode, suppressed: false, originalTo };
  }

  const redirectTo = parseAddressList(env.EMAIL_REDIRECT_TO);
  if (redirectTo.length === 0) {
    return {
      ...email,
      mode,
      suppressed: true,
      reason:
        'EMAIL_MODE=redirect but EMAIL_REDIRECT_TO is not set — nothing was sent. ' +
        'Set EMAIL_REDIRECT_TO (or EMAIL_MODE=off) on this environment.',
      originalTo,
    };
  }

  const banner = redirectBanner(originalTo);
  const html = /<body[^>]*>/i.test(email.html)
    ? email.html.replace(/<body([^>]*)>/i, (_m, attrs: string) => `<body${attrs}>${banner}`)
    : banner + email.html;

  return {
    to: redirectTo,
    subject: `[PREVIEW] ${email.subject}`,
    html,
    mode,
    suppressed: false,
    originalTo,
  };
}

/**
 * Who receives a new collector inquiry at the studio.
 *
 * `ADMIN_EMAIL` is the primary recipient; `STUDIO_CC` adds a copy. Both are env-driven — the
 * addresses that were hardcoded here before are now only defaults, so a studio can re-point
 * notifications without a code change.
 */
export function resolveStudioRecipients(env: {
  ADMIN_EMAIL?: string;
  STUDIO_CC?: string;
} = process.env): string[] {
  const primary = (env.ADMIN_EMAIL || '').trim() || 'rory@ventureio.com';
  const cc = env.STUDIO_CC === undefined
    ? ['jaden@venturepilot.org']   // legacy default, preserved so behaviour does not change silently
    : parseAddressList(env.STUDIO_CC);
  return parseAddressList([primary, ...cc].join(','));
}
