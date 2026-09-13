import { Router } from "express";
import multer from "multer";
import { getSupabaseAdmin, query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const mediaRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

// Media library — list media_assets registry (editor+)
mediaRouter.get("/", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const result = await query(
      `SELECT public_id, url, thumbnail_url, width, height, format, artwork_slug, lqip, renditions
         FROM public.media_assets
        ORDER BY public_id`
    );
    return res.json({ success: true, media: result.rows, count: result.rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch media registry" });
  }
});

// Media upload — store in Supabase Storage `artwork-images` and register in
// media_assets (editor+). Optional artwork_slug links the asset to a work.
mediaRouter.post("/upload", requireAuth, requireRole("editor"), upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided (field name: file)." });

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowed.includes(file.mimetype)) {
      return res.status(400).json({ error: `Unsupported file type: ${file.mimetype}. Use JPEG, PNG, WebP, GIF, or AVIF.` });
    }

    const artworkSlug = typeof req.body?.artwork_slug === "string" ? req.body.artwork_slug.trim() : "";
    if (artworkSlug && !/^[a-z0-9-]+$/i.test(artworkSlug)) {
      return res.status(400).json({ error: "Invalid artwork slug." });
    }

    // Deterministic public_id: {slug|upload}/{timestamp}-{sanitized-filename}
    const ext = (file.originalname.match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1] || "jpg").toLowerCase();
    const baseName = (file.originalname.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "image").toLowerCase();
    const publicId = `${artworkSlug || "uploads"}/${Date.now()}-${baseName}.${ext}`;

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.storage
      .from("artwork-images")
      .upload(publicId, file.buffer, {
        contentType: file.mimetype,
        cacheControl: "31536000",
        upsert: false,
      });
    if (error) return res.status(500).json({ error: `Storage upload failed: ${error.message}` });

    const { data: pubData } = supabaseAdmin.storage.from("artwork-images").getPublicUrl(publicId);
    const publicUrl = pubData?.publicUrl;
    if (!publicUrl) return res.status(500).json({ error: "Failed to resolve public URL for uploaded asset." });

    // Register in media_assets (dimensions arrive from the client form data)
    const width = Number(req.body?.width) || null;
    const height = Number(req.body?.height) || null;
    const insert = await query(
      `INSERT INTO public.media_assets (public_id, url, thumbnail_url, format, width, height, artwork_slug)
       VALUES ($1, $2, $2, $3, $4, $5, NULLIF($6, ''))
       ON CONFLICT (public_id) DO UPDATE SET
         url = EXCLUDED.url,
         thumbnail_url = EXCLUDED.thumbnail_url,
         artwork_slug = COALESCE(EXCLUDED.artwork_slug, media_assets.artwork_slug),
         updated_at = now()
       RETURNING public_id, url, thumbnail_url, format, width, height, artwork_slug`,
      [publicId, publicUrl, file.mimetype.split("/")[1], width, height, artworkSlug]
    );

    return res.json({ success: true, media: insert.rows[0] });
  } catch (err: any) {
    console.error("Media upload error:", err);
    return res.status(500).json({ error: err.message || "Failed to upload media" });
  }
});
