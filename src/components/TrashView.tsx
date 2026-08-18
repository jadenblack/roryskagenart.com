import React, { useState } from 'react';
import { ArtworkRecord } from '../types';
import { Trash2, RotateCcw, AlertTriangle, Search, CheckCircle2, ShieldAlert, ArrowLeft, RefreshCw, Eye } from 'lucide-react';
import { getArtworkSvg } from '../data/artAssets';

export interface TrashViewProps {
  trashedItems?: ArtworkRecord[];
  trashedArtworks?: ArtworkRecord[];
  onRestore?: (slug: string) => void;
  onRestoreArtwork?: (slug: string) => void;
  onPermanentDelete?: (slug: string) => void;
  onPermanentlyDeleteArtwork?: (slug: string) => void;
  onEmptyTrash?: () => void;
  onRestoreAll?: () => void;
  onRestoreAllTrash?: () => void;
  onSelectArtwork?: (slug: string) => void;
  onNavigateToRegistry?: () => void;
  onBackToRegistry?: () => void;
  onNavigateToGallery?: () => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  trashedItems,
  trashedArtworks,
  onRestore,
  onRestoreArtwork,
  onPermanentDelete,
  onPermanentlyDeleteArtwork,
  onEmptyTrash,
  onRestoreAll,
  onRestoreAllTrash,
  onSelectArtwork,
  onNavigateToRegistry,
  onBackToRegistry,
  onNavigateToGallery
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmEmptyModal, setConfirmEmptyModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ArtworkRecord | null>(null);

  const effectiveTrashedItems = trashedItems || trashedArtworks || [];
  const handleRestore = onRestore || onRestoreArtwork || (() => {});
  const handlePermanentDelete = onPermanentDelete || onPermanentlyDeleteArtwork || (() => {});
  const handleEmptyTrash = onEmptyTrash || (() => {});
  const handleRestoreAll = onRestoreAll || onRestoreAllTrash || (() => {});
  const handleGoToRegistry = onNavigateToRegistry || onBackToRegistry || (() => {});
  const handleGoToGallery = onNavigateToGallery || (() => {});

  const filteredItems = effectiveTrashedItems.filter((item) => {
    if (!item) return false;
    const q = searchTerm.toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item.slug || '').toLowerCase().includes(q) ||
      (item.medium || '').toLowerCase().includes(q) ||
      (item.gallery_series || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono pb-16">
      {/* Header Banner */}
      <div className="bg-white dark:bg-black border border-red-200 dark:border-red-900/40 p-6 sm:p-8 relative overflow-hidden shadow-xs transition-colors">
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-red-600 dark:text-red-400 mb-2 font-bold">
              <Trash2 className="w-3.5 h-3.5" />
              <span>TRASH VAULT &amp; STAGING</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-sans flex items-center gap-3">
              <span>Trash Management</span>
              <span className="text-sm font-mono px-2.5 py-0.5 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800/60 text-red-700 dark:text-red-300 font-bold rounded-xs">
                {effectiveTrashedItems.length} {effectiveTrashedItems.length === 1 ? 'item' : 'items'}
              </span>
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 max-w-2xl leading-relaxed font-sans">
              Entries moved to the trash are excluded from the public gallery and master index. You can restore records to the active portfolio or permanently purge records.
            </p>
          </div>

          {/* Global Trash Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleGoToRegistry}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Catalog</span>
            </button>

            {effectiveTrashedItems.length > 0 && (
              <>
                <button
                  onClick={handleRestoreAll}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore All ({effectiveTrashedItems.length})</span>
                </button>

                <button
                  onClick={() => setConfirmEmptyModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/60 border border-red-300 dark:border-red-800/80 text-red-700 dark:text-red-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span>Empty Trash</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-3 flex items-center justify-between flex-wrap gap-4 text-[10px] shadow-xs transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-zinc-600 dark:text-zinc-500 uppercase text-[9px] tracking-wider font-bold">
            FILTER TRASHED ENTRIES ({filteredItems.length} OF {effectiveTrashedItems.length})
          </span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search trashed titles or slugs..."
            className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 pl-8 pr-3 py-1.5 text-[10px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 rounded-xs"
          />
        </div>
      </div>

      {/* Main Table or Empty State */}
      {effectiveTrashedItems.length === 0 ? (
        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-12 text-center space-y-4 shadow-xs transition-colors rounded-xs">
          <div className="w-14 h-14 bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 mx-auto flex items-center justify-center text-zinc-500 rounded-xs">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-950 dark:text-white font-sans">Trash Vault is Empty</h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs max-w-md mx-auto leading-relaxed font-sans">
            No entries are currently in the trash. All artwork posts and pages are active and synchronized with the master index.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={handleGoToGallery}
              className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs shadow-xs"
            >
              Browse Gallery
            </button>
            <button
              onClick={handleGoToRegistry}
              className="px-4 py-2 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs shadow-xs"
            >
              View Master Catalog
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 overflow-hidden shadow-xs transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-[#F2F1EC] dark:bg-black text-zinc-700 dark:text-zinc-400 uppercase text-[9px] tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-bold">Artwork Entry &amp; Preview</th>
                  <th className="py-3 px-4 font-bold">Slug Identifier</th>
                  <th className="py-3 px-4 font-bold">Medium &amp; Dimensions</th>
                  <th className="py-3 px-4 font-bold">Series Cycle</th>
                  <th className="py-3 px-4 font-bold">Staging Status</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-900">
                {filteredItems.map((item) => (
                  <tr key={item.slug} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5 shadow-2xs">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-contain grayscale opacity-60"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getArtworkSvg(item.slug);
                          }}
                        />
                      </div>
                      <div>
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 line-through block truncate max-w-[180px] font-sans">
                          {item.title}
                        </span>
                        <span className="text-[9px] text-zinc-500">{item.year} • {item.edition}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                      <code className="text-[9px] text-red-700 dark:text-red-400/80 bg-red-50 dark:bg-red-950/20 px-1 py-0.5 border border-red-200 dark:border-red-900/30 font-mono">
                        trash/{item.slug}.md
                      </code>
                    </td>

                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-400">
                      <span>{item.medium}</span>
                      {item.dimensions && item.dimensions !== '-' && (
                        <span className="text-zinc-500 block text-[9px]">({item.dimensions})</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-400">
                      <span className="px-1.5 py-0.5 bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-[9px] font-bold">
                        {item.gallery_series}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-block px-1.5 py-0.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800/80 text-[9px] uppercase tracking-wider font-bold">
                        TRASHED
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Restore Button */}
                        <button
                          onClick={() => handleRestore(item.slug)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-[9px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs"
                          title="Restore to active collection"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>

                        {/* Permanent Delete Button */}
                        <button
                          onClick={() => setItemToDelete(item)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/60 border border-red-300 dark:border-red-800/80 text-red-700 dark:text-red-300 text-[9px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs"
                          title="Permanently delete file and metadata"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Confirm Empty Trash */}
      {confirmEmptyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#121216] border border-red-300 dark:border-red-800 p-6 max-w-md w-full space-y-4 shadow-2xl rounded-xs">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <ShieldAlert className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-black uppercase tracking-wider text-zinc-950 dark:text-white font-sans">Permanently Empty Trash?</h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 text-xs font-sans leading-relaxed">
              This will permanently delete all <strong className="text-zinc-950 dark:text-white font-bold">{effectiveTrashedItems.length}</strong> items in the trash vault, including markdown content files and image references. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmEmptyModal(false)}
                className="px-4 py-2 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleEmptyTrash();
                  setConfirmEmptyModal(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 rounded-xs shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Empty Trash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Single Item Permanent Deletion */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#121216] border border-red-300 dark:border-red-800 p-6 max-w-md w-full space-y-4 shadow-2xl rounded-xs">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-black uppercase tracking-wider text-zinc-950 dark:text-white font-sans">Delete Entry Permanently?</h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 text-xs font-sans leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-zinc-950 dark:text-white font-bold">"{itemToDelete.title}"</strong> (<code className="text-red-600 dark:text-red-400">{itemToDelete.slug}</code>)? The markdown post file and its catalog record will be deleted.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handlePermanentDelete(itemToDelete.slug);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 rounded-xs shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
