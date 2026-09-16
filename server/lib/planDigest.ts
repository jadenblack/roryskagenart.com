/**
 * The batched planning digest — the rules, separated from the mailer and from the route.
 *
 * Item 6 of `v3.2.0` in `plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md`. The requirement
 * is that new public submissions reach the studio **batched, not per row** (P-04): a public
 * endpoint that sends an email per submission is a way to spend the studio's Resend quota, and
 * a spike of form posts is indistinguishable from a spike of mail.
 *
 * The batching rule that falls out of that:
 *
 *   * the digest reports every public item that has never been reported (`notified_at IS NULL`),
 *     so an item is mailed **once** — not once per run until someone reads it;
 *   * it is marked only *after* a successful send, so a failed run retries rather than
 *     silently dropping the item;
 *   * it reports `status = 'new'` items only, because an item the studio has already triaged is
 *     not news.
 *
 * ⚠️ `notified_at` IS NOT "read". The unread badge in the nav counts `status = 'new'`; this
 * column counts "mailed". They are different facts and must not be conflated — an item can be
 * reported and still unread (the common case) or read and never reported (triaged before the
 * next run). See the migration that adds the column.
 */

/**
 * How many items one email will render.
 *
 * A digest is a summary, and an email that renders four hundred rows is an email nobody reads
 * — but truncating silently would be worse, so `renderPlanDigestEmail` states the remainder
 * explicitly and the rest stay on the board.
 */
export const PLAN_DIGEST_LIMIT = 25;

/** The subject line. Pure, so the route and its tests agree without sending anything. */
export function planDigestSubject(total: number): string {
  if (total <= 0) return 'No new feedback on the planning board';
  return total === 1
    ? '1 new submission on the planning board'
    : `${total} new submissions on the planning board`;
}

/**
 * The rows a digest run should report, oldest first.
 *
 * Oldest first on purpose: a digest that leads with the newest item pushes an older one further
 * down every run, and an old submission is the one most likely to be forgotten.
 */
export const PLAN_DIGEST_COLUMNS = `id, title, body, author_name, author_email, page_url,
       created_at`;
