var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_express8 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);

// src/server/db.ts
var import_pg = require("pg");
var import_supabase_js = require("@supabase/supabase-js");
var poolInstance = null;
var supabaseAdminInstance = null;
function getCleanConnectionString() {
  const raw = process.env.VRCL_SUPA_POSTGRES_PRISMA_URL || process.env.VRCL_SUPA_POSTGRES_URL || process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING || "";
  return raw.replace(/\?.*$/, "");
}
function getDbPool() {
  if (!poolInstance) {
    const connectionString = getCleanConnectionString();
    if (!connectionString) {
      throw new Error("PostgreSQL connection string is missing from environment.");
    }
    poolInstance = new import_pg.Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 1e4
    });
    poolInstance.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client pool:", err);
    });
  }
  return poolInstance;
}
async function query(text, params) {
  const pool = getDbPool();
  return pool.query(text, params);
}
function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL || process.env.VRCL_SUPA_SUPABASE_URL || "https://orphcusijzkxpxkzapjp.supabase.co";
    const serviceKey = process.env.VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error("VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY is required for admin database operations.");
    }
    supabaseAdminInstance = (0, import_supabase_js.createClient)(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabaseAdminInstance;
}
async function checkDbHealth() {
  try {
    const res = await query("SELECT version(), (SELECT count(*) FROM public.artworks) as artworks_count;");
    return {
      connected: true,
      version: res.rows[0].version,
      artworksCount: Number(res.rows[0].artworks_count || 0)
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message || "Database connection error"
    };
  }
}

// server/emailService.ts
var import_resend = require("resend");
var resendClient = null;
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!resendClient) {
    resendClient = new import_resend.Resend(apiKey);
  }
  return resendClient;
}
function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_EMAIL_DOMAIN || "roryskagenart.com";
  const adminEmail = process.env.ADMIN_EMAIL || "rory@ventureio.com";
  const configured = Boolean(apiKey && apiKey.trim().length > 0);
  const fromAddress = configured ? `Rory Skagen Studio <studio@${domain}>` : "Rory Skagen Studio <onboarding@resend.dev>";
  return {
    configured,
    domain,
    adminEmail,
    fromAddress
  };
}
async function sendInquiryNotificationToStudio(inquiry) {
  const client = getResendClient();
  const config = getEmailConfig();
  if (!client || !config.configured) {
    console.log("[Resend Email] API key not configured, skipping studio email dispatch.");
    return { success: false, error: "Resend API key is not configured" };
  }
  const recipients = Array.from(
    new Set([config.adminEmail, "jaden@venturepilot.org"].filter(Boolean))
  );
  const subject = `\u{1F3A8} New Collector Inquiry: ${inquiry.artwork_title ? `"${inquiry.artwork_title}"` : inquiry.inquiry_type || "General Inquiry"} \u2014 from ${inquiry.name}`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8f8f6; margin: 0; padding: 24px; color: #1a1a1a; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e0; border-radius: 4px; overflow: hidden; }
          .header { background: #111111; color: #ffffff; padding: 24px; border-bottom: 3px solid #d4af37; }
          .header h1 { margin: 0 0 4px; font-size: 18px; text-transform: uppercase; letter-spacing: 0.1em; font-family: monospace; }
          .header p { margin: 0; font-size: 12px; color: #a0a0a0; font-family: monospace; }
          .body { padding: 28px; }
          .field { margin-bottom: 16px; border-bottom: 1px solid #f0f0ec; padding-bottom: 12px; }
          .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #666666; font-family: monospace; margin-bottom: 4px; }
          .value { font-size: 15px; color: #111111; font-weight: 500; }
          .message-box { background: #fbfbf9; border-left: 3px solid #111111; padding: 16px; margin: 20px 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
          .footer { background: #f5f5f0; padding: 16px 28px; font-size: 11px; color: #888888; font-family: monospace; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Rory Skagen Studio</h1>
            <p>New Art Acquisition & Collector Inquiry</p>
          </div>
          <div class="body">
            <div class="field">
              <div class="label">Collector Name</div>
              <div class="value">${escapeHtml(inquiry.name)}</div>
            </div>
            <div class="field">
              <div class="label">Collector Email</div>
              <div class="value"><a href="mailto:${escapeHtml(inquiry.email)}" style="color: #0066cc; text-decoration: none;">${escapeHtml(inquiry.email)}</a></div>
            </div>
            ${inquiry.phone ? `
            <div class="field">
              <div class="label">Phone Number</div>
              <div class="value"><a href="tel:${escapeHtml(inquiry.phone)}" style="color: #0066cc; text-decoration: none;">${escapeHtml(inquiry.phone)}</a></div>
            </div>` : ""}
            <div class="field">
              <div class="label">Target Artwork / Inquiry Type</div>
              <div class="value"><strong>${escapeHtml(inquiry.artwork_title || "General Studio Inquiry")}</strong> ${inquiry.artwork_slug ? `<span style="font-size: 12px; color: #888;">(Slug: ${escapeHtml(inquiry.artwork_slug)})</span>` : ""}</div>
            </div>
            <div class="label" style="margin-top: 20px;">Collector Message</div>
            <div class="message-box">${escapeHtml(inquiry.message)}</div>
            <p style="font-size: 12px; color: #777; margin-top: 20px;">
              You can respond directly to this collector by replying to <strong>${escapeHtml(inquiry.email)}</strong>.
            </p>
          </div>
          <div class="footer">
            Rory Skagen Studio \u2022 Austin, Texas \u2022 roryskagenart.com
          </div>
        </div>
      </body>
    </html>
  `;
  try {
    const { data, error } = await client.emails.send({
      from: config.fromAddress,
      to: recipients,
      replyTo: inquiry.email,
      subject,
      html
    });
    if (error) {
      console.error("[Resend Email] Failed to send inquiry notification:", error);
      return { success: false, error: error.message };
    }
    console.log("[Resend Email] Successfully sent studio inquiry notification. Message ID:", data?.id);
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Resend Email] Exception sending studio inquiry notification:", err);
    return { success: false, error: err.message };
  }
}
async function sendInquiryConfirmationToCollector(inquiry) {
  const client = getResendClient();
  const config = getEmailConfig();
  if (!client || !config.configured) {
    return { success: false, error: "Resend API key is not configured" };
  }
  const subject = `Thank you for your inquiry \u2014 Rory Skagen Studio`;
  const artworkMention = inquiry.artwork_title ? `regarding "${inquiry.artwork_title}"` : "with our studio";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8f8f6; margin: 0; padding: 24px; color: #1a1a1a; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e0; border-radius: 4px; overflow: hidden; }
          .header { background: #111111; color: #ffffff; padding: 24px; border-bottom: 3px solid #d4af37; }
          .header h1 { margin: 0 0 4px; font-size: 18px; text-transform: uppercase; letter-spacing: 0.1em; font-family: monospace; }
          .body { padding: 28px; font-size: 14px; line-height: 1.6; color: #333333; }
          .footer { background: #f5f5f0; padding: 16px 28px; font-size: 11px; color: #888888; font-family: monospace; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Rory Skagen Studio</h1>
          </div>
          <div class="body">
            <p>Dear ${escapeHtml(inquiry.name)},</p>
            <p>Thank you for contacting Rory Skagen Studio ${escapeHtml(artworkMention)}. We have received your inquiry and our studio team will review the details and get back to you shortly.</p>
            <p>In the meantime, feel free to explore the master gallery catalog online at <a href="https://roryskagenart.com" style="color: #111111; font-weight: bold;">roryskagenart.com</a>.</p>
            <p style="margin-top: 24px;">
              Warm regards,<br>
              <strong>Rory Skagen Studio</strong><br>
              <span style="font-size: 12px; color: #777;">Austin, Texas</span>
            </p>
          </div>
          <div class="footer">
            Rory Skagen Studio \u2022 roryskagenart.com \u2022 Austin, Texas
          </div>
        </div>
      </body>
    </html>
  `;
  try {
    const { data, error } = await client.emails.send({
      from: config.fromAddress,
      to: [inquiry.email],
      replyTo: config.adminEmail,
      subject,
      html
    });
    if (error) {
      console.warn("[Resend Email] Notice sending collector confirmation:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.warn("[Resend Email] Exception sending collector confirmation:", err.message);
    return { success: false, error: err.message };
  }
}
async function sendTestVerificationEmail(toEmail) {
  const client = getResendClient();
  const config = getEmailConfig();
  if (!client || !config.configured) {
    return { success: false, error: "Resend API key is not configured in environment" };
  }
  try {
    const { data, error } = await client.emails.send({
      from: config.fromAddress,
      to: [toEmail],
      subject: `\u2705 Resend API Verified \u2014 Rory Skagen Studio`,
      html: `
        <div style="font-family: monospace; padding: 24px; background: #f8f8f6; border: 1px solid #ddd; max-width: 500px;">
          <h2 style="color: #111; margin-top: 0;">Rory Skagen Studio</h2>
          <p style="color: #2e7d32; font-weight: bold;">\u2705 Resend Email API is successfully configured and active.</p>
          <p><strong>Domain:</strong> ${escapeHtml(config.domain)}</p>
          <p><strong>From:</strong> ${escapeHtml(config.fromAddress)}</p>
          <p><strong>Timestamp:</strong> ${(/* @__PURE__ */ new Date()).toISOString()}</p>
        </div>
      `
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// server/middleware/auth.ts
var ROLE_ORDER = { viewer: 0, editor: 1, admin: 2 };
async function resolveCmsUser(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    const sbUser = data.user;
    let role = "viewer";
    let isActive = true;
    try {
      const profileRes = await query(
        `SELECT role, is_active, full_name FROM public.profiles WHERE id = $1 LIMIT 1`,
        [sbUser.id]
      );
      if (profileRes.rows[0]) {
        const r = String(profileRes.rows[0].role);
        role = r === "admin" || r === "editor" ? r : "viewer";
        isActive = profileRes.rows[0].is_active !== false;
      } else {
        const metaRole = sbUser.app_metadata?.role || sbUser.user_metadata?.role;
        role = metaRole === "admin" || metaRole === "editor" ? metaRole : "viewer";
      }
    } catch {
      const metaRole = sbUser.app_metadata?.role || sbUser.user_metadata?.role;
      role = metaRole === "admin" || metaRole === "editor" ? metaRole : "viewer";
    }
    return {
      id: sbUser.id,
      email: sbUser.email || "",
      role,
      isActive
    };
  } catch {
    return null;
  }
}
async function requireAuth(req, res, next) {
  try {
    const user = await resolveCmsUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: "This account has been deactivated." });
    }
    req.cmsUser = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}
function requireRole(minimum) {
  return (req, res, next) => {
    if (!req.cmsUser) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if ((ROLE_ORDER[req.cmsUser.role] ?? -1) < ROLE_ORDER[minimum]) {
      return res.status(403).json({ error: `Requires ${minimum} role or higher.` });
    }
    return next();
  };
}

// server/routes/artworks.ts
var import_express = require("express");
var artworksRouter = (0, import_express.Router)();
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
      artworks: result.rows
    });
  } catch (err) {
    console.error("Fetch artworks error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch artworks from PostgreSQL" });
  }
});
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
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch artwork" });
  }
});
artworksRouter.post("/", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const {
      slug,
      title,
      year,
      medium,
      dimensions,
      price,
      status,
      gallery_series,
      edition,
      location,
      image_url,
      hero_slider,
      narrative,
      metadata
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
        dimensions || '48" x 60"',
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
  } catch (err) {
    console.error("Create artwork error:", err);
    return res.status(500).json({ error: err.message || "Failed to create artwork" });
  }
});
artworksRouter.patch("/:slug", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const { slug } = req.params;
    const body = req.body || {};
    const allowedFields = [
      "title",
      "year",
      "medium",
      "dimensions",
      "price",
      "status",
      "gallery_series",
      "edition",
      "location",
      "image_url",
      "hero_slider",
      "enabled",
      "archived",
      "trashed",
      "trashed_at",
      "narrative",
      "metadata"
    ];
    const updates = [];
    const values = [];
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
  } catch (err) {
    console.error("Update artwork error:", err);
    return res.status(500).json({ error: err.message || "Failed to update artwork" });
  }
});
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
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to delete artwork" });
  }
});

// server/routes/pages.ts
var import_express2 = require("express");
var pagesRouter = (0, import_express2.Router)();
pagesRouter.get("/", async (req, res) => {
  try {
    const result = await query(
      `SELECT slug, title, content, updated_at FROM public.pages ORDER BY slug`
    );
    return res.json({ success: true, pages: result.rows });
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to save page" });
  }
});

// server/routes/taxonomies.ts
var import_express3 = require("express");
var taxonomiesRouter = (0, import_express3.Router)();
taxonomiesRouter.get("/", async (req, res) => {
  try {
    const type = typeof req.query.type === "string" ? req.query.type : null;
    const result = type ? await query(`SELECT * FROM public.taxonomies WHERE type = $1 ORDER BY sort_order, name`, [type]) : await query(`SELECT * FROM public.taxonomies ORDER BY type, sort_order, name`);
    return res.json({ success: true, terms: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch taxonomies" });
  }
});
taxonomiesRouter.post("/", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const { type, name, slug, sort_order } = req.body || {};
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required." });
    }
    const termType = ["series", "tag", "medium", "location"].includes(type) ? type : "series";
    const termSlug = slug && String(slug) || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const result = await query(
      `INSERT INTO public.taxonomies (type, slug, name, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (type, slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [termType, termSlug, name, Number(sort_order) || 0]
    );
    return res.status(201).json({ success: true, term: result.rows[0] });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to create term" });
  }
});
taxonomiesRouter.patch("/:id", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sort_order } = req.body || {};
    const updates = [];
    const values = [];
    let idx = 1;
    if (name !== void 0) {
      updates.push(`name = $${idx++}`);
      values.push(String(name));
    }
    if (sort_order !== void 0) {
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
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to update term" });
  }
});
taxonomiesRouter.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM public.taxonomies WHERE id = $1`, [id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to delete term" });
  }
});

// server/routes/settings.ts
var import_express4 = require("express");
var settingsRouter = (0, import_express4.Router)();
settingsRouter.get("/", async (req, res) => {
  try {
    const result = await query(
      `SELECT key, value FROM public.settings`
    );
    const settings = {};
    for (const row of result.rows) settings[row.key] = row.value;
    return res.json({ success: true, settings });
  } catch {
    return res.json({ success: true, settings: {} });
  }
});
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
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to save settings" });
  }
});

// server/routes/media.ts
var import_express5 = require("express");
var import_multer = __toESM(require("multer"), 1);
var mediaRouter = (0, import_express5.Router)();
var upload = (0, import_multer.default)({
  storage: import_multer.default.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }
  // 30MB
});
mediaRouter.get("/", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const result = await query(
      `SELECT public_id, url, thumbnail_url, width, height, format, artwork_slug, lqip, renditions
         FROM public.media_assets
        ORDER BY public_id`
    );
    return res.json({ success: true, media: result.rows, count: result.rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch media registry" });
  }
});
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
    const ext = (file.originalname.match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1] || "jpg").toLowerCase();
    const baseName = (file.originalname.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "image").toLowerCase();
    const publicId = `${artworkSlug || "uploads"}/${Date.now()}-${baseName}.${ext}`;
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.storage.from("artwork-images").upload(publicId, file.buffer, {
      contentType: file.mimetype,
      cacheControl: "31536000",
      upsert: false
    });
    if (error) return res.status(500).json({ error: `Storage upload failed: ${error.message}` });
    const { data: pubData } = supabaseAdmin.storage.from("artwork-images").getPublicUrl(publicId);
    const publicUrl = pubData?.publicUrl;
    if (!publicUrl) return res.status(500).json({ error: "Failed to resolve public URL for uploaded asset." });
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
  } catch (err) {
    console.error("Media upload error:", err);
    return res.status(500).json({ error: err.message || "Failed to upload media" });
  }
});

// server/routes/inquiries.ts
var import_express6 = require("express");
var inquiriesRouter = (0, import_express6.Router)();
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
    sendInquiryNotificationToStudio({
      id: savedInquiry.id,
      name,
      email,
      phone,
      artwork_slug,
      artwork_title,
      inquiry_type,
      message
    }).catch((err) => console.warn("[Resend Email] Notice sending studio notification:", err));
    sendInquiryConfirmationToCollector({
      name,
      email,
      artwork_title
    }).catch((err) => console.warn("[Resend Email] Notice sending collector confirmation:", err));
    return res.status(201).json({ success: true, inquiry: savedInquiry, emailDispatched: true });
  } catch (err) {
    console.error("Save inquiry error:", err);
    return res.status(500).json({ error: err.message || "Failed to save inquiry" });
  }
});
inquiriesRouter.get("/", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM public.inquiries ORDER BY created_at DESC LIMIT 100`
    );
    return res.json({ success: true, inquiries: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch inquiries" });
  }
});
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
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to update inquiry" });
  }
});

// server/routes/adminUsers.ts
var import_express7 = require("express");
var adminUsersRouter = (0, import_express7.Router)();
adminUsersRouter.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    const profileRes = await query(
      `SELECT id, role, is_active, full_name FROM public.profiles`
    );
    const profiles = new Map(profileRes.rows.map((p) => [p.id, p]));
    const users = (data.users || []).map((u) => {
      const p = profiles.get(u.id);
      return {
        id: u.id,
        email: u.email || "",
        name: p?.full_name || u.user_metadata?.name || "",
        role: p?.role || u.user_metadata?.role || "viewer",
        isActive: p ? p.is_active !== false : true,
        lastSignInAt: u.last_sign_in_at || null,
        createdAt: u.created_at
      };
    });
    return res.json({ success: true, users });
  } catch (err) {
    console.error("List users error:", err);
    return res.status(500).json({ error: err.message || "Failed to list users" });
  }
});
adminUsersRouter.post("/invite", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { email, name, role } = req.body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    const cleanRole = role === "editor" || role === "viewer" ? role : "editor";
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
      data: { name: name || "", role: cleanRole }
    });
    if (error) throw error;
    if (data.user) {
      await query(
        `INSERT INTO public.profiles (id, email, full_name, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name`,
        [data.user.id, email.trim().toLowerCase(), name || "", cleanRole]
      );
    }
    return res.status(201).json({ success: true, user: { id: data.user?.id, email, role: cleanRole } });
  } catch (err) {
    console.error("Invite user error:", err);
    return res.status(400).json({ error: err.message || "Failed to invite user" });
  }
});
adminUsersRouter.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive, name } = req.body || {};
    const supabaseAdmin = getSupabaseAdmin();
    if (role !== void 0) {
      if (!["admin", "editor", "viewer"].includes(role)) {
        return res.status(400).json({ error: "Invalid role." });
      }
      await query(`UPDATE public.profiles SET role = $1 WHERE id = $2`, [role, id]);
      await supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: { role } });
    }
    if (isActive !== void 0) {
      await query(`UPDATE public.profiles SET is_active = $1 WHERE id = $2`, [Boolean(isActive), id]);
      await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: isActive ? "none" : "876000h" });
    }
    if (name !== void 0) {
      await query(`UPDATE public.profiles SET full_name = $1 WHERE id = $2`, [String(name), id]);
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("Update user error:", err);
    return res.status(400).json({ error: err.message || "Failed to update user" });
  }
});
adminUsersRouter.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.cmsUser?.id) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(400).json({ error: err.message || "Failed to delete user" });
  }
});

// server.ts
import_dotenv.default.config();
var app = (0, import_express8.default)();
var PORT = 3e3;
app.use(import_express8.default.json({ limit: "50mb" }));
app.use(import_express8.default.urlencoded({ extended: true, limit: "50mb" }));
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/database/status", requireAuth, requireRole("editor"), async (req, res) => {
  try {
    const health = await checkDbHealth();
    return res.json({
      success: true,
      ...health,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, connected: false, error: err.message });
  }
});
app.get("/api/email/status", (req, res) => {
  const emailConfig = getEmailConfig();
  res.json({
    success: true,
    provider: "Resend",
    ...emailConfig,
    apiKeyPresent: Boolean(process.env.RESEND_API_KEY)
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
      messageId: result.messageId
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.use("/api/artworks", artworksRouter);
app.use("/api/pages", pagesRouter);
app.use("/api/taxonomies", taxonomiesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/media", mediaRouter);
app.use("/api/inquiries", inquiriesRouter);
app.use("/api/admin/users", adminUsersRouter);
async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express8.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}
var server_default = app;
if (!process.env.VERCEL) {
  startServer();
}
//# sourceMappingURL=index.js.map
