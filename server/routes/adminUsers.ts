import { Router } from "express";
import { getSupabaseAdmin, query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  sendAccessChangedEmail,
  sendEmailChangedEmail,
  sendInviteEmail,
  sendPasswordResetEmail,
  getEmailConfig,
} from "../emailService";
import {
  buildAuthRedirect,
  buildUserPatch,
  classifyUserState,
  decideMutation,
  extractActionLink,
  normalizeEmail,
  normalizeRole,
  type CmsRole,
} from "../lib/userAdmin";

export const adminUsersRouter = Router();

/** Everything on this router is administrator-only. */
adminUsersRouter.use(requireAuth, requireRole("admin"));

interface ProfileRow {
  id: string;
  role: string;
  is_active: boolean;
  full_name: string | null;
  email: string | null;
}

/**
 * Profiles live in `public.profiles`, roles in Supabase Auth metadata. Read both
 * once so the list, the guard counts and the mutation endpoints agree.
 */
async function loadProfiles(): Promise<Map<string, ProfileRow>> {
  const res = await query<ProfileRow>(
    `SELECT id, role, is_active, full_name, email FROM public.profiles`
  );
  return new Map(res.rows.map((p) => [p.id, p]));
}

/** How many administrators could currently sign in. */
async function countActiveAdmins(): Promise<number> {
  const res = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM public.profiles WHERE role = 'admin' AND is_active = true`
  );
  return parseInt(res.rows[0]?.count || "0", 10);
}

// ---------------------------------------------------------------- list users
adminUsersRouter.get("/", async (_req, res) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;

    const profiles = await loadProfiles();

    const users = (data.users || []).map((u) => {
      const p = profiles.get(u.id);
      const state = classifyUserState({
        invited_at: u.invited_at,
        confirmation_sent_at: u.confirmation_sent_at,
        email_confirmed_at: u.email_confirmed_at,
        confirmed_at: u.confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        banned_until: u.banned_until,
      });
      return {
        id: u.id,
        email: u.email || p?.email || "",
        name: p?.full_name || (u.user_metadata?.name as string) || "",
        role: normalizeRole(p?.role) || normalizeRole(u.user_metadata?.role) || "viewer",
        isActive: p ? p.is_active !== false : true,
        lastSignInAt: u.last_sign_in_at || null,
        createdAt: u.created_at,
        invitedAt: u.invited_at || null,
        confirmedAt: u.email_confirmed_at || u.confirmed_at || null,
        confirmationSentAt: u.confirmation_sent_at || null,
        /** Never accepted the invitation — the studio still has to chase this row. */
        invitePending: state.invitePending,
      };
    });

    return res.json({ success: true, count: users.length, users });
  } catch (err: any) {
    console.error("List users error:", err);
    return res.status(500).json({ error: err.message || "Failed to list users" });
  }
});

// --------------------------------------------------------------- invite user
interface IssuedInvite {
  userId: string | null;
  inviteUrl: string | null;
  delivery: "email" | "supabase-mailer" | "manual";
  warning?: string;
}

/**
 * Mint a fresh invitation link.
 *
 * An unaccepted invitation leaves an `auth.users` row behind that blocks a
 * second invite, so `replaceUserId` clears it first. That is safe — the account
 * was never signed into, and its `profiles` row cascades — and it is what makes
 * "Resend invitation" deterministic instead of dependent on GoTrue's
 * already-registered heuristics.
 */
async function mintInvite(params: {
  email: string;
  name: string;
  role: CmsRole;
  replaceUserId?: string | null;
}): Promise<{ userId: string | null; inviteUrl: string | null; mailerSent: boolean }> {
  const supabaseAdmin = getSupabaseAdmin();
  const email = normalizeEmail(params.email)!;
  const redirectTo = buildAuthRedirect(getEmailConfig().siteUrl);
  const data = { name: params.name, role: params.role };

  if (params.replaceUserId) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(params.replaceUserId);
    } catch (err) {
      console.warn("[admin-users] could not clear the stale invitation row:", err);
    }
  }

  const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo, data },
  });

  if (!error) {
    const url = extractActionLink({ data: linkData });
    if (url) {
      return { userId: linkData?.user?.id || null, inviteUrl: url, mailerSent: false };
    }
  }

  // No usable link — let the platform mailer handle the whole flow instead.
  const fallback = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo, data });
  if (!fallback.error) {
    return { userId: fallback.data?.user?.id || null, inviteUrl: null, mailerSent: true };
  }

  throw new Error(
    `Could not create the invitation: ${error?.message || fallback.error.message}`
  );
}

/**
 * Create (or re-create) an invitation and deliver it.
 *
 * Delivery order:
 *   1. mint the link and send a **branded** email through Resend;
 *   2. if the link could not be minted, fall back to Supabase's own mailer;
 *   3. either way, return the action link so an administrator can copy it —
 *      email deliverability should never be able to block studio onboarding.
 */
async function issueInvite(params: {
  email: string;
  name?: string;
  role: CmsRole;
  invitedBy?: string | null;
  replaceUserId?: string | null;
}): Promise<IssuedInvite> {
  const minted = await mintInvite({
    email: params.email,
    name: params.name || "",
    role: params.role,
    replaceUserId: params.replaceUserId,
  });

  if (!minted.inviteUrl) {
    return {
      userId: minted.userId,
      inviteUrl: null,
      delivery: "supabase-mailer",
      warning:
        "Branded sending was unavailable, so Supabase delivered the invitation email instead.",
    };
  }

  const branded = await sendInviteEmail({
    to: normalizeEmail(params.email)!,
    name: params.name,
    role: params.role,
    actionUrl: minted.inviteUrl,
    invitedBy: params.invitedBy,
  });

  if (branded.success) {
    return { userId: minted.userId, inviteUrl: minted.inviteUrl, delivery: "email" };
  }

  return {
    userId: minted.userId,
    inviteUrl: minted.inviteUrl,
    delivery: "manual",
    warning: `The email could not be sent (${branded.error}). Copy the invitation link below and share it directly.`,
  };
}

async function upsertProfile(params: {
  id: string;
  email: string;
  name?: string;
  role: CmsRole;
}): Promise<void> {
  await query(
    `INSERT INTO public.profiles (id, email, full_name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET role = EXCLUDED.role,
           full_name = CASE WHEN EXCLUDED.full_name = '' THEN public.profiles.full_name
                            ELSE EXCLUDED.full_name END,
           email = EXCLUDED.email`,
    [params.id, params.email, params.name || "", params.role]
  );
}

adminUsersRouter.post("/invite", async (req, res) => {
  try {
    const { email, name, role } = req.body || {};
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) {
      return res.status(400).json({ error: "A valid email address is required." });
    }
    const cleanRole: CmsRole = normalizeRole(role) || "editor";

    const result = await issueInvite({
      email: cleanEmail,
      name: typeof name === "string" ? name.trim() : "",
      role: cleanRole,
      invitedBy: req.cmsUser?.email || null,
    });

    if (result.userId) {
      await upsertProfile({
        id: result.userId,
        email: cleanEmail,
        name: typeof name === "string" ? name.trim() : "",
        role: cleanRole,
      });
    }

    return res.status(201).json({
      success: true,
      user: { id: result.userId, email: cleanEmail, role: cleanRole },
      delivery: result.delivery,
      inviteUrl: result.inviteUrl,
      warning: result.warning,
    });
  } catch (err: any) {
    console.error("Invite user error:", err);
    return res.status(400).json({ error: err.message || "Failed to invite user" });
  }
});

// ------------------------------------------------------------- re-send invite
adminUsersRouter.post("/:id/reinvite", async (req, res) => {
  try {
    const { id } = req.params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    if (error) throw error;
    const user = data?.user;
    if (!user?.email) {
      return res.status(404).json({ error: "User not found." });
    }

    const state = classifyUserState({
      invited_at: user.invited_at,
      confirmation_sent_at: user.confirmation_sent_at,
      email_confirmed_at: user.email_confirmed_at,
      confirmed_at: user.confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
    });
    if (state.confirmed) {
      return res.status(409).json({
        error:
          "This user has already accepted their invitation. Use “Send password reset” instead.",
      });
    }

    const profiles = await loadProfiles();
    const profile = profiles.get(id);
    const role = normalizeRole(profile?.role) || normalizeRole(user.user_metadata?.role) || "editor";
    const name = profile?.full_name || (user.user_metadata?.name as string) || "";

    const result = await issueInvite({
      email: user.email,
      name,
      role,
      invitedBy: req.cmsUser?.email || null,
      // Never-signed-in invitation: safe to replace so the resend is deterministic.
      replaceUserId: user.last_sign_in_at ? null : id,
    });

    if (result.userId) {
      await upsertProfile({ id: result.userId, email: user.email, name, role });
    }

    return res.json({
      success: true,
      delivery: result.delivery,
      inviteUrl: result.inviteUrl,
      warning: result.warning,
    });
  } catch (err: any) {
    console.error("Re-invite user error:", err);
    return res.status(400).json({ error: err.message || "Failed to re-send the invitation" });
  }
});

// ------------------------------------------------------------ password reset
adminUsersRouter.post("/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    if (error) throw error;
    const user = data?.user;
    if (!user?.email) {
      return res.status(404).json({ error: "User not found." });
    }

    const profiles = await loadProfiles();
    const name = profiles.get(id)?.full_name || (user.user_metadata?.name as string) || "";

    const config = getEmailConfig();
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: user.email,
      options: { redirectTo: buildAuthRedirect(config.siteUrl) },
    });
    if (linkError) throw linkError;

    const resetUrl = extractActionLink({ data: linkData });
    if (!resetUrl) {
      return res.status(502).json({ error: "Could not generate a reset link. Try again." });
    }

    const sent = await sendPasswordResetEmail({
      to: user.email,
      name,
      actionUrl: resetUrl,
      requestedBy: req.cmsUser?.email || null,
    });

    return res.json({
      success: true,
      delivery: sent.success ? "email" : "manual",
      resetUrl,
      warning: sent.success
        ? undefined
        : `Email could not be sent (${sent.error}). Copy the link below and share it directly.`,
    });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return res.status(400).json({ error: err.message || "Failed to send the password reset" });
  }
});

// ----------------------------------------------------------------- update user
adminUsersRouter.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = buildUserPatch(req.body);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }
    const patch = parsed.patch;

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existing, error: getError } = await supabaseAdmin.auth.admin.getUserById(id);
    if (getError) throw getError;
    const target = existing?.user;
    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }

    const profiles = await loadProfiles();
    const profile = profiles.get(id);
    const targetRole: string = profile?.role || "viewer";
    const targetActive: boolean = profile ? profile.is_active !== false : true;
    const actorId = req.cmsUser!.id;
    const activeAdminCount = await countActiveAdmins();

    const nextRole = patch.role;
    const nextActive = patch.isActive;

    // Role change (including a no-op assignment — the guard is cheap).
    if (nextRole !== undefined && nextRole !== targetRole) {
      const decision = decideMutation({
        action: "role",
        actorId,
        target: { id, email: target.email || "", role: targetRole, isActive: targetActive },
        activeAdminCount,
        nextRole,
      });
      if (!decision.allowed) return res.status(409).json({ error: decision.reason });
    }

    // Deactivation.
    if (nextActive === false && targetActive) {
      const decision = decideMutation({
        action: "deactivate",
        actorId,
        target: { id, email: target.email || "", role: targetRole, isActive: targetActive },
        activeAdminCount,
      });
      if (!decision.allowed) return res.status(409).json({ error: decision.reason });
    }

    // ---- apply -------------------------------------------------------------
    let previousEmail: string | null = null;

    if (nextRole !== undefined && nextRole !== targetRole) {
      await query(`UPDATE public.profiles SET role = $1 WHERE id = $2`, [nextRole, id]);
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: { role: nextRole },
      });
    }

    if (nextActive !== undefined && nextActive !== targetActive) {
      await query(`UPDATE public.profiles SET is_active = $1 WHERE id = $2`, [nextActive, id]);
      await supabaseAdmin.auth.admin.updateUserById(id, {
        ban_duration: nextActive ? "none" : "876000h",
      });
    }

    if (patch.name !== undefined) {
      await query(`UPDATE public.profiles SET full_name = $1 WHERE id = $2`, [patch.name, id]);
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: { name: patch.name },
      });
    }

    if (patch.email !== undefined && patch.email !== (target.email || "").toLowerCase()) {
      previousEmail = target.email || null;
      // The administrator is vouching for the new address, so confirm it —
      // otherwise the user is locked behind a confirmation mail they never got.
      await supabaseAdmin.auth.admin.updateUserById(id, {
        email: patch.email,
        email_confirm: true,
      });
      await query(`UPDATE public.profiles SET email = $1 WHERE id = $2`, [patch.email, id]);
    }

    // ---- notify (best effort — never fail the mutation on email) -----------
    const finalRole = nextRole ?? (targetRole as CmsRole);
    const finalActive = nextActive ?? targetActive;

    if (nextActive !== undefined && nextActive !== targetActive) {
      void sendAccessChangedEmail({
        to: patch.email || target.email!,
        name: patch.name ?? profile?.full_name ?? null,
        role: finalRole,
        active: finalActive,
        changedBy: req.cmsUser?.email || null,
      });
    } else if (previousEmail && patch.email) {
      void sendEmailChangedEmail({
        to: patch.email,
        name: patch.name ?? profile?.full_name ?? null,
        previousEmail,
        changedBy: req.cmsUser?.email || null,
      });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Update user error:", err);
    return res.status(400).json({ error: err.message || "Failed to update user" });
  }
});

// ----------------------------------------------------------------- delete user
adminUsersRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: existing, error: getError } = await supabaseAdmin.auth.admin.getUserById(id);
    if (getError) throw getError;
    const target = existing?.user;
    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }

    const profiles = await loadProfiles();
    const profile = profiles.get(id);
    const decision = decideMutation({
      action: "delete",
      actorId: req.cmsUser!.id,
      target: {
        id,
        email: target.email || "",
        role: profile?.role || "viewer",
        isActive: profile ? profile.is_active !== false : true,
      },
      activeAdminCount: await countActiveAdmins(),
    });
    if (!decision.allowed) return res.status(409).json({ error: decision.reason });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Delete user error:", err);
    return res.status(400).json({ error: err.message || "Failed to delete user" });
  }
});
