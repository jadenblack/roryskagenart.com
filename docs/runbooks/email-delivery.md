# Runbook — Email delivery (Resend + Supabase Auth)

> Two independent mailers send mail for this project. Branding one does **not** brand the other.
> See [`supabase-email-branding.md`](./supabase-email-branding.md) for the second one.
>
> | Mailer | Owns | Controlled by |
> | :--- | :--- | :--- |
> | **Resend** | collector inquiries, studio notifications, staff invites, admin-issued password resets, access/email-change notices, test send | **this repo** — `server/emailService.ts`, `server/emailTemplates.ts`, `server/lib/emailRouting.ts` |
> | **Supabase Auth** | sign-up confirmation, magic link, reauthentication, dashboard fallback invites/resets | the Supabase dashboard only |

---

## 1. Verified account state (2026-09-14)

| Item | Value |
| :--- | :--- |
| Resend domain | `roryskagenart.com` — **status `verified`**, region `us-east-1`, sending enabled |
| Resend API keys | one: `roryskagen-resend` (created 2026-09-09) |
| Sender address | `Rory Skagen Art <studio@roryskagenart.com>` (from `RESEND_EMAIL_DOMAIN`) |
| Resend Free plan | 3,000 emails/month, **100/day**, 3 domains, 1 webhook endpoint, 30-day retention |
| Vercel env | `RESEND_API_KEY` + `RESEND_EMAIL_DOMAIN` in **Development only** (was: not in Production/Preview) |

The domain is already verified, so no DNS work is required. Production was simply missing the key.

---

## 2. Can Resend be used in production? — Yes

Resend is the right long-term mailer for this site and should stay.

- **Volume fits the free tier with enormous headroom.** 100 emails/day and 3,000/month against a
  gallery that receives a handful of inquiries a week. Nothing to upgrade.
- **The domain is verified**, DKIM/SPF/DMARC included, so `studio@roryskagenart.com` is deliverable
  and not spoofable.
- **It is already the only repo-controlled mailer**, already branded, and already covers every
  studio-visible message. Replacing it would mean rebuilding six templates for no gain.
- **Escape hatches exist.** The send path is one function (`deliver()` in
  `server/emailService.ts`), so switching provider is a contained change. If you ever need it:
  Postmark (best deliverability reputation, from $10/mo) or Amazon SES (cheapest at volume, more
  setup). Supabase's built-in SMTP is **not** a candidate — it is rate-limited to a few messages per
  hour on the free plan and cannot be branded from the repo.

**Upgrade triggers** (none expected): >100 emails/day → Pro ($20/mo, 50k/mo, no daily cap, 5
webhook endpoints); deliverability reputation problems at scale → dedicated IP (Scale + add-on).

### The real long-term live-site risk is *not* email

| Risk | Mitigation |
| :--- | :--- |
| **Supabase Free project pauses after 7 days idle** — first request after the pause is slow or errors | Supabase Pro ($25/mo), or accept it for a low-traffic gallery and keep the daily cron (which touches the DB) as a natural keep-alive |
| Supabase Free has **no automatic backups / no PITR** | the Vercel Cron → Vercel Blob dump; see [`database-backup-restore.md`](./database-backup-restore.md) |
| **Storage objects are excluded from Supabase DB backups** | no off-site image copy exists today; see the v3 review |
| Vercel Hobby: 1-hour runtime log retention, daily-only cron | make cron runs self-evidencing (§5) |

---

## 3. Environment matrix

| Variable | Development | Preview | Production |
| :--- | :--- | :--- | :--- |
| `RESEND_API_KEY` | ✅ (existing key) | ➕ optional | ✅ **dedicated production key** |
| `RESEND_EMAIL_DOMAIN` | `roryskagenart.com` | `roryskagenart.com` | `roryskagenart.com` |
| `EMAIL_MODE` | *(unset → live)* | `redirect` | `live` |
| `EMAIL_REDIRECT_TO` | – | `rory@ventureio.com` | – |
| `ADMIN_EMAIL` | – | – | `rory@ventureio.com` |
| `STUDIO_CC` | – | – | *(unset → legacy default)* |
| `SITE_URL` | – | – | `https://roryskagenart.com` |

### `EMAIL_MODE` semantics (`server/lib/emailRouting.ts`)

| Mode | Behaviour |
| :--- | :--- |
| `live` | deliver to the real recipients |
| `redirect` | deliver to `EMAIL_REDIRECT_TO`, subject prefixed `[PREVIEW]`, banner naming the original recipients |
| `off` | send nothing; the caller is told `success:false` with a reason |

Unset ⇒ inferred from `VERCEL_ENV`: `production → live`, `preview → redirect`, otherwise `live`
(so local development behaves as before).

⚠️ **`redirect` without `EMAIL_REDIRECT_TO` suppresses the message** — it does *not* fall back to
the real recipients. A missed notification is recoverable; emailing a collector from staging is not.

---

## 4. Go-live checklist (production)

```bash
# 1. Create a PRODUCTION-SCOPED key in Resend (dashboard → API Keys → Create).
#    Do not reuse the Development key: separate keys mean revoking one does not take down the
#    other, and usage stays attributable.

# 2. Add it to Vercel — the value is never echoed; paste it at the prompt.
vercel env add RESEND_API_KEY production
vercel env add RESEND_EMAIL_DOMAIN production      # roryskagenart.com
vercel env add EMAIL_MODE production               # live
vercel env add ADMIN_EMAIL production              # rory@ventureio.com
vercel env add SITE_URL production                 # https://roryskagenart.com

# 3. Belt and braces on Preview: even if a key is added there later, mail cannot reach collectors.
vercel env add EMAIL_MODE preview                  # redirect
vercel env add EMAIL_REDIRECT_TO preview           # rory@ventureio.com

# 4. Env changes only reach NEW deployments.
vercel ls roryskagen --yes                         # copy the production URL
vercel redeploy <production-deployment-url>

# 5. Verify
curl -s https://roryskagenart.com/api/email/status
# => {"success":true,"provider":"Resend","configured":true,"domain":"roryskagenart.com",
#     "mode":"live","apiKeyPresent":true}

# 6. End-to-end: #/admin (admin role) → Settings → send test email, or
#    curl -X POST -H "Authorization: Bearer <session>" /api/email/send-test
```

---

## 5. Verifying and troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `/api/email/status` → `configured:false` | `RESEND_API_KEY` missing in that environment | §4 step 2 + redeploy |
| `401`/`403` from Resend on send | key revoked, or wrong key | re-create the key; re-run §4 |
| `domain is not verified` | sending from a domain Resend does not hold | Resend → Domains → verify DNS |
| Everything goes to `onboarding@resend.dev` | **key missing** → the fallback From only reaches the account owner | set the key |
| Studio notified, collector not (or vice versa) | one send threw; both are now awaited and reported | check `email.studio` / `email.collector` in the response |
| Nothing arrives anywhere, no error | `EMAIL_MODE=redirect` with no `EMAIL_REDIRECT_TO` | set `EMAIL_REDIRECT_TO` or `EMAIL_MODE=live` |

**Hobby keeps runtime logs for one hour** — a failure overnight leaves no trace. Where to look:

1. `vercel logs https://roryskagenart.com` (recent only).
2. Resend dashboard → Emails (30-day retention on the free plan) — **the authoritative record**.
3. The inquiry row itself: `POST /api/inquiries` now returns
   `email: { studio: boolean, collector: boolean }`, and logs
   `[inquiries] studio notification FAILED:` when the studio copy does not go out.
4. `GET /api/email/status` for `configured` + `mode` (unauthenticated; publishes no addresses).

**Recommended next step:** add a Resend webhook (`POST /api/email/webhook`) recording
`delivered | bounced | complained` against a stored `messageId`. The free plan allows 1 endpoint.

---

## 6. Change log for this runbook

- 2026-09-14 — created. Fixes shipped with it: awaited sends + truthful `email` flags
  (`server/routes/inquiries.ts`), env-driven studio recipients, `EMAIL_MODE` routing
  (`server/lib/emailRouting.ts`, 16 new tests), trimmed public `/api/email/status`
  (`server.ts`), cron invocation logging (`server/routes/cronBackup.ts`).
