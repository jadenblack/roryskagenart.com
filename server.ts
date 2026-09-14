import express from "express";
import path from "path";
import dotenv from "dotenv";
import { checkDbHealth, query } from "./src/server/db";
import { getEmailConfig, sendTestVerificationEmail } from "./server/emailService";
import { verifyResendWebhook } from "./server/lib/webhookSignature";
import { requireAuth, requireRole } from "./server/middleware/auth";
import { artworksRouter } from "./server/routes/artworks";
import { pagesRouter } from "./server/routes/pages";
import { taxonomiesRouter } from "./server/routes/taxonomies";
import { settingsRouter } from "./server/routes/settings";
import { mediaRouter } from "./server/routes/media";
import { inquiriesRouter } from "./server/routes/inquiries";
import { adminUsersRouter } from "./server/routes/adminUsers";
import { cronRouter } from "./server/routes/cronBackup";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// -------------------------------------------------------------
// Core System & Diagnostics API Endpoints
// -------------------------------------------------------------

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Database connection status (editor+)
app.get("/api/database/status", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const health = await checkDbHealth();
    return res.json({
      success: true,
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, connected: false, error: err.message });
  }
});

// Resend Email Status & Test Verification
//
// Unauthenticated by design (it is a public health check), so the payload is deliberately the
// minimum: `adminEmail` used to be published here, which handed a real studio address to anyone
// who asked. Nothing in `src/` consumes this endpoint beyond `configured`/`mode`.
app.get("/api/email/status", (req, res) => {
  const emailConfig = getEmailConfig();
  res.json({
    success: true,
    provider: "Resend",
    configured: emailConfig.configured,
    domain: emailConfig.domain,
    mode: emailConfig.mode,
    apiKeyPresent: Boolean(process.env.RESEND_API_KEY),
  });
});

app.post("/api/email/send-test", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { to } = req.body || {};
    const targetEmail = to || process.env.ADMIN_EMAIL || "rory@ventureio.com";
    const result = await sendTestVerificationEmail(targetEmail);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({
      success: true,
      message: `Test email successfully dispatched to ${targetEmail} via Resend API.`,
      messageId: result.messageId,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Resend delivery webhook — records bounces and complaints against the stored message id.
 *
 * WHY: Hobby keeps runtime logs for one hour, so a bounced inquiry notification is otherwise
 * invisible. This closes the loop: the row written by `POST /api/inquiries` is corrected to
 * `bounced` when the provider says the message did not land.
 *
 * ⚠️ `express.raw()` — the HMAC covers the raw bytes. Parsing JSON first would break it.
 * Requests are answered 200 even for unknown event types: retrying an event we will never handle
 * is worse than ignoring it. A bad signature, however, is a 401 — that is a security boundary.
 */
app.post("/api/email/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const verification = verifyResendWebhook({
    payload: req.body ?? Buffer.alloc(0),
    headers: {
      'svix-id': req.get('svix-id') ?? undefined,
      'svix-timestamp': req.get('svix-timestamp') ?? undefined,
      'svix-signature': req.get('svix-signature') ?? undefined,
    },
    secret: process.env.RESEND_WEBHOOK_SECRET,
  });

  if (!verification.ok) {
    console.warn("[email/webhook] rejected:", verification.reason);
    return res.status(401).json({ success: false, error: "Invalid signature." });
  }

  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body ?? "");
    const event = JSON.parse(raw || "{}");
    const type = String(event?.type ?? "");
    const emailId = event?.data?.email_id ? String(event.data.email_id) : null;

    if ((type === "email.bounced" || type === "email.complained") && emailId) {
      await query(
        `UPDATE public.inquiries
            SET email_status = 'bounced',
                email_error = COALESCE($2, email_error)
          WHERE email_studio_id = $1 OR email_collector_id = $1`,
        [emailId, `${type}: ${event?.data?.bounce?.message ?? event?.data?.complaint?.type ?? "no detail"}`]
      );
      console.warn(`[email/webhook] ${type} for ${emailId}`);
    } else {
      console.log(`[email/webhook] ${type || "unknown event"} (no action)`);
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[email/webhook] handler error:", err?.message ?? err);
    return res.status(200).json({ success: true }); // never make Resend retry a bug forever
  }
});

// -------------------------------------------------------------
// Mount Modular API Routers
// -------------------------------------------------------------

app.use("/api/artworks", artworksRouter);
app.use("/api/pages", pagesRouter);
app.use("/api/taxonomies", taxonomiesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/media", mediaRouter);
app.use("/api/inquiries", inquiriesRouter);
app.use("/api/admin/users", adminUsersRouter);
// Guarded by CRON_SECRET (see server/routes/cronBackup.ts). Not behind requireAuth: Vercel Cron
// cannot present a Supabase session, and the shared secret is the stronger gate for a machine caller.
app.use("/api/cron", cronRouter);

// -------------------------------------------------------------
// Vite Dev Server & Static Asset Serving
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    // Dynamic import: keeps Vite (a dev-only, ~30 MB dependency) out of the
    // serverless bundle entirely. Only standalone dev mode loads it.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

// Serverless entry: export the configured app; the platform owns the listener.
export default app;

// Standalone boot (skipped on Vercel)
if (!process.env.VERCEL) {
  startServer();
}
