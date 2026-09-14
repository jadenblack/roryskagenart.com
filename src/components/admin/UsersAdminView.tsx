import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  UserPlus, Loader2, MoreHorizontal, ShieldCheck, Trash2, Pencil, Mail, MailWarning,
  KeyRound, Copy, Check, Search, Info, UserRound, Clock,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Switch } from '../ui/switch';
import { Skeleton } from '../ui/skeleton';
import { api } from '../../lib/adminApi';
import type { AuthUser } from '../../types';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type CmsRole } from '../../lib/roles';

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: CmsRole;
  isActive: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  invitedAt: string | null;
  confirmedAt: string | null;
  confirmationSentAt: string | null;
  invitePending: boolean;
}

/** Delivery outcome for an invite / reset, surfaced so an admin can act on it. */
interface DeliveryResult {
  title: string;
  delivery: 'email' | 'supabase-mailer' | 'manual';
  link: string | null;
  warning?: string;
}

const ROLE_OPTIONS = (['admin', 'editor', 'viewer'] as CmsRole[]).map((role) => ({
  value: role,
  label: `${ROLE_LABELS[role]} — ${ROLE_DESCRIPTIONS[role]}`,
}));

const roleBadgeVariant = (role: CmsRole) =>
  role === 'admin' ? 'default' : role === 'editor' ? 'info' : 'secondary';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : null;

/** Copy-to-clipboard row used for invitation and reset links. */
const CopyLinkField: React.FC<{ url: string }> = ({ url }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{url}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard?.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
};

export const UsersAdminView: React.FC<{ currentUser: AuthUser | null }> = ({ currentUser }) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<CmsRole>('editor');
  const [inviting, setInviting] = useState(false);

  const [editTarget, setEditTarget] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'editor' as CmsRole, isActive: true });
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDeleteUser, setConfirmDeleteUser] = useState<ManagedUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ users: ManagedUser[] }>('/api/admin/users');
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const patchUser = async (id: string, patch: Record<string, unknown>) => {
    setError(null);
    setBusyId(id);
    try {
      await api(`/api/admin/users/${id}`, { method: 'PATCH', body: patch });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (user: ManagedUser) => {
    try {
      await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      flash(`${user.email} was deleted.`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError(null);
    try {
      const res = await api<{ delivery: DeliveryResult['delivery']; inviteUrl: string | null; warning?: string }>(
        '/api/admin/users/invite',
        { method: 'POST', body: { email: inviteEmail, name: inviteName, role: inviteRole } }
      );
      setInviteOpen(false);
      setDelivery({
        title: `Invitation for ${inviteEmail}`,
        delivery: res.delivery,
        link: res.inviteUrl,
        warning: res.warning,
      });
      setInviteEmail('');
      setInviteName('');
      setInviteRole('editor');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const resendInvite = async (user: ManagedUser) => {
    setError(null);
    setBusyId(user.id);
    try {
      const res = await api<{ delivery: DeliveryResult['delivery']; inviteUrl: string | null; warning?: string }>(
        `/api/admin/users/${user.id}/reinvite`,
        { method: 'POST' }
      );
      setDelivery({
        title: `Invitation re-sent to ${user.email}`,
        delivery: res.delivery,
        link: res.inviteUrl,
        warning: res.warning,
      });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to re-send the invitation');
    } finally {
      setBusyId(null);
    }
  };

  const sendPasswordReset = async (user: ManagedUser) => {
    setError(null);
    setBusyId(user.id);
    try {
      const res = await api<{ delivery: DeliveryResult['delivery']; resetUrl: string | null; warning?: string }>(
        `/api/admin/users/${user.id}/reset-password`,
        { method: 'POST' }
      );
      setDelivery({
        title: `Password reset sent to ${user.email}`,
        delivery: res.delivery,
        link: res.resetUrl,
        warning: res.warning,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to send the password reset');
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (user: ManagedUser) => {
    setEditTarget(user);
    setEditForm({
      name: user.name || '',
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = {};
      if (editForm.name !== (editTarget.name || '')) patch.name = editForm.name;
      if (editForm.email !== editTarget.email) patch.email = editForm.email;
      if (editForm.role !== editTarget.role) patch.role = editForm.role;
      if (editForm.isActive !== editTarget.isActive) patch.isActive = editForm.isActive;

      if (Object.keys(patch).length === 0) {
        setEditTarget(null);
        return;
      }
      await api(`/api/admin/users/${editTarget.id}`, { method: 'PATCH', body: patch });
      setEditTarget(null);
      flash(`${editForm.email} was updated.`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setSavingEdit(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.role].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [users, search]);

  const pendingCount = users.filter((u) => u.invitePending).length;
  const activeAdminCount = users.filter((u) => u.role === 'admin' && u.isActive).length;
  /** Null-tolerant so the edit dialog's JSX can be evaluated while closed. */
  const isSelfUser = (u: ManagedUser | null) => !!u && u.id === currentUser?.id;
  /** Last active administrator can't be demoted/deactivated — mirrors the API guard. */
  const isLastAdminUser = (u: ManagedUser | null) =>
    !!u && u.role === 'admin' && u.isActive && activeAdminCount <= 1;
  const isSelf = isSelfUser;
  const isLastAdmin = isLastAdminUser;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or role…"
            className="pl-8"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {users.length} users
          {pendingCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400"> · {pendingCount} invite{pendingCount === 1 ? '' : 's'} pending</span>
          )}
        </span>
        <Button size="sm" className="ml-auto" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" /> Invite user
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}
      {notice && (
        <Card className="border-emerald-500/40">
          <CardContent className="p-4 text-sm text-emerald-700 dark:text-emerald-400">{notice}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <UserRound className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {users.length === 0 ? 'No studio users yet.' : 'No users match your search.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const self = isSelf(u);
                  const locked = isLastAdmin(u);
                  const busy = busyId === u.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {u.name || u.email}
                          {self && <span className="text-xs text-muted-foreground">(you)</span>}
                          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(u.role)}>{ROLE_LABELS[u.role]}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {formatDate(u.lastSignInAt) || 'Never'}
                      </TableCell>
                      <TableCell>
                        {u.invitePending ? (
                          <Badge variant="warning" className="gap-1">
                            <MailWarning className="h-3 w-3" /> Invite pending
                          </Badge>
                        ) : (
                          <Badge variant={u.isActive ? 'success' : 'secondary'}>
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Actions for ${u.email}`}
                              disabled={busy}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuLabel className="font-normal">
                              <span className="block truncate font-medium text-foreground">
                                {u.name || u.email}
                              </span>
                              <span className="block truncate text-xs font-normal text-muted-foreground">
                                {u.email}
                              </span>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem onSelect={() => openEdit(u)}>
                              <Pencil className="h-4 w-4" /> Edit user details
                            </DropdownMenuItem>

                            {u.invitePending && (
                              <DropdownMenuItem onSelect={() => resendInvite(u)}>
                                <Mail className="h-4 w-4" /> Resend invitation
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem onSelect={() => sendPasswordReset(u)}>
                              <KeyRound className="h-4 w-4" /> Send password reset
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {(['admin', 'editor', 'viewer'] as CmsRole[])
                              .filter((role) => role !== u.role)
                              .map((role) => (
                                <DropdownMenuItem
                                  key={role}
                                  disabled={self || locked}
                                  onSelect={() => patchUser(u.id, { role })}
                                >
                                  <ShieldCheck className="h-4 w-4" /> Make {ROLE_LABELS[role].toLowerCase()}
                                </DropdownMenuItem>
                              ))}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              disabled={self || locked}
                              onSelect={() => patchUser(u.id, { isActive: !u.isActive })}
                            >
                              {u.isActive ? 'Deactivate access' : 'Reactivate access'}
                            </DropdownMenuItem>

                            {!self && (
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={locked}
                                onSelect={() => setConfirmDeleteUser(u)}
                              >
                                <Trash2 className="h-4 w-4" /> Delete user
                              </DropdownMenuItem>
                            )}

                            {(self || locked) && (
                              <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                                  {self
                                    ? 'You cannot change your own role or access.'
                                    : 'This is the only active administrator.'}
                                </div>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role legend — what each permission level actually unlocks */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 text-muted-foreground" /> What each role can do
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['admin', 'editor', 'viewer'] as CmsRole[]).map((role) => (
              <div key={role} className="rounded-md border border-border p-3">
                <Badge variant={roleBadgeVariant(role)}>{ROLE_LABELS[role]}</Badge>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit-user dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update {editTarget?.email}. Role and access changes take effect the next time they load the studio.
            </DialogDescription>
          </DialogHeader>
          <form id="edit-user-form" onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Studio Curator"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                Changing the address signs them in with the new one immediately.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                id="edit-role"
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as CmsRole }))}
                options={ROLE_OPTIONS}
                disabled={isSelf(editTarget!) || isLastAdmin(editTarget!)}
              />
              {(isSelf(editTarget!) || isLastAdmin(editTarget!)) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {isSelf(editTarget!)
                    ? 'You cannot change your own role. Ask another administrator.'
                    : 'This is the only active administrator — promote someone else first.'}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="edit-active">Studio access</Label>
                <p className="text-[11px] text-muted-foreground">
                  {editForm.isActive ? 'They can sign in.' : 'Sign-in is blocked.'}
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={editForm.isActive}
                disabled={isSelf(editTarget!) || isLastAdmin(editTarget!)}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
            <div className="flex justify-end gap-1.5 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingEdit}>
                {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete-user confirmation */}
      <Dialog open={!!confirmDeleteUser} onOpenChange={(open) => !open && setConfirmDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle>Delete user?</DialogTitle>
                <DialogDescription>
                  {confirmDeleteUser?.email} will be permanently deleted. This cannot be undone.
                </DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setConfirmDeleteUser(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirmDeleteUser) deleteUser(confirmDeleteUser);
                    setConfirmDeleteUser(null);
                  }}
                >
                  Delete user
                </Button>
              </div>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              They receive a branded Rory Skagen Art email with a link to set their own password.
            </DialogDescription>
          </DialogHeader>
          <form id="invite-form" onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="curator@roryskagen.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Studio Curator"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as CmsRole)}
                options={ROLE_OPTIONS}
              />
              <p className="text-[11px] text-muted-foreground">{ROLE_DESCRIPTIONS[inviteRole]}</p>
            </div>
            <div className="flex justify-end gap-1.5 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={inviting}>
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send invitation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite / reset delivery result */}
      <Dialog open={!!delivery} onOpenChange={(open) => !open && setDelivery(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {delivery?.delivery === 'email' ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Email sent
                </>
              ) : (
                <>
                  <MailWarning className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Share this link manually
                </>
              )}
            </DialogTitle>
            <DialogDescription>{delivery?.title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {delivery?.delivery === 'email' && (
              <p className="text-sm text-muted-foreground">
                A branded Rory Skagen Art email is on its way. The link below is the same one they
                received — keep it handy in case the email is filtered.
              </p>
            )}
            {delivery?.delivery === 'supabase-mailer' && (
              <p className="text-sm text-muted-foreground">
                The message was sent by the Supabase mailer rather than the branded studio sender.
              </p>
            )}
            {delivery?.warning && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                {delivery.warning}
              </p>
            )}
            {delivery?.link && <CopyLinkField url={delivery.link} />}
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              These links are single-use and expire. If one goes stale, open the user's menu and send it again.
            </p>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setDelivery(null)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
