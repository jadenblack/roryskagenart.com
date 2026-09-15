import { Router } from "express";
import multer from "multer";
import { getSupabaseAdmin, query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  IMMUTABLE_CACHE_CONTROL,
  MEDIA_BUCKET,
  RENDITION_MIME,
  UnreadableImageError,
} from "../lib/imageRenditions";
import {
  registerUploadedImage,
  validateUpload,
  type MediaAssetValues,
} from "../lib/mediaUpload";

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

/**
 * Media upload — render the full ladder, store it, register it (editor+).
 *
 * Through v2.15.0 this wrote a single object and inserted `VALUES ($1, $2, $2, …)`: `url` and
 * `thumbnail_url` were the same string, `renditions` and `lqip` stayed null, and width/height came
 * from client form data. Every admin upload therefore had no thumbnail at all — the gallery grid
 * downloaded the full-size image.
 *
 * Now: one upload produces `thumb` + `hero` + `full` WebP and an lqip placeholder, dimensions and
 * format are read from the decoded image rather than trusted from the client, and the source bytes
 * are deliberately not retained (PRD §1 Q4 — full resolution is never needed in the studio).
 *
 * The decisions live in `server/lib/mediaUpload.ts`; this handler only wires them to Supabase and
 * to `media_assets`.
 */
mediaRouter.post("/upload", requireAuth, requireRole("editor"), upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided (field name: file)." });

    const artworkSlug = typeof req.body?.artwork_slug === "string" ? req.body.artwork_slug.trim() : "";

    const invalid = validateUpload({ mimetype: file.mimetype, artworkSlug });
    if (invalid) return res.status(400).json({ error: invalid });

    const supabaseAdmin = getSupabaseAdmin();

    const media = await registerUploadedImage(
      { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname, artworkSlug },
      {
        uploadObject: async (path, body) => {
          const { error } = await supabaseAdmin.storage
            .from(MEDIA_BUCKET)
            .upload(path, body, {
              contentType: RENDITION_MIME,
              cacheControl: IMMUTABLE_CACHE_CONTROL,
              upsert: true,
            });
          if (error) throw new Error(`Storage upload failed: ${error.message}`);
        },

        publicUrl: (path) =>
          supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl ?? "",

        insert: async (values: MediaAssetValues) => {
          const result = await query(
            `INSERT INTO public.media_assets (
               public_id, url, thumbnail_url, format, bytes, width, height,
               folder, artwork_slug, lqip, renditions
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''), $10, $11::jsonb)
             ON CONFLICT (public_id) DO UPDATE SET
               url           = EXCLUDED.url,
               thumbnail_url = EXCLUDED.thumbnail_url,
               format        = EXCLUDED.format,
               bytes         = EXCLUDED.bytes,
               width         = EXCLUDED.width,
               height        = EXCLUDED.height,
               folder        = EXCLUDED.folder,
               artwork_slug  = COALESCE(EXCLUDED.artwork_slug, media_assets.artwork_slug),
               lqip          = EXCLUDED.lqip,
               renditions    = EXCLUDED.renditions,
               updated_at    = now()
             RETURNING public_id, url, thumbnail_url, format, width, height, artwork_slug, lqip, renditions`,
            [
              values.public_id,
              values.url,
              values.thumbnail_url,
              values.format,
              values.bytes,
              values.width,
              values.height,
              values.folder,
              values.artwork_slug ?? "",
              values.lqip,
              JSON.stringify(values.renditions),
            ]
          );
          return result.rows[0];
        },
      }
    );

    return res.json({ success: true, media });
  } catch (err: any) {
    // An undecodable file is the uploader's problem to fix, not a server fault.
    if (err instanceof UnreadableImageError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Media upload error:", err);
    return res.status(500).json({ error: err.message || "Failed to upload media" });
  }
});
