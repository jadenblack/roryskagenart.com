import { Router } from "express";
import { query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";
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

    // Asynchronously dispatch Resend emails to Studio Admin and Collector
    sendInquiryNotificationToStudio({
      id: savedInquiry.id,
      name,
      email,
      phone,
      artwork_slug,
      artwork_title,
      inquiry_type,
      message,
    }).catch((err) => console.warn("[Resend Email] Notice sending studio notification:", err));

    sendInquiryConfirmationToCollector({
      name,
      email,
      artwork_title,
    }).catch((err) => console.warn("[Resend Email] Notice sending collector confirmation:", err));

    return res.status(201).json({ success: true, inquiry: savedInquiry, emailDispatched: true });
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
