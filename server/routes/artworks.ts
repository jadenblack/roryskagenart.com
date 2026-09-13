import { Router } from "express";
import { query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const artworksRouter = Router();

// Fetch Artworks from PostgreSQL
artworksRouter.get("/", async (req, res) => {
  try {
    const includeTrashed = req.query.include_trashed === "true";
    let sql = `
      SELECT 
        id, slug, title, year, medium, dimensions, price, status, 
        gallery_series, edition, location, image_url, hero_slider, 
        enabled, archived, trashed, trashed_at, narrative, metadata, 
        created_at, updated_at
      FROM public.artworks
    `;
    if (!includeTrashed) {
      sql += ` WHERE trashed = false`;
    }
    sql += ` ORDER BY updated_at DESC, created_at DESC`;

    const result = await query(sql);
    return res.json({
      success: true,
      count: result.rows.length,
      artworks: result.rows,
    });
  } catch (err: any) {
    console.error("Fetch artworks error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch artworks from PostgreSQL" });
  }
});

// Fetch Single Artwork by Slug
artworksRouter.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await query(
      `SELECT * FROM public.artworks WHERE slug = $1 LIMIT 1`,
      [slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Artwork with slug "${slug}" not found.` });
    }
    return res.json({ success: true, artwork: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch artwork" });
  }
});

// Create New Artwork in PostgreSQL
artworksRouter.post("/", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const {
      slug, title, year, medium, dimensions, price, status,
      gallery_series, edition, location, image_url, hero_slider,
      narrative, metadata
    } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const result = await query(
      `INSERT INTO public.artworks (
        slug, title, year, medium, dimensions, price, status,
        gallery_series, edition, location, image_url, hero_slider,
        narrative, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
      RETURNING *`,
      [
        finalSlug,
        title,
        year || "2024",
        medium || "Acrylic on Canvas",
        dimensions || "48\" x 60\"",
        price || "$9,500",
        status || "Available",
        gallery_series || "Neon Americana",
        edition || "Original Painting",
        location || "Austin Studio",
        image_url || `/images/${finalSlug}.svg`,
        hero_slider === true,
        narrative || "",
        JSON.stringify(metadata || {})
      ]
    );

    return res.status(201).json({ success: true, artwork: result.rows[0] });
  } catch (err: any) {
    console.error("Create artwork error:", err);
    return res.status(500).json({ error: err.message || "Failed to create artwork" });
  }
});

// Update Artwork in PostgreSQL
artworksRouter.patch("/:slug", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const { slug } = req.params;
    const body = req.body || {};

    const allowedFields = [
      "title", "year", "medium", "dimensions", "price", "status",
      "gallery_series", "edition", "location", "image_url", "hero_slider",
      "enabled", "archived", "trashed", "trashed_at", "narrative", "metadata"
    ];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (field in body) {
        let val = body[field];
        if (field === "metadata" && typeof val === "object") {
          val = JSON.stringify(val);
        }
        updates.push(`${field} = $${paramIndex}`);
        values.push(val);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    updates.push(`updated_at = now()`);
    values.push(slug);

    const sql = `
      UPDATE public.artworks
      SET ${updates.join(", ")}
      WHERE slug = $${paramIndex}
      RETURNING *
    `;

    const result = await query(sql, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Artwork "${slug}" not found` });
    }

    return res.json({ success: true, artwork: result.rows[0] });
  } catch (err: any) {
    console.error("Update artwork error:", err);
    return res.status(500).json({ error: err.message || "Failed to update artwork" });
  }
});

// Delete or Trash Artwork
artworksRouter.delete("/:slug", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const { slug } = req.params;
    const permanent = req.query.permanent === "true";

    if (permanent) {
      await query(`DELETE FROM public.artworks WHERE slug = $1`, [slug]);
      return res.json({ success: true, message: `Artwork "${slug}" permanently deleted.` });
    } else {
      const result = await query(
        `UPDATE public.artworks SET trashed = true, trashed_at = now(), updated_at = now() WHERE slug = $1 RETURNING *`,
        [slug]
      );
      return res.json({ success: true, message: `Artwork moved to trash.`, artwork: result.rows[0] });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to delete artwork" });
  }
});
