import { Router } from "express";
import { query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { classifyInquiryOutcome } from "../lib/emailRouting";
import {
  sendInquiryNotificationToStudio,
  sendInquiryConfirmationToCollector,
} from "../emailService";

export const inquiriesRouter = Router();

// Public inquiry submission + Resend Email Dispatch
inquiriesRouter.post("/", async (req, res) => {
  try {
    const { name, email, phone, artwork_slug, artwork_title, inquiry_type, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email, and message are required." });
    }

    const result = await query(
      `INSERT INTO public.inquiries (
        name, email, phone, artwork_slug, artwork_title, inquiry_type, message, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', now())
      RETURNING *`,
      [name, email, phone || null, artwork_slug || null, artwork_title || null, inquiry_type || "General Inquiry", message]
    );

    const savedInquiry = result.rows[0];

    // Awaited, not fire-and-forget.
    //
    // WHY: this runs as a Vercel serverless function. Once the response is flushed the instance
    // can be frozen, so a `.catch()`-ed promise left running after `res.json()` may never reach
    // Resend — the inquiry would be stored, the collector would be told "sent", and no mail would
    // ever leave. Awaiting both adds a few hundred milliseconds and makes the result true.
    //
    // `allSettled` because a mailer failure must never lose the inquiry: the row is already
    // committed, and the studio can still read it in #/admin → Inquiries.
    const [studioResult, collectorResult] = await Promise.allSettled([
      sendInquiryNotificationToStudio({
        id: savedInquiry.id,
        name,
        email,
        phone,
        artwork_slug,
        artwork_title,
        inquiry_type,
        message,
      }),
      sendInquiryConfirmationToCollector({ name, email, artwork_title }),
    ]);

    const settled = (r: PromiseSettledResult<{ success: boolean; messageId?: string; error?: string }>) =>
      r.status === "fulfilled" && r.value
        ? r.value
        : { success: false, error: r.status === "rejected" ? String(r.reason) : "Unknown failure" };

    const studio = settled(studioResult);
    const collector = settled(collectorResult);
    const outcome = classifyInquiryOutcome({ studio, collector });

    if (!studio.success) {
      // This is the one that matters: an undelivered studio notification is a lost sales lead.
      console.error("[inquiries] studio notification FAILED:", studio.error);
    }

    // Persist the outcome. Best-effort on purpose: the inquiry is already committed, and a failure
    // to record delivery status must never turn a successful submission into a 500. Hobby keeps
    // runtime logs for one hour; this row is what makes a lost lead visible a week later.
    try {
      await query(
        `UPDATE public.inquiries
            SET email_status = $1,
                email_error = $2,
                email_sent_at = $3,
                email_studio_id = $4,
                email_collector_id = $5
          WHERE id = $6`,
        [
          outcome.status,
          outcome.error ? String(outcome.error).slice(0, 500) : null,
          studio.success || collector.success ? new Date().toISOString() : null,
          outcome.studioId ?? null,
          outcome.collectorId ?? null,
          savedInquiry.id,
        ]
      );
    } catch (err: any) {
      console.error("[inquiries] could not record email status:", err?.message ?? err);
    }

    // 201 either way — the collector must not be punished for a mailer outage, and the inquiry is
    // safely stored. `email` reports what actually happened instead of a hardcoded `true`.
    return res.status(201).json({
      success: true,
      inquiry: savedInquiry,
      email: {
        studio: studio.success === true,
        collector: collector.success === true,
        status: outcome.status,
      },
    });
  } catch (err: any) {
    console.error("Save inquiry error:", err);
    return res.status(500).json({ error: err.message || "Failed to save inquiry" });
  }
});

// Admin list of inquiries
inquiriesRouter.get("/", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM public.inquiries ORDER BY created_at DESC LIMIT 100`
    );
    return res.json({ success: true, inquiries: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch inquiries" });
  }
});

// Update inquiry status
inquiriesRouter.patch("/:id/status", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowed = ["New", "Contacted", "Closed"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Status must be one of New, Contacted, Closed." });
    }
    const result = await query(
      `UPDATE public.inquiries SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Inquiry not found." });
    return res.json({ success: true, inquiry: result.rows[0] });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to update inquiry" });
  }
});
