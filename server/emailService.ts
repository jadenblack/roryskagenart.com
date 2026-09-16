import { Resend } from 'resend';
import { applyEmailRouting, resolveEmailMode, resolveStudioRecipients } from './lib/emailRouting';
import {
  BRAND,
  escapeHtml,
  renderAccessChangedEmail,
  renderBrandedEmail,
  renderEmailChangedEmail,
  renderInviteEmail,
  renderPasswordResetEmail,
  renderTestEmail,
  renderPlanDigestEmail,
  resolveSiteUrl,
} from './emailTemplates';
import { planDigestSubject } from './lib/planDigest';
import type { PlanDigestItem } from './emailTemplates';

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_EMAIL_DOMAIN || 'roryskagenart.com';
  const adminEmail = process.env.ADMIN_EMAIL || 'rory@ventureio.com';
  const configured = Boolean(apiKey && apiKey.trim().length > 0);
  const fromAddress = configured
    ? `${BRAND.studio} <studio@${domain}>`
    : `${BRAND.studio} <onboarding@resend.dev>`;

  return {
    configured,
    domain,
    adminEmail,
    fromAddress,
    siteUrl: resolveSiteUrl(),
    // Surfaced so a deployment can be proven to be in the right mode at a glance. A preview that
    // reports `live` is a preview that can mail a real collector.
    mode: resolveEmailMode(),
  };
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** One place that turns a rendered template into a Resend call. */
async function deliver(params: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  const client = getResendClient();
  const config = getEmailConfig();
  if (!client || !config.configured) {
    return { success: false, error: 'Resend API key is not configured' };
  }

  // Route before handing anything to the provider: on a preview deployment the recipients are
  // replaced, and a redirect with no destination suppresses the message instead of delivering it.
  const routed = applyEmailRouting(params);
  if (routed.suppressed) {
    console.warn('[Resend Email] suppressed:', routed.reason);
    return { success: false, error: routed.reason };
  }

  try {
    const { data, error } = await client.emails.send({
      from: config.fromAddress,
      to: routed.to,
      replyTo: params.replyTo,
      subject: routed.subject,
      html: routed.html,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Email delivery failed' };
  }
}

/**
 * Send an email notification to the studio admin when a new collector inquiry is received.
 */
export async function sendInquiryNotificationToStudio(inquiry: {
  name: string;
  email: string;
  phone?: string | null;
  artwork_title?: string | null;
  artwork_slug?: string | null;
  inquiry_type?: string | null;
  message: string;
  id?: string;
}): Promise<SendResult> {
  const config = getEmailConfig();
  const client = getResendClient();

  if (!client || !config.configured) {
    console.log('[Resend Email] API key not configured, skipping studio email dispatch.');
    return { success: false, error: 'Resend API key is not configured' };
  }

  // Env-driven (`ADMIN_EMAIL` + `STUDIO_CC`) — see server/lib/emailRouting.ts.
  const recipients = resolveStudioRecipients();

  const subject = `New Collector Inquiry: ${inquiry.artwork_title ? `"${inquiry.artwork_title}"` : (inquiry.inquiry_type || 'General Inquiry')} — from ${inquiry.name}`;

  const field = (label: string, value: string, href?: string) => `
    <tr>
      <td style="padding:0 0 12px;">
        <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#666666;margin-bottom:4px;">${label}</div>
        <div style="font-size:15px;font-weight:500;color:${BRAND.ink};">${
          href
            ? `<a href="${href}" style="color:#0066cc;text-decoration:none;">${value}</a>`
            : value
        }</div>
      </td>
    </tr>`;

  const html = renderBrandedEmail({
    heading: 'New Art Acquisition &amp; Collector Inquiry',
    eyebrow: 'Collector inquiry',
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        ${field('Collector name', escapeHtml(inquiry.name))}
        ${field('Collector email', escapeHtml(inquiry.email), `mailto:${escapeHtml(inquiry.email)}`)}
        ${inquiry.phone ? field('Phone number', escapeHtml(inquiry.phone), `tel:${escapeHtml(inquiry.phone)}`) : ''}
        ${field(
          'Target artwork / inquiry type',
          `<strong>${escapeHtml(inquiry.artwork_title || 'General Studio Inquiry')}</strong>${
            inquiry.artwork_slug
              ? ` <span style="font-size:12px;color:#888;">(${escapeHtml(inquiry.artwork_slug)})</span>`
              : ''
          }`
        )}
      </table>
      <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#666666;margin:8px 0 6px;">Collector message</div>
      <div style="background:#fbfbf9;border-left:3px solid ${BRAND.ink};padding:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;color:${BRAND.ink};">${escapeHtml(inquiry.message)}</div>
      <p style="font-size:12px;color:#777;margin:20px 0 0;">
        Reply directly to this email to answer <strong>${escapeHtml(inquiry.email)}</strong>.
      </p>`,
    note: inquiry.id ? `Inquiry reference: ${escapeHtml(inquiry.id)}` : undefined,
  });

  const result = await deliver({
    to: recipients,
    replyTo: inquiry.email,
    subject,
    html,
  });

  if (result.success) {
    console.log('[Resend Email] Successfully sent studio inquiry notification. Message ID:', result.messageId);
  } else {
    console.error('[Resend Email] Failed to send inquiry notification:', result.error);
  }
  return result;
}

/**
 * Send an automated confirmation receipt email to the collector.
 */
export async function sendInquiryConfirmationToCollector(inquiry: {
  name: string;
  email: string;
  artwork_title?: string | null;
}): Promise<SendResult> {
  const config = getEmailConfig();
  const artworkMention = inquiry.artwork_title
    ? `regarding “${escapeHtml(inquiry.artwork_title)}”`
    : 'with our studio';

  const html = renderBrandedEmail({
    heading: 'Thank you for your inquiry',
    eyebrow: 'Message received',
    intro: `Dear ${escapeHtml(inquiry.name)},`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Thank you for contacting ${BRAND.studio} ${artworkMention}. We have received your inquiry and our studio team will review the details and get back to you shortly.</p>
      <p style="margin:0 0 16px;">In the meantime, feel free to explore the master gallery catalog online.</p>
      <p style="margin:24px 0 0;">Warm regards,<br><strong>${BRAND.studio}</strong><br><span style="font-size:12px;color:#777;">${BRAND.city}</span></p>`,
    cta: { label: 'Browse the gallery', url: `${config.siteUrl}/#catalog` },
    note: 'You are receiving this because you contacted us through roryskagenart.com.',
  });

  const result = await deliver({
    to: [inquiry.email],
    replyTo: config.adminEmail,
    subject: `Thank you for your inquiry — ${BRAND.studio}`,
    html,
  });

  if (!result.success) {
    console.warn('[Resend Email] Notice sending collector confirmation:', result.error);
  }
  return result;
}

/** Studio staff invitation — the branded replacement for Supabase's default mailer. */
export async function sendInviteEmail(params: {
  to: string;
  name?: string | null;
  role?: string | null;
  actionUrl: string;
  invitedBy?: string | null;
}): Promise<SendResult> {
  return deliver({
    to: [params.to],
    subject: `You're invited to the ${BRAND.name} studio`,
    html: renderInviteEmail({
      email: params.to,
      name: params.name,
      role: params.role,
      actionUrl: params.actionUrl,
      invitedBy: params.invitedBy,
    }),
  });
}

/** Admin-triggered password reset. */
export async function sendPasswordResetEmail(params: {
  to: string;
  name?: string | null;
  actionUrl: string;
  requestedBy?: string | null;
}): Promise<SendResult> {
  return deliver({
    to: [params.to],
    subject: `Reset your ${BRAND.name} studio password`,
    html: renderPasswordResetEmail({
      email: params.to,
      name: params.name,
      actionUrl: params.actionUrl,
      requestedBy: params.requestedBy,
    }),
  });
}

/** Tell a user their role or active state changed. Best-effort. */
export async function sendAccessChangedEmail(params: {
  to: string;
  name?: string | null;
  role: string;
  active: boolean;
  changedBy?: string | null;
}): Promise<SendResult> {
  return deliver({
    to: [params.to],
    subject: params.active
      ? `Your ${BRAND.name} studio access was updated`
      : `Your ${BRAND.name} studio access was paused`,
    html: renderAccessChangedEmail({
      email: params.to,
      name: params.name,
      role: params.role,
      active: params.active,
      changedBy: params.changedBy,
    }),
  });
}

/** Tell a user their studio email address changed. Best-effort. */
export async function sendEmailChangedEmail(params: {
  to: string;
  name?: string | null;
  previousEmail?: string | null;
  changedBy?: string | null;
}): Promise<SendResult> {
  return deliver({
    to: [params.to],
    subject: `Your ${BRAND.name} studio email address was updated`,
    html: renderEmailChangedEmail({
      email: params.to,
      name: params.name,
      previousEmail: params.previousEmail,
      changedBy: params.changedBy,
    }),
  });
}

/**
 * The batched planning digest — one email for every unreported public submission.
 *
 * `v3.2.0` item 6. Called only by the scheduled route, never from the public intake door: mail
 * belongs off the request path, both because a provider timeout must not slow an anonymous
 * submitter and because P-04 is precisely about a public endpoint that sends mail.
 *
 * `total` is passed separately from `items.length` so the subject and the "showing N of M" line
 * stay honest when the batch is larger than one email renders.
 */
export async function sendPlanDigestEmail(params: {
  items: PlanDigestItem[];
  total: number;
}): Promise<SendResult> {
  const { items, total } = params;
  const siteUrl = resolveSiteUrl();
  const recipients = resolveStudioRecipients();

  return deliver({
    to: recipients,
    subject: planDigestSubject(total),
    html: renderPlanDigestEmail({
      items,
      total,
      boardUrl: `${siteUrl}/#/admin/planning`,
    }),
  });
}

/**
 * Send a verification/test email via Resend to verify delivery.
 */export async function sendTestVerificationEmail(toEmail: string): Promise<SendResult> {
  const config = getEmailConfig();
  return deliver({
    to: [toEmail],
    subject: `${BRAND.name} — Resend delivery verified`,
    html: renderTestEmail({ domain: config.domain, fromAddress: config.fromAddress }),
  });
}
