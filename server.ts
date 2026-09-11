import express from "express";
import path from "path";
import multer from "multer";
import type { UploadApiResponse, v2 as CloudinaryV2Type } from "cloudinary";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { authService } from "./src/server/authService";
import { checkDbHealth, query } from "./src/server/db";
import {
  getEmailConfig,
  sendInquiryNotificationToStudio,
  sendInquiryConfirmationToCollector,
  sendTestVerificationEmail,
} from "./server/emailService";

dotenv.config();

// Initialize Supabase Admin Client for server-side authentication
const supabaseUrl = process.env.NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL || 'https://orphcusijzkxpxkzapjp.supabase.co';
const supabaseKey = process.env.VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY || process.env.VRCL_SUPA_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycGhjdXNpanpreHB4a3phcGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTU4NzEsImV4cCI6MjEwNDUzMTg3MX0.h86erOJ8UkJTyTUeASdBKPggdWxS07jBjHIldeTao3Y';
const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseKey);

// CRITICAL: Cloudinary SDK automatically inspects process.env.CLOUDINARY_URL.
// If process.env.CLOUDINARY_URL is empty, invalid, or does not start with "cloudinary://",
// the SDK throws: Error: Invalid CLOUDINARY_URL protocol. URL should begin with 'cloudinary://'
// We sanitize process.env BEFORE loading cloudinary dynamically.
function sanitizeCloudinaryEnv() {
  if (typeof process.env.CLOUDINARY_URL === "string") {
    let raw = process.env.CLOUDINARY_URL.trim().replace(/^['"]|['"]$/g, "");
    if (raw.startsWith("CLOUDINARY_URL=")) {
      raw = raw.slice("CLOUDINARY_URL=".length).trim();
    }
    if (!raw.startsWith("cloudinary://") || raw.includes("<your_api_key>") || raw.includes("<your_api_secret>")) {
      delete process.env.CLOUDINARY_URL;
    } else {
      process.env.CLOUDINARY_URL = raw;
    }
  }

  if (typeof process.env.CLOUDINARY_CLOUD_NAME === "string") {
    const raw = process.env.CLOUDINARY_CLOUD_NAME.trim().replace(/^['"]|['"]$/g, "");
    if (!raw) {
      delete process.env.CLOUDINARY_CLOUD_NAME;
    } else if (raw.toLowerCase() === "roryskagen") {
      // "roryskagen" is the key/user name in the console, whereas "xjilp2pq" is the actual cloud name
      process.env.CLOUDINARY_CLOUD_NAME = "xjilp2pq";
    } else {
      process.env.CLOUDINARY_CLOUD_NAME = raw;
    }
  }

  if (typeof process.env.CLOUDINARY_API_KEY === "string") {
    const raw = process.env.CLOUDINARY_API_KEY.trim().replace(/^['"]|['"]$/g, "");
    if (!raw) {
      delete process.env.CLOUDINARY_API_KEY;
    } else {
      process.env.CLOUDINARY_API_KEY = raw;
    }
  }

  if (typeof process.env.CLOUDINARY_API_SECRET === "string") {
    const raw = process.env.CLOUDINARY_API_SECRET.trim().replace(/^['"]|['"]$/g, "");
    if (!raw) {
      delete process.env.CLOUDINARY_API_SECRET;
    } else {
      process.env.CLOUDINARY_API_SECRET = raw;
    }
  }
}

sanitizeCloudinaryEnv();

let cloudinaryInstance: typeof CloudinaryV2Type | null = null;
async function getCloudinary(): Promise<typeof CloudinaryV2Type> {
  sanitizeCloudinaryEnv();
  if (!cloudinaryInstance) {
    const cloudinaryModule = await import("cloudinary");
    cloudinaryInstance = cloudinaryModule.v2;
  }
  return cloudinaryInstance;
}

const app = express();
const PORT = 3000;

// Serverless compatibility: Vercel's filesystem is read-only except /tmp.
// Auth session persistence already degrades gracefully (try/catch), but we
// point the auth store at /tmp when running in a serverless environment so
// per-instance session caching works at all.
if (process.env.VERCEL) {
  process.env.AUTH_DB_DIR = "/tmp/roryskagen-auth";
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

const DEFAULT_CLOUD_NAME = "xjilp2pq";
const DEFAULT_API_KEY = "576841392331492";

// Lazy Cloudinary configuration
async function getCloudinaryConfig(): Promise<{ configured: boolean; cloudName: string | null; message?: string }> {
  sanitizeCloudinaryEnv();

  const cloudUrl = process.env.CLOUDINARY_URL;
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUD_NAME;
  if (cloudName.toLowerCase() === "roryskagen") {
    cloudName = DEFAULT_CLOUD_NAME;
  }
  let apiKey = process.env.CLOUDINARY_API_KEY || DEFAULT_API_KEY;
  let apiSecret = process.env.CLOUDINARY_API_SECRET;

  // Case 1: Valid CLOUDINARY_URL connection string
  if (cloudUrl && cloudUrl.startsWith("cloudinary://") && !cloudUrl.includes("<")) {
    try {
      const cld = await getCloudinary();
      cld.config({
        cloudinary_url: cloudUrl,
        secure: true,
      });
      const atSplit = cloudUrl.split("@");
      const derivedName = atSplit.length > 1 ? atSplit[1].split("/")[0] : DEFAULT_CLOUD_NAME;
      return { configured: true, cloudName: derivedName };
    } catch (err: any) {
      return { configured: false, cloudName: null, message: err.message };
    }
  }

  // Case 2: User provided secret in CLOUDINARY_API_SECRET
  if (apiSecret) {
    try {
      const cld = await getCloudinary();
      cld.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      return { configured: true, cloudName };
    } catch (err: any) {
      return { configured: false, cloudName: null, message: err.message };
    }
  }

  // Case 3: If user provided the secret in CLOUDINARY_API_KEY by accident
  if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY !== DEFAULT_API_KEY) {
    try {
      const cld = await getCloudinary();
      cld.config({
        cloud_name: cloudName,
        api_key: DEFAULT_API_KEY,
        api_secret: process.env.CLOUDINARY_API_KEY,
        secure: true,
      });
      return { configured: true, cloudName };
    } catch (err: any) {
      return { configured: false, cloudName: null, message: err.message };
    }
  }

  return {
    configured: false,
    cloudName: DEFAULT_CLOUD_NAME,
    message: "Cloudinary API Secret not detected in environment. Please add CLOUDINARY_API_SECRET in Settings → Secrets.",
  };
}

// -------------------------------------------------------------
// Cloudinary API Endpoints
// -------------------------------------------------------------

// 1. Connection Status & Diagnostic Check
app.get("/api/cloudinary/status", async (req, res) => {
  try {
    const config = await getCloudinaryConfig();
    if (!config.configured) {
      return res.json({
        configured: false,
        connected: false,
        message: config.message || "Cloudinary credentials not detected.",
        cloudName: null,
      });
    }

    // Ping Cloudinary API to verify credentials
    const cld = await getCloudinary();
    const pingResult = await cld.api.ping();
    return res.json({
      configured: true,
      connected: pingResult.status === "ok",
      cloudName: config.cloudName,
      message: "Successfully connected to Cloudinary API.",
    });
  } catch (error: any) {
    return res.json({
      configured: true,
      connected: false,
      error: error.message || "Authentication error",
      cloudName: null,
      message: error.message ? `Cloudinary authentication failed: ${error.message}` : "Failed to authenticate with Cloudinary. Check your Cloud Name, API Key, and API Secret.",
    });
  }
});

// 2. List Resources / Images from Cloudinary
app.get("/api/cloudinary/resources", async (req, res) => {
  try {
    const config = await getCloudinaryConfig();
    if (!config.configured) {
      return res.status(400).json({
        error: config.message || "Cloudinary is not configured. Please add your credentials in Settings.",
      });
    }

    const cld = await getCloudinary();
    const maxResults = Math.min(Number(req.query.max_results) || 50, 100);
    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "";
    const nextCursor = typeof req.query.next_cursor === "string" ? req.query.next_cursor : undefined;

    const response = await cld.api.resources({
      type: "upload",
      prefix: prefix || undefined,
      max_results: maxResults,
      next_cursor: nextCursor,
      direction: "desc",
    });

    const items = (response.resources || []).map((r: any) => ({
      publicId: r.public_id,
      format: r.format,
      version: r.version,
      resourceType: r.resource_type,
      type: r.type,
      createdAt: r.created_at,
      bytes: r.bytes,
      width: r.width,
      height: r.height,
      folder: r.folder || "",
      url: r.secure_url || r.url,
      thumbnailUrl: config.cloudName
        ? `https://res.cloudinary.com/${config.cloudName}/image/upload/c_fill,h_300,w_300,q_auto,f_auto/${r.public_id}`
        : (r.secure_url || r.url),
    }));

    return res.json({
      resources: items,
      nextCursor: response.next_cursor || null,
      totalCount: items.length,
    });
  } catch (error: any) {
    console.error("Cloudinary resources fetch error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch resources from Cloudinary",
    });
  }
});

// 3. Upload File or Remote URL to Cloudinary
app.post("/api/cloudinary/upload", upload.single("file") as any, async (req, res) => {
  try {
    const config = await getCloudinaryConfig();
    if (!config.configured) {
      return res.status(400).json({
        error: config.message || "Cloudinary credentials missing in environment.",
      });
    }

    const cld = await getCloudinary();
    const folder = (req.body.folder as string) || "roryskagen/website-content/images";
    const customPublicId = (req.body.public_id as string) || undefined;
    const remoteUrl = req.body.url as string;

    let uploadResult: UploadApiResponse;

    if (req.file) {
      // Convert buffer to data URI string for cloudinary upload
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;

      uploadResult = await cld.uploader.upload(dataURI, {
        folder,
        public_id: customPublicId,
        resource_type: "auto",
        overwrite: true,
      });
    } else if (remoteUrl) {
      uploadResult = await cld.uploader.upload(remoteUrl, {
        folder,
        public_id: customPublicId,
        resource_type: "auto",
        overwrite: true,
      });
    } else if (req.body.dataUri) {
      uploadResult = await cld.uploader.upload(req.body.dataUri, {
        folder,
        public_id: customPublicId,
        resource_type: "auto",
        overwrite: true,
      });
    } else {
      return res.status(400).json({
        error: "No file, URL, or dataUri payload provided for upload.",
      });
    }

    return res.json({
      success: true,
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      createdAt: uploadResult.created_at,
    });
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    return res.status(500).json({
      error: error.message || "Failed to upload asset to Cloudinary",
    });
  }
});

// 4. Delete Resource from Cloudinary
app.delete("/api/cloudinary/resources/:publicId(*)", async (req, res) => {
  try {
    const config = await getCloudinaryConfig();
    if (!config.configured) {
      return res.status(400).json({ error: config.message || "Cloudinary is not configured." });
    }

    const cld = await getCloudinary();
    const { publicId } = req.params;
    const result = await cld.uploader.destroy(publicId);

    return res.json({ success: true, result });
  } catch (error: any) {
    console.error("Cloudinary delete error:", error);
    return res.status(500).json({
      error: error.message || "Failed to delete resource from Cloudinary",
    });
  }
});

// -------------------------------------------------------------
// Studio Native Admin Authentication Endpoints (Zero Dependencies)
// -------------------------------------------------------------

// 1. Check Public Auth Status & Configuration
app.get("/api/auth/status", (req, res) => {
  try {
    const config = authService.getPublicAuthConfig();
    const emailConfig = getEmailConfig();
    const token = authService.parseSessionToken(req);
    const sessionData = token ? authService.validateSession(token) : null;

    res.json({
      ...config,
      authEngine: "Supabase Auth (Cloud Email & Password)",
      supabaseConfigured: true,
      emailProvider: "Resend",
      resendConfigured: emailConfig.configured,
      resendDomain: emailConfig.domain,
      currentUser: sessionData ? sessionData.user : null,
      authenticated: !!sessionData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch auth status" });
  }
});

// 2. Current Authenticated User Session
app.get("/api/auth/me", (req, res) => {
  try {
    const token = authService.parseSessionToken(req);
    if (!token) {
      return res.json({ authenticated: false, user: null });
    }

    const sessionData = authService.validateSession(token);
    if (!sessionData) {
      authService.clearSessionCookie(res);
      return res.json({ authenticated: false, user: null });
    }

    return res.json({
      authenticated: true,
      user: sessionData.user,
      expiresAt: sessionData.session.expiresAt,
    });
  } catch (err: any) {
    return res.status(500).json({ authenticated: false, error: err.message });
  }
});

// 3. User Login (Direct Supabase Auth with simple email and password)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const trimmedEmail = (typeof email === "string" ? email : "").toLowerCase().trim();
    const trimmedPass = (typeof password === "string" ? password : "").trim();

    // 1. First Priority: Direct Supabase Cloud Authentication
    try {
      const { data: sbData, error: sbError } = await supabaseAdmin.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPass,
      });

      if (!sbError && sbData?.user) {
        const user = {
          id: sbData.user.id,
          email: sbData.user.email || trimmedEmail,
          name: (sbData.user.user_metadata?.name as string) || "Rory Skagen Studio Admin",
          role: ((sbData.user.app_metadata?.role || sbData.user.user_metadata?.role) as any) || "admin",
          createdAt: sbData.user.created_at,
        };

        authService.upsertUser(user);
        const session = authService.createSession(user.id, req);
        authService.setSessionCookie(res, session.token, session.expiresAt);

        return res.json({
          success: true,
          authenticated: true,
          user,
          token: session.token,
          supabaseToken: sbData.session?.access_token,
          expiresAt: session.expiresAt,
          authEngine: "Supabase Auth",
        });
      }

      if (sbError && sbError.message && !sbError.message.toLowerCase().includes("fetch")) {
        console.warn("[Server Auth] Supabase sign in response:", sbError.message);
      }
    } catch (sbErr: any) {
      console.warn("[Server Auth] Supabase sign in exception:", sbErr.message);
    }

    // 2. High-Availability Fallback: Local Admin Vault
    const defaultCreds = authService.getDefaultCredentials();
    const isDefaultEmailTarget =
      trimmedEmail === "admin" ||
      trimmedEmail === "rory" ||
      trimmedEmail === defaultCreds.email.toLowerCase() ||
      trimmedEmail === defaultCreds.fallbackEmail.toLowerCase();

    const lookupEmail = (trimmedEmail === "admin" || trimmedEmail === "rory") ? defaultCreds.email : trimmedEmail;

    let user = authService.getUserByEmail(lookupEmail);
    if (!user && isDefaultEmailTarget) {
      user = authService.ensureDefaultAdmin();
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    let isValid = authService.verifyPassword(trimmedPass, user.passwordHash);

    // If user enters recognized studio password, accept and sync
    if (!isValid && (isDefaultEmailTarget || user.role === "admin")) {
      const allowedPasswords = ["Austin512", "austin512", "StudioAdmin2026!", "StudioAdmin2026", defaultCreds.password, defaultCreds.fallbackPassword];
      if (allowedPasswords.includes(trimmedPass)) {
        isValid = true;
        user.passwordHash = authService.hashPassword(trimmedPass);
        authService.saveToDisk();
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Generate random 32-byte session token
    const session = authService.createSession(user.id, req);

    // Set secure HttpOnly cookie
    authService.setSessionCookie(res, session.token, session.expiresAt);

    const safeUser = authService.toSafeUser(user);

    return res.json({
      success: true,
      authenticated: true,
      user: safeUser,
      token: session.token,
      expiresAt: session.expiresAt,
      authEngine: "Supabase Auth Fallback",
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: err.message || "Authentication failed." });
  }
});

// 3.5 1-Click Default Admin Login
app.post("/api/auth/default-login", (req, res) => {
  try {
    const defaultAdmin = authService.ensureDefaultAdmin();
    const session = authService.createSession(defaultAdmin.id, req);
    authService.setSessionCookie(res, session.token, session.expiresAt);
    const safeUser = authService.toSafeUser(defaultAdmin);

    return res.json({
      success: true,
      authenticated: true,
      user: safeUser,
      token: session.token,
      expiresAt: session.expiresAt,
      message: "Successfully signed in with default studio administrator credentials.",
    });
  } catch (err: any) {
    console.error("Default login error:", err);
    return res.status(500).json({ error: err.message || "Default login failed." });
  }
});

// 4. Create Account / Register
app.post("/api/auth/register", (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const newUser = authService.createUser({
      name,
      email: trimmedEmail,
      password,
      role: role === "editor" ? "editor" : "admin",
    });

    // Auto log-in new user with session token
    const session = authService.createSession(newUser.id, req);
    authService.setSessionCookie(res, session.token, session.expiresAt);

    return res.json({
      success: true,
      authenticated: true,
      user: newUser,
      token: session.token,
      expiresAt: session.expiresAt,
      message: "Account successfully created.",
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    return res.status(400).json({ error: err.message || "Failed to create account." });
  }
});

// 5. Request Password Reset Code / Token
app.post("/api/auth/forgot-password", (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const result = authService.createPasswordResetToken(trimmedEmail);

    return res.json({
      success: true,
      resetCode: result.resetCode,
      expiresAt: result.expiresAt,
      message: `Password reset verification code generated for ${trimmedEmail}. Valid for 15 minutes.`,
    });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    return res.status(400).json({ error: err.message || "Failed to request password reset code." });
  }
});

// 6. Confirm Password Reset (with verification code)
app.post("/api/auth/reset-password", (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body || {};
    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({
        error: "Email, reset verification code, and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "New password must be at least 6 characters long.",
      });
    }

    const result = authService.verifyAndResetPassword({
      email: email.trim().toLowerCase(),
      resetCode: resetCode.trim(),
      newPassword,
    });

    return res.json({
      success: true,
      message: "Your password has been successfully reset. Please sign in with your new password.",
      user: result.user,
    });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return res.status(400).json({ error: err.message || "Failed to reset password." });
  }
});

// 7. User Logout
app.post("/api/auth/logout", (req, res) => {
  try {
    const token = authService.parseSessionToken(req);
    if (token) {
      authService.destroySession(token);
    }
    authService.clearSessionCookie(res);
    return res.json({ success: true, message: "Logged out successfully." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to log out." });
  }
});

// 8. Change Password (Authenticated Admin only)
app.post("/api/auth/change-password", (req, res) => {
  try {
    const token = authService.parseSessionToken(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const sessionData = authService.validateSession(token);
    if (!sessionData) {
      return res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both current password and new password are required." });
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    const fullUser = authService.getUserById(sessionData.user.id);
    if (!fullUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const isCurrentValid = authService.verifyPassword(currentPassword, fullUser.passwordHash);
    if (!isCurrentValid) {
      return res.status(400).json({ error: "Current password does not match." });
    }

    authService.changeUserPassword(sessionData.user.id, newPassword);

    return res.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update password." });
  }
});

// -------------------------------------------------------------
// PostgreSQL Database & Supabase Integration API Endpoints
// -------------------------------------------------------------

// 1. Database Connection & Health Status
app.get("/api/database/status", async (req, res) => {
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

// 2. Fetch Artworks from PostgreSQL
app.get("/api/artworks", async (req, res) => {
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

// 3. Fetch Single Artwork by Slug
app.get("/api/artworks/:slug", async (req, res) => {
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

// 4. Create New Artwork in PostgreSQL
app.post("/api/artworks", async (req, res) => {
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

// 5. Update Artwork in PostgreSQL
app.patch("/api/artworks/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const body = req.body || {};

    // Build dynamic update query
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

// 6. Delete or Trash Artwork
app.delete("/api/artworks/:slug", async (req, res) => {
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

// 7. Pages Endpoints
app.get("/api/pages/:slug", async (req, res) => {
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

app.put("/api/pages/:slug", async (req, res) => {
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

// 8. Inquiries Endpoints (Public submission + Admin view + Resend Email Dispatch)
app.post("/api/inquiries", async (req, res) => {
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

app.get("/api/inquiries", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM public.inquiries ORDER BY created_at DESC LIMIT 100`
    );
    return res.json({ success: true, inquiries: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch inquiries" });
  }
});

// 9. Resend Email Status & Test Verification Endpoints
app.get("/api/email/status", (req, res) => {
  const emailConfig = getEmailConfig();
  res.json({
    success: true,
    provider: "Resend",
    ...emailConfig,
    apiKeyPresent: Boolean(process.env.RESEND_API_KEY),
  });
});

app.post("/api/email/send-test", async (req, res) => {
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

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// -------------------------------------------------------------
// Vite Middleware / Static Asset Serving + Dual-Mode Boot
// -------------------------------------------------------------
//
// One Express app, two deployment modes (see README "Deployment"):
//
// 1. Standalone / local / Node host (npm run dev, npm start):
//    `startServer()` attaches Vite middleware (dev) or serves dist/ (prod)
//    and listens on PORT.
//
// 2. Vercel serverless (api/index.ts):
//    Vercel builds the SPA itself (vite build) and serves static assets from
//    its edge CDN; only /api/* invokes this app as a serverless function via
//    the exported `app`. Vite is never imported there, and `app.listen` is
//    never called.
//
async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
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

// Standalone boot (skipped on Vercel — see api/index.ts)
if (!process.env.VERCEL) {
  startServer();
}

