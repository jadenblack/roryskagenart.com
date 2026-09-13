import { Router } from "express";
import { query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const settingsRouter = Router();

// Get settings (public read)
settingsRouter.get("/", async (req, res) => {
  try {
    const result = await query<{ key: string; value: unknown }>(
      `SELECT key, value FROM public.settings`
    );
    const settings: Record<string, unknown> = {};
    for (const row of result.rows) settings[row.key] = row.value;
    return res.json({ success: true, settings });
  } catch {
    return res.json({ success: true, settings: {} }); // degrade gracefully
  }
});

// Update settings (admin only)
settingsRouter.put("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const entries = req.body?.settings;
    if (!entries || typeof entries !== "object") {
      return res.status(400).json({ error: "Body must be { settings: { key: value } }." });
    }
    for (const [key, value] of Object.entries(entries)) {
      await query(
        `INSERT INTO public.settings (key, value, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [key, JSON.stringify(value), req.cmsUser?.id || null]
      );
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to save settings" });
  }
});
