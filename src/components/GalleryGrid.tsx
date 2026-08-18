import React, { useState } from 'react';
import { ArtworkRecord, FilterState } from '../types';
import { Layers, ArrowUpDown, X, Grid, LayoutGrid, Eye, ArrowRight, CornerDownRight } from 'lucide-react';

interface GalleryGridProps {
  items: ArtworkRecord[];
  allItems: ArtworkRecord[];
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onResetFilters: () => void;
  onSelectArtwork: (slug: string) => void;
}

export const GalleryGrid: React.FC<GalleryGridProps> = ({
  items,
  allItems,
  filters,
  onFilterChange,
  onResetFilters,
  onSelectArtwork,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'large' | 'compact'>('grid');

  // Extract unique series and mediums
  const seriesList = ['all', ...Array.from(new Set(allItems.map((i) => i.gallery_series)))];
  const mediumList = ['all', 'Oil & Acrylic on Linen', 'Acrylic on Canvas', 'Enamel on Aluminum', 'Serigraph', 'Mixed Media'];
  const statusList = ['all', 'Available', 'Sold', 'Public Installation', 'Limited Edition', 'Private Collection'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Available':
        return (
          <span className="text-[9px] border border-emerald-800/80 bg-emerald-950/40 px-1.5 py-0.5 text-emerald-400 uppercase font-mono flex items-center gap-1">
            <span className="w-1 h-1 bg-emerald-400"></span>
            Available
          </span>
        );
      case 'Public Installation':
        return (
          <span className="text-[9px] border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300 uppercase font-mono">
            Landmark
          </span>
        );
      case 'Limited Edition':
        return (
          <span className="text-[9px] border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300 uppercase font-mono">
            Edition
          </span>
        );
      case 'Sold':
      default:
        return (
          <span className="text-[9px] border border-zinc-800 bg-black/60 px-1.5 py-0.5 text-zinc-500 uppercase font-mono">
            Sold
          </span>
        );
    }
  };

  const hasActiveFilters =
    filters.search !== '' ||
    filters.status !== 'all' ||
    filters.medium !== 'all' ||
    filters.series !== 'all';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Sleek Header Banner */}
      <section className="bg-black/60 border border-zinc-800 p-6 sm:p-8 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-3xl space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-white inline-block"></span>
              <span>COLLECTION VAULT</span>
              <span className="text-zinc-700">/</span>
              <span>RORY SKAGEN STUDIO</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase font-sans">
              Nostalgic Pop Art, Neon Americana &amp; Murals
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-sans max-w-2xl">
              Physical paintings, limited edition screenprints, and landmark murals authored by Rory Skagen, mapped directly from the website-content Drive filesystem.
            </p>
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-800 font-mono text-[10px] space-y-1.5 min-w-[200px] flex-shrink-0">
            <div className="text-zinc-500 uppercase text-[9px] tracking-wider">Vault Metrics</div>
            <div className="flex justify-between text-zinc-300">
              <span>Cataloged:</span>
              <span className="text-white font-bold">{allItems.length} Units</span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span>Displaying:</span>
              <span className="text-white font-bold">{items.length} Matches</span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span>Status:</span>
              <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>
          </div>
        </div>
      </section>

      {/* Control Bar: Series, Status, Medium, Sort, Search */}
      <div className="bg-[#0D0D10] border border-zinc-800 p-4 space-y-4">
        {/* Top Series Row */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 text-[10px] font-mono">
            <span className="text-zinc-500 uppercase tracking-widest mr-2 flex-shrink-0">
              Series:
            </span>
            {seriesList.map((series) => {
              const isSelected = filters.series === series;
              return (
                <button
                  key={series}
                  onClick={() => onFilterChange('series', series)}
                  className={`px-3 py-1.5 uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer rounded-none ${
                    isSelected
                      ? 'bg-zinc-800 text-white font-bold border-l-2 border-white'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {series === 'all' ? 'All Series' : series}
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 border border-zinc-800 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              title="Standard Grid"
              className={`p-1.5 transition-colors ${
                viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('large')}
              title="Poster View"
              className={`p-1.5 transition-colors ${
                viewMode === 'large' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-mono">
          {/* Status Filter */}
          <div>
            <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
              Status Filter
            </label>
            <select
              value={filters.status}
              onChange={(e) => onFilterChange('status', e.target.value)}
              aria-label="Filter by Availability Status"
              className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500"
            >
              <option value="all">All Entities ({allItems.length})</option>
              {statusList.filter((s) => s !== 'all').map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Medium Filter */}
          <div>
            <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
              Medium / Substrate
            </label>
            <select
              value={filters.medium}
              onChange={(e) => onFilterChange('medium', e.target.value)}
              aria-label="Filter by Medium or Substrate"
              className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500"
            >
              <option value="all">All Mediums</option>
              {mediumList.filter((m) => m !== 'all').map((med) => (
                <option key={med} value={med}>
                  {med}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div>
            <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
              Sort Order
            </label>
            <select
              value={filters.sort}
              onChange={(e) => onFilterChange('sort', e.target.value as any)}
              aria-label="Sort Registry"
              className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500"
            >
              <option value="newest">Chronological (Newest)</option>
              <option value="oldest">Chronological (Oldest)</option>
              <option value="price-desc">Valuation (High to Low)</option>
              <option value="price-asc">Valuation (Low to High)</option>
              <option value="title">Alphabetical (A-Z)</option>
            </select>
          </div>

          {/* Search Bar */}
          <div>
            <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
              Filter Keywords
            </label>
            <div className="relative">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => onFilterChange('search', e.target.value)}
                placeholder="search_query"
                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              />
              {filters.search && (
                <button
                  onClick={() => onFilterChange('search', '')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results summary & Active Reset */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 font-mono uppercase tracking-wider">
          <div>
            SHOWING <strong className="text-white">{items.length}</strong> OF{' '}
            <strong className="text-white">{allItems.length}</strong> ENTITIES
            {filters.search && ` (QUERY: "${filters.search}")`}
          </div>
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="text-white hover:underline flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <div className="text-center py-20 bg-zinc-950 border border-dashed border-zinc-800 p-8">
          <p className="text-sm font-mono uppercase tracking-widest text-zinc-400">No artwork entities found in vault.</p>
          <p className="text-xs text-zinc-600 mt-2 font-mono">Adjust search parameters or reset filter constraints.</p>
          <button
            onClick={onResetFilters}
            className="mt-6 px-4 py-2 bg-white text-black font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Sleek Artwork Grid */}
      <div
        className={
          viewMode === 'large'
            ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
        }
      >
        {items.map((art) => (
          <div
            key={art.slug}
            onClick={() => onSelectArtwork(art.slug)}
            className="group cursor-pointer flex flex-col justify-between transition-all"
          >
            {/* Visual Container */}
            <div className="aspect-[3/4] bg-zinc-900 border border-zinc-800 relative overflow-hidden flex items-center justify-center p-4 group-hover:border-zinc-500 transition-colors">
              <img
                src={art.imageUrl}
                alt={art.title}
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />

              {/* Status Badge */}
              <div className="absolute top-3 left-3 z-10">
                {getStatusBadge(art.status)}
              </div>

              {/* Series Tag */}
              <div className="absolute top-3 right-3 z-10">
                <span className="text-[9px] font-mono uppercase border border-zinc-800 bg-black/80 px-1.5 py-0.5 text-zinc-400">
                  {art.gallery_series}
                </span>
              </div>

              {/* Quick overlay hint */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="px-3 py-1 bg-white text-black text-[9px] font-mono font-bold uppercase tracking-widest">
                  Inspect Record
                </span>
              </div>
            </div>

            {/* Meta Row below artwork */}
            <div className="mt-3 flex justify-between items-start gap-2">
              <div className="min-w-0">
                <h4 className="text-[11px] font-bold tracking-tight text-white group-hover:text-zinc-300 transition-colors truncate">
                  {art.title}
                </h4>
                <p className="text-[9px] text-zinc-500 uppercase mt-0.5 font-mono">
                  {art.year} / {art.medium}
                </p>
                <p className="text-[9px] text-zinc-600 font-mono mt-0.5">
                  {art.dimensions} • posts/{art.slug}.md
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <span className="text-[10px] font-mono font-bold text-white block">
                  {art.price}
                </span>
                <span className="text-[9px] text-zinc-500 uppercase font-mono">
                  Valuation
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Manifest Index Manifest Panel (from Sleek Interface design) */}
      <div className="border border-zinc-800 p-6 bg-zinc-950">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
            Manifest Index (posts/*.md)
          </h3>
          <span className="text-[9px] text-zinc-600 font-mono">Realtime Drive Registry</span>
        </div>
        
        <div className="grid grid-cols-12 gap-2 text-[9px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 pb-2 mb-2 font-mono">
          <span className="col-span-4 sm:col-span-3">Slug Reference</span>
          <span className="col-span-4 sm:col-span-3">Medium / Surface</span>
          <span className="col-span-2 sm:col-span-2">Date</span>
          <span className="col-span-2 sm:col-span-2">Status</span>
          <span className="hidden sm:block sm:col-span-2 text-right">Valuation</span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-[10px]">
          {items.slice(0, 8).map((art) => (
            <div
              key={art.slug}
              onClick={() => onSelectArtwork(art.slug)}
              className="grid grid-cols-12 gap-2 border-b border-zinc-900 pb-1.5 hover:bg-zinc-900/60 p-1 cursor-pointer transition-colors"
            >
              <span className="col-span-4 sm:col-span-3 text-white truncate hover:underline">
                {art.slug}
              </span>
              <span className="col-span-4 sm:col-span-3 text-zinc-400 truncate">
                {art.medium}
              </span>
              <span className="col-span-2 sm:col-span-2 text-zinc-400">
                {art.year}
              </span>
              <span className="col-span-2 sm:col-span-2">
                <span className={art.status === 'Available' ? 'text-emerald-400' : 'text-zinc-500'}>
                  {art.status}
                </span>
              </span>
              <span className="hidden sm:block sm:col-span-2 text-right text-zinc-300 font-bold">
                {art.price}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
