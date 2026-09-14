import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { classifyInquiryOutcome } from '../../server/lib/emailRouting';
import {
  parseSignatureHeader,
  verifyResendWebhook,
  DEFAULT_TOLERANCE_SECONDS,
} from '../../server/lib/webhookSignature';
import { dumpUtcDate, hasDumpForDate } from '../../server/lib/blobBackup';
const reasonOf = (r: { ok: boolean; reason?: string }): string => r.reason ?? '(unexpectedly verified)';

/** Build a real Svix-style signature so the verifier is tested against the algorithm, not a mock. */
function sign(payload: string, secret: string, id: string, timestampSeconds: number): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const digest = createHmac('sha256', key)
    .update(`${id}.${timestampSeconds}.${payload}`, 'utf8')
    .digest('base64');
  return `v1,${digest}`;
}

const SECRET = 'whsec_' + Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

describe('classifyInquiryOutcome', () => {
  it('reports sent only when both messages left', () => {
    expect(
      classifyInquiryOutcome({
        studio: { success: true, messageId: 's1' },
        collector: { success: true, messageId: 'c1' },
      })
    ).toEqual({ status: 'sent', studioId: 's1', collectorId: 'c1' });
  });

  it('reports partial and keeps the failing side’s error', () => {
    const record = classifyInquiryOutcome({
      studio: { success: true, messageId: 's1' },
      collector: { success: false, error: 'Resend 429' },
    });
    expect(record.status).toBe('partial');
    expect(record.error).toBe('Resend 429');
    expect(record.studioId).toBe('s1');
  });

  it('distinguishes a deliberate suppression from a provider failure', () => {
    // Conflating these is how a studio chases a bug that does not exist.
    const suppressed = classifyInquiryOutcome({
      studio: { success: false, error: 'Outbound email is disabled (EMAIL_MODE=off).' },
      collector: { success: false, error: 'Outbound email is disabled (EMAIL_MODE=off).' },
    });
    expect(suppressed.status).toBe('suppressed');

    const failed = classifyInquiryOutcome({
      studio: { success: false, error: 'Resend API key is not configured' },
      collector: { success: false, error: 'Resend API key is not configured' },
    });
    expect(failed.status).toBe('failed');
  });

  it('treats a missing redirect destination as suppression', () => {
    const record = classifyInquiryOutcome({
      studio: { success: false, error: 'EMAIL_MODE=redirect but EMAIL_REDIRECT_TO is not set — nothing was sent.' },
      collector: { success: false, error: 'EMAIL_MODE=redirect but EMAIL_REDIRECT_TO is not set — nothing was sent.' },
    });
    expect(record.status).toBe('suppressed');
  });
});

describe('Resend webhook signature', () => {
  const now = new Date('2026-09-14T21:00:00Z');
  const timestamp = Math.floor(now.getTime() / 1000);
  const payload = JSON.stringify({ type: 'email.bounced', data: { email_id: 'abc' } });

  const headers = (overrides: Record<string, string> = {}) => ({
    'svix-id': 'msg_1',
    'svix-timestamp': String(timestamp),
    'svix-signature': sign(payload, SECRET, 'msg_1', timestamp),
    ...overrides,
  });

  it('accepts a correctly signed request', () => {
    expect(verifyResendWebhook({ payload, headers: headers(), secret: SECRET, now }).ok).toBe(true);
  });

  it('rejects a tampered body', () => {
    const result = verifyResendWebhook({
      payload: payload.replace('bounced', 'delivered'),
      headers: headers(),
      secret: SECRET,
      now,
    });
    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/mismatch/i);
  });

  it('rejects a replayed (stale) signature', () => {
    const stale = timestamp - (DEFAULT_TOLERANCE_SECONDS + 60);
    const result = verifyResendWebhook({
      payload,
      headers: { 'svix-id': 'msg_1', 'svix-timestamp': String(stale), 'svix-signature': sign(payload, SECRET, 'msg_1', stale) },
      secret: SECRET,
      now,
    });
    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/tolerance/);
  });

  it('fails closed when the secret is unset — nothing is trusted', () => {
    const result = verifyResendWebhook({ payload, headers: headers(), secret: undefined, now });
    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/not configured/);
  });

  it('rejects missing headers', () => {
    const result = verifyResendWebhook({ payload, headers: {}, secret: SECRET, now });
    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/Missing/);
  });

  it('ignores unknown signature versions but still requires a v1 match', () => {
    const result = verifyResendWebhook({
      payload,
      headers: headers({ 'svix-signature': 'v2,not-a-v1-signature' }),
      secret: SECRET,
      now,
    });
    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/No v1 signature/);
  });

  it('parses a multi-value header (secret rotation)', () => {
    expect(parseSignatureHeader('v1,aaa v1,bbb v2,ccc')).toEqual(['aaa', 'bbb']);
    expect(parseSignatureHeader(undefined)).toEqual([]);
  });
});

describe('cron idempotency', () => {
  it('reads the UTC day from a stamp', () => {
    expect(dumpUtcDate('2026-09-14T20-08-20-091Z')).toBe('2026-09-14');
    expect(dumpUtcDate('nonsense')).toBeNull();
  });

  it('detects an existing dump for a given UTC day', () => {
    const dumps = [
      { name: '2026-09-14T20-08-20-091Z', createdAt: '2026-09-14T20:08:22Z' },
      { name: '2026-09-13T06-43-00-000Z', createdAt: '2026-09-13T06:43:00Z' },
    ];
    expect(hasDumpForDate(dumps, '2026-09-14')).toBe(true);
    expect(hasDumpForDate(dumps, '2026-09-15')).toBe(false);
  });

  it('does not let an interrupted run satisfy a day — otherwise no restorable dump is ever made', () => {
    // The realistic failure: a run dies mid-upload, leaving objects under today's stamp. If that
    // counted as "today is done", every later attempt that day would skip and the day would end
    // with nothing restorable.
    const dumps = [{ name: '2026-09-14T06-43-00-000Z', createdAt: '2026-09-14T06:43:00Z', files: 3, hasManifest: false }];
    expect(hasDumpForDate(dumps, '2026-09-14')).toBe(false);
  });
});
