import { Resend } from 'resend';

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
    ? `Rory Skagen Studio <studio@${domain}>`
    : 'Rory Skagen Studio <onboarding@resend.dev>';

  return {
    configured,
    domain,
    adminEmail,
    fromAddress,
  };
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
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getResendClient();
  const config = getEmailConfig();

  if (!client || !config.configured) {
    console.log('[Resend Email] API key not configured, skipping studio email dispatch.');
    return { success: false, error: 'Resend API key is not configured' };
  }

  const recipients = Array.from(
    new Set([config.adminEmail, 'jaden@venturepilot.org'].filter(Boolean))
  );

  const subject = `🎨 New Collector Inquiry: ${inquiry.artwork_title ? `"${inquiry.artwork_title}"` : (inquiry.inquiry_type || 'General Inquiry')} — from ${inquiry.name}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8f8f6; margin: 0; padding: 24px; color: #1a1a1a; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e0; border-radius: 4px; overflow: hidden; }
          .header { background: #111111; color: #ffffff; padding: 24px; border-bottom: 3px solid #d4af37; }
          .header h1 { margin: 0 0 4px; font-size: 18px; text-transform: uppercase; letter-spacing: 0.1em; font-family: monospace; }
          .header p { margin: 0; font-size: 12px; color: #a0a0a0; font-family: monospace; }
          .body { padding: 28px; }
          .field { margin-bottom: 16px; border-bottom: 1px solid #f0f0ec; padding-bottom: 12px; }
          .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #666666; font-family: monospace; margin-bottom: 4px; }
          .value { font-size: 15px; color: #111111; font-weight: 500; }
          .message-box { background: #fbfbf9; border-left: 3px solid #111111; padding: 16px; margin: 20px 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
          .footer { background: #f5f5f0; padding: 16px 28px; font-size: 11px; color: #888888; font-family: monospace; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Rory Skagen Studio</h1>
            <p>New Art Acquisition & Collector Inquiry</p>
          </div>
          <div class="body">
            <div class="field">
              <div class="label">Collector Name</div>
              <div class="value">${escapeHtml(inquiry.name)}</div>
            </div>
            <div class="field">
              <div class="label">Collector Email</div>
              <div class="value"><a href="mailto:${escapeHtml(inquiry.email)}" style="color: #0066cc; text-decoration: none;">${escapeHtml(inquiry.email)}</a></div>
            </div>
            ${inquiry.phone ? `
            <div class="field">
              <div class="label">Phone Number</div>
              <div class="value"><a href="tel:${escapeHtml(inquiry.phone)}" style="color: #0066cc; text-decoration: none;">${escapeHtml(inquiry.phone)}</a></div>
            </div>` : ''}
            <div class="field">
              <div class="label">Target Artwork / Inquiry Type</div>
              <div class="value"><strong>${escapeHtml(inquiry.artwork_title || 'General Studio Inquiry')}</strong> ${inquiry.artwork_slug ? `<span style="font-size: 12px; color: #888;">(Slug: ${escapeHtml(inquiry.artwork_slug)})</span>` : ''}</div>
            </div>
            <div class="label" style="margin-top: 20px;">Collector Message</div>
            <div class="message-box">${escapeHtml(inquiry.message)}</div>
            <p style="font-size: 12px; color: #777; margin-top: 20px;">
              You can respond directly to this collector by replying to <strong>${escapeHtml(inquiry.email)}</strong>.
            </p>
          </div>
          <div class="footer">
            Rory Skagen Studio • Austin, Texas • roryskagenart.com
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const { data, error } = await client.emails.send({
      from: config.fromAddress,
      to: recipients,
      replyTo: inquiry.email,
      subject,
      html,
    });

    if (error) {
      console.error('[Resend Email] Failed to send inquiry notification:', error);
      return { success: false, error: error.message };
    }

    console.log('[Resend Email] Successfully sent studio inquiry notification. Message ID:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Resend Email] Exception sending studio inquiry notification:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send an automated confirmation receipt email to the collector.
 */
export async function sendInquiryConfirmationToCollector(inquiry: {
  name: string;
  email: string;
  artwork_title?: string | null;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getResendClient();
  const config = getEmailConfig();

  if (!client || !config.configured) {
    return { success: false, error: 'Resend API key is not configured' };
  }

  const subject = `Thank you for your inquiry — Rory Skagen Studio`;
  const artworkMention = inquiry.artwork_title ? `regarding "${inquiry.artwork_title}"` : 'with our studio';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8f8f6; margin: 0; padding: 24px; color: #1a1a1a; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e0; border-radius: 4px; overflow: hidden; }
          .header { background: #111111; color: #ffffff; padding: 24px; border-bottom: 3px solid #d4af37; }
          .header h1 { margin: 0 0 4px; font-size: 18px; text-transform: uppercase; letter-spacing: 0.1em; font-family: monospace; }
          .body { padding: 28px; font-size: 14px; line-height: 1.6; color: #333333; }
          .footer { background: #f5f5f0; padding: 16px 28px; font-size: 11px; color: #888888; font-family: monospace; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Rory Skagen Studio</h1>
          </div>
          <div class="body">
            <p>Dear ${escapeHtml(inquiry.name)},</p>
            <p>Thank you for contacting Rory Skagen Studio ${escapeHtml(artworkMention)}. We have received your inquiry and our studio team will review the details and get back to you shortly.</p>
            <p>In the meantime, feel free to explore the master gallery catalog online at <a href="https://roryskagenart.com" style="color: #111111; font-weight: bold;">roryskagenart.com</a>.</p>
            <p style="margin-top: 24px;">
              Warm regards,<br>
              <strong>Rory Skagen Studio</strong><br>
              <span style="font-size: 12px; color: #777;">Austin, Texas</span>
            </p>
          </div>
          <div class="footer">
            Rory Skagen Studio • roryskagenart.com • Austin, Texas
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const { data, error } = await client.emails.send({
      from: config.fromAddress,
      to: [inquiry.email],
      replyTo: config.adminEmail,
      subject,
      html,
    });

    if (error) {
      console.warn('[Resend Email] Notice sending collector confirmation:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.warn('[Resend Email] Exception sending collector confirmation:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send a verification/test email via Resend to verify delivery.
 */
export async function sendTestVerificationEmail(toEmail: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const client = getResendClient();
  const config = getEmailConfig();

  if (!client || !config.configured) {
    return { success: false, error: 'Resend API key is not configured in environment' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: config.fromAddress,
      to: [toEmail],
      subject: `✅ Resend API Verified — Rory Skagen Studio`,
      html: `
        <div style="font-family: monospace; padding: 24px; background: #f8f8f6; border: 1px solid #ddd; max-width: 500px;">
          <h2 style="color: #111; margin-top: 0;">Rory Skagen Studio</h2>
          <p style="color: #2e7d32; font-weight: bold;">✅ Resend Email API is successfully configured and active.</p>
          <p><strong>Domain:</strong> ${escapeHtml(config.domain)}</p>
          <p><strong>From:</strong> ${escapeHtml(config.fromAddress)}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
