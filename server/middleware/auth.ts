import type { Request, Response, NextFunction } from "express";
import { getSupabaseAdmin, query } from "../../src/server/db";

export interface CmsUser {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  isActive: boolean;
  /**
   * `profiles.full_name`, when the profile has one.
   *
   * The profile query below already selected this column and threw it away. v3.1.0 needs
   * it because `plan_items.author_name` is denormalised on purpose — an item stays
   * attributable after the profile is gone — and an author name that is null for every
   * staff-filed item would make the column decorative.
   */
  name: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      cmsUser?: CmsUser;
    }
  }
}

export const ROLE_ORDER: Record<string, number> = { viewer: 0, editor: 1, admin: 2 };

export async function resolveCmsUser(req: Request): Promise<CmsUser | null> {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;

    const sbUser = data.user;
    let role: CmsUser["role"] = "viewer";
    let isActive = true;
    let name: string | null = null;

    try {
      const profileRes = await query<{ role: string; is_active: boolean; full_name: string | null }>(
        `SELECT role, is_active, full_name FROM public.profiles WHERE id = $1 LIMIT 1`,
        [sbUser.id]
      );
      if (profileRes.rows[0]) {
        const r = String(profileRes.rows[0].role);
        role = r === "admin" || r === "editor" ? r : "viewer";
        isActive = profileRes.rows[0].is_active !== false;
        const fullName = profileRes.rows[0].full_name;
        name = typeof fullName === "string" && fullName.trim().length > 0 ? fullName.trim() : null;
      } else {
        const metaRole = (sbUser.app_metadata?.role || sbUser.user_metadata?.role) as string | undefined;
        role = metaRole === "admin" || metaRole === "editor" ? metaRole : "viewer";
      }
    } catch {
      const metaRole = (sbUser.app_metadata?.role || sbUser.user_metadata?.role) as string | undefined;
      role = metaRole === "admin" || metaRole === "editor" ? metaRole : "viewer";
    }

    return {
      id: sbUser.id,
      email: sbUser.email || "",
      role,
      isActive,
      name,
    };
  } catch {
    return null;
  }
}

/** Requires a valid Supabase session. Populates req.cmsUser. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

/** Requires req.cmsUser.role to be at least `minimum`. Use after requireAuth. */
export function requireRole(minimum: "editor" | "admin") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.cmsUser) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if ((ROLE_ORDER[req.cmsUser.role] ?? -1) < ROLE_ORDER[minimum]) {
      return res.status(403).json({ error: `Requires ${minimum} role or higher.` });
    }
    return next();
  };
}
