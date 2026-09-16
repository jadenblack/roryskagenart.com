import { describe, it, expect } from 'vitest';
import { planDigestSubject, PLAN_DIGEST_LIMIT } from '../../server/lib/planDigest';
import { renderPlanDigestEmail } from '../../server/emailTemplates';

/**
 * The batched planning digest — `v3.2.0` item 6.
 *
 * Two things are worth testing here and both are about the email lying to the studio:
 * untrusted text reaching HTML unescaped, and a truncated batch reading as the whole batch.
 */

const BOARD_URL = 'https://roryskagenart.com/#/admin/planning';

const item = (over: Partial<Parameters<typeof renderPlanDigestEmail>[0]['items'][number]> = {}) => ({
  title: 'A title',
  body: 'A body',
  author_name: null,
  author_email: null,
  page_url: null,
  created_at: '2026-09-16T10:00:00Z',
  ...over,
});

describe('planDigestSubject', () => {
  it('says there is nothing when there is nothing', () => {
    expect(planDigestSubject(0)).toMatch(/no new feedback/i);
  });

  it('is singular for one and plural otherwise', () => {
    expect(planDigestSubject(1)).toBe('1 new submission on the planning board');
    expect(planDigestSubject(7)).toBe('7 new submissions on the planning board');
  });
});

describe('renderPlanDigestEmail', () => {
  it('escapes the title and body, which a member of the public typed', () => {
    const html = renderPlanDigestEmail({
      items: [item({ title: '<script>alert(1)</script>', body: '<img src=x onerror=alert(1)>' })],
      total: 1,
      boardUrl: BOARD_URL,
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    // Not a bare '<img' — the shared shell's own brand logo is a legitimate <img>.
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    // The payload's *text* survives escaping — that is what escaping means, and it is inert.
    // What must not survive is the tag, so assert on the tag and not on the string.
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('truncates a long body instead of emailing a wall of text', () => {
    const html = renderPlanDigestEmail({
      items: [item({ body: 'x'.repeat(600) })],
      total: 1,
      boardUrl: BOARD_URL,
    });

    // 220 characters plus the ellipsis, and far short of the 600 submitted.
    expect(html).toContain('…');
    expect(html).not.toContain('x'.repeat(600));
  });

  it('says how many it left out, rather than implying the batch was complete', () => {
    const html = renderPlanDigestEmail({
      items: [item(), item({ title: 'Second' })],
      total: 9,
      boardUrl: BOARD_URL,
    });

    expect(html).toMatch(/showing 2 of 9/i);
  });

  it('does not claim a remainder when there is none', () => {
    const html = renderPlanDigestEmail({
      items: [item(), item({ title: 'Second' })],
      total: 2,
      boardUrl: BOARD_URL,
    });

    expect(html).not.toMatch(/showing/i);
  });

  it('links the studio to the board, and to the submitter when one was left', () => {
    const html = renderPlanDigestEmail({
      items: [item({ author_email: 'collector@example.com', author_name: 'A Collector' })],
      total: 1,
      boardUrl: BOARD_URL,
    });

    expect(html).toContain(BOARD_URL);
    expect(html).toContain('mailto:collector@example.com');
    expect(html).toContain('A Collector');
  });

  it('renders the limit as a real cap the route applies', () => {
    // The route passes LIMIT $1; this is only worth asserting so the constant cannot be
    // changed to something the email cannot render.
    expect(PLAN_DIGEST_LIMIT).toBeGreaterThan(0);
    expect(PLAN_DIGEST_LIMIT).toBeLessThanOrEqual(50);
  });
});
