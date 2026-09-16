/**
 * Scheduled planning digest — Vercel Cron → this route → one batched Resend email.
 *
 * Item 6 of `v3.2.0` in `plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md`: new public
 * submissions must reach the studio, **batched, not per row** (P-04). A public endpoint that
 * sends an email per submission is a way to spend the studio's Resend quota, and a spike of
 * form posts would be indistinguishable from a spike of mail.
 *
 * WHY THIS IS A CRON ROUTE AND NOT PART OF THE INTAKE DOOR.
 * Sending mail from `POST /api/plan/feedback` would put a third-party network call on an
 * anonymous request path: a slow provider becomes a slow form, and a provider error has to be
 * either swallowed or surfaced to someone who cannot act on it. Off the request path, a failed
 * run simply retries next time — nothing is lost, because the marker is written only on success.
 *
 * ⚠️ ITEM REPORTED ONCE, MARKED ONLY AFTER A SUCCESSFUL SEND.
 * The set is `source = 'public' AND status = 'new' AND notified_at IS NULL`. Marking before the
 * send would drop the item if the provider failed; marking after means a failure retries. An
 * item the studio has already triaged leaves the set on its own (`status` no longer `new`),
 * which is why this does not nag about things already handled.
 *
 * SECURITY — this endpoint can mail studio data, so it is gated on `CRON_SECRET` exactly like
 * the backup route, and it **fails closed** when the secret is unset. The response carries
 * counts only; no submission content ever appears in an HTTP response.
 */
import { Router } from 'express';
import { query } from '../../src/server/db';
import { cronAuthorized } from '../lib/cronAuth';
import { PLAN_DIGEST_COLUMNS, PLAN_DIGEST_LIMIT } from '../lib/planDigest';
import { sendPlanDigestEmail } from '../emailService';

const router = Router();

/**
 * The pending set.
 *
 * `notified_at` is the batch's memory. See `server/lib/planDigest.ts` for why it is not the
 * status, and `supabase/migrations/2026_09_16_v3_2_plan_items_notified_at.sql` for the column.
 */
const PENDING = `source = 'public' AND status = 'new' AND notified_at IS NULL`;

router.get('/plan-digest', async (req, res) => {
  const startedAt = Date.now();
  const auth = cronAuthorized(req);
  if (!auth.ok) {
    return res.status(auth.status ?? 401).json({ success: false, error: auth.error });
  }

  try {
    const counted = await query<{ total: number }>(
      `SELECT count(*)::int AS total FROM public.plan_items WHERE ${PENDING}`,
    );
    const total = Number(counted.rows[0]?.total ?? 0);

    // Nothing new is a success, not an error — a cron that reports failure every quiet day
    // trains the studio to ignore its alerts.
    if (total === 0) {
      return res.json({
        success: true,
        sent: false,
        reason: 'No unreported submissions.',
        total: 0,
        reported: 0,
        durationMs: Date.now() - startedAt,
      });
    }

    const items = await query(
      `SELECT ${PLAN_DIGEST_COLUMNS}
         FROM public.plan_items
        WHERE ${PENDING}
        ORDER BY created_at ASC
        LIMIT $1`,
      [PLAN_DIGEST_LIMIT],
    );

    const result = await sendPlanDigestEmail({ items: items.rows, total });
    if (!result.success) {
      console.error('[cron/plan-digest] send failed:', result.error);
      // 502, not 500: the failure is upstream of this route. The rows stay unmarked so the
      // next run retries them rather than losing the submissions.
      return res.status(502).json({ success: false, error: result.error, total });
    }

    const ids = items.rows.map((row: { id: string }) => row.id);
    // Still guarded on `notified_at IS NULL`: marking is idempotent, so an overlapping run
    // cannot overwrite a marker and cannot send the same item twice.
    await query(
      `UPDATE public.plan_items
          SET notified_at = now()
        WHERE id = ANY($1::uuid[])
          AND notified_at IS NULL`,
      [ids],
    );

    return res.json({
      success: true,
      sent: true,
      // `total` is everything waiting; `reported` is what this email rendered. They differ
      // when a batch exceeds PLAN_DIGEST_LIMIT, and the email says so rather than hiding it.
      total,
      reported: ids.length,
      messageId: result.messageId,
      durationMs: Date.now() - startedAt,
    });
  } catch (err: any) {
    console.error('[cron/plan-digest] failed:', err?.message ?? err);
    return res.status(500).json({ success: false, error: err?.message ?? 'Plan digest failed.' });
  }
});

export { router as planDigestRouter };
