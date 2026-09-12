import React, { useState } from 'react';
import { ArtworkRecord } from '../types';
import { 
  Table, 
  FileText, 
  Search, 
  Copy, 
  Check, 
  Eye, 
  ExternalLink, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Filter,
  Power,
  Box,
  RotateCcw,
  Trash2,
  EyeOff,
  Sparkles
} from 'lucide-react';
import { DRIVE_ROOT_PATH } from '../data/driveFileSystem';
import { MEDIA_ASSETS_LOG, MediaAssetLogEntry } from '../data/mediaAssetsData';

interface MasterRegistryTableProps {
  items: ArtworkRecord[];
  rawIndexMd: string;
  onSelectArtwork: (slug: string) => void;
  onEditIndexMd: () => void;
  onToggleEnable?: (slug: string) => void;
  onToggleArchive?: (slug: string) => void;
  onToggleHeroSlider?: (slug: string) => void;
  onTrashArtwork?: (slug: string) => void;
  onNavigateToTrash?: () => void;
  trashedCount?: number;
}

export const MasterRegistryTable: React.FC<MasterRegistryTableProps> = ({
  items = [],
  rawIndexMd = '',
  onSelectArtwork,
  onEditIndexMd,
  onToggleEnable,
  onToggleArchive,
  onToggleHeroSlider,
  onTrashArtwork,
  onNavigateToTrash,
  trashedCount = 0
}) => {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'media' | 'raw'>('portfolio');
  const [statusFilter, setStatusFilter] = useState<'all' | 'hero' | 'available' | 'sold' | 'archived' | 'disabled' | 'hidden'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'active' | 'orphaned'>('all');
  const [copied, setCopied] = useState(false);
  const [copiedAssetUrl, setCopiedAssetUrl] = useState<string | null>(null);

  const safeItems = items || [];
  // Filter out trashed items from master active registry
  const activeItems = safeItems.filter((i) => !i?.trashed && i?.status !== 'Trashed');

  const cleanDisplayTitle = (title: string, fallbackSlug?: string): string => {
    if (!title) return (fallbackSlug || '').replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    let clean = title.trim();
    const wikiMatch = clean.match(/\[\[(.*?)\]\]/);
    if (wikiMatch) {
      const parts = wikiMatch[1].split('|');
      clean = (parts[1] || parts[0]).trim();
    }
    clean = clean
      .replace(/^\[\[+/, '')
      .replace(/\]\]+$/, '')
      .replace(/^(?:posts|post|Posts|Post)[\/\\]+/i, '')
      .replace(/\.md$/i, '')
      .trim();
    if (clean.includes('-') && !clean.includes(' ')) {
      clean = clean.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
    return clean;
  };

  const cleanDisplaySlug = (slug: string): string => {
    if (!slug) return '';
    let clean = slug.trim();
    const wikiMatch = clean.match(/\[\[(.*?)\]\]/);
    if (wikiMatch) {
      clean = wikiMatch[1].split('|')[0].trim();
    }
    return clean
      .replace(/^\[\[+/, '')
      .replace(/\]\]+$/, '')
      .replace(/^(?:posts|post|Posts|Post)[\/\\]+/i, '')
      .replace(/\.md$/i, '')
      .trim()
      .toLowerCase();
  };

  const filteredItems = activeItems.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      item.title.toLowerCase().includes(q) ||
      item.slug.toLowerCase().includes(q) ||
      item.medium.toLowerCase().includes(q) ||
      item.gallery_series.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q) ||
      item.year.toString().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === 'hero') return item.heroSlider === true;
    if (statusFilter === 'available') return item.status === 'Available';
    if (statusFilter === 'sold') return item.status === 'Sold';
    if (statusFilter === 'archived') return item.status === 'Archived' || item.archived === true;
    if (statusFilter === 'disabled' || statusFilter === 'hidden') return item.status === 'Hidden' || item.status === 'Disabled' || item.enabled === false;

    return true;
  });

  const heroCount = activeItems.filter((i) => i.heroSlider === true).length;
  const availableCount = activeItems.filter((i) => i.status === 'Available').length;
  const soldCount = activeItems.filter((i) => i.status === 'Sold').length;
  const archivedCount = activeItems.filter((i) => i.status === 'Archived' || i.archived === true).length;
  const hiddenCount = activeItems.filter((i) => i.status === 'Hidden' || i.status === 'Disabled' || i.enabled === false).length;

  const filteredMedia = MEDIA_ASSETS_LOG.filter((asset) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      asset.filename.toLowerCase().includes(q) ||
      asset.linkStr.toLowerCase().includes(q) ||
      asset.status.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (mediaFilter === 'active') return asset.isActive;
    if (mediaFilter === 'orphaned') return !asset.isActive;
    return true;
  });

  const copyRawMarkdown = () => {
    navigator.clipboard.writeText(rawIndexMd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAssetLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedAssetUrl(url);
    setTimeout(() => setCopiedAssetUrl(null), 2000);
  };

  const activeMediaCount = MEDIA_ASSETS_LOG.filter(m => m.isActive).length;
  const orphanedMediaCount = MEDIA_ASSETS_LOG.filter(m => !m.isActive).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono">
      {/* Header Banner */}
      <div className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 p-6 sm:p-8 shadow-xs transition-colors">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 mb-2 font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"></span>
              <span>RORY SKAGEN STUDIO — MASTER CATALOG &amp; MEDIA REGISTRY</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-sans">
              Master Catalog &amp; Media Registry
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 font-sans">
              Synchronized studio registry with <span className="text-zinc-950 dark:text-white font-bold">{activeItems.length}</span> active fine art works, 2 gallery pages, and <span className="text-zinc-950 dark:text-white font-bold">{MEDIA_ASSETS_LOG.length}</span> archived media assets on studio CDN storage.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToTrash && (
              <button
                onClick={onNavigateToTrash}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-300 dark:border-red-800/80 text-red-700 dark:text-red-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span>Trash Vault ({trashedCount})</span>
              </button>
            )}

            <button
              onClick={copyRawMarkdown}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">COPIED MARKDOWN</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Copy index.md</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs & Search controls */}
      <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-3 flex items-center justify-between flex-wrap gap-4 text-[10px] shadow-xs transition-colors">
        <div className="flex items-center gap-2 bg-[#F2F1EC] dark:bg-black p-1 border border-zinc-300 dark:border-zinc-800 flex-wrap rounded-xs">
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs ${
              activeTab === 'portfolio'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white border-l-2 border-emerald-500 dark:border-emerald-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-300'
            }`}
          >
            Portfolio Entries ({activeItems.length})
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs ${
              activeTab === 'media'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white border-l-2 border-emerald-500 dark:border-emerald-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-300'
            }`}
          >
            Media Assets &amp; CDN Logs ({MEDIA_ASSETS_LOG.length})
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs ${
              activeTab === 'raw'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white border-l-2 border-emerald-500 dark:border-emerald-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-300'
            }`}
          >
            Raw index.md Source
          </button>
        </div>

        {activeTab !== 'raw' && (
          <div className="flex items-center gap-3 flex-wrap">
            {activeTab === 'portfolio' && (
              <div className="flex items-center gap-1 bg-[#F2F1EC] dark:bg-black p-1 border border-zinc-300 dark:border-zinc-800 flex-wrap rounded-xs font-bold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer rounded-xs ${
                    statusFilter === 'all' ? 'bg-white text-zinc-950 dark:bg-zinc-800 dark:text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-300'
                  }`}
                >
                  All ({activeItems.length})
                </button>
                <button
                  onClick={() => setStatusFilter('hero')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer rounded-xs flex items-center gap-1 ${
                    statusFilter === 'hero' ? 'bg-amber-100 text-amber-950 dark:bg-amber-950/80 dark:text-amber-300 shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-amber-700 dark:hover:text-amber-300'
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                  <span>Hero Slider ({heroCount})</span>
                </button>
                <button
                  onClick={() => setStatusFilter('available')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer rounded-xs ${
                    statusFilter === 'available' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-300'
                  }`}
                >
                  Available ({availableCount})
                </button>
                <button
                  onClick={() => setStatusFilter('sold')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer rounded-xs ${
                    statusFilter === 'sold' ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300' : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-300'
                  }`}
                >
                  Sold ({soldCount})
                </button>
                <button
                  onClick={() => setStatusFilter('archived')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer rounded-xs ${
                    statusFilter === 'archived' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-300'
                  }`}
                >
                  Storage ({archivedCount})
                </button>
                <button
                  onClick={() => setStatusFilter('hidden')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer rounded-xs ${
                    statusFilter === 'hidden' || statusFilter === 'disabled' ? 'bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300' : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-300'
                  }`}
                >
                  Hidden ({hiddenCount})
                </button>
              </div>
            )}

            {activeTab === 'media' && (
              <div className="flex items-center gap-1 bg-[#F2F1EC] dark:bg-black p-1 border border-zinc-300 dark:border-zinc-800 font-bold rounded-xs">
                <button
                  onClick={() => setMediaFilter('all')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer rounded-xs ${
                    mediaFilter === 'all' ? 'bg-white text-zinc-950 dark:bg-zinc-800 dark:text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  All ({MEDIA_ASSETS_LOG.length})
                </button>
                <button
                  onClick={() => setMediaFilter('active')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer rounded-xs ${
                    mediaFilter === 'active' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Active ({activeMediaCount})
                </button>
                <button
                  onClick={() => setMediaFilter('orphaned')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer rounded-xs ${
                    mediaFilter === 'orphaned' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Orphaned ({orphanedMediaCount})
                </button>
              </div>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={activeTab === 'portfolio' ? "filter_catalog_records..." : "filter_media_assets..."}
                className="w-full bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 pl-8 pr-3 py-1.5 text-[10px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 rounded-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* 1. Portfolio Entries Tab */}
      {activeTab === 'portfolio' && (
        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 overflow-hidden shadow-xs transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-[#F2F1EC] dark:bg-black text-zinc-700 dark:text-zinc-400 uppercase text-[9px] tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-bold">Artwork &amp; Preview</th>
                  <th className="py-3 px-4 font-bold">Slug Identifier</th>
                  <th className="py-3 px-4 font-bold">Production Date</th>
                  <th className="py-3 px-4 font-bold">Status Classification</th>
                  <th className="py-3 px-4 font-bold">Medium &amp; Dimensions</th>
                  <th className="py-3 px-4 font-bold">Curated Series</th>
                  <th className="py-3 px-4 font-bold">Valuation</th>
                  <th className="py-3 px-4 font-bold text-right">Studio Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-900">
                {filteredItems.map((item) => {
                  const isDisabled = item.status === 'Disabled' || item.enabled === false;
                  const isArchived = item.status === 'Archived' || item.archived === true;

                  return (
                    <tr
                      key={item.slug}
                      onClick={() => onSelectArtwork(item.slug)}
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors cursor-pointer group ${
                        isDisabled ? 'opacity-50 bg-zinc-100/40 dark:bg-zinc-950/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5 shadow-2xs">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className={`w-full h-full object-contain ${isDisabled ? 'grayscale' : ''}`}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-950 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors block truncate max-w-[160px] font-sans">
                              {cleanDisplayTitle(item.title, item.slug)}
                            </span>
                            {item.heroSlider && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[8px] font-mono uppercase tracking-wider font-bold rounded-2xs flex-shrink-0" title="Featured in homepage hero slider">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                Hero
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-zinc-500">{item.edition}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400">
                        <code className="text-[9px] text-zinc-800 dark:text-zinc-300 bg-[#F2F1EC] dark:bg-zinc-900 px-1 py-0.5 border border-zinc-300 dark:border-zinc-800 font-mono">
                          {cleanDisplaySlug(item.slug)}
                        </code>
                      </td>
                      <td className="py-2.5 px-4 text-zinc-800 dark:text-zinc-300 font-mono">{item.date || item.year}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block px-1.5 py-0.5 border text-[9px] uppercase tracking-wider font-bold ${
                            isDisabled
                              ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/60'
                              : isArchived
                              ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/60'
                              : item.status === 'Available'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80'
                              : item.status === 'Sold'
                              ? 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-red-950/30 dark:text-zinc-400 dark:border-zinc-800'
                              : 'bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-black/60 dark:text-amber-400 dark:border-amber-900/40'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-zinc-800 dark:text-zinc-300">
                        <span className="font-semibold">{item.medium}</span>
                        {item.dimensions && item.dimensions !== '-' && (
                          <span className="text-zinc-500 ml-1">({item.dimensions})</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-700 dark:text-zinc-400">
                        <span className="px-1.5 py-0.5 bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-[9px] font-bold">
                          {item.gallery_series}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-zinc-950 dark:text-white font-bold">{item.price}</td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Hero Slider Toggle Button */}
                          {onToggleHeroSlider && (
                            <button
                              onClick={() => onToggleHeroSlider(item.slug)}
                              className={`p-1.5 border transition-colors cursor-pointer rounded-xs ${
                                item.heroSlider
                                  ? 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 shadow-2xs'
                                  : 'bg-[#F2F1EC] text-zinc-600 border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 dark:hover:text-amber-400'
                              }`}
                              title={item.heroSlider ? 'Remove from Homepage Hero Slider' : 'Add to Homepage Hero Slider'}
                            >
                              <Sparkles className={`w-3.5 h-3.5 ${item.heroSlider ? 'text-amber-600 dark:text-amber-400 fill-amber-500/20' : ''}`} />
                            </button>
                          )}

                          {/* Enable/Disable Button */}
                          {onToggleEnable && (
                            <button
                              onClick={() => onToggleEnable(item.slug)}
                              className={`p-1.5 border transition-colors cursor-pointer rounded-xs ${
                                isDisabled
                                  ? 'bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
                                  : 'bg-[#F2F1EC] text-zinc-700 border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 dark:hover:text-white'
                              }`}
                              title={isDisabled ? "Enable artwork" : "Hide artwork"}
                            >
                              {isDisabled ? <Power className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Storage Toggle Button */}
                          {onToggleArchive && (
                            <button
                              onClick={() => onToggleArchive(item.slug)}
                              className={`p-1.5 border transition-colors cursor-pointer rounded-xs ${
                                isArchived
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-[#F2F1EC] text-zinc-700 border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 dark:hover:text-amber-400'
                              }`}
                              title={isArchived ? "Restore to Showroom" : "Move to Storage"}
                            >
                              {isArchived ? <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> : <Box className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Trash Button */}
                          {onTrashArtwork && (
                            <button
                              onClick={() => onTrashArtwork(item.slug)}
                              className="p-1.5 bg-[#F2F1EC] hover:bg-red-50 text-red-700 border border-zinc-300 hover:border-red-300 dark:bg-zinc-900 dark:hover:bg-red-950/80 dark:text-red-400 dark:border-zinc-800 transition-colors cursor-pointer rounded-xs"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* View Presentation Button */}
                          <button
                            onClick={() => onSelectArtwork(item.slug)}
                            className="p-1.5 bg-zinc-900 hover:bg-black text-white dark:bg-zinc-900 dark:hover:bg-emerald-500 dark:hover:text-black dark:text-zinc-400 border border-zinc-800 transition-colors cursor-pointer rounded-xs"
                            title="View Presentation"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Media Assets & Verification Logs Tab */}
      {activeTab === 'media' && (
        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 overflow-hidden space-y-0 shadow-xs transition-colors">
          <div className="p-4 bg-[#F2F1EC] dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-4">
              <span>Showing <strong>{filteredMedia.length}</strong> of <strong>{MEDIA_ASSETS_LOG.length}</strong> verified media assets</span>
              <span className="text-zinc-400 dark:text-zinc-600">|</span>
              <span className="text-emerald-700 dark:text-emerald-400"><strong>{activeMediaCount}</strong> Active in Posts</span>
              <span className="text-zinc-400 dark:text-zinc-600">|</span>
              <span className="text-amber-700 dark:text-amber-400"><strong>{orphanedMediaCount}</strong> Orphaned / Unlinked</span>
            </div>
            <span className="text-zinc-500 text-[10px]">Studio CDN Archive</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-[#F2F1EC] dark:bg-black text-zinc-700 dark:text-zinc-400 uppercase text-[9px] tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-bold">Image Asset Filename</th>
                  <th className="py-3 px-4 font-bold">CDN Live Preview</th>
                  <th className="py-3 px-4 font-bold">Current Deployment Link</th>
                  <th className="py-3 px-4 font-bold">Usage Status</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-900">
                {filteredMedia.map((asset) => (
                  <tr key={asset.filename} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors">
                    <td className="py-2.5 px-4 text-zinc-900 dark:text-zinc-300 font-mono">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="font-bold">{asset.filename}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="w-8 h-8 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden flex items-center justify-center shadow-2xs">
                        <img
                          src={asset.thumbnailUrl || asset.url}
                          alt={asset.filename}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400 font-mono text-[9px] max-w-xs truncate">
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
                      >
                        <span className="truncate">{asset.url}</span>
                        <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                      </a>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase border font-bold ${
                          asset.isActive
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80'
                            : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40'
                        }`}
                      >
                        {asset.isActive ? (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        ) : (
                          <AlertCircle className="w-2.5 h-2.5" />
                        )}
                        <span>{asset.status}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => copyAssetLink(asset.url)}
                        className="px-2.5 py-1 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 text-[9px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs"
                      >
                        {copiedAssetUrl === asset.url ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">COPIED</span>
                        ) : (
                          <span>Copy URL</span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Raw index.md Source Tab */}
      {activeTab === 'raw' && (
        <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 space-y-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-600 dark:text-zinc-500 uppercase tracking-widest font-bold">
              SOURCE FILE: {DRIVE_ROOT_PATH}index.md
            </span>
            <button
              onClick={onEditIndexMd}
              className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline transition-colors uppercase tracking-wider cursor-pointer font-bold"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Edit in Drive Explorer</span>
            </button>
          </div>
          <pre className="bg-[#F7F6F2] dark:bg-black border border-zinc-300 dark:border-zinc-800 p-4 text-[10px] text-zinc-900 dark:text-zinc-300 font-mono overflow-x-auto max-h-[600px] leading-relaxed whitespace-pre rounded-xs">
            {rawIndexMd}
          </pre>
        </div>
      )}
    </div>
  );
};
