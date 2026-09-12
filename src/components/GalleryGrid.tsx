import React, { useState } from 'react';
import { ArtworkRecord, FilterState } from '../types';
import { Layers, ArrowUpDown, X, Grid, LayoutGrid, Eye, ArrowRight, CornerDownRight, CheckCircle2, DollarSign } from 'lucide-react';
import { getArtworkSvg } from '../data/artAssets';
import { PageHeader } from './PageHeader';

interface GalleryGridProps {
  items: ArtworkRecord[];
  allItems: ArtworkRecord[];
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onResetFilters: () => void;
  onSelectArtwork: (slug: string) => void;
}

export const GalleryGrid: React.FC<GalleryGridProps> = ({
  items = [],
  allItems = [],
  filters = { search: '', status: 'all', medium: 'all', series: 'all', sort: 'newest' },
  onFilterChange,
  onResetFilters,
  onSelectArtwork,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'large' | 'compact'>('grid');

  const safeAllItems = allItems || [];
  const safeItems = items || [];

  // Extract unique series and mediums
  const seriesList = ['all', ...Array.from(new Set(safeAllItems.map((i) => i.gallery_series)))];
  const mediumList = ['all', 'Oil & Acrylic on Linen', 'Acrylic on Canvas', 'Enamel on Aluminum', 'Serigraph', 'Mixed Media'];
  const statusList = ['all', 'Available', 'Sold', 'Public Installation', 'Limited Edition', 'Private Collection'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Available':
        return (
          <span className="text-[9px] border border-emerald-600/60 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-emerald-800 dark:text-emerald-300 uppercase font-mono font-bold flex items-center gap-1 shadow-xs">
            <span className="w-1.5 h-1.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"></span>
            Available
          </span>
        );
      case 'Public Installation':
        return (
          <span className="text-[9px] border border-zinc-400 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 text-zinc-800 dark:text-zinc-300 uppercase font-mono font-bold shadow-xs">
            Landmark
          </span>
        );
      case 'Limited Edition':
        return (
          <span className="text-[9px] border border-sky-400 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 text-sky-800 dark:text-sky-300 uppercase font-mono font-bold shadow-xs">
            Edition
          </span>
        );
      case 'Hidden':
      case 'Disabled':
        return (
          <span className="text-[9px] border border-purple-400 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 text-purple-800 dark:text-purple-300 uppercase font-mono font-bold shadow-xs">
            Hidden
          </span>
        );
      case 'Archived':
        return (
          <span className="text-[9px] border border-amber-400 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-amber-800 dark:text-amber-300 uppercase font-mono font-bold shadow-xs">
            Storage
          </span>
        );
      case 'Sold':
      default:
        return (
          <span className="text-[9px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-black/70 px-2 py-0.5 text-zinc-600 dark:text-zinc-400 uppercase font-mono shadow-xs">
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
      {/* Studio Header — shared editorial masthead */}
      <PageHeader
        kicker="Fine Art Studio & Gallery — Austin, Texas"
        statement="Nostalgic pop art, neon Americana & murals"
        support="Original fine art masterworks, collectible limited editions, and iconic Austin landmark paintings authored by Rory Skagen. Available for gallery acquisition, private collections, and custom public commissions."
        meta={[
          { label: 'Cataloged Works', value: `${safeAllItems.filter((i) => !i.trashed && i.enabled !== false && i.status !== 'Hidden' && i.status !== 'Disabled').length} Originals` },
          { label: 'Active Results', value: String(items.length) },
          { label: 'Gallery Status', value: 'Open for Acquisition' },
        ]}
      />

      {/* Control Bar: Series, Status, Medium, Sort, Search */}
      <div className="bg-card border border-line p-4 space-y-4 shadow-xs transition-colors">
        {/* Top Series Row */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-line pb-3">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 text-[10px] font-mono">
            <span className="text-muted-foreground uppercase tracking-widest mr-2 flex-shrink-0 font-bold">
              Series:
            </span>
            {seriesList.map((series) => {
              const isSelected = filters.series === series;
              return (
                <button
                  key={series}
                  onClick={() => onFilterChange('series', series)}
                  className={`px-3 py-1.5 uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer rounded-xs ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-surface-deep text-foreground/75 hover:text-foreground border border-line'
                  }`}
                >
                  {series === 'all' ? 'All Curated Series' : series}
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-surface-deep p-1 border border-line flex-shrink-0 rounded-xs">
            <button
              onClick={() => setViewMode('grid')}
              title="Standard Grid"
              className={`p-1.5 transition-colors cursor-pointer rounded-xs ${
                viewMode === 'grid' 
                  ? 'bg-card text-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('large')}
              title="Poster View"
              className={`p-1.5 transition-colors cursor-pointer rounded-xs ${
                viewMode === 'large' 
                  ? 'bg-card text-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
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
            <label className="block text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">
              Availability
            </label>
            <select
              value={filters.status}
              onChange={(e) => onFilterChange('status', e.target.value)}
              aria-label="Filter by Availability Status"
              className="w-full bg-surface-deep border border-line px-3 py-2 text-foreground focus:outline-none focus:border-line-strong font-sans"
            >
              <option value="all">All Statuses ({allItems.length})</option>
              {statusList.filter((s) => s !== 'all').map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Medium Filter */}
          <div>
            <label className="block text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">
              Medium / Technique
            </label>
            <select
              value={filters.medium}
              onChange={(e) => onFilterChange('medium', e.target.value)}
              aria-label="Filter by Art Medium"
              className="w-full bg-surface-deep border border-line px-3 py-2 text-foreground focus:outline-none focus:border-line-strong font-sans"
            >
              <option value="all">All Mediums &amp; Surfaces</option>
              {mediumList.filter((m) => m !== 'all').map((med) => (
                <option key={med} value={med}>
                  {med}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">
              Sort Sequence
            </label>
            <select
              value={filters.sort}
              onChange={(e) => onFilterChange('sort', e.target.value as any)}
              aria-label="Sort Artworks"
              className="w-full bg-surface-deep border border-line px-3 py-2 text-foreground focus:outline-none focus:border-line-strong font-sans"
            >
              <option value="newest">Chronological (Newest First)</option>
              <option value="oldest">Historical (Oldest First)</option>
              <option value="title-asc">Title Alphabetical (A-Z)</option>
              <option value="price-desc">Valuation / Scale (High to Low)</option>
            </select>
          </div>

          {/* Search Term Input */}
          <div>
            <label className="block text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">
              Keyword Filter
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
              placeholder="Search titles, motifs, series..."
              className="w-full bg-surface-deep border border-line px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-line-strong font-sans text-xs"
            />
          </div>
        </div>

        {/* Results summary & Active Reset */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 font-mono uppercase tracking-wider">
          <div>
            SHOWING <strong className="text-foreground font-bold">{items.length}</strong> OF{' '}
            <strong className="text-foreground font-bold">{allItems.length}</strong> ORIGINAL ARTWORKS
            {filters.search && ` (QUERY: "${filters.search}")`}
          </div>
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="text-foreground hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <X className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <div className="text-center py-20 bg-card border border-dashed border-line p-8 shadow-xs">
          <p className="text-sm font-mono uppercase tracking-widest text-foreground/80 font-bold">No artworks matching current filters.</p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">Adjust search terms or clear selected series and status filters.</p>
          <button
            onClick={onResetFilters}
            className="mt-6 px-4 py-2 bg-primary text-primary-foreground font-mono font-bold text-[10px] uppercase tracking-widest hover:opacity-90 transition-opacity cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Artwork Grid */}
      <div
        className={
          viewMode === 'large'
            ? 'grid grid-cols-1 md:grid-cols-2 gap-8'
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
            <div className="aspect-[3/4] bg-card border border-line relative overflow-hidden flex items-center justify-center p-4 group-hover:border-line-strong transition-colors shadow-xs">
              <img
                src={art.renditions?.thumb?.url || art.imageUrl}
                alt={art.title}
                width={art.renditions?.thumb?.width || undefined}
                height={art.renditions?.thumb?.height || undefined}
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
                style={art.renditions?.lqip ? { backgroundImage: `url(${art.renditions.lqip})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getArtworkSvg(art.slug);
                }}
              />

              {/* Status Badge */}
              <div className="absolute top-3 left-3 z-10">
                {getStatusBadge(art.status)}
              </div>

              {/* Series Tag */}
              <div className="absolute top-3 right-3 z-10">
                <span className="text-[9px] font-mono uppercase border border-line bg-card/90 px-2 py-0.5 text-foreground/85 font-bold shadow-xs">
                  {art.gallery_series}
                </span>
              </div>

              {/* Quick overlay hint */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="px-3.5 py-1.5 bg-primary text-primary-foreground text-[9px] font-mono font-bold uppercase tracking-widest shadow-md">
                  View Artwork
                </span>
              </div>
            </div>

            {/* Meta Row below artwork */}
            <div className="mt-3 flex justify-between items-start gap-2 px-0.5">
              <div className="min-w-0">
                <h4 className="text-xs font-bold tracking-tight text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate font-sans">
                  {art.title}
                </h4>
                <p className="text-[9px] text-muted-foreground uppercase mt-0.5 font-mono">
                  {art.year} • {art.medium}
                </p>
                <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
                  {art.dimensions} • Original Studio Work
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <span className="text-[11px] font-mono font-bold text-foreground block">
                  {art.price}
                </span>
                <span className="text-[8px] text-muted-foreground uppercase font-mono tracking-wider">
                  Pricing / Inquire
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Master Catalog Summary Table */}
      <div className="border border-line p-6 bg-card shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono font-bold">
            Studio Master Inventory Registry
          </h3>
          <span className="text-[9px] text-muted-foreground font-mono">Austin Fine Art Studio</span>
        </div>
        
        <div className="grid grid-cols-12 gap-2 text-[9px] uppercase tracking-wider text-muted-foreground border-b border-line pb-2 mb-2 font-mono font-bold">
          <span className="col-span-4 sm:col-span-3">Artwork Title / Reference</span>
          <span className="col-span-4 sm:col-span-3">Medium / Surface</span>
          <span className="col-span-2 sm:col-span-2">Year</span>
          <span className="col-span-2 sm:col-span-2">Status</span>
          <span className="hidden sm:block sm:col-span-2 text-right">Price</span>
        </div>

        <div className="space-y-1.5 max-h-52 overflow-y-auto font-mono text-[10px]">
          {items.slice(0, 8).map((art) => (
            <div
              key={art.slug}
              onClick={() => onSelectArtwork(art.slug)}
              className="grid grid-cols-12 gap-2 border-b border-line pb-1.5 hover:bg-muted p-1 cursor-pointer transition-colors"
            >
              <span className="col-span-4 sm:col-span-3 text-foreground font-bold truncate hover:underline">
                {art.title}
              </span>
              <span className="col-span-4 sm:col-span-3 text-muted-foreground truncate">
                {art.medium}
              </span>
              <span className="col-span-2 sm:col-span-2 text-muted-foreground">
                {art.year}
              </span>
              <span className="col-span-2 sm:col-span-2 text-emerald-700 dark:text-emerald-400 font-bold">
                {art.status}
              </span>
              <span className="hidden sm:block sm:col-span-2 text-right text-foreground font-bold">
                {art.price}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
