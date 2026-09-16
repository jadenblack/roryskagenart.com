-- ─────────────────────────────────────────────────────────────────────────────
-- v3.2.0 — Group: a batched digest needs to know what it has already reported
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Item 6 of the `v3.2.0` plan: a **batched** Resend digest to `ADMIN_EMAIL` for new public
-- submissions, rather than one message per submission. (P-04: a public endpoint that sends mail is
-- a way to spend the studio's Resend quota.)
--
-- WHY A COLUMN AND NOT "everything with `status = 'new'`".
-- Batching needs a memory of what has already been mailed. Selecting on `status = 'new'` alone
-- would re-send the same items on every run until someone triaged them — a daily email that says
-- the same thing until it is ignored, which is worse than no email. `notified_at` makes the digest
-- idempotent: an item is reported once. It also makes a missed run safe rather than lossy, since
-- an item that was never mailed stays un-notified instead of aging out of a time window.
--
-- WHY IT IS NOT THE STATUS. Triage and notification are different facts: an item can be reported
-- and still unread (`new` + a timestamp), or read and never reported (triaged before the next
-- digest run). Overloading `status` for both would make "has the studio seen this?" and "has the
-- studio been told?" the same question, and the whole point of the unread badge is that they
-- are not.

ALTER TABLE public.plan_items
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- The digest scans `source = 'public' AND notified_at IS NULL`, newest last, so the index matches
-- the query rather than the column. Partial: every row eventually leaves the set, so indexing the
-- notified ones would grow an index nothing reads.
CREATE INDEX IF NOT EXISTS plan_items_digest_pending_idx
  ON public.plan_items (created_at)
  WHERE source = 'public' AND notified_at IS NULL;

COMMENT ON COLUMN public.plan_items.notified_at IS
  'When the batched studio digest last reported this item. NULL = never reported. '
  'Set only by the digest run, never by a request.';
