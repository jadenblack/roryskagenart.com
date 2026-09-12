import React, { useMemo, useState } from 'react';
import { AdminLayout, ADMIN_NAV } from './AdminLayout';
import { AdminLoginPage } from './AdminLoginPage';
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
import { useAuth } from '../../context/AuthContext';
import { GalleryAppEngineInstance } from '../../engine/galleryStateEngine';
import { api } from '../../lib/adminApi';
import { UserRole } from '../../types';

interface AdminAppProps {
  /** Hash path after '#', e.g. "/admin/catalog" */
  path: string;
  onNavigate: (path: string) => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({ path, onNavigate }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingArtwork, setEditingArtwork] = useState<string | null>(null);
  const [newInquiryCount, setNewInquiryCount] = useState(0);
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
  const normalizedPath = path.startsWith('/admin') ? path : '/admin';
  const subPath = normalizedPath.replace(/^\/admin\/?/, '') || '';

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

  const showToast = (message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 3000);
  };

  // ------- Artwork mutations (hit the protected API, then refresh engine) -------
  const refreshEngine = async () => {
    try {
      await GalleryAppEngineInstance.syncWithPostgres();
    } catch {
      // Engine handles its own fallback state
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
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (payload.slug) {
        const { slug, ...fields } = payload;
        await api(`/api/artworks/${slug}`, { method: 'PATCH', body: fields });
        showToast('Artwork updated.');
      } else {
        await api('/api/artworks', { method: 'POST', body: payload });
        showToast('Artwork created.');
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
  const renderView = () => {
    switch (subPath) {
      case '':
        return (
          <DashboardHome
            artworks={artworks}
            catalogCount={catalogCount}
            onNavigate={onNavigate}
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
        return <InquiriesView onCountChange={setNewInquiryCount} />;
      case 'pages':
        return <PagesAdminView />;
      case 'media':
        return <MediaAdminView />;
      case 'taxonomies':
        return role === 'viewer' ? <Forbidden /> : <TaxonomiesAdminView />;
      case 'users':
        return role === 'admin' ? <UsersAdminView currentUser={user} /> : <Forbidden />;
      case 'settings':
        return role === 'admin' ? <SettingsAdminView /> : <Forbidden />;
      case 'design':
        return role === 'admin' || role === 'editor' ? <DesignAdminView /> : <Forbidden />;
      case 'trash':
        return (
          <CatalogView
            artworks={artworks}
            role={role}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
          />
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

const Forbidden: React.FC = () => (
  <div className="rounded-xl border border-border bg-card p-12 text-center">
    <p className="text-sm font-medium">Insufficient permissions</p>
    <p className="mt-1 text-sm text-muted-foreground">
      Your role does not have access to this section.
    </p>
  </div>
);
