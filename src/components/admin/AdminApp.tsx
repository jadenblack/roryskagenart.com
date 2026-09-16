import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout, ADMIN_NAV } from './AdminLayout';
import { AdminLoginPage } from './AdminLoginPage';
import { PasswordSetupView } from './PasswordSetupView';
import { DashboardHome } from './DashboardHome';
import { CatalogView } from './CatalogView';
import { ArtworkEditDialog } from './ArtworkEditDialog';
import { InquiriesView } from './InquiriesView';
import { PagesAdminView } from './PagesAdminView';
import { UsersAdminView } from './UsersAdminView';
import { TaxonomiesAdminView } from './TaxonomiesAdminView';
import { SettingsAdminView } from './SettingsAdminView';
import { DesignAdminView } from './DesignAdminView';
import { MediaAdminView } from './MediaAdminView';
import { ChangelogView } from './ChangelogView';
import { PlanningView } from './PlanningView';
import { useAuth } from '../../context/AuthContext';
import { GalleryAppEngineInstance } from '../../engine/galleryStateEngine';
import { api } from '../../lib/adminApi';
import { parseAdminPath } from '../../lib/adminRoute';
import type { PlanBoardSummary } from '../../lib/planTypes';
import { UserRole } from '../../types';

interface AdminAppProps {
  /** Hash path after '#', e.g. "/admin/catalog" */
  path: string;
  onNavigate: (path: string) => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({ path, onNavigate }) => {
  const { user, isAuthenticated, isLoading, authHandoff, clearAuthHandoff } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingArtwork, setEditingArtwork] = useState<string | null>(null);
  const [newInquiryCount, setNewInquiryCount] = useState(0);
  /**
   * Public planning submissions nobody has read yet — the Planning nav badge.
   *
   * `v3.2.0` item 5. Fetched here rather than pushed up by `PlanningView`, because a badge that
   * only populates once you have opened the page it points at is a badge that tells you nothing.
   * (The inquiries badge has exactly that weakness: `InquiriesView` reports its own count, so it
   * reads 0 until you visit Inquiries. Not repeated here.)
   */
  const [planTriageCount, setPlanTriageCount] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const engineVersion = useMemo(
    () => GalleryAppEngineInstance.subscribe(() => setFlash(`${Date.now()}`)),
    []
  );
  void engineVersion;

  const artworks = GalleryAppEngineInstance.items;
  const catalogCount = GalleryAppEngineInstance.getCatalogCount();
  const trashedCount = artworks.filter((a) => a.trashed || a.status === 'Trashed').length;

  const role: UserRole = (user?.role as UserRole) || 'viewer';
  const canManageCatalog = role === 'admin' || role === 'editor';
  const normalizedPath = path.startsWith('/admin') ? path : '/admin';

  // "#/admin/catalog?edit=<slug>" — the deep link the public dossier's
  // "Edit in Studio" action uses, so it lands on that entry's editor rather
  // than dumping the curator into the whole catalog list.
  const { subPath, editSlug } = useMemo(() => parseAdminPath(path), [path]);

  const showToast = (message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 3000);
  };

  // Open the editor for a deep-linked entry, once the engine has the record.
  const deepLinkHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editSlug || subPath !== 'catalog') {
      deepLinkHandledRef.current = null;
      return;
    }
    if (deepLinkHandledRef.current === editSlug) return;

    const found = artworks.some((a) => a.slug === editSlug);
    if (!found) {
      // The engine bootstraps from the bundled registry and replaces it when
      // /api/artworks answers; a miss before hydration is not a miss.
      if (!GalleryAppEngineInstance.hydrated) return;
      deepLinkHandledRef.current = editSlug;
      showToast(`No catalog entry matches “${editSlug}”.`);
      return;
    }

    deepLinkHandledRef.current = editSlug;
    setEditingArtwork(editSlug);
    setEditDialogOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSlug, subPath, artworks]);

  // The Planning badge. `?limit=1` — one row is enough, the summary is a separate aggregate and
  // does not shrink with the page. Re-runs on `path` so triaging on the board clears the badge
  // on the way out, and swallowed on failure: a badge is never worth an error screen.
  useEffect(() => {
    if (!canManageCatalog || !isAuthenticated) {
      setPlanTriageCount(0);
      return;
    }
    let cancelled = false;
    api<{ summary?: PlanBoardSummary }>('/api/plan/items?limit=1')
      .then((data) => {
        if (!cancelled) setPlanTriageCount(Number(data?.summary?.awaitingTriage ?? 0));
      })
      .catch(() => {
        if (!cancelled) setPlanTriageCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageCatalog, isAuthenticated, path]);

  const showLogin = !isLoading && !isAuthenticated;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking session…</p>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <AdminLoginPage
        onSuccess={() => {
          /* AuthContext listener flips isAuthenticated */
        }}
        onBackToSite={() => onNavigate('/')}
      />
    );
  }

  // Invitation / password-reset hand-off: Supabase already signed the user in
  // from the emailed token, so the only thing left is choosing a password.
  if (authHandoff) {
    return (
      <PasswordSetupView
        reason={authHandoff}
        onDone={clearAuthHandoff}
        onBackToSite={() => onNavigate('/')}
      />
    );
  }

  // ------- Artwork mutations (hit the protected API, then refresh engine) -------
  const refreshEngine = async () => {
    try {
      await GalleryAppEngineInstance.syncWithPostgres();
    } catch {
      // Engine handles its own fallback state
    }
  };

  const handleSetDraft = async (slug: string, draft: boolean) => {
    try {
      // Server contract: draft=true forces enabled=false; draft=false republishes.
      await api(`/api/artworks/${slug}`, { method: 'PATCH', body: { draft } });
      showToast(draft ? 'Unpublished — now a private draft.' : 'Artwork published.');
      await refreshEngine();
    } catch (err: any) {
      showToast(err.message || 'Failed to update draft state');
    }
  };

  const handleToggleHero = async (slug: string, next: boolean) => {
    try {
      await api(`/api/artworks/${slug}`, { method: 'PATCH', body: { hero_slider: next } });
      showToast(`Hero slider ${next ? 'enabled' : 'disabled'} for artwork.`);
      await refreshEngine();
    } catch (err: any) {
      showToast(err.message || 'Failed to update');
    }
  };

  const handleToggleEnabled = async (slug: string, next: boolean) => {
    try {
      await api(`/api/artworks/${slug}`, { method: 'PATCH', body: { enabled: next } });
      showToast(`Artwork ${next ? 'enabled' : 'disabled'}.`);
      await refreshEngine();
    } catch (err: any) {
      showToast(err.message || 'Failed to update');
    }
  };

  const handleToggleArchive = async (slug: string, next: boolean) => {
    try {
      await api(`/api/artworks/${slug}`, { method: 'PATCH', body: { archived: next } });
      showToast(`Artwork ${next ? 'archived' : 'unarchived'}.`);
      await refreshEngine();
    } catch (err: any) {
      showToast(err.message || 'Failed to update');
    }
  };

  const handleTrash = async (slug: string) => {
    try {
      await api(`/api/artworks/${slug}`, { method: 'DELETE' });
      showToast('Moved to trash.');
      await refreshEngine();
    } catch (err: any) {
      showToast(err.message || 'Failed to trash artwork');
    }
  };

  const handleRestore = async (slug: string) => {
    try {
      await api(`/api/artworks/${slug}`, { method: 'PATCH', body: { trashed: false, status: 'Available' } });
      showToast('Artwork restored.');
      await refreshEngine();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore artwork');
    }
  };

  const handlePermanentDelete = async (slug: string) => {
    try {
      await api(`/api/artworks/${slug}?permanent=true`, { method: 'DELETE' });
      showToast('Artwork permanently deleted.');
      await refreshEngine();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete artwork');
    }
  };

  const handleSaveArtwork = async (
    payload: Record<string, unknown> & { slug?: string }
  ): Promise<{ success: boolean; error?: string; slug?: string }> => {
    try {
      if (payload.slug) {
        const { slug, ...fields } = payload;
        await api(`/api/artworks/${slug}`, { method: 'PATCH', body: fields });
        showToast('Artwork updated.');
      } else {
        const created = await api<{ success: boolean; artwork?: { slug: string } }>('/api/artworks', { method: 'POST', body: payload });
        showToast(payload.draft ? 'Draft created — auto-save is now on.' : 'Artwork created.');
        // Refresh FIRST so the dialog's artwork prop resolves to the new
        // record, THEN switch the dialog into edit mode on it — continuing
        // edits (incl. auto-save) PATCH instead of POST duplicates.
        await refreshEngine();
        setEditingArtwork(created?.artwork?.slug || null);
        return { success: true, slug: created?.artwork?.slug };
      }
      await refreshEngine();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save artwork' };
    }
  };

  const seriesOptions = Array.from(
    new Set(artworks.map((a) => a.gallery_series).filter(Boolean) as string[])
  ).sort();

  // ------- Route resolution -------
  // Each guarded case mirrors the server's own `requireRole` on the matching
  // API route, so a viewer never reaches a screen that answers 403.
  const canEdit = canManageCatalog;
  const renderView = () => {
    switch (subPath) {
      case '':
        return (
          <DashboardHome
            artworks={artworks}
            catalogCount={catalogCount}
            onNavigate={onNavigate}
            role={role}
          />
        );
      case 'catalog':
        return (
          <CatalogView
            artworks={artworks}
            role={role}
            onSelectArtwork={(slug) => onNavigate(`/artwork/${slug}`)}
            onToggleHero={handleToggleHero}
            onToggleEnabled={handleToggleEnabled}
            onToggleArchive={handleToggleArchive}
            onTrash={handleTrash}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
            onSetDraft={canManageCatalog ? handleSetDraft : undefined}
            onEdit={(slug) => {
              setEditingArtwork(slug);
              setEditDialogOpen(true);
            }}
            onCreate={() => {
              setEditingArtwork(null);
              setEditDialogOpen(true);
            }}
          />
        );
      case 'inquiries':
        return canEdit ? <InquiriesView onCountChange={setNewInquiryCount} /> : <Forbidden required="editor" />;
      case 'pages':
        return <PagesAdminView canEdit={canEdit} />;
      case 'media':
        return canEdit ? <MediaAdminView /> : <Forbidden required="editor" />;
      case 'taxonomies':
        return canEdit ? <TaxonomiesAdminView /> : <Forbidden required="editor" />;
      case 'users':
        return role === 'admin' ? <UsersAdminView currentUser={user} /> : <Forbidden required="administrator" />;
      case 'settings':
        return role === 'admin' ? <SettingsAdminView /> : <Forbidden required="administrator" />;
      case 'design':
        return canEdit ? <DesignAdminView /> : <Forbidden required="editor" />;
      // v3.1.0. Changelog is readable by every role (`GET /api/plan/history` is `requireAuth`
      // only); Planning is editor+ (`requireRole('editor')` on every read and write of the board).
      // Both cases mirror ADMIN_NAV's minRole, which src/test/adminNavGuard.test.ts asserts.
      case 'changelog':
        return <ChangelogView />;
      case 'planning':
        return canEdit ? <PlanningView /> : <Forbidden required="editor" />;
      case 'trash':
        return canEdit ? (
          <CatalogView
            artworks={artworks}
            role={role}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
            onSetDraft={canManageCatalog ? handleSetDraft : undefined}
          />
        ) : (
          <Forbidden required="editor" />
        );
      default:
        return (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">Unknown admin page: {subPath}</p>
          </div>
        );
    }
  };

  const artworkForEdit = editingArtwork
    ? artworks.find((a) => a.slug === editingArtwork) || null
    : null;

  return (
    <div className="relative">
      <AdminLayout
        currentPath={normalizedPath}
        onNavigate={onNavigate}
        inquiryCount={newInquiryCount}
        planTriageCount={planTriageCount}
        trashedCount={trashedCount}
      >
        {renderView()}
      </AdminLayout>

      {/* Artwork create/edit dialog (opened from catalog) */}
      <ArtworkEditDialog
        open={editDialogOpen}
        artwork={artworkForEdit}
        seriesOptions={seriesOptions}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleSaveArtwork}
      />

      {/* Toast */}
      {flash && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {flash}
        </div>
      )}
    </div>
  );
};

const Forbidden: React.FC<{ required?: string }> = ({ required }) => (
  <div className="rounded-xl border border-border bg-card p-12 text-center">
    <p className="text-sm font-medium">Insufficient permissions</p>
    <p className="mt-1 text-sm text-muted-foreground">
      {required
        ? `This section requires ${required} access. Ask a studio administrator to upgrade your role.`
        : 'Your role does not have access to this section.'}
    </p>
  </div>
);
