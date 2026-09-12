import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Loader2, MoreHorizontal, ShieldCheck, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { api } from '../../lib/adminApi';
import type { AuthUser } from '../../types';

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastSignInAt: string | null;
  createdAt: string;
}

export const UsersAdminView: React.FC<{ currentUser: AuthUser | null }> = ({ currentUser }) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);

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

  const patchUser = async (id: string, patch: Record<string, unknown>) => {
    setError(null);
    try {
      await api(`/api/admin/users/${id}`, { method: 'PATCH', body: patch });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    }
  };

  const deleteUser = async (user: ManagedUser) => {
    if (!window.confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
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
      await api('/api/admin/users/invite', {
        method: 'POST',
        body: { email: inviteEmail, name: inviteName, role: inviteRole },
      });
      setInviteOpen(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{users.length} users</span>
        <Button size="sm" className="ml-auto" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" /> Invite user
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
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
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="pl-4">
                        <div className="text-sm font-medium">
                          {u.name || u.email} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : u.role === 'editor' ? 'info' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? 'success' : 'warning'}>
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <DropdownMenu
                          align="end"
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="User actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          }
                        >
                          <DropdownMenuLabel>{u.email}</DropdownMenuLabel>
                          {u.role !== 'admin' && (
                            <DropdownMenuItem onClick={() => patchUser(u.id, { role: 'admin' })}>
                              <ShieldCheck className="h-4 w-4" /> Make admin
                            </DropdownMenuItem>
                          )}
                          {u.role !== 'editor' && (
                            <DropdownMenuItem onClick={() => patchUser(u.id, { role: 'editor' })}>
                              Make editor
                            </DropdownMenuItem>
                          )}
                          {u.role !== 'viewer' && (
                            <DropdownMenuItem onClick={() => patchUser(u.id, { role: 'viewer' })}>
                              Make viewer
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => patchUser(u.id, { isActive: !u.isActive })}>
                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                          </DropdownMenuItem>
                          {!isSelf && (
                            <DropdownMenuItem destructive onClick={() => deleteUser(u)}>
                              <Trash2 className="h-4 w-4" /> Delete user
                            </DropdownMenuItem>
                          )}
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

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              They will receive a Supabase invitation email to set their password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
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
                onChange={(e) => setInviteRole(e.target.value)}
                options={[
                  { value: 'admin', label: 'Admin — full control' },
                  { value: 'editor', label: 'Editor — manage content' },
                  { value: 'viewer', label: 'Viewer — read only' },
                ]}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
