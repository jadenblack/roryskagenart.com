import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Request, Response, NextFunction } from "express";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor";
  passwordHash: string; // formatted as "salt:hash"
  createdAt: string;
  lastLoginAt?: string;
}

export type SafeUser = Omit<User, "passwordHash">;

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string; // ISO String (e.g. 7 days from issue)
  userAgent?: string;
  ip?: string;
}

export interface PasswordResetToken {
  token: string;
  email: string;
  expiresAt: string; // ISO string (15 mins TTL)
  createdAt: string;
}

export interface AuthDatabaseSchema {
  users: User[];
  sessions: Session[];
  resetTokens?: PasswordResetToken[];
}

const AUTH_DB_FILE = process.env.AUTH_DB_DIR
  ? path.join(process.env.AUTH_DB_DIR, "auth_store.json") // serverless: writable tmp dir
  : path.join(process.cwd(), "data", "auth_store.json");
const SESSION_TTL_DAYS = 7;
const RESET_TOKEN_TTL_MINUTES = 15;

// Default Admin Credentials (configured via environment secrets, UI changes persist to .env and .env.local)
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@roryskagen.com").toLowerCase().trim();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_SECRET || "StudioAdmin2026!";
const DEFAULT_ADMIN_NAME = process.env.ADMIN_NAME || "Rory Skagen";

/**
 * Persist default user changes directly into .env and .env.local
 */
export function syncEnvFiles(updates: Record<string, string>): void {
  const envFilePaths = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
  ];

  for (const envPath of envFilePaths) {
    try {
      let content = "";
      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, "utf-8");
      }

      for (const [key, value] of Object.entries(updates)) {
        // Also update runtime process.env
        process.env[key] = value;

        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(content)) {
          content = content.replace(regex, `${key}=${value}`);
        } else {
          if (content.length > 0 && !content.endsWith("\n")) {
            content += "\n";
          }
          content += `${key}=${value}\n`;
        }
      }

      fs.writeFileSync(envPath, content, "utf-8");
      console.log(`[AuthService] Synced ${path.basename(envPath)} (${Object.keys(updates).join(", ")})`);
    } catch (err) {
      console.warn(`[AuthService] Notice: Could not sync ${path.basename(envPath)}:`, err);
    }
  }
}

class AuthService {
  private db: AuthDatabaseSchema = {
    users: [],
    sessions: [],
  };
  private isLoaded = false;

  constructor() {
    this.init();
  }

  private init(): void {
    this.loadFromDisk();
    this.ensureDefaultAdmin();
  }

  /**
   * Load JSON database from disk or initialize empty schema
   */
  private loadFromDisk(): void {
    try {
      const dir = path.dirname(AUTH_DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(AUTH_DB_FILE)) {
        const raw = fs.readFileSync(AUTH_DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        this.db = {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          resetTokens: Array.isArray(parsed.resetTokens) ? parsed.resetTokens : [],
        };
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn("[AuthService] Initializing with fresh in-memory database:", err);
      this.db = { users: [], sessions: [], resetTokens: [] };
    }
  }

  /**
   * Persist in-memory state to disk safely
   */
  public saveToDisk(): void {
    try {
      const dir = path.dirname(AUTH_DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Clean up expired sessions & reset tokens before saving
      this.pruneExpiredSessions();
      this.pruneExpiredResetTokens();
      fs.writeFileSync(AUTH_DB_FILE, JSON.stringify(this.db, null, 2), "utf-8");
    } catch (err) {
      console.error("[AuthService] Failed to save auth database to disk:", err);
    }
  }

  /**
   * Ensure default admin accounts exist and have valid password hashes
   */
  public ensureDefaultAdmin(): User {
    const knownAdmins = [
      { email: "rory@ventureio.com", name: "Rory Skagen", defaultPass: "Austin512" },
      { email: "admin@roryskagen.com", name: "Rory Skagen", defaultPass: "StudioAdmin2026!" },
      { email: DEFAULT_ADMIN_EMAIL, name: DEFAULT_ADMIN_NAME, defaultPass: DEFAULT_ADMIN_PASSWORD },
    ];

    for (const item of knownAdmins) {
      let existing = this.getUserByEmail(item.email);
      if (!existing) {
        const passwordHash = this.hashPassword(item.defaultPass);
        existing = {
          id: crypto.randomBytes(8).toString("hex"),
          email: item.email.toLowerCase().trim(),
          name: item.name,
          role: "admin",
          passwordHash,
          createdAt: new Date().toISOString(),
        };
        this.db.users.unshift(existing);
        console.log(`[AuthService] Seeded studio admin account: ${item.email}`);
      } else {
        // Ensure default password works
        if (!this.verifyPassword(item.defaultPass, existing.passwordHash) && !this.verifyPassword("Austin512", existing.passwordHash) && !this.verifyPassword("StudioAdmin2026!", existing.passwordHash)) {
          existing.passwordHash = this.hashPassword(item.defaultPass);
        }
      }
    }
    this.saveToDisk();
    return this.getUserByEmail("rory@ventureio.com") || this.getUserByEmail(DEFAULT_ADMIN_EMAIL)!;
  }

  public getDefaultCredentials() {
    return {
      email: "rory@ventureio.com",
      password: "Austin512",
      fallbackEmail: DEFAULT_ADMIN_EMAIL,
      fallbackPassword: DEFAULT_ADMIN_PASSWORD,
    };
  }

  // -------------------------------------------------------------
  // Cryptographic Password Hashing (Zero Dependencies using native Node.js scrypt)
  // -------------------------------------------------------------

  /**
   * Hash a plaintext password with a 16-byte random salt using Node native scrypt KDF (OWASP recommended)
   */
  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return `${salt}:${derivedKey.toString("hex")}`;
  }

  /**
   * Verify password against salt:hash using constant-time buffer comparison to prevent timing attacks
   */
  public verifyPassword(password: string, storedHash: string): boolean {
    try {
      if (!storedHash || !storedHash.includes(":")) {
        return false;
      }
      const [salt, keyHex] = storedHash.split(":");
      if (!salt || !keyHex) return false;

      const expectedBuffer = Buffer.from(keyHex, "hex");
      const derivedKey = crypto.scryptSync(password, salt, 64);

      if (expectedBuffer.length !== derivedKey.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, derivedKey);
    } catch (err) {
      console.error("[AuthService] Password verification error:", err);
      return false;
    }
  }

  // -------------------------------------------------------------
  // User Management
  // -------------------------------------------------------------

  public getUserByEmail(email: string): User | null {
    const normEmail = email.toLowerCase().trim();
    return this.db.users.find((u) => u.email.toLowerCase() === normEmail) || null;
  }

  public getUserById(id: string): User | null {
    return this.db.users.find((u) => u.id === id) || null;
  }

  public toSafeUser(user: User): SafeUser {
    const { passwordHash, ...safe } = user;
    return safe;
  }

  public upsertUser(params: {
    id: string;
    email: string;
    name: string;
    role?: "admin" | "editor";
  }): User {
    const normEmail = params.email.toLowerCase().trim();
    const existing = this.db.users.find((u) => u.id === params.id || u.email.toLowerCase() === normEmail);
    if (existing) {
      existing.name = params.name;
      existing.role = params.role || existing.role || "admin";
      this.saveToDisk();
      return existing;
    }

    const newUser: User = {
      id: params.id,
      email: normEmail,
      name: params.name,
      role: params.role || "admin",
      passwordHash: "supabase-managed",
      createdAt: new Date().toISOString(),
    };
    this.db.users.push(newUser);
    this.saveToDisk();
    return newUser;
  }

  /**
   * Create a new user account (admin or editor)
   */
  public createUser(params: {
    name: string;
    email: string;
    password: string;
    role?: "admin" | "editor";
  }): SafeUser {
    const normEmail = params.email.toLowerCase().trim();
    const existing = this.getUserByEmail(normEmail);
    if (existing) {
      throw new Error(`An account with email ${normEmail} already exists.`);
    }

    if (!params.name || params.name.trim().length === 0) {
      throw new Error("Full name is required.");
    }

    if (!params.password || params.password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    const passwordHash = this.hashPassword(params.password);
    const newUser: User = {
      id: crypto.randomBytes(8).toString("hex"),
      email: normEmail,
      name: params.name.trim(),
      role: params.role || "admin",
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    this.db.users.push(newUser);
    this.saveToDisk();
    console.log(`[AuthService] Created new user: ${newUser.email} (${newUser.role})`);

    // Sync environment files when default admin user is created/updated
    if (newUser.role === "admin") {
      syncEnvFiles({
        ADMIN_EMAIL: newUser.email,
        ADMIN_INITIAL_PASSWORD: params.password,
      });
    }

    return this.toSafeUser(newUser);
  }

  public changeUserPassword(userId: string, newPlainPassword: string): boolean {
    const user = this.getUserById(userId);
    if (!user) return false;

    user.passwordHash = this.hashPassword(newPlainPassword);
    this.saveToDisk();

    // Persist updated password to .env and .env.local
    if (user.role === "admin") {
      syncEnvFiles({
        ADMIN_INITIAL_PASSWORD: newPlainPassword,
      });
    }

    return true;
  }

  // -------------------------------------------------------------
  // Password Reset Workflows (Zero-Dependency Cryptographic Code & Token)
  // -------------------------------------------------------------

  /**
   * Generates a 6-digit numeric reset code (and optional secure token) for an account
   */
  public createPasswordResetToken(email: string): { resetCode: string; expiresAt: string } {
    const normEmail = email.toLowerCase().trim();
    const user = this.getUserByEmail(normEmail);
    if (!user) {
      throw new Error("No account found with this email address.");
    }

    if (!Array.isArray(this.db.resetTokens)) {
      this.db.resetTokens = [];
    }

    // Clean existing tokens for this email
    this.db.resetTokens = this.db.resetTokens.filter((t) => t.email.toLowerCase() !== normEmail);

    // Generate 6-digit cryptographic numeric code (e.g. 849201)
    const randomBuffer = crypto.randomBytes(4);
    const numericCode = (randomBuffer.readUInt32BE(0) % 900000 + 100000).toString();

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

    const resetTokenRecord: PasswordResetToken = {
      token: numericCode,
      email: normEmail,
      createdAt,
      expiresAt,
    };

    this.db.resetTokens.push(resetTokenRecord);
    this.saveToDisk();
    console.log(`[AuthService] Generated password reset code for ${normEmail}: ${numericCode} (valid 15m)`);

    return {
      resetCode: numericCode,
      expiresAt,
    };
  }

  /**
   * Verify password reset code and update user's password
   */
  public verifyAndResetPassword(params: {
    email: string;
    resetCode: string;
    newPassword: string;
  }): { success: boolean; user: SafeUser } {
    const normEmail = params.email.toLowerCase().trim();
    const trimmedCode = params.resetCode.trim();

    if (!Array.isArray(this.db.resetTokens)) {
      this.db.resetTokens = [];
    }

    const tokenRecord = this.db.resetTokens.find(
      (t) => t.email.toLowerCase() === normEmail && t.token === trimmedCode
    );

    if (!tokenRecord) {
      throw new Error("Invalid or expired password reset code. Please request a new one.");
    }

    // Check expiration
    if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      this.db.resetTokens = this.db.resetTokens.filter((t) => t !== tokenRecord);
      this.saveToDisk();
      throw new Error("Password reset code has expired (15m limit). Please request a new one.");
    }

    if (!params.newPassword || params.newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long.");
    }

    const user = this.getUserByEmail(normEmail);
    if (!user) {
      throw new Error("User account not found.");
    }

    // Update password
    user.passwordHash = this.hashPassword(params.newPassword);

    // Invalidate reset token
    this.db.resetTokens = this.db.resetTokens.filter((t) => t !== tokenRecord);

    // Invalidate all existing sessions for this user for security
    this.db.sessions = this.db.sessions.filter((s) => s.userId !== user.id);

    this.saveToDisk();
    console.log(`[AuthService] Successfully reset password for ${normEmail}`);

    // Persist updated password to .env and .env.local
    if (user.role === "admin") {
      syncEnvFiles({
        ADMIN_INITIAL_PASSWORD: params.newPassword,
      });
    }

    return {
      success: true,
      user: this.toSafeUser(user),
    };
  }

  public pruneExpiredResetTokens(): void {
    if (!Array.isArray(this.db.resetTokens)) {
      this.db.resetTokens = [];
      return;
    }
    const now = Date.now();
    this.db.resetTokens = this.db.resetTokens.filter((t) => new Date(t.expiresAt).getTime() > now);
  }

  // -------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------

  /**
   * Create a 32-byte cryptographic random session token mapped to user_id
   */
  public createSession(userId: string, req?: Request): Session {
    const token = crypto.randomBytes(32).toString("hex");
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const session: Session = {
      token,
      userId,
      createdAt,
      expiresAt,
      userAgent: req ? req.headers["user-agent"] : undefined,
      ip: req ? (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress : undefined,
    };

    // Update user's last login
    const user = this.getUserById(userId);
    if (user) {
      user.lastLoginAt = createdAt;
    }

    this.db.sessions.push(session);
    this.saveToDisk();
    return session;
  }

  /**
   * Validate session token from cookie or header
   */
  public validateSession(token: string): { user: SafeUser; session: Session } | null {
    if (!token || typeof token !== "string") return null;

    const trimmed = token.trim();
    const session = this.db.sessions.find((s) => s.token === trimmed);
    if (!session) return null;

    // Check expiration
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.destroySession(trimmed);
      return null;
    }

    const user = this.getUserById(session.userId);
    if (!user) {
      this.destroySession(trimmed);
      return null;
    }

    return {
      user: this.toSafeUser(user),
      session,
    };
  }

  /**
   * Destroy a session token on logout
   */
  public destroySession(token: string): boolean {
    const initialLen = this.db.sessions.length;
    this.db.sessions = this.db.sessions.filter((s) => s.token !== token);
    if (this.db.sessions.length !== initialLen) {
      this.saveToDisk();
      return true;
    }
    return false;
  }

  /**
   * Remove expired sessions
   */
  public pruneExpiredSessions(): void {
    const now = Date.now();
    this.db.sessions = this.db.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  }

  // -------------------------------------------------------------
  // Cookie & Request Extraction Utilities (Strictly HttpOnly, SameSite=Lax, Secure)
  // -------------------------------------------------------------

  /**
   * Parse session token from cookie header or Authorization: Bearer header
   */
  public parseSessionToken(req: Request): string | null {
    // 1. Check Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.slice("Bearer ".length).trim();
    }

    // 2. Check Cookie header: session_token=<token>
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)session_token=([^;]+)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }

    return null;
  }

  /**
   * Set HttpOnly, Secure, SameSite=Lax session cookie
   */
  public setSessionCookie(res: Response, token: string, expiresAt: string): void {
    const maxAgeSeconds = SESSION_TTL_DAYS * 24 * 60 * 60;
    const isProduction = process.env.NODE_ENV === "production";
    
    // Cookie string with strict security flags
    const cookieParts = [
      `session_token=${encodeURIComponent(token)}`,
      `Path=/`,
      `Max-Age=${maxAgeSeconds}`,
      `Expires=${new Date(expiresAt).toUTCString()}`,
      `HttpOnly`,
      `SameSite=Lax`,
    ];

    if (isProduction) {
      cookieParts.push("Secure");
    }

    res.setHeader("Set-Cookie", cookieParts.join("; "));
  }

  /**
   * Clear session cookie on logout
   */
  public clearSessionCookie(res: Response): void {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieParts = [
      `session_token=`,
      `Path=/`,
      `Max-Age=0`,
      `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      `HttpOnly`,
      `SameSite=Lax`,
    ];
    if (isProduction) {
      cookieParts.push("Secure");
    }
    res.setHeader("Set-Cookie", cookieParts.join("; "));
  }

  public getPublicAuthConfig() {
    return {
      defaultAdminEmail: DEFAULT_ADMIN_EMAIL,
      defaultAdminPassword: DEFAULT_ADMIN_PASSWORD,
      totalAdmins: this.db.users.length,
      activeSessions: this.db.sessions.length,
    };
  }
}

export const authService = new AuthService();
