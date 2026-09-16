/**
 * The shared gate for every scheduled route.
 *
 * One function, because there is now more than one cron route and a secret check copied twice
 * is a secret check that drifts: the second copy is written from memory, and the difference
 * between them is usually the one that fails open.
 *
 * FAILS CLOSED. An unset `CRON_SECRET` returns 503 rather than allowing the request. A
 * scheduled route that reads or mails studio data must be unreachable when its secret is
 * missing — a route that answers anyway is the same route without a gate.
 */
import { timingSafeEqual } from 'crypto';

export interface CronAuthResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * Check the `Authorization: Bearer $CRON_SECRET` header Vercel Cron sends.
 *
 * Compares lengths before `timingSafeEqual`, which throws on a length mismatch rather than
 * returning false.
 */
export function cronAuthorized(req: {
  get(name: string): string | undefined;
}): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: 'CRON_SECRET is not configured; scheduled endpoints are disabled.',
    };
  }

  const provided = Buffer.from(req.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, error: 'Unauthorized.' };
  }
  return { ok: true };
}
