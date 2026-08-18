import { ArtworkRecord, ArtworkStatus, DriveFile, FilterState, MasterIndexRow, PageDocument } from '../types';
import { buildInitialVirtualFileSystem, DRIVE_ROOT_PATH } from '../data/driveFileSystem';
import { getArtworkSvg } from '../data/artAssets';
import { resolveCloudinaryUrl } from '../data/cloudinaryMap';

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
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.files = buildInitialVirtualFileSystem();
    this.init();
  }

  public init(): void {
    this.loadMasterRegistry();
    this.loadPages();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
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
    
    // Find all posts in posts/
    const postFiles = this.files.filter((f) => f.folder === 'posts' && f.extension === 'md');
    const records: ArtworkRecord[] = [];

    // Map through posts files as source of truth, enriched with index rows
    for (const postFile of postFiles) {
      try {
        const record = this.parsePostMarkdown(postFile.content, postFile.path);
        // Find corresponding index row if exists
        const matchedRow = parsedRows.find((r) => r.slug === record.slug);
        if (matchedRow) {
          if (!record.tags || record.tags.length === 0) {
            record.tags = matchedRow.tags.split(',').map((t) => t.trim()).filter(Boolean);
          }
        }
        // Resolve image URL
        record.imageUrl = this.resolveImagePath(record.featured_image, record.slug);
        records.push(record);
      } catch (err) {
        console.error(`Failed parsing ${postFile.path}`, err);
      }
    }

    // Also check if any rows in index.md don't have a post file yet, synthesize them
    for (const row of parsedRows) {
      if (!records.some((r) => r.slug === row.slug)) {
        const synthRecord: ArtworkRecord = {
          slug: row.slug,
          title: row.title,
          year: parseInt(row.year, 10) || 2024,
          medium: row.medium,
          dimensions: row.dimensions,
          dimensions_cm: this.calculateCm(row.dimensions),
          status: (row.status as ArtworkStatus) || 'Available',
          price: row.price,
          featured_image: row.imageFile,
          imageUrl: this.resolveImagePath(row.imageFile, row.slug),
          gallery_series: row.series || 'Texas Folklore',
          edition: 'Original Artwork',
          location: 'Rory Skagen Studio',
          narrative: `# ${row.title}\n\nOriginal artwork from the **${row.series}** series.\n\n![${row.title}](${row.imageFile})`,
          filePath: `posts/${row.slug}.md`,
          tags: row.tags ? row.tags.split(',').map((t) => t.trim()) : [],
          scaleCategory: this.inferScaleCategory(row.dimensions)
        };
        synthRecord.renderedHtml = this.renderMarkdownWithWikiLinks(synthRecord.narrative);
        records.push(synthRecord);
      }
    }

    this.items = records;
    this.notify();
  }

  public loadPages(): void {
    const pageFiles = this.files.filter((f) => f.folder === 'pages' && f.extension === 'md');
    this.pages = pageFiles.map((pf) => {
      const { metadata, body } = this.extractFrontmatter(pf.content);
      return {
        slug: metadata.slug || pf.name.replace('.md', ''),
        title: metadata.title || pf.name.replace('.md', '').toUpperCase(),
        subtitle: metadata.subtitle,
        filePath: pf.path,
        rawMarkdown: pf.content
      };
    });
  }

  /**
   * Parse Markdown Table from index.md
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
          rows.push({
            slug: columns[0] || '',
            title: columns[1] || '',
            year: columns[2] || '',
            medium: columns[3] || '',
            dimensions: columns[4] || '',
            status: columns[5] || 'Available',
            price: columns[6] || '',
            series: columns[7] || 'Texas Folklore',
            imageFile: columns[8] || `images/${columns[0]}.svg`,
            tags: columns[9] || ''
          });
        } else if (columns.length >= 4) {
          // 4-column format: Portfolio Entry Link | Production Date | Status Classification | Medium & Scale
          const linkRaw = columns[0] || '';
          let slug = linkRaw;
          let title = linkRaw;

          // Parse [[posts/slug|Title]] or [[slug|Title]] or [[slug]]
          const wikiMatch = linkRaw.match(/\[\[(.*?)\]\]/);
          if (wikiMatch) {
            const inner = wikiMatch[1];
            const parts = inner.split('|');
            slug = parts[0].replace('posts/', '').trim();
            title = (parts[1] || parts[0]).trim();
          } else {
            slug = slug.replace(/^posts\//, '').replace(/\.md$/, '').trim();
          }

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
            price: status === 'Sold' ? 'Private Collection' : status === 'Archived' ? 'Archive Only' : 'Inquire',
            series: medium.toLowerCase().includes('enamel') ? 'Monsters & Kaiju' : 'Pop Surrealism & Folklore',
            imageFile: `images/${slug}.svg`,
            tags: `${medium.toLowerCase()}, ${status.toLowerCase()}, ${year}`
          });
        }
      }
    }
    return rows;
  }

  /**
   * Parse individual artwork post markdown containing YAML frontmatter + Markdown body
   */
  public parsePostMarkdown(rawContent: string, filePath: string): ArtworkRecord {
    const { metadata, body } = this.extractFrontmatter(rawContent);

    const slug = metadata.slug || filePath.split('/').pop()?.replace('.md', '') || 'untitled';
    const title = metadata.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const dimensions = metadata.dimensions || '36" x 48"';
    const dimensions_cm = metadata.dimensions_cm || this.calculateCm(dimensions);
    
    // Find image in metadata or scan body for ![[image.jpg]] or ![alt](image)
    let featured_image = metadata.featured_image;
    if (!featured_image) {
      const obsidianImgMatch = body.match(/!\[\[(.*?)\]\]/);
      if (obsidianImgMatch) {
        featured_image = `images/${obsidianImgMatch[1].trim()}`;
      } else {
        const mdImgMatch = body.match(/!\[(.*?)\]\((.*?)\)/);
        if (mdImgMatch) {
          featured_image = mdImgMatch[2].trim();
        } else {
          featured_image = `images/${slug}.svg`;
        }
      }
    }

    const status = (metadata.status as ArtworkStatus) || 'Available';
    const price = metadata.price || (status === 'Sold' ? 'Sold' : 'Inquire');
    const year = metadata.year || (metadata.date ? new Date(metadata.date).getFullYear() : 2019);
    const gallery_series = metadata.gallery_series || (metadata.medium && metadata.medium.toLowerCase().includes('enamel') ? 'Monsters & Kaiju' : 'Pop Surrealism & Folklore');
    const tags = Array.isArray(metadata.tags)
      ? metadata.tags
      : typeof metadata.tags === 'string'
      ? metadata.tags.split(',').map((t: string) => t.trim())
      : [];

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
      gallery_series,
      edition: metadata.edition || (metadata.surface ? `${metadata.medium} on ${metadata.surface}` : 'Original Artwork'),
      location: metadata.location || 'Austin, TX',
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
      const target = parts[0].trim();
      let label = (parts[1] || '').trim();

      // Check if targeting index / root map
      if (target === 'index' || target === 'index.md') {
        const displayLabel = label || '← Return to Resource Map Index';
        return `<a href="#archive" class="wiki-link inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 underline underline-offset-4 decoration-amber-500/40 hover:decoration-amber-300 font-medium transition-colors cursor-pointer" data-page="index"><span class="text-amber-500/80 text-sm">⟵</span> ${displayLabel}</a>`;
      }

      // Check if targeting pages
      if (target.startsWith('pages/') || target === 'about' || target === 'contact' || target === 'commissions' || target === 'exhibitions') {
        const pageSlug = target.replace('pages/', '').replace('.md', '');
        const displayLabel = label || this.formatTitle(pageSlug);
        return `<a href="#page/${pageSlug}" class="wiki-link inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 underline underline-offset-4 decoration-amber-500/40 hover:decoration-amber-300 font-medium transition-colors cursor-pointer" data-page="${pageSlug}"><span class="text-amber-500/70 text-xs">◈</span> ${displayLabel}</a>`;
      }

      // Targeting posts or artworks
      const artworkSlug = target.replace('posts/', '').replace('.md', '');
      const displayLabel = label || this.formatTitle(artworkSlug);
      return `<a href="#artwork/${artworkSlug}" class="wiki-link inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 underline underline-offset-4 decoration-amber-500/40 hover:decoration-amber-300 font-medium transition-colors cursor-pointer" data-artwork="${artworkSlug}"><span class="text-amber-500/70 text-xs">★</span> ${displayLabel}</a>`;
    });

    // 3. Resolve standard markdown image tags ![Alt](images/path.ext)
    result = result.replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt, imgPath) => {
      const cleanPath = imgPath.trim();
      const slug = cleanPath.split('/').pop()?.split('.')[0] || 'art';
      const resolvedSrc = this.resolveImagePath(cleanPath, slug);

      return `<div class="my-8 rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950/60 p-3 shadow-2xl backdrop-blur-sm">
        <div class="relative group overflow-hidden rounded-lg bg-zinc-900 flex items-center justify-center min-h-[220px]">
          <img src="${resolvedSrc}" alt="${alt}" class="w-full max-h-[500px] object-contain transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" />
        </div>
        ${alt ? `<p class="text-xs text-center text-zinc-400 mt-2.5 font-mono tracking-wide flex items-center justify-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-500/60 inline-block"></span> ${alt}</p>` : ''}
      </div>`;
    });

    // 4. Resolve standard markdown links [Label](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
      // If internal link to local or contact
      if (href.includes('contact')) {
        return `<a href="#page/contact" class="text-amber-400 hover:text-amber-300 underline underline-offset-4 decoration-amber-500/40 font-medium cursor-pointer">${label}</a>`;
      }
      return `<a href="${href}" target="_blank" rel="noreferrer" class="text-amber-400 hover:text-amber-300 underline underline-offset-4 decoration-amber-500/40 font-medium">${label}</a>`;
    });

    // 5. Headings
    result = result.replace(/^### (.*$)/gim, '<h3 class="text-xl font-display font-semibold text-zinc-100 mt-8 mb-3 tracking-wide">$1</h3>');
    result = result.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-display font-bold text-zinc-100 mt-10 mb-4 tracking-wide pb-2 border-b border-zinc-800/60">$1</h2>');
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
        return `<p class="text-zinc-300 leading-relaxed my-4 text-[15px] font-normal">${trimmed}</p>`;
      })
      .join('\n');

    return result;
  }

  public resolveImagePath(imgPath: string, slugHint?: string): string {
    if (!imgPath && !slugHint) return getArtworkSvg('art');

    // 1. If already an external absolute URL or data URI, return directly
    if (imgPath && (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('data:'))) {
      return imgPath;
    }

    // 2. Check direct Cloudinary image registry resolution
    const cloudUrl = resolveCloudinaryUrl(imgPath, slugHint);
    if (cloudUrl) {
      return cloudUrl;
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
    } else {
      this.files.push({
        path: imagePath,
        name: filename,
        folder: 'images',
        extension: (filename.split('.').pop() || 'jpg') as any,
        content: cloudinaryUrl,
        size: 'CDN Asset',
        lastModified: now,
      });
    }

    // If assignToSlug provided, update the post's featured_image frontmatter
    if (assignToSlug) {
      const postFile = this.files.find((f) => f.path === `posts/${assignToSlug}.md`);
      if (postFile) {
        // Replace featured_image line in YAML
        postFile.content = postFile.content.replace(
          /featured_image:\s*["']?([^"'\n]+)["']?/,
          `featured_image: "${cloudinaryUrl}"`
        );
        postFile.lastModified = now;
      }
    }

    this.loadMasterRegistry();
    this.syncIndexMdTable();
    this.notify();
  }

  /**
   * Filter and Sort workspace items live
   */
  public getFilteredItems(): ArtworkRecord[] {
    let result = [...this.items];
    const { search, status, medium, series, sort } = this.activeFilters;

    // Search filter (title, slug, medium, tags, narrative)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
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
    if (status !== 'all') {
      result = result.filter((item) => item.status.toLowerCase() === status.toLowerCase());
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
    } else {
      const name = path.split('/').pop() || 'untitled.md';
      const folder = (path.includes('/') ? path.split('/')[0] : 'root') as any;
      const extension = (name.split('.').pop() || 'md') as any;
      this.files.push({
        path,
        name,
        folder,
        extension,
        content,
        size: `${(content.length / 1024).toFixed(1)} KB`,
        lastModified: now
      });
    }

    // Refresh database registry and pages
    this.loadMasterRegistry();
    this.loadPages();
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

${narrativeBody || `# ${record.title || 'Untitled Artwork'}\n\nNewly archived painting from the Rory Skagen Studio archive.`}
`;

    const filePath = `posts/${slug}.md`;
    this.saveFile(filePath, yamlFrontmatter);

    // Also add SVG asset
    const svgAssetPath = `images/${slug}.svg`;
    if (!this.files.some((f) => f.path === svgAssetPath)) {
      this.files.push({
        path: svgAssetPath,
        name: `${slug}.svg`,
        folder: 'images',
        extension: 'svg',
        content: getArtworkSvg(slug),
        size: '2.5 KB',
        lastModified: 'Just now'
      });
    }

    // Auto-update index.md table
    this.syncIndexMdTable();

    return slug;
  }

  public deleteArtwork(slug: string): void {
    this.files = this.files.filter((f) => f.path !== `posts/${slug}.md`);
    this.syncIndexMdTable();
    this.loadMasterRegistry();
  }

  public syncIndexMdTable(): void {
    const indexFile = this.files.find((f) => f.path === 'index.md');
    if (!indexFile) return;

    let markdown = `# Master Art Archive Registry — roryskagen.com\n*Root Path: \`My Drive/Clients/roryskagen.com/website-content/\`*\n*Last Synced: ${new Date().toISOString().split('T')[0]}*\n\n| Slug | Title | Year | Medium | Dimensions | Status | Price | Series | Image File | Tags |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const item of this.items) {
      const tagsStr = (item.tags || []).join(', ');
      markdown += `| ${item.slug} | ${item.title} | ${item.year} | ${item.medium} | ${item.dimensions} | ${item.status} | ${item.price} | ${item.gallery_series} | ${item.featured_image} | ${tagsStr} |\n`;
    }

    indexFile.content = markdown;
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
