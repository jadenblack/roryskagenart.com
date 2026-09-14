/**
 * Verification for Resend webhook deliveries (Svix-style signatures).
 *
 * WHY NOT A DEPENDENCY
 * Resend signs with Svix, and the check is ~20 lines of HMAC-SHA256: the signed payload is
 * `${id}.${timestamp}.${rawBody}`, keyed by the base64 secret that follows the `whsec_` prefix.
 * Pulling in `svix` (or `standardwebhooks`) for that would add an SDK to a repo that already has
 * one vendor SDK too many — and would put a third party between us and a security check.
 *
 * The verification is constant-time and timestamp-bounded, because a signature that never expires
 * is a replay oracle.
 *
 * ⚠️ The signature covers the **raw** request body. Any middleware that parses JSON before this
 * runs will invalidate it — mount the route with `express.raw()`.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/** Default replay window. Svix recommends five minutes. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export interface WebhookHeaders {
  'svix-id'?: string;
  'svix-timestamp'?: string;
  'svix-signature'?: string;
}

/**
 * NOT a discriminated union on `ok`: this project compiles without `strictNullChecks`, which widens
 * `ok: true | false` to `boolean` and leaves the union non-discriminated — so narrowing would not
 * work and callers could not read `reason`. A single shape with an optional reason avoids that trap.
 */
export interface WebhookVerification {
  ok: boolean;
  /** Always present when `ok` is false. */
  reason?: string;
}

/** `v1,<base64> v1,<base64>` → the base64 digests only, ignoring unknown versions. */
export function parseSignatureHeader(header: string | undefined | null): string[] {
  if (!header) return [];
  return header
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice(3))
    .filter((digest) => digest.length > 0);
}

/** `whsec_<base64>` → raw key bytes. A secret without the prefix is used as-is (base64-decoded). */
function secretKey(secret: string): Buffer {
  const raw = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  return Buffer.from(raw, 'base64');
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyResendWebhook(input: {
  payload: string | Buffer;
  headers: WebhookHeaders;
  secret: string | undefined;
  now?: Date;
  toleranceSeconds?: number;
}): WebhookVerification {
  const { payload, headers, secret } = input;
  // Fail closed: without a configured secret nothing can be proven, so nothing is trusted.
  if (!secret || secret.trim() === '') {
    return { ok: false, reason: 'RESEND_WEBHOOK_SECRET is not configured.' };
  }

  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signature = headers['svix-signature'];
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: 'Missing svix-id, svix-timestamp or svix-signature header.' };
  }

  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const sentAtSeconds = Number(timestamp);
  if (!Number.isFinite(sentAtSeconds)) {
    return { ok: false, reason: 'svix-timestamp is not a number.' };
  }
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - sentAtSeconds) > tolerance) {
    return { ok: false, reason: `Timestamp outside the ${tolerance}s tolerance window.` };
  }

  const digests = parseSignatureHeader(signature);
  if (digests.length === 0) {
    return { ok: false, reason: 'No v1 signature found in svix-signature.' };
  }

  const body = typeof payload === 'string' ? payload : payload.toString('utf8');
  const expected = createHmac('sha256', secretKey(secret))
    .update(`${id}.${timestamp}.${body}`, 'utf8')
    .digest('base64');

  // Any one matching digest is enough — Svix sends several during secret rotation.
  const matched = digests.some((digest) => constantTimeEquals(digest, expected));
  return matched ? { ok: true } : { ok: false, reason: 'Signature mismatch.' };
}
