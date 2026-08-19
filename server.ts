import express from "express";
import path from "path";
import multer from "multer";
import type { UploadApiResponse, v2 as CloudinaryV2Type } from "cloudinary";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { authService } from "./src/server/authService";

dotenv.config();

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
app.post("/api/cloudinary/upload", upload.single("file"), async (req, res) => {
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
    const token = authService.parseSessionToken(req);
    const sessionData = token ? authService.validateSession(token) : null;

    res.json({
      ...config,
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

// 3. User Login
app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = authService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isValid = authService.verifyPassword(password, user.passwordHash);
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
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: err.message || "Authentication failed." });
  }
});

// 4. User Logout
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

// 5. Change Password (Authenticated Admin only)
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

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// -------------------------------------------------------------
// Vite Middleware / Static Asset Serving
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
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

startServer();

