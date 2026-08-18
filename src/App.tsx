/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GalleryAppEngineInstance } from './engine/galleryStateEngine';
import { ArtworkRecord, DriveFile, FilterState, PageDocument } from './types';
import { Navbar } from './components/Navbar';
import { GalleryGrid } from './components/GalleryGrid';
import { ArtworkFocusView } from './components/ArtworkFocusView';
import { MasterRegistryTable } from './components/MasterRegistryTable';
import { DriveExplorer } from './components/DriveExplorer';
import { PagesView } from './components/PagesView';
import { ReadmeView } from './components/ReadmeView';
import { TrashView } from './components/TrashView';
import { CloudinaryManager } from './components/CloudinaryManager';
import { DRIVE_ROOT_PATH } from './data/driveFileSystem';
import { Sparkles, ArrowUp, Github, Heart } from 'lucide-react';

export default function App() {
  const [engineVersion, setEngineVersion] = useState(0);
  const [route, setRoute] = useState<string>('gallery');
  const [selectedArtworkSlug, setSelectedArtworkSlug] = useState<string | null>(null);
  const [selectedPageSlug, setSelectedPageSlug] = useState<string>('about');
  const [explorerTargetFilePath, setExplorerTargetFilePath] = useState<string | undefined>(undefined);
  const [cloudinaryModalOpen, setCloudinaryModalOpen] = useState(false);

  // Subscribe to engine state updates
  useEffect(() => {
    const unsubscribe = GalleryAppEngineInstance.subscribe(() => {
      setEngineVersion((v) => v + 1);
    });
    return () => unsubscribe();
  }, []);

  // Hash-based client router listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (!hash || hash === 'gallery') {
        setRoute('gallery');
        setSelectedArtworkSlug(null);
      } else if (hash.startsWith('artwork/')) {
        const slug = hash.replace('artwork/', '');
        setRoute('artwork');
        setSelectedArtworkSlug(slug);
      } else if (hash.startsWith('page/')) {
        const slug = hash.replace('page/', '');
        setRoute('pages');
        setSelectedPageSlug(slug);
      } else if (hash === 'registry' || hash === 'index') {
        setRoute('registry');
      } else if (hash === 'trash') {
        setRoute('trash');
      } else if (hash === 'explorer' || hash === 'files') {
        setRoute('explorer');
      } else if (hash === 'readme' || hash === 'docs') {
        setRoute('readme');
      } else if (hash === 'pages') {
        setRoute('pages');
      }
    };

    // Initial check
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Sync route changes to window.location.hash
  const navigateTo = (newRoute: string, param?: string) => {
    if (newRoute === 'gallery') {
      window.location.hash = '#gallery';
      setRoute('gallery');
      setSelectedArtworkSlug(null);
    } else if (newRoute === 'artwork' && param) {
      window.location.hash = `#artwork/${param}`;
      setRoute('artwork');
      setSelectedArtworkSlug(param);
    } else if (newRoute === 'pages') {
      const pSlug = param || selectedPageSlug || 'about';
      window.location.hash = `#page/${pSlug}`;
      setRoute('pages');
      setSelectedPageSlug(pSlug);
    } else if (newRoute === 'registry') {
      window.location.hash = '#registry';
      setRoute('registry');
    } else if (newRoute === 'trash') {
      window.location.hash = '#trash';
      setRoute('trash');
    } else if (newRoute === 'explorer') {
      window.location.hash = '#explorer';
      setRoute('explorer');
      if (param) setExplorerTargetFilePath(param);
    } else if (newRoute === 'readme') {
      window.location.hash = '#readme';
      setRoute('readme');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Get reactive items from engine
  const allItems = GalleryAppEngineInstance.items;
  const filteredItems = GalleryAppEngineInstance.getFilteredItems();
  const trashedItems = GalleryAppEngineInstance.getTrashedItems();
  const files = GalleryAppEngineInstance.files;
  const pages = GalleryAppEngineInstance.pages;
  const activeFilters = GalleryAppEngineInstance.activeFilters;

  const currentArtwork = useMemo(() => {
    if (!selectedArtworkSlug) return null;
    return allItems.find((a) => a.slug === selectedArtworkSlug) || allItems[0] || null;
  }, [selectedArtworkSlug, allItems, engineVersion]);

  // Pre-rendered HTML map for pages
  const renderedPagesHtml = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of pages) {
      const { body } = GalleryAppEngineInstance.extractFrontmatter(p.rawMarkdown);
      map[p.slug] = GalleryAppEngineInstance.renderMarkdownWithWikiLinks(body);
    }
    return map;
  }, [pages, engineVersion]);

  const indexMdContent = useMemo(() => {
    const file = files.find((f) => f.path === 'index.md');
    return file ? file.content : '';
  }, [files, engineVersion]);

  const readmeContent = useMemo(() => {
    const file = files.find((f) => f.path === 'readme.md');
    return file ? file.content : '';
  }, [files, engineVersion]);

  return (
    <div id="root-container" className="min-h-screen bg-[#E5E4DF] text-zinc-900 dark:bg-[#0c0c0e] dark:text-[#f4f4f5] flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-900 dark:selection:text-amber-200 transition-colors">
      <div>
        {/* Navigation Bar */}
        <Navbar
          currentRoute={route}
          onNavigate={(r) => navigateTo(r)}
          searchQuery={activeFilters.search}
          onSearchChange={(q) => GalleryAppEngineInstance.setFilter('search', q)}
          totalWorks={allItems.filter(i => !i.trashed).length}
          trashedCount={trashedItems.length}
          onOpenCloudinary={() => setCloudinaryModalOpen(true)}
        />

        {/* Main Content Area with clear layout styling */}
        <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 w-full flex-grow">
          {/* Route 1: Individual Artwork Focus View */}
          {route === 'artwork' && currentArtwork ? (
            <ArtworkFocusView
              artwork={currentArtwork}
              allArtworks={allItems}
              onBack={() => navigateTo('gallery')}
              onSelectArtwork={(slug) => navigateTo('artwork', slug)}
              onNavigatePage={(slug) => navigateTo('pages', slug)}
              onEditInExplorer={(filePath) => navigateTo('explorer', filePath)}
              onOpenCloudinary={() => setCloudinaryModalOpen(true)}
              onToggleEnable={(slug) => GalleryAppEngineInstance.toggleEnableArtwork(slug)}
              onToggleArchive={(slug) => GalleryAppEngineInstance.toggleArchiveArtwork(slug)}
              onTrashArtwork={(slug) => {
                GalleryAppEngineInstance.trashArtwork(slug);
                navigateTo('registry');
              }}
            />
          ) : null}

          {/* Route 2: Gallery Grid (Default) */}
          {route === 'gallery' && (
            <GalleryGrid
              items={filteredItems}
              allItems={allItems}
              filters={activeFilters}
              onFilterChange={(key, val) => GalleryAppEngineInstance.setFilter(key, val)}
              onResetFilters={() => GalleryAppEngineInstance.resetFilters()}
              onSelectArtwork={(slug) => navigateTo('artwork', slug)}
            />
          )}

          {/* Route 3: Master Registry Table (index.md) */}
          {route === 'registry' && (
            <MasterRegistryTable
              items={allItems.filter(i => !i.trashed)}
              rawIndexMd={indexMdContent}
              onSelectArtwork={(slug) => navigateTo('artwork', slug)}
              onEditIndexMd={() => navigateTo('explorer', 'index.md')}
              onToggleEnable={(slug) => GalleryAppEngineInstance.toggleEnableArtwork(slug)}
              onToggleArchive={(slug) => GalleryAppEngineInstance.toggleArchiveArtwork(slug)}
              onTrashArtwork={(slug) => GalleryAppEngineInstance.trashArtwork(slug)}
              onNavigateToTrash={() => navigateTo('trash')}
            />
          )}

          {/* Route 3.5: Dedicated Trash Management View */}
          {route === 'trash' && (
            <TrashView
              trashedItems={trashedItems}
              trashedArtworks={trashedItems}
              onRestore={(slug) => GalleryAppEngineInstance.restoreArtwork(slug)}
              onRestoreArtwork={(slug) => GalleryAppEngineInstance.restoreArtwork(slug)}
              onPermanentDelete={(slug) => GalleryAppEngineInstance.permanentlyDeleteArtwork(slug)}
              onPermanentlyDeleteArtwork={(slug) => GalleryAppEngineInstance.permanentlyDeleteArtwork(slug)}
              onEmptyTrash={() => GalleryAppEngineInstance.emptyTrash()}
              onRestoreAll={() => GalleryAppEngineInstance.restoreAllTrash()}
              onRestoreAllTrash={() => GalleryAppEngineInstance.restoreAllTrash()}
              onNavigateToRegistry={() => navigateTo('registry')}
              onBackToRegistry={() => navigateTo('registry')}
              onNavigateToGallery={() => navigateTo('gallery')}
              onSelectArtwork={(slug) => navigateTo('artwork', slug)}
            />
          )}

          {/* Route 4: Virtual Drive File Explorer */}
          {route === 'explorer' && (
            <DriveExplorer
              files={files}
              initialSelectedPath={explorerTargetFilePath}
              onSaveFile={(path, content) => GalleryAppEngineInstance.saveFile(path, content)}
              onCreateArtwork={(record, narrative) => {
                const slug = GalleryAppEngineInstance.createNewArtwork(record, narrative);
                navigateTo('artwork', slug);
              }}
              onSelectArtwork={(slug) => navigateTo('artwork', slug)}
              onOpenCloudinary={() => setCloudinaryModalOpen(true)}
            />
          )}

          {/* Route 5: Pages (About, Contact, Exhibitions, Commissions) */}
          {route === 'pages' && (
            <PagesView
              pages={pages}
              activePageSlug={selectedPageSlug}
              onSelectPage={(slug) => navigateTo('pages', slug)}
              onSelectArtwork={(slug) => navigateTo('artwork', slug)}
              renderedHtmlMap={renderedPagesHtml}
            />
          )}

          {/* Route 6: System Guidelines (readme.md) */}
          {route === 'readme' && (
            <ReadmeView
              readmeContent={readmeContent}
              onOpenExplorer={() => navigateTo('explorer', 'readme.md')}
            />
          )}
        </main>
      </div>

      {/* Luxury Studio Gallery Footer */}
      <footer className="bg-[#DFDED9] dark:bg-[#09090c] border-t border-zinc-300 dark:border-zinc-800/80 mt-20 text-xs font-mono text-zinc-600 dark:text-zinc-500 py-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-3">
              <span className="font-display font-black text-lg text-zinc-950 dark:text-zinc-100 tracking-wider">
                RORY SKAGEN STUDIO
              </span>
              <p className="text-zinc-700 dark:text-zinc-400 font-sans text-xs max-w-md leading-relaxed">
                Official fine art gallery and studio portfolio celebrating four decades of iconic retro pop art, Austin landmarks, and neon roadside Americana. Original paintings and fine art commissions available.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400/90 font-mono">
                Studio Repository: <code className="text-zinc-900 dark:text-zinc-300">{DRIVE_ROOT_PATH}</code>
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-zinc-950 dark:text-zinc-200 font-bold text-xs block uppercase tracking-wider">Fine Art Collection</span>
              <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-400 font-sans">
                <li><button onClick={() => navigateTo('gallery')} className="hover:text-black dark:hover:text-amber-300 transition-colors cursor-pointer">Available Artworks</button></li>
                <li><button onClick={() => navigateTo('pages', 'about')} className="hover:text-black dark:hover:text-amber-300 transition-colors cursor-pointer">Biography &amp; Legacy</button></li>
                <li><button onClick={() => navigateTo('pages', 'commissions')} className="hover:text-black dark:hover:text-amber-300 transition-colors cursor-pointer">Mural Commissions</button></li>
                <li><button onClick={() => navigateTo('pages', 'exhibitions')} className="hover:text-black dark:hover:text-amber-300 transition-colors cursor-pointer">Exhibition History</button></li>
              </ul>
            </div>

            <div className="space-y-2">
              <span className="text-zinc-950 dark:text-zinc-200 font-bold text-xs block uppercase tracking-wider">Studio Architecture</span>
              <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-400 font-sans">
                <li><button onClick={() => navigateTo('registry')} className="hover:text-black dark:hover:text-amber-300 transition-colors cursor-pointer">Master Catalog (index.md)</button></li>
                <li><button onClick={() => navigateTo('trash')} className="hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer">Trash Vault ({trashedItems.length})</button></li>
                <li><button onClick={() => navigateTo('explorer')} className="hover:text-black dark:hover:text-amber-300 transition-colors cursor-pointer">Drive Files &amp; Editor</button></li>
                <li><button onClick={() => navigateTo('readme')} className="hover:text-black dark:hover:text-amber-300 transition-colors cursor-pointer">System Specs (readme.md)</button></li>
                <li><button onClick={() => navigateTo('pages', 'contact')} className="hover:text-black dark:hover:text-amber-300 transition-colors cursor-pointer">Acquisitions &amp; Contact</button></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-zinc-300 dark:border-zinc-800/60 flex items-center justify-between flex-wrap gap-4 text-[11px] text-zinc-600 dark:text-zinc-500">
            <div>
              &copy; {new Date().getFullYear()} Rory Skagen Studio. All rights reserved. Artwork and original paintings presented for acquisition and exhibition.
            </div>
            <div className="flex items-center gap-4 font-mono">
              <span className="text-zinc-800 dark:text-zinc-400">Austin, Texas</span>
              <span>•</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">Studio Active</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Cloudinary Integration Modal */}
      <CloudinaryManager
        isOpen={cloudinaryModalOpen}
        onClose={() => setCloudinaryModalOpen(false)}
        artworks={allItems}
        onSelectArtwork={(slug) => {
          setCloudinaryModalOpen(false);
          navigateTo('artwork', slug);
        }}
      />
    </div>
  );
}
