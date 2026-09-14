# Runbook — Supabase Auth Email Branding

**Applies to:** the `roryskagenart.com` Supabase project (Auth mailer) and the studio's Resend
account.
**Owner:** Rory Skagen Studio Engineering.
**Related:** [`server/emailTemplates.ts`](../../server/emailTemplates.ts) ·
[`scripts/generate-auth-email-templates.ts`](../../scripts/generate-auth-email-templates.ts) ·
[`supabase/email-templates/`](../../supabase/email-templates/) · [`AGENTS.md`](../../AGENTS.md) §9

---

## 1. Why this document exists

Studio members invited from the Users screen received an email headed **"Supabase Auth"** with a
plain grey question-mark avatar and the line *"You're receiving this email because you signed up
for an application powered by Supabase."* Nothing about it said Rory Skagen Art.

There are **two different mailers** in this system, and they are configured in two different
places. Branding one does not brand the other.

| Mailer | Sends | Templates live in | Code controls it? |
| :--- | :--- | :--- | :--- |
| **Resend** (studio-owned) | Collector inquiry notifications, collector confirmations, **staff invitations**, **admin-triggered password resets**, delivery test | [`server/emailTemplates.ts`](../../server/emailTemplates.ts) | ✅ Yes — in this repo |
| **Supabase Auth** (platform-owned) | Confirm signup, invite, magic link, change email, reset password, reauthentication, security notifications | Supabase Dashboard → Authentication → Emails | ❌ No — dashboard config only |

**Design decision (v2.11.0):** staff invitations and admin password resets are now sent through
**Resend**, not through Supabase's mailer, so the studio fully controls their branding, sender
address and reply-to. Supabase's mailer templates are still branded via this runbook because they
remain the fallback path (`inviteUserByEmail`) and still fire for self-service flows such as
"forgot password" on the login screen.

---

## 2. Layer 1 — Resend templates (no action required)

Nothing to configure. `server/emailTemplates.ts` renders every studio email through one shared
shell: brand mark, wordmark, gold rule, footer. The only environment inputs are:

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `RESEND_API_KEY` | Enables sending at all. Without it every send is skipped and logged. | — |
| `RESEND_EMAIL_DOMAIN` | Domain in the `From:` address. | `roryskagenart.com` |
| `ADMIN_EMAIL` | Default studio recipient for inquiry notifications. | `rory@ventureio.com` |
| `SITE_URL` | Absolute origin used for every link and for the logo URL. | `https://roryskagenart.com` |
| `BRAND_LOGO_URL` | Override for the brand mark URL. | `${SITE_URL}/android-chrome-192x192.png` |

⚠️ **The logo must be an absolute, publicly reachable URL.** Email clients cannot resolve relative
paths, and most block remote images until the recipient allows them — which is why every `<img>`
carries explicit `width`/`height` and a text `alt`.

Verify delivery from the running server:

```bash
curl -s http://localhost:3000/api/email/test \
  -H "Authorization: Bearer <admin-jwt>" \
  -H 'Content-Type: application/json' \
  -d '{"to":"you@example.com"}'
```

---

## 3. Layer 2 — Supabase Auth templates (manual, one time)

The six branded templates are generated into [`supabase/email-templates/`](../../supabase/email-templates/).
They are **build artifacts** — never hand-edit them.

```bash
npx tsx scripts/generate-auth-email-templates.ts
```

### 3.1 Paste each template

For every row below: **Supabase Dashboard → Authentication → Emails → *[template]* → Message
body**, replace the contents with the file, and set the subject line.

| Dashboard template | File | Suggested subject |
| :--- | :--- | :--- |
| Invite user | `invite-user.html` | `You're invited to the Rory Skagen Art studio` |
| Confirm sign up | `confirm-signup.html` | `Confirm your Rory Skagen Art studio account` |
| Magic link or OTP | `magic-link.html` | `Your Rory Skagen Art sign-in link` |
| Change email address | `change-email.html` | `Confirm your new Rory Skagen Art email address` |
| Reset password | `reset-password.html` | `Reset your Rory Skagen Art studio password` |
| Reauthentication | `reauthentication.html` | `Your Rory Skagen Art verification code` |

Do **not** paste the leading `<!-- … -->` comment block — it documents the template and would be
rendered verbatim.

### 3.2 Set the sender identity

**Authentication → Emails → SMTP Settings** (or the project's custom SMTP section):

- **Sender name:** `Rory Skagen Art`
- **Sender email:** `studio@roryskagenart.com` — the address must be verified with the SMTP
  provider. Without custom SMTP, Supabase sends from `noreply@mail.app.supabase.io` and the
  branding work above is undermined at the From line, whatever the body says.

### 3.3 Set the redirect allow-list

**Authentication → URL Configuration:**

- **Site URL:** `https://roryskagenart.com`
- **Redirect URLs:** add `https://roryskagenart.com/**` and `http://localhost:3000/**` for local
  work.

⚠️ **Redirect targets must not contain a `#`.** The studio app is a hash-router SPA, and
`supabase-js` consumes the auth token from the URL fragment (`#access_token=…`). A redirect to
`https://roryskagenart.com/#/admin` produces `…/#/admin#access_token=…`, which the SDK cannot
parse — the session is silently dropped. Redirect to the **origin** (`https://roryskagenart.com`)
and let the app route the user onward; it detects the invite/recovery fragment and shows the
**Set your password** screen at `#/admin/set-password`.

---

## 4. Known limitations

| Limitation | Impact | Mitigation |
| :--- | :--- | :--- |
| Remote images blocked by default in most clients | Brand mark may not render on first open | Explicit `width`/`height` + text `alt`; the wordmark is also rendered as live text, so the email is never anonymous |
| Supabase security-notification emails (password changed, sign-in method added, …) are separate templates | Not yet branded | They are disabled unless explicitly enabled in the dashboard; if enabled, paste the same shell |
| No custom SMTP configured ⇒ `noreply@mail.app.supabase.io` sender | From line still shows Supabase | §3.2 |
| Studio invites now bypass Supabase's mailer | If `RESEND_API_KEY` is unset, invites fall back to Supabase's mailer and return the action link for manual sharing | The Users screen always offers a **Copy invite link** action |

---

## 5. Verification checklist

1. `npx tsx scripts/generate-auth-email-templates.ts` — six files + `manifest.json` rewritten.
2. Send a test from the server (`/api/email/test`) and confirm the brand mark renders.
3. Invite a throwaway address from **Studio → Users → Invite user**:
   - the email is branded and arrives from `studio@roryskagenart.com`;
   - the button opens the studio **Set your password** screen;
   - the Users table shows the user as **Invite pending** until they sign in.
4. Use **Send password reset** on that user and confirm the reset email is branded.
5. Self-service **Forgot password** on the login screen still works (Supabase mailer path).
