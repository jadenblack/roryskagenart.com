/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GalleryAppEngineInstance } from './engine/galleryStateEngine';
import { ArtworkRecord, FilterState, PageDocument } from './types';
import { Navbar } from './components/Navbar';
import { HomeLandingView } from './components/HomeLandingView';
import { AboutView } from './components/AboutView';
import { ContactView } from './components/ContactView';
import { AuthGateView } from './components/AuthGateView';
import { GalleryGrid } from './components/GalleryGrid';
import { ArtworkFocusView } from './components/ArtworkFocusView';
import { PagesView } from './components/PagesView';
import { useAuth } from './context/AuthContext';
import { Lock, ShieldCheck } from 'lucide-react';

const AdminApp = React.lazy(() =>
  import('./components/admin/AdminApp').then((m) => ({ default: m.AdminApp }))
);

export default function App() {
  const { isAuthenticated, user } = useAuth();
  const [engineVersion, setEngineVersion] = useState(0);
  const [route, setRoute] = useState<string>('home');
  const [selectedArtworkSlug, setSelectedArtworkSlug] = useState<string | null>(null);
  const [selectedPageSlug, setSelectedPageSlug] = useState<string>('about');
  const [adminPath, setAdminPath] = useState<string>('/admin');

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

      // Admin dashboard section: #/admin, #/admin/catalog, #/admin/users, …
      if (hash === 'admin' || hash.startsWith('admin/') || hash.startsWith('/admin')) {
        setRoute('admin');
        setAdminPath(hash.startsWith('/admin') ? hash : `/${hash}`);
        return;
      }

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
      } else if (hash === 'registry' || hash === 'index' || hash === 'trash' || hash === 'explorer' || hash === 'files' || hash === 'readme' || hash === 'docs') {
        setRoute('admin');
        setAdminPath('/admin/catalog');
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
    // Admin dashboard paths are full hash paths like "/admin/catalog"
    if (newRoute.startsWith('/admin') || newRoute === '/') {
      const target = newRoute === '/' ? 'home' : newRoute;
      if (target === 'home') {
        window.location.hash = '#home';
        setRoute('home');
        setSelectedArtworkSlug(null);
        return;
      }
      window.location.hash = `#${target}`;
      setRoute('admin');
      setAdminPath(target);
      return;
    }
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
      case 'pages':
        return 'Studio Page Editor';
      default:
        return 'Studio Workspace';
    }
  };

  // Get reactive items from engine
  const allItems = GalleryAppEngineInstance.items;
  const catalogCount = GalleryAppEngineInstance.getCatalogCount();
  const filteredItems = GalleryAppEngineInstance.getFilteredItems();
  const trashedItems = GalleryAppEngineInstance.getTrashedItems();
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

  const isPublicRoute = ['home', 'gallery', 'catalog', 'artwork', 'about', 'contact'].includes(route);

  return (
    <div id="root-container" className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-accent/30 transition-colors">
      <div>
        {/* Admin Dashboard: full-screen takeover, lazy-loaded on demand */}
        {route === 'admin' && (
          <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading Studio Admin...</div>}>
            <AdminApp path={adminPath} onNavigate={(p) => navigateTo(p)} />
          </React.Suspense>
        )}

        {/* Public Clean Header (Single-Tier) — hidden on admin routes */}
        {route !== 'admin' && (
          <Navbar
            currentRoute={route}
            onNavigate={(r) => navigateTo(r)}
          />
        )}

        {/* Main Content Area */}
        <main id="main-content" className={route === 'admin' ? 'hidden' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 w-full flex-grow'}>
          {/* Public Route 0: Home Exhibition Landing */}
          {route === 'home' && (
            <HomeLandingView
              onNavigate={(r, p) => navigateTo(r, p)}
              featuredArtworks={allItems.filter(i => !i.trashed)}
              totalWorks={catalogCount}
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
              onEditInStudio={() => navigateTo('/admin/catalog')}
              onToggleEnable={(slug) => GalleryAppEngineInstance.toggleEnableArtwork(slug)}
              onToggleArchive={(slug) => GalleryAppEngineInstance.toggleArchiveArtwork(slug)}
              onToggleHeroSlider={(slug) => GalleryAppEngineInstance.toggleHeroSlider(slug)}
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

          {/* Protected Routes Gate: legacy admin tools redirect to the dashboard */}
          {!isPublicRoute && !isAuthenticated && (
            <AuthGateView
              pageName={getPageTitle(route)}
              onOpenAdminAuth={() => navigateTo('/admin')}
              onBackToHome={() => navigateTo('home')}
            />
          )}

          {/* Protected Routes (When Authenticated) */}
          {!isPublicRoute && isAuthenticated && (
            <>
              {/* Admin Route: Markdown Pages Editor */}
              {route === 'pages' && (
                <PagesView
                  pages={pages}
                  activePageSlug={selectedPageSlug}
                  onSelectPage={(slug) => navigateTo('pages', slug)}
                  onSelectArtwork={(slug) => navigateTo('artwork', slug)}
                  renderedHtmlMap={renderedPagesHtml}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          PUBLIC FINE ART STUDIO FOOTER (Refined Editorial Layout)
      ────────────────────────────────────────────────────────────────*/}
      <footer className={route === 'admin' ? 'hidden' : 'bg-surface-deep border-t-2 border-line-strong mt-20 text-xs font-mono text-muted-foreground py-12 transition-colors'}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand & Studio Heritage Column */}
            <div className="md:col-span-2 space-y-3">
              <span className="font-serif font-black text-xl text-foreground uppercase tracking-wider block">
                Rory Skagen Art
              </span>
              <p className="text-foreground/80 font-sans text-xs max-w-md leading-relaxed">
                Official fine art studio and gallery celebrating four decades of iconic retro pop surrealism, Austin landmarks, and neon roadside Americana. Original paintings, large-scale steel panels, and fine art commissions available.
              </p>
              <div className="text-[11px] text-muted-foreground font-mono">
                Austin, Texas • Est. 1985 • Co-Creator of <em>&ldquo;Greetings from Austin&rdquo;</em> Mural
              </div>
            </div>

            {/* Navigation Column */}
            <div className="space-y-2">
              <span className="text-foreground font-bold text-xs block uppercase tracking-wider">
                Explore
              </span>
              <ul className="space-y-2 text-xs font-mono">
                <li>
                  <button 
                    onClick={() => navigateTo('home')} 
                    className="hover:text-foreground transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('gallery')} 
                    className="hover:text-foreground transition-colors cursor-pointer"
                  >
                    Catalog ({catalogCount} Works)
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('about')} 
                    className="hover:text-foreground transition-colors cursor-pointer"
                  >
                    About Rory
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('contact')} 
                    className="hover:text-foreground transition-colors cursor-pointer"
                  >
                    Contact Me
                  </button>
                </li>
              </ul>
            </div>

            {/* Studio Services Column */}
            <div className="space-y-2">
              <span className="text-foreground font-bold text-xs block uppercase tracking-wider">
                Studio Services
              </span>
              <ul className="space-y-2 text-xs font-mono text-foreground/75">
                <li>
                  <button 
                    onClick={() => navigateTo('contact')} 
                    className="hover:text-foreground transition-colors cursor-pointer text-left"
                  >
                    Original Artwork Inquiries
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('contact')} 
                    className="hover:text-foreground transition-colors cursor-pointer text-left"
                  >
                    Mural Commissions
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('contact')} 
                    className="hover:text-foreground transition-colors cursor-pointer text-left"
                  >
                    Exhibitions and Press
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigateTo('about')} 
                    className="hover:text-foreground transition-colors cursor-pointer text-left"
                  >
                    Certificate of Authenticity
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar with Copyright and Subtle Admin Link */}
          <div className="pt-8 border-t border-line flex items-center justify-between flex-wrap gap-4 text-[11px] text-muted-foreground">
            <div>
              &copy; {new Date().getFullYear()} Rory Skagen Studio. All rights reserved. Austin, Texas.
            </div>
            <div className="flex items-center gap-4 font-mono">
              <span>Austin, TX 78704</span>
              <span>•</span>
              <button
                onClick={() => navigateTo('/admin')}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
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


    </div>
  );
}
