/**
 * Pure markdown/wiki-link utilities for the studio catalog — extracted
 * verbatim from the former engine methods so both the engine and admin
 * views share one renderer. No state, no I/O.
 */

import { resolveAssetUrl, resolveRenditions } from '../data/assetResolver';
import { getArtworkSvg } from '../data/artAssets';

/** Strip wikilink syntax and paths from slugs. */
export function sanitizeSlug(raw: string): string {
  if (!raw) return 'artwork';
  let clean = raw.trim();
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

/** Strip wikilinks and normalize human-readable titles. */
export function sanitizeTitle(raw: string | undefined, fallbackSlug: string): string {
  if (!raw) return formatTitle(fallbackSlug);
  let title = raw.trim();
  const wikiMatch = title.match(/\[\[(.*?)\]\]/);
  if (wikiMatch) {
    const inner = wikiMatch[1];
    const parts = inner.split('|');
    title = (parts[1] || parts[0]).trim();
  }
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

export function formatTitle(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function calculateCm(dimensions: string): string {
  const match = dimensions.match(/(\d+)\s*(?:"|'|in)?\s*[xX×]\s*(\d+)/);
  if (match) {
    const w = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);
    const isFeet = dimensions.includes("'");
    const mult = isFeet ? 30.48 : 2.54;
    return `${Math.round(w * mult)} x ${Math.round(h * mult)} cm`;
  }
  return dimensions;
}

export function inferScaleCategory(dimensions: string): 'small' | 'medium' | 'large' | 'monumental' {
  if (dimensions.includes("'")) return 'monumental';
  const match = dimensions.match(/(\d+)/);
  if (!match) return 'medium';
  const val = parseInt(match[1], 10);
  if (val < 30) return 'small';
  if (val <= 48) return 'medium';
  return 'large';
}

/**
 * Extracts YAML frontmatter without external dependencies.
 * Supports multi-line lists (e.g. tags: \n - item1 \n - item2).
 */
export function extractFrontmatter(rawText: string): { metadata: Record<string, any>; body: string } {
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

    if (val === '') {
      currentListKey = key;
      metadata[key] = [];
      continue;
    } else {
      currentListKey = null;
    }

    if (val.includes('#')) {
      const commentIndex = val.indexOf('#');
      if (!val.startsWith('"') && !val.startsWith("'")) {
        val = val.substring(0, commentIndex).trim();
      }
    }

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else if (val.startsWith('[') && val.endsWith(']')) {
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
 * 1. [[index|Label]] → catalog index navigation
 * 2. [[posts/slug]] / [[slug]] → artwork route
 * 3. [[posts/slug|Label]] → labeled artwork route
 * 4. [[pages/about]] / [[about]] → page route
 * 5. ![[image.jpg]] → image embed via the asset resolver
 * 6. ![Alt](images/file.ext) → standard markdown image
 */
export function renderMarkdownWithWikiLinks(markdown: string): string {
  let result = markdown;

  // 1. Obsidian image embeds ![[filename.jpg]]
  result = result.replace(/!\[\[(.*?)\]\]/g, (_, imgRef) => {
    const cleanRef = imgRef.trim();
    const filename = cleanRef.split('/').pop() || cleanRef;
    const slug = filename.replace(/\.(jpg|jpeg|png|svg|webp|tif|tiff)$/i, '');
    const resolvedSrc = resolveImagePath(cleanRef, slug);

    return `<div class="my-8 rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950/60 p-3 shadow-2xl backdrop-blur-sm">
      <div class="relative group overflow-hidden rounded-lg bg-zinc-900 flex items-center justify-center min-h-[220px]">
        <img src="${resolvedSrc}" alt="${slug}" class="w-full max-h-[500px] object-contain transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" />
      </div>
      <p class="text-xs text-center text-zinc-400 mt-2.5 font-mono tracking-wide flex items-center justify-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-500/60 inline-block"></span> ${filename}</p>
    </div>`;
  });

  // 2. Wikilinks [[target|label]] or [[target]]
  result = result.replace(/\[\[(.*?)\]\]/g, (_, match) => {
    const parts = match.split('|');
    const rawTarget = parts[0].trim();
    const label = (parts[1] || '').trim();
    const cleanTarget = rawTarget.toLowerCase().replace(/\\/g, '/');

    if (cleanTarget === 'index' || cleanTarget === 'index.md') {
      const displayLabel = label || '← Return to Master Catalog Index';
      return `<a href="#registry" class="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-mono font-medium underline underline-offset-4 decoration-amber-500/40 hover:decoration-amber-400 transition-colors">${displayLabel}</a>`;
    }

    if (cleanTarget.startsWith('pages/') || cleanTarget === 'about' || cleanTarget === 'contact' || cleanTarget === 'exhibitions' || cleanTarget === 'commissions') {
      const pageSlug = cleanTarget.replace(/^pages\//, '').replace(/\.md$/, '');
      const displayLabel = label || formatTitle(pageSlug);
      return `<a href="#page/${pageSlug}" class="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-4 decoration-emerald-500/40 hover:decoration-emerald-400 transition-colors">${displayLabel}</a>`;
    }

    const postSlug = cleanTarget.replace(/^posts\//, '').replace(/^trash\//, '').replace(/\.md$/, '');
    const displayLabel = label || formatTitle(postSlug);
    return `<a href="#artwork/${postSlug}" class="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium underline underline-offset-4 decoration-sky-500/40 hover:decoration-sky-400 transition-colors group">
      <span class="group-hover:translate-x-0.5 transition-transform inline-block">◈</span>
      <span>${displayLabel}</span>
    </a>`;
  });

  // 3. Standard markdown links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-zinc-200 hover:text-white underline underline-offset-4 decoration-zinc-500 hover:decoration-zinc-300 transition-colors inline-flex items-center gap-0.5">${text} <span class="text-[10px] opacity-70">↗</span></a>`;
    }
    return match;
  });

  result = result.replace(/^### (.*$)/gim, '<h3 class="text-lg font-display font-semibold text-zinc-200 mt-5 mb-2 tracking-wide">$1</h3>');
  result = result.replace(/^## (.*$)/gim, '<h2 class="text-xl font-display font-bold text-zinc-100 mt-6 mb-3 tracking-wide border-b border-zinc-800/80 pb-1.5">$1</h2>');
  result = result.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-display font-bold text-zinc-50 mt-6 mb-4 tracking-wide">$1</h1>');

  result = result.replace(/^\>(.*$)/gim, '<blockquote class="border-l-2 border-amber-500/70 pl-4 py-2 my-5 text-zinc-300 italic bg-amber-500/5 rounded-r-lg">$1</blockquote>');

  result = result.replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold text-zinc-100"><em>$1</em></strong>');
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-zinc-100">$1</strong>');
  result = result.replace(/\*(.*?)\*/g, '<em class="italic text-zinc-300">$1</em>');

  result = result.replace(/^\- (.*$)/gim, '<li class="ml-5 list-disc text-zinc-300 my-1 leading-relaxed">$1</li>');
  result = result.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-800/80 text-amber-300 text-xs font-mono border border-zinc-700/50">$1</code>');

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

/** Stage v3.2 rendition bundle for an image ref + slug hint, or null. */
export function resolveRenditionsFor(imgPath: string, slugHint?: string) {
  return resolveRenditions(imgPath, slugHint);
}

/**
 * Single-URL resolution: external URLs pass through, then the dual-read
 * Supabase registry → Cloudinary chain, then the SVG generator fallback.
 */
export function resolveImagePath(imgPath: string, slugHint?: string): string {
  if (!imgPath && !slugHint) return getArtworkSvg('art');

  if (imgPath && (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('data:'))) {
    return imgPath;
  }

  const resolved = resolveAssetUrl(imgPath, slugHint, 'hero');
  if (resolved) {
    return resolved;
  }

  return getArtworkSvg(slugHint || '');
}
