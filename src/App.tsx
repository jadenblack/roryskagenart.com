/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GalleryAppEngineInstance } from './engine/galleryStateEngine';
import { ArtworkRecord, DriveFile, FilterState, PageDocument } from './types';
import { Navbar } from './components/Navbar';
import { HomeLandingView } from './components/HomeLandingView';
import { AboutView } from './components/AboutView';
import { ContactView } from './components/ContactView';
import { AuthGateView } from './components/AuthGateView';
import { GalleryGrid } from './components/GalleryGrid';
import { ArtworkFocusView } from './components/ArtworkFocusView';
import { MasterRegistryTable } from './components/MasterRegistryTable';
import { DriveExplorer } from './components/DriveExplorer';
import { PagesView } from './components/PagesView';
import { ReadmeView } from './components/ReadmeView';
import { TrashView } from './components/TrashView';
import { CloudinaryManager } from './components/CloudinaryManager';
import { AdminLoginModal } from './components/AdminLoginModal';
import { useAuth } from './context/AuthContext';
import { Lock, ShieldCheck } from 'lucide-react';

export default function App() {
  const { isAuthenticated, user } = useAuth();
  const [engineVersion, setEngineVersion] = useState(0);
  const [route, setRoute] = useState<string>('home');
  const [selectedArtworkSlug, setSelectedArtworkSlug] = useState<string | null>(null);
  const [selectedPageSlug, setSelectedPageSlug] = useState<string>('about');
  const [explorerTargetFilePath, setExplorerTargetFilePath] = useState<string | undefined>(undefined);
  const [cloudinaryModalOpen, setCloudinaryModalOpen] = useState(false);
  const [adminAuthModalOpen, setAdminAuthModalOpen] = useState(false);

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
      if (!hash || hash === 'home') {
        setRoute('home');
        setSelectedArtworkSlug(null);
      } else if (hash === 'gallery' || hash === 'catalog') {
        setRoute('gallery');
        setSelectedArtworkSlug(null);
      } else if (hash === 'about') {
        setRoute('about');
        setSelectedArtworkSlug(null);
      } else if (hash === 'contact' || hash === 'inquire') {
        setRoute('contact');
        setSelectedArtworkSlug(null);
      } else if (hash.startsWith('artwork/')) {
        const slug = hash.replace('artwork/', '');
        setRoute('artwork');
        setSelectedArtworkSlug(slug);
      } else if (hash.startsWith('page/')) {
        const slug = hash.replace('page/', '');
        if (slug === 'about') {
          setRoute('about');
        } else if (slug === 'contact') {
          setRoute('contact');
        } else {
          setRoute('pages');
          setSelectedPageSlug(slug);
        }
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
    if (newRoute === 'home') {
      window.location.hash = '#home';
      setRoute('home');
      setSelectedArtworkSlug(null);
    } else if (newRoute === 'gallery' || newRoute === 'catalog') {
      window.location.hash = '#catalog';
      setRoute('gallery');
      setSelectedArtworkSlug(null);
    } else if (newRoute === 'about') {
      window.location.hash = '#about';
      setRoute('about');
      setSelectedArtworkSlug(null);
    } else if (newRoute === 'contact' || newRoute === 'inquire') {
      window.location.hash = '#contact';
      setRoute('contact');
      setSelectedArtworkSlug(null);
    } else if (newRoute === 'artwork' && param) {
      window.location.hash = `#artwork/${param}`;
      setRoute('artwork');
      setSelectedArtworkSlug(param);
    } else if (newRoute === 'pages') {
      const pSlug = param || selectedPageSlug || 'about';
      if (pSlug === 'about') {
        window.location.hash = '#about';
        setRoute('about');
      } else if (pSlug === 'contact') {
        window.location.hash = '#contact';
        setRoute('contact');
      } else {
        window.location.hash = `#page/${pSlug}`;
        setRoute('pages');
        setSelectedPageSlug(pSlug);
      }
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

  // Helper to get friendly page title for auth gate
  const getPageTitle = (r: string): string => {
    switch (r) {
      case 'registry':
        return 'Master Catalog Index (index.md)';
      case 'trash':
        return 'Trash Bin';
      case 'explorer':
        return 'Virtual Drive File Editor';
      case 'pages':
        return 'Studio Page Editor';
      case 'readme':
        return 'Studio System Guidelines';
      default:
        return 'Studio Workspace';
    }
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

  const isPublicRoute = ['home', 'gallery', 'catalog', 'artwork', 'about', 'contact'].includes(route);

  return (
    <div id="root-container" className="min-h-screen bg-[#E5E4DF] text-zinc-900 dark:bg-[#0c0c0e] dark:text-[#f4f4f5] flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-900 dark:selection:text-amber-200 transition-colors">
      <div>
        {/* Public Clean Header (Single-Tier) */}
        <Navbar
          currentRoute={route}
          onNavigate={(r) => navigateTo(r)}
          onOpenAdminAuth={() => setAdminAuthModalOpen(true)}
        />

        {/* Main Content Area */}
        <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 w-full flex-grow">
          {/* Public Route 0: Home Exhibition Landing */}
          {route === 'home' && (
            <HomeLandingView
              onNavigate={(r, p) => navigateTo(r, p)}
              onOpenAdminAuth={() => setAdminAuthModalOpen(true)}
              featuredArtworks={allItems.filter(i => !i.trashed)}
              totalWorks={allItems.filter(i => !i.trashed).length}
            />
          )}

          {/* Public Route 1: Catalog / Gallery Grid */}
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

          {/* Public Route 2: Individual Artwork Focus View */}
          {route === 'artwork' && currentArtwork && (
            <ArtworkFocusView
              artwork={currentArtwork}
              allArtworks={allItems}
              onBack={() => navigateTo('gallery')}
              onSelectArtwork={(slug) => navigateTo('artwork', slug)}
              onNavigatePage={(slug) => navigateTo(slug)}
              onEditInExplorer={(filePath) => navigateTo('explorer', filePath)}
              onOpenCloudinary={() => setCloudinaryModalOpen(true)}
              onToggleEnable={(slug) => GalleryAppEngineInstance.toggleEnableArtwork(slug)}
              onToggleArchive={(slug) => GalleryAppEngineInstance.toggleArchiveArtwork(slug)}
              onTrashArtwork={(slug) => {
                GalleryAppEngineInstance.trashArtwork(slug);
                navigateTo('gallery');
              }}
            />
          )}

          {/* Public Route 3: About Page */}
          {route === 'about' && (
            <AboutView
              onNavigate={(r, p) => navigateTo(r, p)}
              onOpenInquiry={() => navigateTo('contact')}
            />
          )}

          {/* Public Route 4: Contact & Inquiries Page */}
          {route === 'contact' && (
            <ContactView
              onNavigate={(r, p) => navigateTo(r, p)}
              prefillArtworkTitle={currentArtwork ? currentArtwork.title : undefined}
            />
          )}

          {/* Protected Routes Gate: If route is an admin tool and visitor is not authenticated */}
          {!isPublicRoute && !isAuthenticated && (
            <AuthGateView
              pageName={getPageTitle(route)}
              onOpenAdminAuth={() => setAdminAuthModalOpen(true)}
              onBackToHome={() => navigateTo('home')}
            />
          )}

          {/* Protected Routes (When Authenticated) */}
          {!isPublicRoute && isAuthenticated && (
            <>
              {/* Admin Route 1: Master Registry Table (index.md) */}
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

              {/* Admin Route 2: Dedicated Trash Management View */}
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

              {/* Admin Route 3: Virtual Drive File Explorer */}
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

              {/* Admin Route 4: Markdown Pages Editor */}
              {route === 'pages' && (
                <PagesView
                  pages={pages}
                  activePageSlug={selectedPageSlug}
                  onSelectPage={(slug) => navigateTo('pages', slug)}
                  onSelectArtwork={(slug) => navigateTo('artwork', slug)}
                  renderedHtmlMap={renderedPagesHtml}
                />
              )}

              {/* Admin Route 5: System Guidelines (readme.md) */}
              {route === 'readme' && (
                <ReadmeView
                  readmeContent={readmeContent}
                  onOpenExplorer={() => navigateTo('explorer', 'readme.md')}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          PUBLIC FINE ART STUDIO FOOTER (Refined Editorial Layout)
      ────────────────────────────────────────────────────────────────*/}
      <footer className="bg-[#DFDED9] dark:bg-[#09090c] border-t-2 border-zinc-900 dark:border-zinc-800 mt-20 text-xs font-mono text-zinc-600 dark:text-zinc-400 py-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand & Studio Heritage Column */}
            <div className="md:col-span-2 space-y-3">
              <span className="font-serif font-black text-xl text-zinc-950 dark:text-white uppercase tracking-wider block">
                Rory Skagen Art
              </span>
              <p className="text-zinc-700 dark:text-zinc-400 font-sans text-xs max-w-md leading-relaxed">
                Official fine art studio and gallery celebrating four decades of iconic retro pop surrealism, Austin landmarks, and neon roadside Americana. Original paintings, large-scale steel panels, and fine art commissions available.
              </p>
              <div className="text-[11px] text-zinc-500 font-mono">
                Austin, Texas • Est. 1985 • Co-Creator of <em>&ldquo;Greetings from Austin&rdquo;</em> Mural
              </div>
            </div>

            {/* Navigation Column */}
            <div className="space-y-2">
              <span className="text-zinc-950 dark:text-zinc-100 font-bold text-xs block uppercase tracking-wider">
                Explore
              </span>
              <ul className="space-y-2 text-xs font-mono">
                <li>
                  <button 
                    onClick={() => navigateTo('home')} 
                    className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('gallery')} 
                    className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Catalog ({allItems.filter(i => !i.trashed).length} Works)
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('about')} 
                    className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    About Rory
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('contact')} 
                    className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Contact &amp; Inquiries
                  </button>
                </li>
              </ul>
            </div>

            {/* Studio Services Column */}
            <div className="space-y-2">
              <span className="text-zinc-950 dark:text-zinc-100 font-bold text-xs block uppercase tracking-wider">
                Studio Services
              </span>
              <ul className="space-y-2 text-xs font-mono text-zinc-700 dark:text-zinc-400">
                <li>
                  <button 
                    onClick={() => navigateTo('contact')} 
                    className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Original Artwork Inquiries
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('contact')} 
                    className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Mural Commissions
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('contact')} 
                    className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Exhibitions and Press
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('about')} 
                    className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Certificate of Authenticity
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar with Copyright and Subtle Admin Link */}
          <div className="pt-8 border-t border-zinc-300 dark:border-zinc-800/80 flex items-center justify-between flex-wrap gap-4 text-[11px] text-zinc-600 dark:text-zinc-500">
            <div>
              &copy; {new Date().getFullYear()} Rory Skagen Studio. All rights reserved. Austin, Texas.
            </div>
            <div className="flex items-center gap-4 font-mono">
              <span>Austin, TX 78704</span>
              <span>•</span>
              <button
                onClick={() => setAdminAuthModalOpen(true)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1"
                title="Studio Staff Portal"
              >
                {isAuthenticated ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Studio Admin Active</span>
                  </span>
                ) : (
                  <span>Studio Login</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Cloudinary Integration Modal (Protected) */}
      <CloudinaryManager
        isOpen={cloudinaryModalOpen && isAuthenticated}
        onClose={() => setCloudinaryModalOpen(false)}
        artworks={allItems}
        onSelectArtwork={(slug) => {
          setCloudinaryModalOpen(false);
          navigateTo('artwork', slug);
        }}
      />

      {/* Zero-Dependency Admin Authentication Modal */}
      <AdminLoginModal
        isOpen={adminAuthModalOpen}
        onClose={() => setAdminAuthModalOpen(false)}
      />
    </div>
  );
}
