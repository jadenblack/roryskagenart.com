import { Router } from "express";
import { getSupabaseAdmin, query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const adminUsersRouter = Router();

// List users (admin only)
adminUsersRouter.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;

    const profileRes = await query<{ id: string; role: string; is_active: boolean; full_name: string | null }>(
      `SELECT id, role, is_active, full_name FROM public.profiles`
    );
    const profiles = new Map(profileRes.rows.map((p) => [p.id, p]));

    const users = (data.users || []).map((u) => {
      const p = profiles.get(u.id);
      return {
        id: u.id,
        email: u.email || "",
        name: p?.full_name || (u.user_metadata?.name as string) || "",
        role: (p?.role as string) || (u.user_metadata?.role as string) || "viewer",
        isActive: p ? p.is_active !== false : true,
        lastSignInAt: u.last_sign_in_at || null,
        createdAt: u.created_at,
      };
    });

    return res.json({ success: true, users });
  } catch (err: any) {
    console.error("List users error:", err);
    return res.status(500).json({ error: err.message || "Failed to list users" });
  }
});

// Invite user (admin only)
adminUsersRouter.post("/invite", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { email, name, role } = req.body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    const cleanRole = role === "editor" || role === "viewer" ? role : "editor";

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
      data: { name: name || "", role: cleanRole },
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
  } catch (err: any) {
    console.error("Invite user error:", err);
    return res.status(400).json({ error: err.message || "Failed to invite user" });
  }
});

// Update user role, status, or name (admin only)
adminUsersRouter.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive, name } = req.body || {};
    const supabaseAdmin = getSupabaseAdmin();

    if (role !== undefined) {
      if (!["admin", "editor", "viewer"].includes(role)) {
        return res.status(400).json({ error: "Invalid role." });
      }
      await query(`UPDATE public.profiles SET role = $1 WHERE id = $2`, [role, id]);
      await supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: { role } });
    }

    if (isActive !== undefined) {
      await query(`UPDATE public.profiles SET is_active = $1 WHERE id = $2`, [Boolean(isActive), id]);
      await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: isActive ? "none" : "876000h" });
    }

    if (name !== undefined) {
      await query(`UPDATE public.profiles SET full_name = $1 WHERE id = $2`, [String(name), id]);
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Update user error:", err);
    return res.status(400).json({ error: err.message || "Failed to update user" });
  }
});

// Delete user (admin only)
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
  } catch (err: any) {
    console.error("Delete user error:", err);
    return res.status(400).json({ error: err.message || "Failed to delete user" });
  }
});
