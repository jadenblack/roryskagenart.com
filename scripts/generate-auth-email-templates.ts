/**
 * Generate the branded Supabase Auth mailer templates.
 *
 * Supabase renders its own auth emails (invite, confirm signup, magic link,
 * password recovery, email change, reauthentication) from templates stored in
 * the project's Auth settings — not from this repo. Those templates are
 * unbranded by default, which is why invited studio members received a plain
 * "Supabase Auth" message.
 *
 * This script renders the same branded shell used by `server/emailTemplates.ts`
 * into paste-ready HTML files under `supabase/email-templates/`, so the brand
 * lives in version control even though the mailer does not read from it.
 *
 * Usage:  npx tsx scripts/generate-auth-email-templates.ts
 * Then:   paste each file into Supabase → Authentication → Emails
 *         (see docs/runbooks/supabase-email-branding.md)
 */

import fs from 'node:fs';
import path from 'node:path';
import { renderBrandedEmail } from '../server/emailTemplates';

const OUT_DIR = path.resolve(process.cwd(), 'supabase', 'email-templates');

interface AuthTemplate {
  file: string;
  /** Supabase dashboard template name. */
  dashboardName: string;
  /** Suggested subject line (set alongside the body in the dashboard). */
  subject: string;
  heading: string;
  eyebrow: string;
  intro: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaFallbackNote?: string;
  note: string;
  /** Variables this template may reference — surfaced in the file header. */
  variables: string[];
}

const TEMPLATES: AuthTemplate[] = [
  {
    file: 'invite-user.html',
    dashboardName: 'Invite user',
    subject: "You're invited to the Rory Skagen Art studio",
    heading: "You're invited to the Rory Skagen Art studio",
    eyebrow: 'Studio invitation',
    intro: 'Hello{{ if .Data.name }} {{ .Data.name }}{{ end }}, you have been invited to the studio workspace at roryskagenart.com.',
    bodyHtml: `
      <p style="margin:0 0 16px;">Choose a password to activate your account. The link below can only be used once and expires shortly, so please complete this step soon.</p>`,
    ctaLabel: 'Set my password',
    ctaUrl: '{{ .ConfirmationURL }}',
    ctaFallbackNote: 'Button not working? Copy and paste this link into your browser:',
    note: 'Sent to {{ .Email }}. If you were not expecting this invitation, you can safely ignore this email.',
    variables: ['{{ .ConfirmationURL }}', '{{ .Token }}', '{{ .TokenHash }}', '{{ .Email }}', '{{ .SiteURL }}', '{{ .RedirectTo }}', '{{ .Data }}'],
  },
  {
    file: 'confirm-signup.html',
    dashboardName: 'Confirm sign up',
    subject: 'Confirm your Rory Skagen Art studio account',
    heading: 'Confirm your studio account',
    eyebrow: 'Confirm your email',
    intro: 'Hello{{ if .Data.name }} {{ .Data.name }}{{ end }}, please confirm your email address to finish setting up your studio account.',
    bodyHtml: `
      <p style="margin:0 0 16px;">If you did not create an account, no further action is required.</p>`,
    ctaLabel: 'Confirm my email',
    ctaUrl: '{{ .ConfirmationURL }}',
    ctaFallbackNote: 'Button not working? Copy and paste this link into your browser:',
    note: 'Sent to {{ .Email }}.',
    variables: ['{{ .ConfirmationURL }}', '{{ .Token }}', '{{ .TokenHash }}', '{{ .Email }}', '{{ .SiteURL }}', '{{ .RedirectTo }}', '{{ .Data }}'],
  },
  {
    file: 'magic-link.html',
    dashboardName: 'Magic link or OTP',
    subject: 'Your Rory Skagen Art sign-in link',
    heading: 'Your studio sign-in link',
    eyebrow: 'One-time sign-in',
    intro: 'Use the link below to sign in to the studio workspace. It can only be used once.',
    bodyHtml: `
      <p style="margin:0 0 16px;">If you prefer, you can enter this one-time code instead:</p>
      <div style="font-family:'Courier New',Courier,monospace;font-size:26px;letter-spacing:0.32em;font-weight:bold;color:#111111;background:#fbfbf9;border:1px solid #e5e5e0;padding:16px;text-align:center;">{{ .Token }}</div>`,
    ctaLabel: 'Sign in to the studio',
    ctaUrl: '{{ .ConfirmationURL }}',
    ctaFallbackNote: 'Button not working? Copy and paste this link into your browser:',
    note: 'If you did not request this link, you can safely ignore this email.',
    variables: ['{{ .ConfirmationURL }}', '{{ .Token }}', '{{ .TokenHash }}', '{{ .Email }}', '{{ .SiteURL }}', '{{ .RedirectTo }}'],
  },
  {
    file: 'change-email.html',
    dashboardName: 'Change email address',
    subject: 'Confirm your new Rory Skagen Art email address',
    heading: 'Confirm your new email address',
    eyebrow: 'Email change',
    intro: 'Follow the link below to confirm your new studio email address.',
    bodyHtml: `
      <p style="margin:0 0 16px;">Your account email will change from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong> once confirmed.</p>`,
    ctaLabel: 'Confirm new email',
    ctaUrl: '{{ .ConfirmationURL }}',
    ctaFallbackNote: 'Button not working? Copy and paste this link into your browser:',
    note: 'If you did not request this change, contact a studio administrator.',
    variables: ['{{ .ConfirmationURL }}', '{{ .Token }}', '{{ .TokenHash }}', '{{ .Email }}', '{{ .NewEmail }}', '{{ .SiteURL }}', '{{ .RedirectTo }}'],
  },
  {
    file: 'reset-password.html',
    dashboardName: 'Reset password',
    subject: 'Reset your Rory Skagen Art studio password',
    heading: 'Reset your studio password',
    eyebrow: 'Password reset',
    intro: 'A password reset was requested for your Rory Skagen Art studio account.',
    bodyHtml: `
      <p style="margin:0 0 16px;">Click the button below to choose a new password. This link can only be used once and expires shortly.</p>
      <p style="margin:0 0 16px;">If you did not request this, you can ignore this email — your current password will keep working.</p>`,
    ctaLabel: 'Choose a new password',
    ctaUrl: '{{ .ConfirmationURL }}',
    ctaFallbackNote: 'Button not working? Copy and paste this link into your browser:',
    note: 'Sent to {{ .Email }}.',
    variables: ['{{ .ConfirmationURL }}', '{{ .Token }}', '{{ .TokenHash }}', '{{ .Email }}', '{{ .SiteURL }}', '{{ .RedirectTo }}'],
  },
  {
    file: 'reauthentication.html',
    dashboardName: 'Reauthentication',
    subject: 'Your Rory Skagen Art verification code',
    heading: 'Confirm it is you',
    eyebrow: 'Verification code',
    intro: 'Enter this one-time code to continue.',
    bodyHtml: `
      <div style="font-family:'Courier New',Courier,monospace;font-size:26px;letter-spacing:0.32em;font-weight:bold;color:#111111;background:#fbfbf9;border:1px solid #e5e5e0;padding:16px;text-align:center;">{{ .Token }}</div>`,
    ctaLabel: '',
    ctaUrl: '',
    note: 'If you did not request this code, you can safely ignore this email.',
    variables: ['{{ .Token }}', '{{ .Email }}', '{{ .SiteURL }}'],
  },
];

function header(t: AuthTemplate): string {
  return `<!--
  Rory Skagen Art — Supabase Auth mailer template: ${t.dashboardName}
  ---------------------------------------------------------------
  Generated by scripts/generate-auth-email-templates.ts — do not hand-edit;
  change server/emailTemplates.ts and re-run the script instead.

  Where to paste: Supabase Dashboard → Authentication → Emails →
  "${t.dashboardName}" → Message body (and set the subject line below).

  Suggested subject: ${t.subject}

  Template variables available:
${t.variables.map((v) => `    - ${v}`).join('\n')}
-->
`;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest: { file: string; dashboardName: string; subject: string }[] = [];

  for (const t of TEMPLATES) {
    const html = renderBrandedEmail({
      heading: t.heading,
      eyebrow: t.eyebrow,
      intro: t.intro,
      bodyHtml: t.bodyHtml,
      cta: t.ctaUrl ? { label: t.ctaLabel, url: t.ctaUrl } : undefined,
      ctaFallbackNote: t.ctaFallbackNote,
      note: t.note,
    });

    fs.writeFileSync(path.join(OUT_DIR, t.file), header(t) + html, 'utf8');
    manifest.push({ file: t.file, dashboardName: t.dashboardName, subject: t.subject });
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(
      {
        generatedBy: 'scripts/generate-auth-email-templates.ts',
        brand: 'Rory Skagen Art',
        logo: `${process.env.SITE_URL || 'https://roryskagenart.com'}/android-chrome-192x192.png`,
        templates: manifest,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  console.log(`Wrote ${manifest.length} branded auth templates to ${OUT_DIR}`);
  for (const m of manifest) console.log(`  · ${m.dashboardName} → ${m.file}`);
}

main();
