import { Router } from "express";
import { query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const pagesRouter = Router();

// Public list with content — the SPA renders pages from the DB (source of truth).
pagesRouter.get("/", async (req, res) => {
  try {
    const result = await query(
      `SELECT slug, title, content, updated_at FROM public.pages ORDER BY slug`
    );
    return res.json({ success: true, pages: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to list pages" });
  }
});

pagesRouter.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await query(`SELECT * FROM public.pages WHERE slug = $1 LIMIT 1`, [slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Page "${slug}" not found` });
    }
    return res.json({ success: true, page: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to get page" });
  }
});

pagesRouter.put("/:slug", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content } = req.body || {};
    const result = await query(
      `INSERT INTO public.pages (slug, title, content, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = COALESCE(EXCLUDED.title, pages.title),
         content = EXCLUDED.content,
         updated_at = now()
       RETURNING *`,
      [slug, title || slug, content || ""]
    );
    return res.json({ success: true, page: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to save page" });
  }
});
