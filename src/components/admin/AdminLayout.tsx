import React, { useState } from 'react';
import {
  LayoutDashboard,
  Image as ImageIcon,
  Files,
  Inbox,
  Users,
  Tags,
  Settings,
  Trash2,
  Palette,
  ExternalLink,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  ShieldCheck,
  X,
  Menu,
  FolderOpen,
  History,
  ListChecks,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { roleAtLeast } from '../../lib/roles';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { UserRole } from '../../types';

export interface AdminNavItem {
  route: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole?: UserRole;
  badgeCount?: number;
}

/**
 * Studio navigation, with the minimum role that can actually use each section.
 *
 * `minRole` must match the server's own guard on the matching API route —
 * otherwise a Viewer is offered a menu item that answers 403, which is how the
 * Inquiries and Media pages previously failed for read-only accounts.
 *
 *   route          API guard            minRole
 *   /admin         —                    (all)
 *   catalog        public read          (all)
 *   pages          public read          (all)
 *   media          requireRole(editor)  editor
 *   inquiries      requireRole(editor)  editor
 *   taxonomies     requireRole(editor)  editor
 *   design         local only           editor
 *   trash          catalog mutations    editor
 *   changelog      requireAuth          (all)
 *   planning       requireRole(editor)  editor
 *   users          requireRole(admin)   admin
 *   settings       requireRole(admin)   admin
 *
 * `src/test/adminNavGuard.test.ts` asserts the two-column relationship above against the actual
 * route files, so a `minRole` added here without a matching server guard fails the suite rather
 * than surfacing as a 403 in front of the studio.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { route: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { route: '/admin/catalog', label: 'Catalog', icon: ImageIcon },
  { route: '/admin/pages', label: 'Pages', icon: Files },
  { route: '/admin/inquiries', label: 'Inquiries', icon: Inbox, minRole: 'editor' },
  { route: '/admin/media', label: 'Media', icon: FolderOpen, minRole: 'editor' },
  { route: '/admin/taxonomies', label: 'Taxonomies', icon: Tags, minRole: 'editor' },
  { route: '/admin/design', label: 'Design', icon: Palette, minRole: 'editor' },
  // v3.1.0. Two items rather than one with tabs: they differ in access level (all roles vs
  // editor+) and in data source (a generated artifact vs the database), and `ADMIN_NAV` is a flat
  // list whose badge lookup keys on the route.
  //
  // Changelog carries no `minRole` because `GET /api/plan/history` is `requireAuth` only — the
  // release history is static and already public in the repo's own git history.
  { route: '/admin/changelog', label: 'Changelog', icon: History },
  { route: '/admin/planning', label: 'Planning', icon: ListChecks, minRole: 'editor' },
  { route: '/admin/users', label: 'Users', icon: Users, minRole: 'admin' },
  { route: '/admin/settings', label: 'Settings', icon: Settings, minRole: 'admin' },
  { route: '/admin/trash', label: 'Trash', icon: Trash2, minRole: 'editor' },
];

interface AdminLayoutProps {
  /** e.g. "/admin/catalog" */
  currentPath: string;
  onNavigate: (path: string) => void;
  /** New inquiries count for badge */
  inquiryCount?: number;
  trashedCount?: number;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentPath,
  onNavigate,
  inquiryCount = 0,
  trashedCount = 0,
  children,
}) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role: UserRole = user?.role || 'viewer';
  const visibleNav = ADMIN_NAV.filter((item) => !item.minRole || roleAtLeast(role, item.minRole));

  const badgeFor = (route: string) =>
    route === '/admin/inquiries' ? inquiryCount : route === '/admin/trash' ? trashedCount : undefined;

  const sidebar = (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-card transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <img
          src="/android-chrome-192x192.png"
          alt=""
          className="h-8 w-8 shrink-0 rounded-md"
        />
        {!collapsed && (
          <span className="truncate text-sm font-bold uppercase tracking-widest">Studio Admin</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {visibleNav.map((item) => {
          const isActive = currentPath === item.route;
          const count = badgeFor(item.route);
          return (
            <button
              key={item.route}
              onClick={() => {
                onNavigate(item.route);
                setMobileOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && count !== undefined && count > 0 && (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-2">
        {user && (
          <div className={cn('flex items-center gap-2 rounded-md p-2', collapsed && 'justify-center')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
              {(user.name || user.email).slice(0, 2)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name || user.email}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  {role}
                </p>
              </div>
            )}
            {!collapsed && (
              <Button variant="ghost" size="icon" onClick={() => logout()} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mt-1 hidden w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground md:flex cursor-pointer"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:block">{sidebar}</div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50">
            {sidebar}
          </div>
          <button
            className="absolute right-4 top-4 rounded-md bg-card p-2 shadow"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <button
            className="rounded-md p-2 hover:bg-muted md:hidden cursor-pointer"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="truncate text-sm font-semibold">
            {ADMIN_NAV.find((i) => i.route === currentPath)?.label || 'Admin'}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate('/')} title="View public site">
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">View Site</span>
            </Button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
};
