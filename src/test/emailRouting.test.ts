import { describe, it, expect } from 'vitest';
import {
  applyEmailRouting,
  parseAddressList,
  resolveEmailMode,
  resolveStudioRecipients,
} from '../../server/lib/emailRouting';

/**
 * These guards exist because a preview deployment shares the production database and the
 * production contact list. The invariant under test: **no code path may hand a real collector's
 * address to the provider from a non-production environment.** Each failure mode below is proven
 * to fail — mode inference, suppression, and recipient replacement are all asserted, not assumed.
 */

const email = { to: ['collector@example.com'], subject: 'Thank you for your inquiry', html: '<html><body>Hi</body></html>' };

describe('resolveEmailMode', () => {
  it('honours an explicit mode', () => {
    expect(resolveEmailMode({ EMAIL_MODE: 'off' })).toBe('off');
    expect(resolveEmailMode({ EMAIL_MODE: 'REDIRECT' })).toBe('redirect');
  });

  it('defaults production to live and every preview to redirect', () => {
    expect(resolveEmailMode({ VERCEL_ENV: 'production' })).toBe('live');
    expect(resolveEmailMode({ VERCEL_ENV: 'preview' })).toBe('redirect');
    expect(resolveEmailMode({})).toBe('live'); // local dev keeps sending real mail
  });

  it('treats an unrecognised mode as redirect rather than live', () => {
    // A typo must not silently re-enable real delivery.
    expect(resolveEmailMode({ EMAIL_MODE: 'lve' })).toBe('redirect');
  });
});

describe('parseAddressList', () => {
  it('splits, trims and de-duplicates case-insensitively', () => {
    expect(parseAddressList(' a@b.com , c@d.com;;A@B.COM ')).toEqual(['a@b.com', 'c@d.com']);
    expect(parseAddressList('')).toEqual([]);
    expect(parseAddressList(undefined)).toEqual([]);
  });
});

describe('applyEmailRouting — live', () => {
  it('passes the message through untouched and records the original recipients', () => {
    const routed = applyEmailRouting(email, { EMAIL_MODE: 'live' });
    expect(routed.suppressed).toBe(false);
    expect(routed.to).toEqual(['collector@example.com']);
    expect(routed.subject).toBe('Thank you for your inquiry');
    expect(routed.originalTo).toEqual(['collector@example.com']);
  });
});

describe('applyEmailRouting — redirect', () => {
  it('replaces the recipient, flags the subject and names who was originally addressed', () => {
    const routed = applyEmailRouting(email, {
      EMAIL_MODE: 'redirect',
      EMAIL_REDIRECT_TO: 'qa@ventureio.com',
    });
    expect(routed.to).toEqual(['qa@ventureio.com']);
    expect(routed.to).not.toContain('collector@example.com');
    expect(routed.subject).toBe('[PREVIEW] Thank you for your inquiry');
    expect(routed.html).toContain('Test message from a non-production environment');
    expect(routed.html).toContain('collector@example.com');
    expect(routed.suppressed).toBe(false);
  });

  it('puts the banner inside <body> so it renders first', () => {
    const routed = applyEmailRouting(email, {
      EMAIL_MODE: 'redirect',
      EMAIL_REDIRECT_TO: 'qa@ventureio.com',
    });
    expect(routed.html.indexOf('non-production environment')).toBeGreaterThan(routed.html.indexOf('<body'));
    expect(routed.html).toMatch(/<body><div style="background:#fff4d6/);
  });

  it('still carries the banner when a template has no <body> tag', () => {
    const routed = applyEmailRouting(
      { to: 'a@b.com', subject: 's', html: '<div>fragment</div>' },
      { EMAIL_MODE: 'redirect', EMAIL_REDIRECT_TO: 'qa@ventureio.com' }
    );
    expect(routed.html.startsWith('<div style="background:#fff4d6')).toBe(true);
    expect(routed.html).toContain('<div>fragment</div>');
  });

  it('supports several redirect targets', () => {
    const routed = applyEmailRouting(email, {
      EMAIL_MODE: 'redirect',
      EMAIL_REDIRECT_TO: 'qa@ventureio.com, dev@ventureio.com',
    });
    expect(routed.to).toEqual(['qa@ventureio.com', 'dev@ventureio.com']);
  });
});

describe('applyEmailRouting — fail-closed', () => {
  it('suppresses instead of delivering when redirect has no destination', () => {
    const routed = applyEmailRouting(email, { EMAIL_MODE: 'redirect' });
    expect(routed.suppressed).toBe(true);
    expect(routed.reason).toMatch(/EMAIL_REDIRECT_TO/);
    // The critical assertion: a misconfigured redirect must never fall back to the real recipient.
    expect(routed.to).toEqual(['collector@example.com']); // untouched, but `suppressed` stops the send
  });

  it('suppresses everything in off mode', () => {
    const routed = applyEmailRouting(email, { EMAIL_MODE: 'off' });
    expect(routed.suppressed).toBe(true);
    expect(routed.reason).toMatch(/EMAIL_MODE=off/);
  });

  it('never reports suppressed as deliverable', () => {
    for (const env of [{ EMAIL_MODE: 'off' }, { EMAIL_MODE: 'redirect' }]) {
      expect(applyEmailRouting(email, env).suppressed).toBe(true);
    }
  });
});

describe('resolveStudioRecipients', () => {
  it('uses ADMIN_EMAIL plus STUDIO_CC', () => {
    expect(
      resolveStudioRecipients({ ADMIN_EMAIL: 'studio@roryskagenart.com', STUDIO_CC: 'ops@x.com' })
    ).toEqual(['studio@roryskagenart.com', 'ops@x.com']);
  });

  it('falls back to the historical defaults when the environment is silent', () => {
    expect(resolveStudioRecipients({})).toEqual(['rory@ventureio.com', 'jaden@venturepilot.org']);
  });

  it('lets a studio drop the copied address by setting STUDIO_CC empty', () => {
    expect(resolveStudioRecipients({ ADMIN_EMAIL: 'a@b.com', STUDIO_CC: '' })).toEqual(['a@b.com']);
  });

  it('de-duplicates the primary address out of the copy list', () => {
    expect(resolveStudioRecipients({ ADMIN_EMAIL: 'a@b.com', STUDIO_CC: 'A@B.com' })).toEqual(['a@b.com']);
  });
});
