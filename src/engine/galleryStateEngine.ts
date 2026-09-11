import { ArtworkRecord, ArtworkStatus, DriveFile, FilterState, MasterIndexRow, PageDocument } from '../types';
import { buildInitialVirtualFileSystem, DRIVE_ROOT_PATH } from '../data/driveFileSystem';
import { getArtworkSvg } from '../data/artAssets';
import { resolveAssetUrl, resolveRenditions } from '../data/assetResolver';
import { PORTFOLIO_POSTS_REGISTRY } from '../data/portfolioPostsData';

export const ORIGINAL_POSTS_SLUGS: Set<string> = new Set(
  PORTFOLIO_POSTS_REGISTRY.map((p) => p.slug.toLowerCase())
);

const STORAGE_KEY_TRASHED = 'rory_studio_trashed_slugs_v2';
const STORAGE_KEY_DELETED = 'rory_studio_deleted_slugs_v2';
const STORAGE_KEY_OVERRIDES = 'rory_studio_artwork_overrides_v2';
const STORAGE_KEY_FILES = 'rory_studio_virtual_files_v2';

export class GalleryStateEngine {
  public rootPath: string = DRIVE_ROOT_PATH;
  public files: DriveFile[] = [];
  public items: ArtworkRecord[] = [];
  public pages: PageDocument[] = [];
  public activeFilters: FilterState = {
    search: '',
    status: 'all',
    medium: 'all',
    series: 'all',
    sort: 'newest'
  };

  private trashedSlugs: Set<string> = new Set();
  private deletedSlugs: Set<string> = new Set();
  private artworkOverrides: Record<string, Partial<ArtworkRecord>> = {};
  private customVirtualFiles: Record<string, DriveFile> = {};
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadPersistence();
    this.files = buildInitialVirtualFileSystem();
    this.init();
  }

  public init(): void {
    // 1. Merge custom virtual files into files list
    for (const [path, customFile] of Object.entries(this.customVirtualFiles)) {
      const idx = this.files.findIndex((f) => f.path === path);
      if (idx >= 0) {
        this.files[idx] = { ...customFile };
      } else {
        this.files.push({ ...customFile });
      }
    }

    // 2. Remove duplicate files across posts and trash
    // If a file is in trash/ or trashedSlugs, remove any matching posts/ file
    const trashFilenames = new Set([
      ...this.files.filter((f) => f.folder === 'trash').map((f) => f.name.toLowerCase()),
      ...Array.from(this.trashedSlugs).map((s) => `${s.toLowerCase()}.md`)
    ]);

    this.files = this.files.filter((f) => {
      if (f.folder === 'posts' && trashFilenames.has(f.name.toLowerCase())) {
        return false;
      }
      return true;
    });

    // 3. Remove permanently deleted files from virtual file system
    this.files = this.files.filter((f) => {
      const slugMatch = f.path.match(/^(?:posts|trash)\/([^\/]+)\.md$/i);
      if (slugMatch) {
        const slug = slugMatch[1].toLowerCase();
        if (this.deletedSlugs.has(slug)) return false;
      }
      const imgMatch = f.path.match(/^images\/([^\/]+)\.(?:svg|png|jpg|jpeg|webp)$/i);
      if (imgMatch) {
        const slug = imgMatch[1].toLowerCase();
        if (this.deletedSlugs.has(slug)) return false;
      }
      return true;
    });

    // 4. Ensure files in trashedSlugs have path = trash/{slug}.md and folder = 'trash'
    for (const slug of this.trashedSlugs) {
      const postFile = this.files.find((f) => f.path === `posts/${slug}.md`);
      if (postFile) {
        postFile.path = `trash/${slug}.md`;
        postFile.folder = 'trash';
      }
    }

    // 5. Load master registry and pages
    this.loadMasterRegistry();
    this.loadPages();

    // 6. Asynchronously sync live state with PostgreSQL database
    this.syncWithPostgres();
  }

  public async syncWithPostgres(): Promise<void> {
    try {
      const res = await fetch('/api/artworks?include_trashed=true');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.artworks) && data.artworks.length > 0) {
        for (const row of data.artworks) {
          const normSlug = (row.slug || '').toLowerCase().trim();
          if (!normSlug) continue;

          this.artworkOverrides[normSlug] = {
            ...(this.artworkOverrides[normSlug] || {}),
            title: row.title,
            year: parseInt(row.year, 10) || 2024,
            medium: row.medium,
            dimensions: row.dimensions,
            price: row.price,
            status: row.status,
            gallery_series: row.gallery_series,
            edition: row.edition,
            location: row.location,
            heroSlider: row.hero_slider === true,
            trashed: row.trashed === true,
            enabled: row.enabled !== false,
          };

          if (row.trashed) {
            this.trashedSlugs.add(normSlug);
          }
        }
        this.loadMasterRegistry();
        this.notify();
      }
    } catch (err) {
      // Non-blocking fallback for offline environments
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private savePersistence(): void {
    try {
      localStorage.setItem(STORAGE_KEY_TRASHED, JSON.stringify(Array.from(this.trashedSlugs)));
      localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(Array.from(this.deletedSlugs)));
      localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(this.artworkOverrides));
      localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(this.customVirtualFiles));
    } catch (e) {
      console.warn('Unable to persist gallery state to localStorage', e);
    }
  }

  private loadPersistence(): void {
    try {
      const trashed = localStorage.getItem(STORAGE_KEY_TRASHED);
      if (trashed) {
        const parsed = JSON.parse(trashed);
        if (Array.isArray(parsed)) {
          this.trashedSlugs = new Set(parsed.map((s: string) => s.toLowerCase()));
        }
      }

      const deleted = localStorage.getItem(STORAGE_KEY_DELETED);
      if (deleted) {
        const parsed = JSON.parse(deleted);
        if (Array.isArray(parsed)) {
          this.deletedSlugs = new Set(parsed.map((s: string) => s.toLowerCase()));
        }
      }

      const overrides = localStorage.getItem(STORAGE_KEY_OVERRIDES);
      if (overrides) {
        const parsed = JSON.parse(overrides);
        if (parsed && typeof parsed === 'object') {
          this.artworkOverrides = parsed;
        }
      }

      const files = localStorage.getItem(STORAGE_KEY_FILES);
      if (files) {
        const parsed = JSON.parse(files);
        if (parsed && typeof parsed === 'object') {
          this.customVirtualFiles = parsed;
        }
      }
    } catch (e) {
      console.warn('Unable to read gallery state from localStorage', e);
    }
  }

  /**
   * Reset all deletions, trashed items, and overrides back to original factory defaults
   */
  public resetToFactoryDefaults(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_TRASHED);
      localStorage.removeItem(STORAGE_KEY_DELETED);
      localStorage.removeItem(STORAGE_KEY_OVERRIDES);
      localStorage.removeItem(STORAGE_KEY_FILES);
    } catch {}

    this.trashedSlugs.clear();
    this.deletedSlugs.clear();
    this.artworkOverrides = {};
    this.customVirtualFiles = {};
    this.files = buildInitialVirtualFileSystem();
    this.init();
    this.notify();
  }

  /**
   * Core parsing pipeline logic:
   * 1. Reads raw index rows from index.md to map structural file slugs and basic metadata
   * 2. Cross-references with posts/*.md files to parse rich YAML frontmatter & markdown narratives
   * 3. Resolves all internal wiki links and image assets
   */
  public loadMasterRegistry(): void {
    const indexFile = this.files.find((f) => f.path === 'index.md');
    const parsedRows: MasterIndexRow[] = indexFile ? this.parseIndexMarkdown(indexFile.content) : [];
    
    // Find all posts in posts/ and trash/
    const postFiles = this.files.filter((f) => (f.folder === 'posts' || f.folder === 'trash') && f.extension === 'md');
    const records: ArtworkRecord[] = [];
    const seenSlugs = new Set<string>();

    // Map through posts files as source of truth, enriched with index rows
    for (const postFile of postFiles) {
      try {
        const record = this.parsePostMarkdown(postFile.content, postFile.path);
        const normSlug = record.slug.toLowerCase();
        
        // Skip permanently deleted slugs
        if (this.deletedSlugs.has(normSlug)) {
          continue;
        }

        // Avoid duplicate slug entries
        if (seenSlugs.has(normSlug)) {
          const isCurrentlyTrashed = this.trashedSlugs.has(normSlug);
          if (isCurrentlyTrashed && postFile.folder === 'trash') {
            const existingIdx = records.findIndex((r) => r.slug.toLowerCase() === normSlug);
            if (existingIdx >= 0) {
              record.trashed = true;
              record.status = 'Trashed';
              record.imageUrl = this.resolveImagePath(record.featured_image, record.slug);
              records[existingIdx] = record;
            }
          }
          continue;
        }

        // Apply persistent trashed state
        if (this.trashedSlugs.has(normSlug)) {
          record.trashed = true;
          record.status = 'Trashed';
        }

        // Enforce Hidden status for any post not on the original list (unless explicitly overridden or trashed)
        const isOriginal = ORIGINAL_POSTS_SLUGS.has(normSlug);
        if (!isOriginal && record.status !== 'Trashed' && !this.artworkOverrides[normSlug]?.status) {
          record.status = 'Hidden';
          record.enabled = false;
        }

        // Apply any saved overrides
        const override = this.artworkOverrides[normSlug];
        if (override) {
          Object.assign(record, override);
        }

        // Find corresponding index row if exists
        const matchedRow = parsedRows.find((r) => r.slug.toLowerCase() === normSlug);
        if (matchedRow) {
          if (!record.tags || record.tags.length === 0) {
            record.tags = matchedRow.tags.split(',').map((t) => t.trim()).filter(Boolean);
          }
        }
        // Resolve image URL + stage v3.2 rendition bundle
        record.imageUrl = this.resolveImagePath(record.featured_image, record.slug);
        record.renditions = this.resolveRenditionsFor(record.featured_image, record.slug) ?? undefined;
        seenSlugs.add(normSlug);
        records.push(record);
      } catch (err) {
        console.error(`Failed parsing ${postFile.path}`, err);
      }
    }

    // Also check if any rows in index.md don't have a post file yet, synthesize them without creating duplicates
    for (const row of parsedRows) {
      const normalizedRowSlug = row.slug.toLowerCase().replace(/^posts\//i, '').replace(/\.md$/i, '').trim();
      if (this.deletedSlugs.has(normalizedRowSlug) || seenSlugs.has(normalizedRowSlug)) {
        continue;
      }

      const isOriginal = ORIGINAL_POSTS_SLUGS.has(normalizedRowSlug);
      const isTrashed = this.trashedSlugs.has(normalizedRowSlug) || row.status === 'Trashed';
      let rowStatus: ArtworkStatus = isTrashed
        ? 'Trashed'
        : !isOriginal
        ? 'Hidden'
        : ((row.status as ArtworkStatus) || 'Available');

      const synthRecord: ArtworkRecord = {
        slug: normalizedRowSlug,
        title: row.title,
        year: parseInt(row.year, 10) || 2024,
        medium: row.medium,
        dimensions: row.dimensions,
        dimensions_cm: this.calculateCm(row.dimensions),
        status: rowStatus,
        price: row.price,
        featured_image: row.imageFile,
        imageUrl: this.resolveImagePath(row.imageFile, normalizedRowSlug),
        renditions: this.resolveRenditionsFor(row.imageFile, normalizedRowSlug) ?? undefined,
        gallery_series: row.series || 'Texas Folklore',
        edition: 'Original Artwork',
        location: 'Rory Skagen Studio',
        enabled: rowStatus !== 'Disabled' && rowStatus !== 'Hidden',
        archived: rowStatus === 'Archived',
        trashed: isTrashed,
        narrative: `# ${row.title}\n\nOriginal masterwork by Rory Skagen exploring themes from the **${row.series}** cycle.\n\n![${row.title}](${row.imageFile})`,
        filePath: isTrashed ? `trash/${normalizedRowSlug}.md` : `posts/${normalizedRowSlug}.md`,
        tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        scaleCategory: this.inferScaleCategory(row.dimensions)
      };

      const override = this.artworkOverrides[normalizedRowSlug];
      if (override) {
        Object.assign(synthRecord, override);
      }

      synthRecord.renderedHtml = this.renderMarkdownWithWikiLinks(synthRecord.narrative);
      seenSlugs.add(normalizedRowSlug);
      records.push(synthRecord);
    }

    this.items = records;
    this.notify();
  }

  /**
   * Parse pages from pages/*.md
   */
  public loadPages(): void {
    const pageFiles = this.files.filter((f) => f.folder === 'pages' && f.extension === 'md');
    this.pages = pageFiles.map((pf) => {
      const { metadata, body } = this.extractFrontmatter(pf.content);
      const slug = pf.name.replace(/\.md$/, '');
      const title = metadata.title || this.formatTitle(slug);
      return {
        slug,
        title,
        route: `#page/${slug}`,
        filePath: pf.path,
        rawMarkdown: pf.content,
        metaDescription: metadata.description || `Rory Skagen Studio - ${title}`,
        metadata
      };
    });
    this.notify();
  }

  /**
   * Parses Markdown Pipe Table inside index.md
   */
  public parseIndexMarkdown(content: string): MasterIndexRow[] {
    const lines = content.split('\n');
    const rows: MasterIndexRow[] = [];
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) {
        continue;
      }
      // Check if it's the header or separator line
      if (
        trimmed.includes('---') ||
        trimmed.toLowerCase().includes('| slug |') ||
        trimmed.toLowerCase().includes('| portfolio entry link |') ||
        trimmed.toLowerCase().includes('| :---')
      ) {
        inTable = true;
        continue;
      }

      if (inTable && trimmed.startsWith('|')) {
        const columns = trimmed
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());

        if (columns.length >= 7) {
          // Standard 10-column format
          const rawSlug = columns[0] || '';
          const slug = this.sanitizeSlug(rawSlug);
          const title = this.sanitizeTitle(columns[1] || rawSlug, slug);
          rows.push({
            slug,
            title,
            year: columns[2] || '',
            medium: columns[3] || '',
            dimensions: columns[4] || '',
            status: columns[5] || 'Available',
            price: columns[6] || '',
            series: columns[7] || 'Texas Folklore',
            imageFile: columns[8] || `images/${slug}.svg`,
            tags: columns[9] || ''
          });
        } else if (columns.length >= 4) {
          // 4-column format: Portfolio Entry Link | Production Date | Status Classification | Medium & Scale
          const linkRaw = columns[0] || '';
          const slug = this.sanitizeSlug(linkRaw);
          const title = this.sanitizeTitle(linkRaw, slug);

          const prodDate = columns[1] || '';
          const year = prodDate.includes('-') ? prodDate.split('-')[0] : prodDate || '2019';
          const status = columns[2] || 'Available';
          const mediumAndScale = columns[3] || '';

          let medium = mediumAndScale;
          let dimensions = '-';
          const parenMatch = mediumAndScale.match(/^(.*?)\((.*?)\)$/);
          if (parenMatch) {
            medium = parenMatch[1].trim();
            dimensions = parenMatch[2].trim();
          }

          rows.push({
            slug,
            title,
            year,
            medium,
            dimensions,
            status,
            price: status === 'Sold' ? 'Private Collection' : status === 'Archived' ? 'Storage' : 'Inquire',
            series: medium.toLowerCase().includes('enamel') ? 'Monsters & Kaiju' : 'Pop Surrealism & Folklore',
            imageFile: `images/${slug}.svg`,
            tags: 'fine-art, vintage'
          });
        }
      }
    }

    return rows;
  }

  /**
   * Helper to strip wikilinks syntax and paths from slugs
   */
  public sanitizeSlug(raw: string): string {
    if (!raw) return 'artwork';
    let clean = raw.trim();
    // Parse [[posts/slug|Title]] or [[slug]]
    const wikiMatch = clean.match(/\[\[(.*?)\]\]/);
    if (wikiMatch) {
      clean = wikiMatch[1].split('|')[0].trim();
    }
    return clean
      .replace(/^(?:posts|post|Posts|Post)[\/\\]+/i, '')
      .replace(/^trash[\/\\]+/i, '')
      .replace(/\.md$/i, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .toLowerCase();
  }

  /**
   * Helper to strip wikilinks and normalize human-readable titles
   */
  public sanitizeTitle(raw: string | undefined, fallbackSlug: string): string {
    if (!raw) return this.formatTitle(fallbackSlug);
    let title = raw.trim();
    // Parse [[posts/slug|Title]] or [[slug|Title]] or [[title]]
    const wikiMatch = title.match(/\[\[(.*?)\]\]/);
    if (wikiMatch) {
      const inner = wikiMatch[1];
      const parts = inner.split('|');
      title = (parts[1] || parts[0]).trim();
    }
    // Strip any raw leftover bracket syntax, folder prefixes, and markdown extensions
    title = title
      .replace(/^\[\[+/, '')
      .replace(/\]\]+$/, '')
      .replace(/^(?:posts|post|Posts|Post)[\/\\]+/i, '')
      .replace(/^trash[\/\\]+/i, '')
      .replace(/\.md$/i, '')
      .trim();

    if (title.includes('-') && !title.includes(' ')) {
      title = title.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
    return title;
  }

  /**
   * Parse individual artwork post markdown containing YAML frontmatter + Markdown body
   */
  public parsePostMarkdown(rawContent: string, filePath: string): ArtworkRecord {
    const { metadata, body } = this.extractFrontmatter(rawContent);

    const slug = this.sanitizeSlug(metadata.slug || filePath.split('/').pop());
    const title = this.sanitizeTitle(metadata.title, slug);
    const dimensions = metadata.dimensions || metadata.dimensions_in || '36" x 48"';
    const dimensions_cm = metadata.dimensions_cm || metadata.dimensionsCm || this.calculateCm(dimensions);
    
    // Find image in metadata (featured_image or image) or scan body for ![[image.jpg]] or ![alt](image)
    let featured_image = metadata.featured_image || metadata.image;
    if (!featured_image) {
      const obsidianImgMatch = body.match(/!\[\[(.*?)\]\]/);
      if (obsidianImgMatch) {
        featured_image = obsidianImgMatch[1].trim();
      } else {
        const mdImgMatch = body.match(/!\[(.*?)\]\((.*?)\)/);
        if (mdImgMatch) {
          featured_image = mdImgMatch[2].trim();
        } else {
          featured_image = `${slug}.jpg`;
        }
      }
    }

    const normSlug = slug.toLowerCase();
    const isOriginal = ORIGINAL_POSTS_SLUGS.has(normSlug);
    const rawStatus = (metadata.status as ArtworkStatus) || (isOriginal ? 'Available' : 'Hidden');
    const isTrashed = metadata.trashed === true || rawStatus === 'Trashed' || filePath.startsWith('trash/') || this.trashedSlugs.has(normSlug);
    let status: ArtworkStatus = isTrashed ? 'Trashed' : rawStatus;
    if (!isTrashed && !isOriginal && !metadata.status) {
      status = 'Hidden';
    }
    const isArchived = metadata.archived === true || status === 'Archived';
    const isEnabled = metadata.enabled !== undefined ? Boolean(metadata.enabled) : (status !== 'Disabled' && status !== 'Hidden');
    const trashedAt = metadata.trashedAt || (isTrashed ? new Date().toISOString() : undefined);
    const price = metadata.price || (status === 'Sold' ? 'Sold' : 'Inquire');
    const year = metadata.year || (metadata.date ? new Date(metadata.date).getFullYear() : 2019);
    const gallery_series = metadata.gallery_series || metadata.series || (metadata.medium && metadata.medium.toLowerCase().includes('enamel') ? 'Monsters & Kaiju' : 'Pop Surrealism & Folklore');
    const tags = Array.isArray(metadata.tags)
      ? metadata.tags
      : typeof metadata.tags === 'string'
      ? metadata.tags.split(',').map((t: string) => t.trim())
      : [];

    const defaultHeroSlugs = [
      'greetings-from-austin',
      'godzilla-austin',
      'king-kong-austin',
      'drive-in-theatre',
      'retro-robot-sign',
      'atomic-cocktail-lounge',
      'kirunan',
      'terrordon',
      'rendezvous-in-chinatown',
      'the-cats-of-the-colloseum'
    ];

    const isHeroSlider = metadata.hero_slider !== undefined
      ? Boolean(metadata.hero_slider)
      : metadata.heroSlider !== undefined
      ? Boolean(metadata.heroSlider)
      : defaultHeroSlugs.includes(normSlug);

    const renderedHtml = this.renderMarkdownWithWikiLinks(body);

    return {
      slug,
      title,
      year,
      date: metadata.date,
      medium: metadata.medium || 'Acrylic on Canvas',
      surface: metadata.surface,
      type: metadata.type || 'post',
      dimensions,
      dimensions_cm,
      status,
      price,
      featured_image,
      imageUrl: this.resolveImagePath(featured_image, slug),
      renditions: this.resolveRenditionsFor(featured_image, slug) ?? undefined,
      gallery_series,
      edition: metadata.edition || (metadata.surface ? `${metadata.medium} on ${metadata.surface}` : 'Original Artwork'),
      location: metadata.location || 'Austin, TX',
      enabled: isEnabled,
      archived: isArchived,
      trashed: isTrashed,
      trashedAt,
      heroSlider: isHeroSlider,
      narrative: body,
      renderedHtml,
      rawContent,
      filePath,
      tags,
      scaleCategory: metadata.scaleCategory || this.inferScaleCategory(dimensions)
    };
  }

  /**
   * Extracts YAML frontmatter without external dependencies
   * Supports multi-line lists (e.g. tags: \n - item1 \n - item2)
   */
  public extractFrontmatter(rawText: string): { metadata: Record<string, any>; body: string } {
    const trimmed = rawText.trim();
    if (!trimmed.startsWith('---')) {
      return { metadata: {}, body: rawText };
    }

    const secondDelimiterIndex = trimmed.indexOf('\n---', 3);
    if (secondDelimiterIndex === -1) {
      return { metadata: {}, body: rawText };
    }

    const yamlBlock = trimmed.substring(3, secondDelimiterIndex).trim();
    const body = trimmed.substring(secondDelimiterIndex + 4).trim();
    const metadata: Record<string, any> = {};

    const yamlLines = yamlBlock.split('\n');
    let currentListKey: string | null = null;

    for (const rawLine of yamlLines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Check if this line is a list item under current list key
      if (line.startsWith('- ') && currentListKey) {
        const itemVal = line.substring(2).trim().replace(/^["']|["']$/g, '');
        if (!Array.isArray(metadata[currentListKey])) {
          metadata[currentListKey] = [];
        }
        metadata[currentListKey].push(itemVal);
        continue;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        currentListKey = null;
        continue;
      }

      const key = line.substring(0, colonIndex).trim();
      let val = line.substring(colonIndex + 1).trim();

      // If val is empty, this could be the start of a multi-line list
      if (val === '') {
        currentListKey = key;
        metadata[key] = [];
        continue;
      } else {
        currentListKey = null;
      }

      // Strip comments
      if (val.includes('#')) {
        const commentIndex = val.indexOf('#');
        if (!val.startsWith('"') && !val.startsWith("'")) {
          val = val.substring(0, commentIndex).trim();
        }
      }

      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      } else if (val.startsWith('[') && val.endsWith(']')) {
        // Array parsing e.g. [a, b, c]
        val = val
          .slice(1, -1)
          .split(',')
          .map((item) => item.trim().replace(/^["']|["']$/g, '')) as any;
      } else if (!isNaN(Number(val)) && val !== '') {
        val = Number(val) as any;
      }

      metadata[key] = val;
    }

    return { metadata, body };
  }

  /**
   * Reference Link Resolution:
   * 1. [[index|Label]] or [[index]] -> Index map navigation
   * 2. [[posts/slug]] or [[slug]] -> <a href="#artwork/slug">Title</a>
   * 3. [[posts/slug|Custom Label]] -> <a href="#artwork/slug">Custom Label</a>
   * 4. [[pages/about]] or [[pages/about|Label]] or [[about]] -> <a href="#page/about">Label</a>
   * 5. ![[image.jpg]] -> Obsidian image presentation component
   * 6. ![Alt](images/filename.ext) -> Image presentation component
   */
  public renderMarkdownWithWikiLinks(markdown: string): string {
    let result = markdown;

    // 1. Resolve Obsidian image embeds ![[filename.jpg]] or ![[filename]]
    result = result.replace(/!\[\[(.*?)\]\]/g, (_, imgRef) => {
      const cleanRef = imgRef.trim();
      const filename = cleanRef.split('/').pop() || cleanRef;
      const slug = filename.replace(/\.(jpg|jpeg|png|svg|webp|tif|tiff)$/i, '');
      const resolvedSrc = this.resolveImagePath(cleanRef, slug);

      return `<div class="my-8 rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950/60 p-3 shadow-2xl backdrop-blur-sm">
        <div class="relative group overflow-hidden rounded-lg bg-zinc-900 flex items-center justify-center min-h-[220px]">
          <img src="${resolvedSrc}" alt="${slug}" class="w-full max-h-[500px] object-contain transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" />
        </div>
        <p class="text-xs text-center text-zinc-400 mt-2.5 font-mono tracking-wide flex items-center justify-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-500/60 inline-block"></span> ${filename}</p>
      </div>`;
    });

    // 2. Resolve Wikilinks [[target|label]] or [[target]]
    result = result.replace(/\[\[(.*?)\]\]/g, (_, match) => {
      const parts = match.split('|');
      const rawTarget = parts[0].trim();
      let label = (parts[1] || '').trim();
      const cleanTarget = rawTarget.toLowerCase().replace(/\\/g, '/');

      // Check if targeting index / root map
      if (cleanTarget === 'index' || cleanTarget === 'index.md') {
        const displayLabel = label || '← Return to Master Catalog Index';
        return `<a href="#registry" class="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-mono font-medium underline underline-offset-4 decoration-amber-500/40 hover:decoration-amber-400 transition-colors">${displayLabel}</a>`;
      }

      // Check if targeting pages (e.g. pages/about, about)
      if (cleanTarget.startsWith('pages/') || cleanTarget === 'about' || cleanTarget === 'contact' || cleanTarget === 'exhibitions' || cleanTarget === 'commissions') {
        const pageSlug = cleanTarget.replace(/^pages\//, '').replace(/\.md$/, '');
        const displayLabel = label || this.formatTitle(pageSlug);
        return `<a href="#page/${pageSlug}" class="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-4 decoration-emerald-500/40 hover:decoration-emerald-400 transition-colors">${displayLabel}</a>`;
      }

      // Check if targeting posts (e.g. posts/slug, slug)
      const postSlug = cleanTarget.replace(/^posts\//, '').replace(/^trash\//, '').replace(/\.md$/, '');
      const displayLabel = label || this.formatTitle(postSlug);
      return `<a href="#artwork/${postSlug}" class="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium underline underline-offset-4 decoration-sky-500/40 hover:decoration-sky-400 transition-colors group">
        <span class="group-hover:translate-x-0.5 transition-transform inline-block">◈</span>
        <span>${displayLabel}</span>
      </a>`;
    });

    // 3. Resolve standard Markdown links [Label](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-zinc-200 hover:text-white underline underline-offset-4 decoration-zinc-500 hover:decoration-zinc-300 transition-colors inline-flex items-center gap-0.5">${text} <span class="text-[10px] opacity-70">↗</span></a>`;
      }
      return match;
    });

    // Basic markdown formatting for headings, quotes, bold, list
    result = result.replace(/^### (.*$)/gim, '<h3 class="text-lg font-display font-semibold text-zinc-200 mt-5 mb-2 tracking-wide">$1</h3>');
    result = result.replace(/^## (.*$)/gim, '<h2 class="text-xl font-display font-bold text-zinc-100 mt-6 mb-3 tracking-wide border-b border-zinc-800/80 pb-1.5">$1</h2>');
    result = result.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-display font-bold text-zinc-50 mt-6 mb-4 tracking-wide">$1</h1>');

    // Blockquotes
    result = result.replace(/^\> (.*$)/gim, '<blockquote class="border-l-2 border-amber-500/70 pl-4 py-2 my-5 text-zinc-300 italic bg-amber-500/5 rounded-r-lg">$1</blockquote>');

    // Bold and Italic
    result = result.replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold text-zinc-100"><em>$1</em></strong>');
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-zinc-100">$1</strong>');
    result = result.replace(/\*(.*?)\*/g, '<em class="italic text-zinc-300">$1</em>');

    // Lists
    result = result.replace(/^\- (.*$)/gim, '<li class="ml-5 list-disc text-zinc-300 my-1 leading-relaxed">$1</li>');

    // Code
    result = result.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-800/80 text-amber-300 text-xs font-mono border border-zinc-700/50">$1</code>');

    // Paragraphs & HTML
    const paragraphs = result.split(/\n\n+/);
    result = paragraphs
      .map((p) => {
        const trimmed = p.trim();
        if (
          trimmed.startsWith('<h') ||
          trimmed.startsWith('<div') ||
          trimmed.startsWith('<blockquote') ||
          trimmed.startsWith('<li') ||
          trimmed.startsWith('<hr') ||
          trimmed.startsWith('<p') ||
          trimmed.startsWith('<span') ||
          trimmed.startsWith('<a')
        ) {
          return trimmed;
        }
        return `<p class="text-zinc-700 dark:text-zinc-300 leading-relaxed my-4 text-[15px] font-normal">${trimmed}</p>`;
      })
      .join('\n');

    return result;
  }

  /** Stage v3.2: rendition bundle for an artwork, or null when not in the Supabase registry. */
  public resolveRenditionsFor(imgPath: string, slugHint?: string) {
    return resolveRenditions(imgPath, slugHint);
  }

  public resolveImagePath(imgPath: string, slugHint?: string): string {
    if (!imgPath && !slugHint) return getArtworkSvg('art');

    // 1. If already an external absolute URL or data URI, return directly
    if (imgPath && (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('data:'))) {
      return imgPath;
    }

    // 2. Stage v3.2 dual-read chain: Supabase registry first (hero rendition),
    //    frozen Cloudinary map second (logs [asset-migration] miss), SVG fallback last.
    const resolved = resolveAssetUrl(imgPath, slugHint, 'hero');
    if (resolved) {
      return resolved;
    }

    const filename = imgPath ? imgPath.split('/').pop() || '' : '';
    const cleanSlug = slugHint || filename.replace(/\.(svg|png|jpg|jpeg|webp)$/, '');

    // 3. Check if the image exists in our virtual files
    const found = this.files.find((f) => (imgPath && f.path === imgPath) || (filename && f.name === filename));
    if (found && found.content) {
      if (found.content.startsWith('http://') || found.content.startsWith('https://') || found.content.startsWith('data:')) {
        return found.content;
      }
    }

    // Fallback to SVG generator for the slug
    return getArtworkSvg(cleanSlug);
  }

  /**
   * Sync a Cloudinary CDN image into the local drive files and artwork records
   */
  public syncCloudinaryAsset(cloudinaryUrl: string, publicId: string, assignToSlug?: string): void {
    const filename = publicId.split('/').pop() || `${publicId}.jpg`;
    const imagePath = `images/${filename}`;

    // Add or update image file in virtual drive
    const existingImg = this.files.find((f) => f.path === imagePath || f.name === filename);
    const now = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    if (existingImg) {
      existingImg.content = cloudinaryUrl;
      existingImg.lastModified = now;
      this.customVirtualFiles[imagePath] = { ...existingImg };
    } else {
      const newImgFile: DriveFile = {
        path: imagePath,
        name: filename,
        folder: 'images',
        extension: (filename.split('.').pop() || 'jpg') as any,
        content: cloudinaryUrl,
        size: 'CDN Asset',
        lastModified: now,
      };
      this.files.push(newImgFile);
      this.customVirtualFiles[imagePath] = newImgFile;
    }

    // If assignToSlug provided, update the post's featured_image frontmatter
    if (assignToSlug) {
      const postFile = this.files.find((f) => f.path === `posts/${assignToSlug}.md` || f.path === `trash/${assignToSlug}.md`);
      if (postFile) {
        postFile.content = postFile.content.replace(
          /featured_image:\s*["']?([^"'\n]+)["']?/,
          `featured_image: "${cloudinaryUrl}"`
        );
        postFile.lastModified = now;
        this.customVirtualFiles[postFile.path] = { ...postFile };
      }
    }

    this.loadMasterRegistry();
    this.syncIndexMdTable();
    this.savePersistence();
    this.notify();
  }

  /**
   * Filter and Sort workspace items live
   */
  public getFilteredItems(): ArtworkRecord[] {
    const { search, status, medium, series, sort } = this.activeFilters;
    
    // By default, hide trashed, disabled, and hidden items from public gallery browsing unless explicitly filtered
    let result: ArtworkRecord[];
    if (status.toLowerCase() === 'trashed') {
      result = this.items.filter((item) => item.trashed || item.status === 'Trashed');
    } else if (status.toLowerCase() === 'hidden' || status.toLowerCase() === 'disabled') {
      result = this.items.filter((item) => !item.trashed && (item.status === 'Hidden' || item.status === 'Disabled' || item.enabled === false));
    } else if (status.toLowerCase() === 'all-with-hidden') {
      result = this.items.filter((item) => !item.trashed && item.status !== 'Trashed');
    } else {
      // By default for 'all' or active statuses, exclude Hidden and Disabled items from public display
      result = this.items.filter((item) => !item.trashed && item.status !== 'Trashed' && item.status !== 'Hidden' && item.status !== 'Disabled' && item.enabled !== false);
    }

    // Search filter (title, slug, medium, tags, narrative)
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

    // Status filter
    if (status !== 'all' && status.toLowerCase() !== 'trashed' && status.toLowerCase() !== 'hidden' && status.toLowerCase() !== 'disabled' && status.toLowerCase() !== 'all-with-hidden') {
      if (status.toLowerCase() === 'archived') {
        result = result.filter((item) => item.status === 'Archived' || item.archived === true);
      } else if (status.toLowerCase() === 'enabled' || status.toLowerCase() === 'active') {
        result = result.filter((item) => item.enabled !== false && item.status !== 'Disabled' && item.status !== 'Hidden');
      } else {
        result = result.filter((item) => item.status.toLowerCase() === status.toLowerCase());
      }
    }

    // Medium filter
    if (medium !== 'all') {
      result = result.filter((item) => item.medium.toLowerCase().includes(medium.toLowerCase()));
    }

    // Series filter
    if (series !== 'all') {
      result = result.filter((item) => item.gallery_series.toLowerCase() === series.toLowerCase());
    }

    // Live Sorting
    result.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return Number(b.year) - Number(a.year);
        case 'oldest':
          return Number(a.year) - Number(b.year);
        case 'price-desc': {
          const numA = parseInt(a.price.replace(/[^0-9]/g, '') || '0', 10);
          const numB = parseInt(b.price.replace(/[^0-9]/g, '') || '0', 10);
          return numB - numA;
        }
        case 'price-asc': {
          const numA = parseInt(a.price.replace(/[^0-9]/g, '') || '0', 10);
          const numB = parseInt(b.price.replace(/[^0-9]/g, '') || '0', 10);
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

  // --- Artwork Lifecycle Actions (Enable/Disable, Archive, Trash, Delete) ---

  public toggleEnableArtwork(slug: string): void {
    const normSlug = slug.toLowerCase().replace(/^posts\//i, '').replace(/\.md$/i, '').trim();
    const item = this.items.find((i) => i.slug.toLowerCase() === normSlug);
    if (!item) return;

    const newEnabled = item.enabled === false || item.status === 'Disabled' || item.status === 'Hidden';
    const newStatus: ArtworkStatus = newEnabled ? 'Available' : 'Hidden';

    // Update item
    item.enabled = newEnabled;
    item.status = newStatus;

    this.artworkOverrides[normSlug] = {
      ...(this.artworkOverrides[normSlug] || {}),
      enabled: newEnabled,
      status: newStatus
    };

    // Update in virtual file
    const postFile = this.files.find((f) => f.path === `posts/${normSlug}.md` || f.path === `trash/${normSlug}.md`);
    if (postFile) {
      postFile.content = this.updateFrontmatterProperty(postFile.content, 'status', newStatus);
      postFile.content = this.updateFrontmatterProperty(postFile.content, 'enabled', newEnabled.toString());
      postFile.lastModified = 'Just now';
      this.customVirtualFiles[postFile.path] = { ...postFile };
    }

    this.syncIndexMdTable();
    this.savePersistence();
    this.notify();
  }

  public toggleArchiveArtwork(slug: string): void {
    const normSlug = slug.toLowerCase().replace(/^posts\//i, '').replace(/\.md$/i, '').trim();
    const item = this.items.find((i) => i.slug.toLowerCase() === normSlug);
    if (!item) return;

    const isArchived = item.status === 'Archived' || item.archived === true;
    const newStatus: ArtworkStatus = isArchived ? 'Available' : 'Archived';
    const newArchived = !isArchived;

    item.archived = newArchived;
    item.status = newStatus;

    this.artworkOverrides[normSlug] = {
      ...(this.artworkOverrides[normSlug] || {}),
      archived: newArchived,
      status: newStatus
    };

    const postFile = this.files.find((f) => f.path === `posts/${normSlug}.md` || f.path === `trash/${normSlug}.md`);
    if (postFile) {
      postFile.content = this.updateFrontmatterProperty(postFile.content, 'status', newStatus);
      postFile.content = this.updateFrontmatterProperty(postFile.content, 'archived', newArchived.toString());
      postFile.lastModified = 'Just now';
      this.customVirtualFiles[postFile.path] = { ...postFile };
    }

    this.syncIndexMdTable();
    this.savePersistence();
    this.notify();
  }

  public toggleHeroSlider(slug: string): void {
    const normSlug = slug.toLowerCase().replace(/^posts\//i, '').replace(/\.md$/i, '').trim();
    const item = this.items.find((i) => i.slug.toLowerCase() === normSlug);
    if (!item) return;

    const newHeroSlider = !item.heroSlider;
    item.heroSlider = newHeroSlider;

    this.artworkOverrides[normSlug] = {
      ...(this.artworkOverrides[normSlug] || {}),
      heroSlider: newHeroSlider
    };

    const postFile = this.files.find((f) => f.path === `posts/${normSlug}.md` || f.path === `trash/${normSlug}.md`);
    if (postFile) {
      postFile.content = this.updateFrontmatterProperty(postFile.content, 'hero_slider', newHeroSlider.toString());
      postFile.lastModified = 'Just now';
      this.customVirtualFiles[postFile.path] = { ...postFile };
    }

    this.savePersistence();
    this.notify();

    // Async sync to PostgreSQL database
    fetch(`/api/artworks/${normSlug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hero_slider: newHeroSlider }),
    }).catch(() => {});
  }

  public setHeroSlider(slug: string, showInHero: boolean): void {
    const normSlug = slug.toLowerCase().replace(/^posts\//i, '').replace(/\.md$/i, '').trim();
    const item = this.items.find((i) => i.slug.toLowerCase() === normSlug);
    if (!item) return;

    item.heroSlider = showInHero;

    this.artworkOverrides[normSlug] = {
      ...(this.artworkOverrides[normSlug] || {}),
      heroSlider: showInHero
    };

    const postFile = this.files.find((f) => f.path === `posts/${normSlug}.md` || f.path === `trash/${normSlug}.md`);
    if (postFile) {
      postFile.content = this.updateFrontmatterProperty(postFile.content, 'hero_slider', showInHero.toString());
      postFile.lastModified = 'Just now';
      this.customVirtualFiles[postFile.path] = { ...postFile };
    }

    this.savePersistence();
    this.notify();

    // Async sync to PostgreSQL database
    fetch(`/api/artworks/${normSlug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hero_slider: showInHero }),
    }).catch(() => {});
  }

  public trashArtwork(slug: string): void {
    const normSlug = slug.toLowerCase().replace(/^(?:posts|trash)\//i, '').replace(/\.md$/i, '').trim();
    this.trashedSlugs.add(normSlug);
    this.deletedSlugs.delete(normSlug);

    const nowIso = new Date().toISOString();
    const item = this.items.find((i) => i.slug.toLowerCase() === normSlug);
    if (item) {
      item.trashed = true;
      item.status = 'Trashed';
      item.trashedAt = nowIso;
      item.filePath = `trash/${normSlug}.md`;
    }

    this.artworkOverrides[normSlug] = {
      ...(this.artworkOverrides[normSlug] || {}),
      trashed: true,
      status: 'Trashed',
      trashedAt: nowIso
    };

    // Move file to trash/ folder
    const postFile = this.files.find((f) => f.path === `posts/${normSlug}.md`);
    if (postFile) {
      postFile.path = `trash/${normSlug}.md`;
      postFile.folder = 'trash';
      postFile.content = this.updateFrontmatterProperty(postFile.content, 'status', 'Trashed');
      postFile.content = this.updateFrontmatterProperty(postFile.content, 'trashed', 'true');
      postFile.content = this.updateFrontmatterProperty(postFile.content, 'trashedAt', `"${nowIso}"`);
      postFile.lastModified = 'Just now';
      this.customVirtualFiles[`trash/${normSlug}.md`] = { ...postFile };
      delete this.customVirtualFiles[`posts/${normSlug}.md`];
    }

    this.syncIndexMdTable();
    this.savePersistence();
    this.notify();
  }

  public restoreArtwork(slug: string): void {
    const normSlug = slug.toLowerCase().replace(/^(?:posts|trash)\//i, '').replace(/\.md$/i, '').trim();
    this.trashedSlugs.delete(normSlug);
    this.deletedSlugs.delete(normSlug);

    const item = this.items.find((i) => i.slug.toLowerCase() === normSlug);
    if (item) {
      item.trashed = false;
      item.status = 'Available';
      delete item.trashedAt;
      item.filePath = `posts/${normSlug}.md`;
    }

    if (this.artworkOverrides[normSlug]) {
      this.artworkOverrides[normSlug].trashed = false;
      this.artworkOverrides[normSlug].status = 'Available';
      delete this.artworkOverrides[normSlug].trashedAt;
    }

    // Move file back to posts/ folder
    const trashFile = this.files.find((f) => f.path === `trash/${normSlug}.md` || f.path === `posts/${normSlug}.md`);
    if (trashFile) {
      trashFile.path = `posts/${normSlug}.md`;
      trashFile.folder = 'posts';
      trashFile.content = this.updateFrontmatterProperty(trashFile.content, 'status', 'Available');
      trashFile.content = this.updateFrontmatterProperty(trashFile.content, 'trashed', 'false');
      trashFile.content = trashFile.content.replace(/trashedAt:\s*["']?[^"'\n]+["']?\n?/, '');
      trashFile.lastModified = 'Just now';
      this.customVirtualFiles[`posts/${normSlug}.md`] = { ...trashFile };
      delete this.customVirtualFiles[`trash/${normSlug}.md`];
    }

    this.syncIndexMdTable();
    this.savePersistence();
    this.notify();
  }

  public permanentlyDeleteArtwork(slug: string): void {
    const normSlug = slug.toLowerCase().replace(/^(?:posts|trash)\//i, '').replace(/\.md$/i, '').trim();
    this.deletedSlugs.add(normSlug);
    this.trashedSlugs.delete(normSlug);
    delete this.artworkOverrides[normSlug];

    delete this.customVirtualFiles[`posts/${normSlug}.md`];
    delete this.customVirtualFiles[`trash/${normSlug}.md`];
    delete this.customVirtualFiles[`images/${normSlug}.svg`];
    delete this.customVirtualFiles[`images/${normSlug}.jpg`];
    delete this.customVirtualFiles[`images/${normSlug}.png`];

    // Remove files from virtual filesystem
    this.files = this.files.filter(
      (f) =>
        f.path !== `posts/${normSlug}.md` &&
        f.path !== `trash/${normSlug}.md` &&
        f.path !== `images/${normSlug}.svg` &&
        f.path !== `images/${normSlug}.jpg` &&
        f.path !== `images/${normSlug}.png`
    );

    // Remove from items array
    this.items = this.items.filter((i) => i.slug.toLowerCase() !== normSlug);

    this.syncIndexMdTable();
    this.savePersistence();
    this.notify();

    // Async delete from Supabase PostgreSQL database
    fetch(`/api/artworks/${normSlug}?permanent=true`, { method: 'DELETE' }).catch(() => {});
  }

  public emptyTrash(): void {
    const trashedSlugs = this.items.filter((i) => i.trashed || i.status === 'Trashed').map((i) => i.slug.toLowerCase());
    for (const slug of trashedSlugs) {
      this.deletedSlugs.add(slug);
      this.trashedSlugs.delete(slug);
      delete this.artworkOverrides[slug];
      delete this.customVirtualFiles[`posts/${slug}.md`];
      delete this.customVirtualFiles[`trash/${slug}.md`];
      delete this.customVirtualFiles[`images/${slug}.svg`];
      delete this.customVirtualFiles[`images/${slug}.jpg`];
      delete this.customVirtualFiles[`images/${slug}.png`];
    }

    // Also include any slug that was in trashedSlugs set
    for (const slug of Array.from(this.trashedSlugs)) {
      this.deletedSlugs.add(slug);
      this.trashedSlugs.delete(slug);
    }

    this.files = this.files.filter(
      (f) =>
        f.folder !== 'trash' &&
        !trashedSlugs.some(
          (s) =>
            f.path === `posts/${s}.md` ||
            f.path === `trash/${s}.md` ||
            f.path === `images/${s}.svg` ||
            f.path === `images/${s}.jpg` ||
            f.path === `images/${s}.png`
        )
    );

    this.items = this.items.filter((i) => !i.trashed && i.status !== 'Trashed');

    this.syncIndexMdTable();
    this.savePersistence();
    this.notify();
  }

  public restoreAllTrash(): void {
    const trashed = this.items.filter((i) => i.trashed || i.status === 'Trashed');
    for (const item of trashed) {
      this.restoreArtwork(item.slug);
    }
  }

  private updateFrontmatterProperty(rawContent: string, key: string, value: string): string {
    const regex = new RegExp(`^${key}:.*$`, 'm');
    if (regex.test(rawContent)) {
      return rawContent.replace(regex, `${key}: ${value}`);
    } else {
      // Insert after opening ---
      return rawContent.replace(/^---\n/, `---\n${key}: ${value}\n`);
    }
  }

  // --- Virtual File System Operations ---

  public getFile(path: string): DriveFile | undefined {
    return this.files.find((f) => f.path === path);
  }

  public saveFile(path: string, content: string): void {
    const existing = this.files.find((f) => f.path === path);
    const now = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (existing) {
      existing.content = content;
      existing.lastModified = now;
      existing.size = `${(content.length / 1024).toFixed(1)} KB`;
      this.customVirtualFiles[path] = { ...existing };
    } else {
      const name = path.split('/').pop() || 'untitled.md';
      const folder = (path.includes('/') ? path.split('/')[0] : 'root') as any;
      const extension = (name.split('.').pop() || 'md') as any;
      const newFile: DriveFile = {
        path,
        name,
        folder,
        extension,
        content,
        size: `${(content.length / 1024).toFixed(1)} KB`,
        lastModified: now
      };
      this.files.push(newFile);
      this.customVirtualFiles[path] = newFile;
    }

    // Refresh database registry and pages
    this.loadMasterRegistry();
    this.loadPages();
    this.savePersistence();
    this.notify();
  }

  public createNewArtwork(record: Partial<ArtworkRecord>, narrativeBody: string): string {
    const slug = (record.slug || record.title || 'new-artwork')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const yamlFrontmatter = `---
title: "${record.title || 'Untitled Artwork'}"
slug: "${slug}"
year: ${record.year || new Date().getFullYear()}
date: "${new Date().toISOString().split('T')[0]}"
medium: "${record.medium || 'Oil & Acrylic on Linen'}"
dimensions: "${record.dimensions || '36\\" x 48\\"'}"
dimensions_cm: "${record.dimensions_cm || this.calculateCm(record.dimensions || '36\\" x 48\\"')}"
status: "${record.status || 'Available'}"
price: "${record.price || '$8,500'}"
featured_image: "images/${slug}.svg"
gallery_series: "${record.gallery_series || 'Neon Americana'}"
edition: "${record.edition || 'Original Canvas'}"
location: "${record.location || 'Austin Studio'}"
tags: [${(record.tags || ['pop-art', 'texas']).join(', ')}]
scaleCategory: "${record.scaleCategory || 'medium'}"
---

${narrativeBody || `# ${record.title || 'Untitled Artwork'}\n\nOriginal painting from the Rory Skagen Studio catalog.`}
`;

    const filePath = `posts/${slug}.md`;
    this.saveFile(filePath, yamlFrontmatter);

    // Also add SVG asset
    const svgAssetPath = `images/${slug}.svg`;
    if (!this.files.some((f) => f.path === svgAssetPath)) {
      const newSvg: DriveFile = {
        path: svgAssetPath,
        name: `${slug}.svg`,
        folder: 'images',
        extension: 'svg',
        content: getArtworkSvg(slug),
        size: '2.5 KB',
        lastModified: 'Just now'
      };
      this.files.push(newSvg);
      this.customVirtualFiles[svgAssetPath] = newSvg;
    }

    // Auto-update index.md table
    this.syncIndexMdTable();
    this.savePersistence();

    return slug;
  }

  public deleteArtwork(slug: string): void {
    this.permanentlyDeleteArtwork(slug);
  }

  public syncIndexMdTable(): void {
    const indexFile = this.files.find((f) => f.path === 'index.md');
    if (!indexFile) return;

    let markdown = `# Master Art Gallery Registry — Rory Skagen Studio\n*Root Path: \`My Drive/Clients/roryskagen.com/website-content/\`*\n*Last Synced: ${new Date().toISOString().split('T')[0]}*\n\n| Slug | Title | Year | Medium | Dimensions | Status | Price | Series | Image File | Tags |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const item of this.items) {
      if (item.trashed || item.status === 'Trashed') continue;
      const tagsStr = (item.tags || []).join(', ');
      markdown += `| ${item.slug} | ${item.title} | ${item.year} | ${item.medium} | ${item.dimensions} | ${item.status} | ${item.price} | ${item.gallery_series} | ${item.featured_image} | ${tagsStr} |\n`;
    }

    indexFile.content = markdown;
    this.customVirtualFiles['index.md'] = { ...indexFile };
  }

  // --- Helper formatting utils ---

  private formatTitle(slug: string): string {
    return slug
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private calculateCm(dimensions: string): string {
    const match = dimensions.match(/(\d+)\s*(?:\"|'|in)?\s*[xX×]\s*(\d+)/);
    if (match) {
      const w = parseInt(match[1], 10);
      const h = parseInt(match[2], 10);
      const isFeet = dimensions.includes("'");
      const mult = isFeet ? 30.48 : 2.54;
      return `${Math.round(w * mult)} x ${Math.round(h * mult)} cm`;
    }
    return dimensions;
  }

  private inferScaleCategory(dimensions: string): 'small' | 'medium' | 'large' | 'monumental' {
    if (dimensions.includes("'")) return 'monumental';
    const match = dimensions.match(/(\d+)/);
    if (!match) return 'medium';
    const val = parseInt(match[1], 10);
    if (val < 30) return 'small';
    if (val <= 48) return 'medium';
    return 'large';
  }
}

// Global Singleton for immediate client accessibility & vanilla JS conformance
export const GalleryAppEngineInstance = new GalleryStateEngine();
export const GalleryAppEngine = GalleryStateEngine;
export const galleryAppEngine = GalleryAppEngineInstance;
