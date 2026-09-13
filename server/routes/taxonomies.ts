import { Router } from "express";
import { query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const taxonomiesRouter = Router();

// Get taxonomies (public read)
taxonomiesRouter.get("/", async (req, res) => {
  try {
    const type = typeof req.query.type === "string" ? req.query.type : null;
    const result = type
      ? await query(`SELECT * FROM public.taxonomies WHERE type = $1 ORDER BY sort_order, name`, [type])
      : await query(`SELECT * FROM public.taxonomies ORDER BY type, sort_order, name`);
    return res.json({ success: true, terms: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch taxonomies" });
  }
});

// Create taxonomy term (editor+)
taxonomiesRouter.post("/", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const { type, name, slug, sort_order } = req.body || {};
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required." });
    }
    const termType = ["series", "tag", "medium", "location"].includes(type) ? type : "series";
    const termSlug =
      (slug && String(slug)) ||
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const result = await query(
      `INSERT INTO public.taxonomies (type, slug, name, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (type, slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [termType, termSlug, name, Number(sort_order) || 0]
    );
    return res.status(201).json({ success: true, term: result.rows[0] });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to create term" });
  }
});

// Update taxonomy term (editor+)
taxonomiesRouter.patch("/:id", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sort_order } = req.body || {};
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(String(name));
    }
    if (sort_order !== undefined) {
      updates.push(`sort_order = $${idx++}`);
      values.push(Number(sort_order) || 0);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: "No updatable fields provided." });
    }
    updates.push(`updated_at = now()`);
    values.push(id);
    const result = await query(
      `UPDATE public.taxonomies SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Term not found." });
    return res.json({ success: true, term: result.rows[0] });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to update term" });
  }
});

// Delete taxonomy term (admin only)
taxonomiesRouter.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM public.taxonomies WHERE id = $1`, [id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to delete term" });
  }
});
