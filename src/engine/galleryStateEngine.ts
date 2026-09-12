/**
 * Gallery state engine — thin reactive store over the Supabase API.
 *
 * Source of truth is the database (via /api/artworks, /api/pages). The bundled
 * registry exists only as a synchronous bootstrap cache for first paint and
 * offline fallback; it is fully replaced the moment the API answers.
 *
 * Mutations are async API wrappers: optimistic local update, then PATCH/DELETE,
 * then authoritative reload. No localStorage, no virtual filesystem.
 */

import { ArtworkRecord, ArtworkStatus, FilterState, PageDocument } from '../types';
import {
  extractFrontmatter,
  formatTitle,
  inferScaleCategory,
  renderMarkdownWithWikiLinks,
  resolveImagePath,
  resolveRenditionsFor,
  sanitizeSlug,
  sanitizeTitle,
  calculateCm,
} from '../lib/markdown';
import { getArtworkSvg } from '../data/artAssets';
import { PORTFOLIO_POSTS_REGISTRY } from '../data/portfolioPostsData';
import { DEFAULT_HERO_SLUGS } from '../data/bundledContent';
import { api } from '../lib/adminApi';

/** DB row shape returned by GET /api/artworks. */
interface ArtworkDbRow {
  slug: string;
  title: string;
  year: string | number | null;
  medium: string | null;
  dimensions: string | null;
  price: string | null;
  status: string | null;
  gallery_series: string | null;
  edition: string | null;
  location: string | null;
  image_url: string | null;
  hero_slider: boolean | null;
  enabled: boolean | null;
  archived: boolean | null;
  trashed: boolean | null;
  trashed_at: string | null;
  narrative: string | null;
  metadata?: { tags?: string[]; scaleCategory?: string } | null;
}

function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/^posts\//i, '').replace(/\.md$/i, '').trim();
}

export class GalleryStateEngine {
  public items: ArtworkRecord[] = [];
  public pages: PageDocument[] = [];
  public activeFilters: FilterState = {
    search: '',
    status: 'all',
    medium: 'all',
    series: 'all',
    sort: 'newest'
  };
  /** True once the API has answered at least once (bootstrap cache replaced). */
  public hydrated = false;

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.items = this.buildBootstrapItems();
    this.pages = this.buildBootstrapPages();
    this.notify();
    this.loadFromApi();
  }

  // ------------------------------------------------------------------
  // Data loading
  // ------------------------------------------------------------------

  /** Build first-paint records from the bundled registry (never persisted). */
  private buildBootstrapItems(): ArtworkRecord[] {
    return PORTFOLIO_POSTS_REGISTRY.map((post) => {
      const narrative = [
        `[[index|← Return to Master Catalog Index]]`,
        ``,
        `# ${post.title}`,
        ``,
        post.image ? `![[${post.image}]]` : `![[art.svg]]`,
        ``,
        `> **${post.series}** — Produced ${post.date}`,
        `> **Medium & Dimensions:** ${post.medium} (${post.dimensions}) • ${post.dimensionsInches} (${post.dimensionsCm})`,
        `> **Status:** ${post.status} • **Surface:** ${post.surface}`,
        ``,
        `## Artwork Description`,
        ``,
        post.description,
      ].join('\n');

      return {
        slug: post.slug,
        title: post.title,
        year: post.date ? new Date(post.date).getFullYear() : 2019,
        date: post.date,
        medium: post.medium,
        surface: post.surface,
        type: 'post' as const,
        dimensions: post.dimensions,
        dimensions_cm: post.dimensionsCm,
        status: post.status as ArtworkStatus,
        price: post.price,
        featured_image: post.image || `${post.slug}.jpg`,
        imageUrl: resolveImagePath(post.image, post.slug),
        renditions: resolveRenditionsFor(post.image, post.slug) ?? undefined,
        gallery_series: post.series,
        edition: post.surface ? `${post.medium} on ${post.surface}` : 'Original Artwork',
        location: post.location,
        enabled: true,
        archived: post.status === 'Archived',
        trashed: false,
        heroSlider: DEFAULT_HERO_SLUGS.includes(post.slug),
        narrative,
        renderedHtml: renderMarkdownWithWikiLinks(narrative),
        filePath: `posts/${post.slug}.md`,
        tags: post.tags,
        scaleCategory: inferScaleCategory(post.dimensions),
      };
    });
  }

  private buildBootstrapPages(): PageDocument[] {
    return [
      { slug: 'about', title: 'About', filePath: 'pages/about.md', rawMarkdown: '' },
      { slug: 'contact', title: 'Contact', filePath: 'pages/contact.md', rawMarkdown: '' },
      { slug: 'commissions', title: 'Commissions', filePath: 'pages/commissions.md', rawMarkdown: '' },
      { slug: 'exhibitions', title: 'Exhibitions', filePath: 'pages/exhibitions.md', rawMarkdown: '' },
    ];
  }

  /** Map a DB row onto the public ArtworkRecord shape. */
  private rowToRecord(row: ArtworkDbRow): ArtworkRecord {
    const slug = normalizeSlug(row.slug);
    const narrative = row.narrative || '';
    const imageRef = row.image_url || `${slug}.jpg`;
    const tags = Array.isArray(row.metadata?.tags) ? row.metadata!.tags : [];
    const status = ((row.status as ArtworkStatus) || 'Available');
    const isTrashed = row.trashed === true || status === 'Trashed';
    const dimensions = row.dimensions || '36" x 48"';
    const enabled = row.enabled !== false && !isTrashed && status !== 'Hidden' && status !== 'Disabled';

    return {
      slug,
      title: row.title || formatTitle(slug),
      year: row.year ? parseInt(String(row.year), 10) || row.year : 2019,
      medium: row.medium || 'Acrylic on Canvas',
      surface: undefined,
      type: 'post',
      dimensions,
      dimensions_cm: calculateCm(dimensions),
      status: isTrashed ? 'Trashed' : status,
      price: row.price || (status === 'Sold' ? 'Sold' : 'Inquire'),
      featured_image: imageRef,
      imageUrl: row.image_url?.startsWith('http') || row.image_url?.startsWith('data:')
        ? row.image_url
        : resolveImagePath(imageRef, slug),
      renditions: resolveRenditionsFor(imageRef, slug) ?? undefined,
      gallery_series: row.gallery_series || 'Pop Surrealism & Folklore',
      edition: row.edition || 'Original Artwork',
      location: row.location || 'Austin, TX',
      enabled,
      archived: row.archived === true || status === 'Archived',
      trashed: isTrashed,
      trashedAt: row.trashed_at || undefined,
      heroSlider: row.hero_slider === true,
      narrative,
      renderedHtml: renderMarkdownWithWikiLinks(narrative),
      rawContent: narrative,
      filePath: `posts/${slug}.md`,
      tags,
      scaleCategory: (row.metadata?.scaleCategory as ArtworkRecord['scaleCategory']) || inferScaleCategory(dimensions),
    };
  }

  /**
   * Load the catalog and pages from the API. DB rows fully replace local
   * state — no merging, no overrides. Falls back silently to the current
   * (bootstrap) state when the API is unreachable.
   */
  public async loadFromApi(): Promise<void> {
    try {
      const [artworksRes, pagesRes] = await Promise.all([
        fetch('/api/artworks?include_trashed=true'),
        fetch('/api/pages'),
      ]);

      if (artworksRes.ok) {
        const data = await artworksRes.json();
        if (data.success && Array.isArray(data.artworks)) {
          this.items = data.artworks.map((row: ArtworkDbRow) => this.rowToRecord(row));
          this.hydrated = true;
        }
      }

      if (pagesRes.ok) {
        const data = await pagesRes.json();
        if (data.success && Array.isArray(data.pages)) {
          this.pages = data.pages.map((p: { slug: string; title?: string; content?: string }) => ({
            slug: p.slug,
            title: p.title || formatTitle(p.slug),
            filePath: `pages/${p.slug}.md`,
            rawMarkdown: p.content || '',
          }));
        }
      }

      this.notify();
    } catch {
      // Offline/first-paint: keep bootstrap state
    }
  }

  /** Back-compat alias for the former override-sync entry point. */
  public async syncWithPostgres(): Promise<void> {
    return this.loadFromApi();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // ------------------------------------------------------------------
  // Queries (unchanged public behavior)
  // ------------------------------------------------------------------

  /**
   * Single source of truth for "how many works does the catalog show" —
   * public, enabled, non-trashed artworks.
   */
  public getCatalogCount(): number {
    return this.items.filter(
      (i) => !i.trashed && i.enabled !== false && i.status !== 'Hidden' && i.status !== 'Disabled'
    ).length;
  }

  public getFilteredItems(): ArtworkRecord[] {
    const { search, status, medium, series, sort } = this.activeFilters;

    let result: ArtworkRecord[];
    if (status.toLowerCase() === 'trashed') {
      result = this.items.filter((item) => item.trashed || item.status === 'Trashed');
    } else if (status.toLowerCase() === 'hidden' || status.toLowerCase() === 'disabled') {
      result = this.items.filter((item) => !item.trashed && (item.status === 'Hidden' || item.status === 'Disabled' || item.enabled === false));
    } else if (status.toLowerCase() === 'all-with-hidden') {
      result = this.items.filter((item) => !item.trashed && item.status !== 'Trashed');
    } else {
      result = this.items.filter((item) => !item.trashed && item.status !== 'Trashed' && item.status !== 'Hidden' && item.status !== 'Disabled' && item.enabled !== false);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
          item.slug.toLowerCase().includes(q) ||
          item.medium.toLowerCase().includes(q) ||
          item.gallery_series.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q) ||
          item.year.toString().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q)) ||
          item.narrative.toLowerCase().includes(q)
        );
      });
    }

    if (status !== 'all' && status.toLowerCase() !== 'trashed' && status.toLowerCase() !== 'hidden' && status.toLowerCase() !== 'disabled' && status.toLowerCase() !== 'all-with-hidden') {
      if (status.toLowerCase() === 'archived') {
        result = result.filter((item) => item.status === 'Archived' || item.archived === true);
      } else if (status.toLowerCase() === 'enabled' || status.toLowerCase() === 'active') {
        result = result.filter((item) => item.enabled !== false && item.status !== 'Disabled' && item.status !== 'Hidden');
      } else {
        result = result.filter((item) => item.status.toLowerCase() === status.toLowerCase());
      }
    }

    if (medium !== 'all') {
      result = result.filter((item) => item.medium.toLowerCase().includes(medium.toLowerCase()));
    }

    if (series !== 'all') {
      result = result.filter((item) => item.gallery_series.toLowerCase() === series.toLowerCase());
    }

    result.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return Number(b.year) - Number(a.year);
        case 'oldest':
          return Number(a.year) - Number(b.year);
        case 'price-desc': {
          const numA = parseInt(String(a.price).replace(/[^0-9]/g, '') || '0', 10);
          const numB = parseInt(String(b.price).replace(/[^0-9]/g, '') || '0', 10);
          return numB - numA;
        }
        case 'price-asc': {
          const numA = parseInt(String(a.price).replace(/[^0-9]/g, '') || '0', 10);
          const numB = parseInt(String(b.price).replace(/[^0-9]/g, '') || '0', 10);
          return numA - numB;
        }
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }

  public getActiveItems(): ArtworkRecord[] {
    return this.items.filter((item) => !item.trashed && item.status !== 'Trashed');
  }

  public getTrashedItems(): ArtworkRecord[] {
    return this.items.filter((item) => item.trashed || item.status === 'Trashed');
  }

  public setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]): void {
    this.activeFilters[key] = value;
    this.notify();
  }

  public resetFilters(): void {
    this.activeFilters = {
      search: '',
      status: 'all',
      medium: 'all',
      series: 'all',
      sort: 'newest'
    };
    this.notify();
  }

  // ------------------------------------------------------------------
  // Mutations — optimistic local update + API write + authoritative reload
  // ------------------------------------------------------------------

  private async patchArtwork(slug: string, body: Record<string, unknown>): Promise<void> {
    await api(`/api/artworks/${normalizeSlug(slug)}`, { method: 'PATCH', body });
  }

  private async reload(): Promise<void> {
    await this.loadFromApi();
  }

  public async toggleEnableArtwork(slug: string): Promise<void> {
    const norm = normalizeSlug(slug);
    const item = this.items.find((i) => i.slug === norm);
    if (!item) return;

    const newEnabled = item.enabled === false || item.status === 'Disabled' || item.status === 'Hidden';
    const newStatus: ArtworkStatus = newEnabled ? 'Available' : 'Hidden';
    item.enabled = newEnabled;
    item.status = newStatus;
    this.notify();

    await this.patchArtwork(norm, { enabled: newEnabled, status: newStatus });
    await this.reload();
  }

  public async toggleArchiveArtwork(slug: string): Promise<void> {
    const norm = normalizeSlug(slug);
    const item = this.items.find((i) => i.slug === norm);
    if (!item) return;

    const isArchived = item.status === 'Archived' || item.archived === true;
    const newStatus: ArtworkStatus = isArchived ? 'Available' : 'Archived';
    item.archived = !isArchived;
    item.status = newStatus;
    this.notify();

    await this.patchArtwork(norm, { archived: !isArchived, status: newStatus });
    await this.reload();
  }

  public async toggleHeroSlider(slug: string): Promise<void> {
    const norm = normalizeSlug(slug);
    const item = this.items.find((i) => i.slug === norm);
    if (!item) return;

    const next = !item.heroSlider;
    item.heroSlider = next;
    this.notify();

    await this.patchArtwork(norm, { hero_slider: next });
    await this.reload();
  }

  public async setHeroSlider(slug: string, showInHero: boolean): Promise<void> {
    const norm = normalizeSlug(slug);
    const item = this.items.find((i) => i.slug === norm);
    if (!item) return;

    item.heroSlider = showInHero;
    this.notify();

    await this.patchArtwork(norm, { hero_slider: showInHero });
    await this.reload();
  }

  public async trashArtwork(slug: string): Promise<void> {
    const norm = normalizeSlug(slug);
    const item = this.items.find((i) => i.slug === norm);
    if (item) {
      item.trashed = true;
      item.status = 'Trashed';
      item.trashedAt = new Date().toISOString();
      this.notify();
    }

    await api(`/api/artworks/${norm}`, { method: 'DELETE' });
    await this.reload();
  }

  public async restoreArtwork(slug: string): Promise<void> {
    const norm = normalizeSlug(slug);
    const item = this.items.find((i) => i.slug === norm);
    if (item) {
      item.trashed = false;
      item.status = 'Available';
      item.trashedAt = undefined;
      this.notify();
    }

    await this.patchArtwork(norm, { trashed: false, trashed_at: null, status: 'Available' });
    await this.reload();
  }

  public async restoreAllTrash(): Promise<void> {
    const trashed = this.getTrashedItems().map((i) => i.slug);
    await Promise.allSettled(trashed.map((s) => this.patchArtwork(s, { trashed: false, trashed_at: null, status: 'Available' })));
    await this.reload();
  }

  public async permanentlyDeleteArtwork(slug: string): Promise<void> {
    const norm = normalizeSlug(slug);
    this.items = this.items.filter((i) => i.slug !== norm);
    this.notify();

    await api(`/api/artworks/${norm}?permanent=true`, { method: 'DELETE' });
    await this.reload();
  }

  public async emptyTrash(): Promise<void> {
    const trashed = this.getTrashedItems().map((i) => i.slug);
    await Promise.allSettled(trashed.map((s) => this.permanentlyDeleteArtwork(s)));
    await this.reload();
  }

  public deleteArtwork(slug: string): Promise<void> {
    return this.permanentlyDeleteArtwork(slug);
  }

  // ------------------------------------------------------------------
  // Markdown helpers (delegated to the pure lib; kept for call sites)
  // ------------------------------------------------------------------

  public renderMarkdownWithWikiLinks(markdown: string): string {
    return renderMarkdownWithWikiLinks(markdown);
  }

  public extractFrontmatter(rawText: string): { metadata: Record<string, any>; body: string } {
    return extractFrontmatter(rawText);
  }

  public sanitizeSlug(raw: string): string {
    return sanitizeSlug(raw);
  }

  public sanitizeTitle(raw: string | undefined, fallbackSlug: string): string {
    return sanitizeTitle(raw, fallbackSlug);
  }

  public formatTitle(slug: string): string {
    return formatTitle(slug);
  }

  public resolveRenditionsFor(imgPath: string, slugHint?: string) {
    return resolveRenditionsFor(imgPath, slugHint);
  }

  public resolveImagePath(imgPath: string, slugHint?: string): string {
    if (!imgPath && !slugHint) return getArtworkSvg('art');
    if (imgPath && (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('data:'))) {
      return imgPath;
    }
    const resolved = resolveImagePath(imgPath, slugHint);
    return resolved;
  }
}

// Global Singleton for immediate client accessibility & vanilla JS conformance
export const GalleryAppEngineInstance = new GalleryStateEngine();
export const GalleryAppEngine = GalleryStateEngine;
export const galleryAppEngine = GalleryAppEngineInstance;
