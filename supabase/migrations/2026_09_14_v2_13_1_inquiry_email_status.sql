-- Record what actually happened to the two emails a collector inquiry triggers.
--
-- WHY THIS EXISTS
-- `POST /api/inquiries` stores the inquiry and then mails the studio and the collector. Until
-- v2.13.1 that result was thrown away: the response always claimed `emailDispatched: true`, so a
-- lost lead was indistinguishable from a delivered one, and the only evidence lived in Vercel
-- runtime logs — which the Hobby plan keeps for one hour.
--
-- These columns make delivery state part of the record, so the studio can see in
-- `#/admin -> Inquiries` that a collector was never notified, and a Resend webhook can later
-- correct `email_status` to `bounced` / `complained` by matching the stored message id.
--
-- Additive and idempotent: `ADD COLUMN IF NOT EXISTS`, no backfill, no constraint that could
-- reject an existing row. Safe to re-run.
--
-- FILENAME ORDERING: run-migrations.ts sorts by filename, so this must sort after
-- 2026_09_01_baseline_core_tables.sql. Enforced by src/test/migrationSafety.test.ts.

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'unknown';
-- Allowed values, enforced in application code rather than a CHECK so this migration can never
-- fail on an unexpected row:  unknown | sent | partial | failed | suppressed | bounced

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS email_error text;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

-- Resend message ids, so a webhook event can find the row it belongs to.
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS email_studio_id text;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS email_collector_id text;

COMMENT ON COLUMN public.inquiries.email_status IS
  'Outcome of the inquiry emails: unknown | sent | partial | failed | suppressed | bounced.';
COMMENT ON COLUMN public.inquiries.email_error IS
  'Last delivery error, if any. Surfaced in the studio UI so a lost lead is visible.';
