import React, { useState } from 'react';
import { ArtworkRecord } from '../types';
import { Table, FileText, Search, Copy, Check, Eye, ExternalLink, Image as ImageIcon, CheckCircle2, AlertCircle, Filter } from 'lucide-react';
import { DRIVE_ROOT_PATH } from '../data/driveFileSystem';
import { MEDIA_ASSETS_LOG, MediaAssetLogEntry } from '../data/mediaAssetsData';

interface MasterRegistryTableProps {
  items: ArtworkRecord[];
  rawIndexMd: string;
  onSelectArtwork: (slug: string) => void;
  onEditIndexMd: () => void;
}

export const MasterRegistryTable: React.FC<MasterRegistryTableProps> = ({
  items,
  rawIndexMd,
  onSelectArtwork,
  onEditIndexMd
}) => {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'media' | 'raw'>('portfolio');
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'active' | 'orphaned'>('all');
  const [copied, setCopied] = useState(false);
  const [copiedAssetUrl, setCopiedAssetUrl] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.slug.toLowerCase().includes(q) ||
      item.medium.toLowerCase().includes(q) ||
      item.gallery_series.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q) ||
      item.year.toString().includes(q)
    );
  });

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
      <div className="bg-black border border-zinc-800 p-6 sm:p-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-zinc-500 mb-2">
              <span className="w-1.5 h-1.5 bg-emerald-400"></span>
              <span>VERIFIED 285-ENTRY ARTWORK ARCHIVE &amp; MASTER CATALOG</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white font-sans">
              Master Registry &amp; Media Logs
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              Synchronized studio catalog with <span className="text-white font-bold">{items.length}</span> portfolio records, 2 core pages, and <span className="text-white font-bold">{MEDIA_ASSETS_LOG.length}</span> verified media assets on Cloudinary CDN (<code className="text-emerald-400">xjilp2pq</code>).
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={copyRawMarkdown}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">COPIED MARKDOWN</span>
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
      <div className="bg-[#0D0D10] border border-zinc-800 p-3 flex items-center justify-between flex-wrap gap-4 text-[10px]">
        <div className="flex items-center gap-2 bg-black p-1 border border-zinc-800 flex-wrap">
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'portfolio'
                ? 'bg-zinc-800 text-white font-bold border-l-2 border-emerald-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Portfolio Entries ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'media'
                ? 'bg-zinc-800 text-white font-bold border-l-2 border-emerald-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Media Assets &amp; Verification Logs ({MEDIA_ASSETS_LOG.length})
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'raw'
                ? 'bg-zinc-800 text-white font-bold border-l-2 border-emerald-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Raw index.md Source
          </button>
        </div>

        {activeTab !== 'raw' && (
          <div className="flex items-center gap-3 flex-wrap">
            {activeTab === 'media' && (
              <div className="flex items-center gap-1 bg-black p-1 border border-zinc-800">
                <button
                  onClick={() => setMediaFilter('all')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer ${
                    mediaFilter === 'all' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500'
                  }`}
                >
                  All ({MEDIA_ASSETS_LOG.length})
                </button>
                <button
                  onClick={() => setMediaFilter('active')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer ${
                    mediaFilter === 'active' ? 'bg-emerald-950/60 text-emerald-400 font-bold' : 'text-zinc-500'
                  }`}
                >
                  Active ({activeMediaCount})
                </button>
                <button
                  onClick={() => setMediaFilter('orphaned')}
                  className={`px-2 py-1 uppercase text-[9px] cursor-pointer ${
                    mediaFilter === 'orphaned' ? 'bg-amber-950/60 text-amber-400 font-bold' : 'text-zinc-500'
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
                placeholder={activeTab === 'portfolio' ? "filter_portfolio_rows..." : "filter_media_assets..."}
                className="w-full bg-zinc-900 border border-zinc-800 pl-8 pr-3 py-1.5 text-[10px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 1. Portfolio Entries Tab */}
      {activeTab === 'portfolio' && (
        <div className="bg-[#0D0D10] border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-black text-zinc-500 uppercase text-[9px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-bold">Portfolio Entry &amp; Preview</th>
                  <th className="py-3 px-4 font-bold">Slug Identifier</th>
                  <th className="py-3 px-4 font-bold">Production Date</th>
                  <th className="py-3 px-4 font-bold">Status Classification</th>
                  <th className="py-3 px-4 font-bold">Medium &amp; Scale</th>
                  <th className="py-3 px-4 font-bold">Curated Series</th>
                  <th className="py-3 px-4 font-bold">Valuation</th>
                  <th className="py-3 px-4 font-bold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filteredItems.map((item) => (
                  <tr
                    key={item.slug}
                    onClick={() => onSelectArtwork(item.slug)}
                    className="hover:bg-zinc-900/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-950 border border-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div>
                        <span className="font-bold text-white group-hover:text-emerald-400 transition-colors block truncate max-w-[160px]">
                          {item.title}
                        </span>
                        <span className="text-[9px] text-zinc-500">{item.edition}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-400">
                      <code className="text-[9px] text-zinc-300 bg-zinc-900 px-1 py-0.5 border border-zinc-800">
                        {item.slug}
                      </code>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-300 font-mono">{item.date || item.year}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-1.5 py-0.5 border text-[9px] uppercase tracking-wider ${
                          item.status === 'Available'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/80'
                            : item.status === 'Sold'
                            ? 'bg-red-950/30 text-zinc-400 border-zinc-800'
                            : 'bg-black/60 text-amber-400 border-amber-900/40'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-300">
                      <span className="font-semibold">{item.medium}</span>
                      {item.dimensions && item.dimensions !== '-' && (
                        <span className="text-zinc-500 ml-1">({item.dimensions})</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-400">
                      <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-[9px]">
                        {item.gallery_series}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-white font-bold">{item.price}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectArtwork(item.slug);
                        }}
                        className="p-1.5 bg-zinc-900 group-hover:bg-emerald-500 group-hover:text-black text-zinc-400 border border-zinc-800 transition-colors cursor-pointer"
                        title="View presentation"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Media Assets & Verification Logs Tab */}
      {activeTab === 'media' && (
        <div className="bg-[#0D0D10] border border-zinc-800 overflow-hidden space-y-0">
          <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-4 text-xs text-zinc-400">
            <div className="flex items-center gap-4">
              <span>Showing <strong>{filteredMedia.length}</strong> of <strong>{MEDIA_ASSETS_LOG.length}</strong> verified media assets</span>
              <span className="text-zinc-600">|</span>
              <span className="text-emerald-400"><strong>{activeMediaCount}</strong> Active in Posts</span>
              <span className="text-zinc-600">|</span>
              <span className="text-amber-400"><strong>{orphanedMediaCount}</strong> Orphaned / Unlinked</span>
            </div>
            <span className="text-zinc-500 text-[10px]">Cloudinary CDN Account: <code>xjilp2pq</code></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-black text-zinc-500 uppercase text-[9px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-bold">Image Asset Filename</th>
                  <th className="py-3 px-4 font-bold">CDN Live Preview</th>
                  <th className="py-3 px-4 font-bold">Current Deployment Link</th>
                  <th className="py-3 px-4 font-bold">Usage Status</th>
                  <th className="py-3 px-4 font-bold">Cloudinary Public ID</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filteredMedia.map((asset, idx) => (
                  <tr key={`${asset.filename}-${idx}`} className="hover:bg-zinc-900/60 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-zinc-200">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                        <span className="font-bold">{asset.filename}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="w-12 h-12 bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center justify-center p-0.5">
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
                    <td className="py-2.5 px-4 text-zinc-400 max-w-xs">
                      {asset.isActive ? (
                        <span className="text-emerald-300 font-semibold">{asset.linkStr}</span>
                      ) : (
                        <span className="text-zinc-500 italic">{asset.linkStr}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase tracking-wider border ${
                          asset.isActive
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/80'
                            : 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                        }`}
                      >
                        {asset.isActive ? (
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
                        )}
                        {asset.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[9px] text-zinc-400">
                      <code>{asset.publicId}</code>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => copyAssetLink(asset.url)}
                          className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors cursor-pointer"
                          title="Copy Cloudinary CDN URL"
                        >
                          {copiedAssetUrl === asset.url ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-zinc-400" />
                          )}
                        </button>
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors inline-block"
                          title="Open CDN Image"
                        >
                          <ExternalLink className="w-3 h-3 text-zinc-400" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Raw Source Tab */}
      {activeTab === 'raw' && (
        <div className="bg-[#0D0D10] border border-zinc-800 p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Direct Markdown representation of {DRIVE_ROOT_PATH}index.md</span>
            <button
              onClick={onEditIndexMd}
              className="text-white hover:underline text-[10px] uppercase tracking-wider cursor-pointer"
            >
              Open in Drive Vault Editor
            </button>
          </div>
          <pre className="p-4 bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] overflow-x-auto leading-relaxed max-h-[600px]">
            {rawIndexMd}
          </pre>
        </div>
      )}
    </div>
  );
};
