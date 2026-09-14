import { describe, it, expect, afterEach } from 'vitest';
import {
  renderAccessChangedEmail,
  renderInviteEmail,
  renderPasswordResetEmail,
  renderBrandedEmail,
  renderTestEmail,
  resolveBrandLogoUrl,
  resolveSiteUrl,
} from '../../server/emailTemplates';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/**
 * Regression guard for the studio's request that every system email carry the
 * Rory Skagen Art brand. Before v2.11.0 the invite mail was Supabase's default
 * template, which said "Supabase Auth" and showed a grey question-mark avatar.
 */
describe('branded email shell', () => {
  it('puts the brand name, mark and studio footer on every message', () => {
    const html = renderBrandedEmail({ heading: 'Hello' });

    expect(html).toContain('Rory Skagen Art');
    expect(html).toContain('roryskagenart.com');
    expect(html).toContain('Austin, Texas');
    expect(html).toContain('<img');
    expect(html).toContain('alt="Rory Skagen Art"');
  });

  it('never mentions the platform vendor in a user-facing message', () => {
    for (const html of [
      renderInviteEmail({ email: 'a@b.com', actionUrl: 'https://x/y' }),
      renderPasswordResetEmail({ email: 'a@b.com', actionUrl: 'https://x/y' }),
      renderAccessChangedEmail({ email: 'a@b.com', role: 'editor', active: true }),
      renderTestEmail({ domain: 'roryskagenart.com', fromAddress: 'studio@roryskagenart.com' }),
    ]) {
      expect(html).not.toMatch(/Supabase/i);
    }
  });

  it('uses an absolute logo URL — email clients cannot resolve relative paths', () => {
    process.env.SITE_URL = 'https://roryskagenart.com';
    expect(resolveBrandLogoUrl()).toBe('https://roryskagenart.com/android-chrome-192x192.png');
  });

  it('honours a logo override', () => {
    process.env.BRAND_LOGO_URL = 'https://cdn.example.com/logo.png';
    expect(resolveBrandLogoUrl()).toBe('https://cdn.example.com/logo.png');
  });

  it('defaults the site URL when the environment is silent', () => {
    delete process.env.SITE_URL;
    delete process.env.PUBLIC_SITE_URL;
    delete process.env.VITE_SITE_URL;
    expect(resolveSiteUrl()).toBe('https://roryskagenart.com');
  });

  it('strips a trailing slash from the configured site URL', () => {
    process.env.SITE_URL = 'https://staging.roryskagenart.com/';
    expect(resolveSiteUrl()).toBe('https://staging.roryskagenart.com');
  });
});

describe('staff invitation email', () => {
  const invite = renderInviteEmail({
    email: 'curator@roryskagenart.com',
    name: 'Studio Curator',
    role: 'editor',
    actionUrl: 'https://project.supabase.co/auth/v1/verify?token=abc&type=invite',
    invitedBy: 'admin@roryskagenart.com',
  });

  it('greets the invitee by name and states their role', () => {
    expect(invite).toContain('Studio Curator');
    expect(invite).toContain('Editor');
  });

  it('carries the action link as a button and as a copyable fallback', () => {
    const link = 'https://project.supabase.co/auth/v1/verify?token=abc&type=invite';
    expect(invite).toContain(link);
    expect(invite).toMatch(/Set my password/);
    expect(invite).toMatch(/Copy and paste this link/i);
  });

  it('names the inviter and warns the recipient about unexpected mail', () => {
    expect(invite).toContain('admin@roryskagenart.com');
    expect(invite).toMatch(/safely ignore/i);
  });

  it('escapes a name that contains markup', () => {
    const nasty = renderInviteEmail({
      email: 'a@b.com',
      name: '<script>alert(1)</script>',
      actionUrl: 'https://x/y',
    });
    expect(nasty).not.toContain('<script>');
    expect(nasty).toContain('&lt;script&gt;');
  });

  it('falls back to a generic greeting when no name is known', () => {
    expect(renderInviteEmail({ email: 'a@b.com', actionUrl: 'https://x/y' })).toContain('Hello,');
  });
});

describe('password reset email', () => {
  const reset = renderPasswordResetEmail({
    email: 'curator@roryskagenart.com',
    name: 'Studio Curator',
    actionUrl: 'https://project.supabase.co/auth/v1/verify?token=abc&type=recovery',
    requestedBy: 'admin@roryskagenart.com',
  });

  it('explains that the old password keeps working if the request was not theirs', () => {
    expect(reset).toMatch(/current password will keep working/i);
  });

  it('credits the administrator who triggered it', () => {
    expect(reset).toContain('admin@roryskagenart.com');
  });
});
