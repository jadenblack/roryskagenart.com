import React, { useState, useEffect } from 'react';
import { ArtworkRecord } from '../types';
import { ScaleVisualizer } from './ScaleVisualizer';
import { InquiryModal } from './InquiryModal';
import { getArtworkSvg } from '../data/artAssets';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Ruler, 
  Tag, 
  MapPin, 
  FileCode, 
  FileText, 
  Share2, 
  Check, 
  ZoomIn, 
  X, 
  Layers, 
  Edit3, 
  Power, 
  Box, 
  RotateCcw, 
  Trash2, 
  EyeOff,
  Sparkles
} from 'lucide-react';

interface ArtworkFocusViewProps {
  artwork: ArtworkRecord;
  allArtworks: ArtworkRecord[];
  onBack: () => void;
  onSelectArtwork: (slug: string) => void;
  onNavigatePage: (slug: string) => void;
  onEditInStudio: () => void;
  onToggleEnable?: (slug: string) => void;
  onToggleArchive?: (slug: string) => void;
  onToggleHeroSlider?: (slug: string) => void;
  onTrashArtwork?: (slug: string) => void;
}

export const ArtworkFocusView: React.FC<ArtworkFocusViewProps> = ({
  artwork,
  allArtworks,
  onBack,
  onSelectArtwork,
  onNavigatePage,
  onEditInStudio,
  onToggleEnable,
  onToggleArchive,
  onToggleHeroSlider,
  onTrashArtwork
}) => {
  const [activeTab, setActiveTab] = useState<'narrative' | 'scale' | 'source'>('narrative');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isDisabled = artwork.status === 'Disabled' || artwork.status === 'Hidden' || artwork.enabled === false;
  const isStored = artwork.status === 'Archived' || artwork.archived === true;
  const isTrashed = artwork.status === 'Trashed' || artwork.trashed === true;

  // Find index and previous / next artworks
  const currentIndex = allArtworks.findIndex((a) => a.slug === artwork.slug);
  const prevArtwork = currentIndex > 0 ? allArtworks[currentIndex - 1] : allArtworks[allArtworks.length - 1];
  const nextArtwork = currentIndex < allArtworks.length - 1 ? allArtworks[currentIndex + 1] : allArtworks[0];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxOpen) {
        if (e.key === 'Escape') setLightboxOpen(false);
        return;
      }
      if (inquiryOpen) return;

      if (e.key === 'ArrowLeft' && prevArtwork) {
        onSelectArtwork(prevArtwork.slug);
      } else if (e.key === 'ArrowRight' && nextArtwork) {
        onSelectArtwork(nextArtwork.slug);
      } else if (e.key === 'Escape') {
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, inquiryOpen, prevArtwork, nextArtwork, onSelectArtwork, onBack]);

  // Click handler for rendered Wikilinks in markdown
  const handleMarkdownClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const linkEl = target.closest('a');
    if (!linkEl) return;

    const href = linkEl.getAttribute('href');
    if (href && href.startsWith('#artwork/')) {
      e.preventDefault();
      const slug = href.replace('#artwork/', '');
      onSelectArtwork(slug);
    } else if (href && href.startsWith('#page/')) {
      e.preventDefault();
      const pageSlug = href.replace('#page/', '');
      onNavigatePage(pageSlug);
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#artwork/${artwork.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Top Breadcrumbs & Record Navigation Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-card border border-line p-3 sm:p-4 font-mono text-[10px] shadow-xs transition-colors">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 bg-surface-deep hover:bg-muted text-foreground/85 hover:text-foreground uppercase tracking-wider border border-line transition-colors cursor-pointer font-bold rounded-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Gallery</span>
        </button>

        {/* Record Counter & Next/Prev Controls */}
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground uppercase tracking-widest hidden sm:inline font-bold">
            ARTWORK <strong className="text-foreground">{currentIndex + 1}</strong> OF{' '}
            <strong className="text-foreground/80">{allArtworks.length}</strong>
          </span>

          <div className="flex items-center gap-1 bg-surface-deep p-1 border border-line rounded-xs">
            <button
              onClick={() => prevArtwork && onSelectArtwork(prevArtwork.slug)}
              title={`Previous: ${prevArtwork?.title}`}
              className="flex items-center gap-1 px-2.5 py-1 text-foreground/75 hover:text-foreground hover:bg-muted uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Prev</span>
            </button>
            <span className="w-px h-3 bg-line"></span>
            <button
              onClick={() => nextArtwork && onSelectArtwork(nextArtwork.slug)}
              title={`Next: ${nextArtwork?.title}`}
              className="flex items-center gap-1 px-2.5 py-1 text-foreground/75 hover:text-foreground hover:bg-muted uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs"
            >
              <span className="hidden md:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={copyShareLink}
            title="Copy direct link to this artwork"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-deep hover:bg-muted text-foreground/75 hover:text-foreground border border-line transition-colors uppercase tracking-wider font-bold rounded-xs cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">LINK COPIED</span>
              </>
            ) : (
              <>
                <Share2 className="w-3 h-3" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Full-Screen Focus Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Visual Media Presentation */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card border border-line p-4 sm:p-6 overflow-hidden shadow-xs transition-colors">
            {/* Interactive Image Frame */}
            <div
              onClick={() => setLightboxOpen(true)}
              className="relative aspect-[4/3] bg-surface-deep overflow-hidden flex items-center justify-center p-4 border border-line cursor-zoom-in group/img"
            >
              {/* Blurred artwork ambience — no dead letterbox space for
                  portrait or landscape works */}
              <img
                src={artwork.renditions?.hero?.url || artwork.imageUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-30"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getArtworkSvg(artwork.slug);
                }}
              />
              <img
                src={artwork.renditions?.hero?.url || artwork.imageUrl}
                alt={artwork.title}
                width={artwork.renditions?.hero?.width || undefined}
                height={artwork.renditions?.hero?.height || undefined}
                className="relative w-full h-full object-contain transition-transform duration-500 group-hover/img:scale-[1.02]"
                style={artwork.renditions?.lqip ? { backgroundImage: `url(${artwork.renditions.lqip})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getArtworkSvg(artwork.slug);
                }}
              />

              {/* Click to expand pill */}
              <div className="absolute bottom-3 right-3 bg-card/95 border border-line px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest text-foreground flex items-center gap-1.5 opacity-90 group-hover/img:opacity-100 transition-opacity font-bold shadow-xs">
                <ZoomIn className="w-3 h-3" />
                <span>Zoom Artwork</span>
              </div>
            </div>

            {/* File Path Indicator below image */}
            <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground font-mono flex-wrap gap-2 pt-3 border-t border-line">
              <span className="flex items-center gap-1.5 text-foreground/80 font-bold">
                <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="truncate">{artwork.slug}.md</span>
              </span>

              <div className="flex items-center gap-3">                  <button
                  onClick={() => onEditInStudio()}
                  className="text-foreground hover:underline flex items-center gap-1 uppercase tracking-wider text-[9px] cursor-pointer font-bold"
                >
                  <Edit3 className="w-3 h-3" /> Edit in Studio
                </button>
              </div>
            </div>
          </div>

          {/* Scale Visualizer */}
          <ScaleVisualizer artwork={artwork} />
        </div>

        {/* Right Column: Properties, Specs, Narrative */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Info Header Card */}
          <div className="bg-card border border-line p-6 sm:p-8 space-y-6 shadow-xs transition-colors">
            <div>
              {/* Series & Status Badges */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3 text-[9px] font-mono uppercase tracking-widest font-bold">
                <span className="px-2.5 py-0.5 bg-surface-deep text-foreground border border-line">
                  {artwork.gallery_series}
                </span>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 border font-bold ${
                      isDisabled
                        ? 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/80'
                        : isStored
                        ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/80'
                        : artwork.status === 'Available'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80'
                        : artwork.status === 'Public Installation'
                        ? 'bg-surface-deep text-foreground/85 border-line'
                        : artwork.status === 'Limited Edition'
                        ? 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/80'
                        : 'bg-surface-deep text-muted-foreground border-line'
                    }`}
                  >
                    {artwork.status === 'Hidden' ? 'Hidden' : isDisabled ? 'Disabled' : isStored ? 'Studio Storage' : artwork.status}
                  </span>
                </div>
              </div>

              {/* Lifecycle Actions Toolbar */}
              <div className="flex items-center gap-2 mb-4 p-2 bg-surface-deep border border-line text-[10px] font-mono flex-wrap rounded-xs">
                <span className="text-muted-foreground uppercase text-[9px] tracking-wider mr-1 font-bold">STUDIO CONTROLS:</span>
                
                {onToggleHeroSlider && (
                  <button
                    onClick={() => onToggleHeroSlider(artwork.slug)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] uppercase tracking-wider border transition-all cursor-pointer font-bold rounded-xs ${
                      artwork.heroSlider
                        ? 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700 shadow-xs'
                        : 'bg-card text-foreground/80 border-line hover:bg-muted'
                    }`}
                    title={artwork.heroSlider ? 'Remove from Homepage Hero Slider' : 'Show in Homepage Hero Slider'}
                  >
                    <Sparkles className={`w-3 h-3 ${artwork.heroSlider ? 'text-amber-600 dark:text-amber-400 fill-amber-500/20' : 'text-muted-foreground'}`} />
                    <span>Hero Slider: {artwork.heroSlider ? 'ON' : 'OFF'}</span>
                  </button>
                )}

                {onToggleEnable && (
                  <button
                    onClick={() => onToggleEnable(artwork.slug)}
                    className={`flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-wider border transition-colors cursor-pointer font-bold rounded-xs ${
                      isDisabled
                        ? 'bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                        : 'bg-card text-foreground/85 border-line hover:bg-muted'
                    }`}
                  >
                    {isDisabled ? <Power className="w-3 h-3 text-purple-600 dark:text-purple-400" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                    <span>{isDisabled ? 'Unhide Work' : 'Hide Work'}</span>
                  </button>
                )}

                {onToggleArchive && (
                  <button
                    onClick={() => onToggleArchive(artwork.slug)}
                    className={`flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-wider border transition-colors cursor-pointer font-bold rounded-xs ${
                      isStored
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-card text-foreground/85 border-line hover:bg-muted'
                    }`}
                  >
                    {isStored ? <RotateCcw className="w-3 h-3 text-amber-600 dark:text-amber-400" /> : <Box className="w-3 h-3 text-muted-foreground" />}
                    <span>{isStored ? 'To Showroom' : 'To Storage'}</span>
                  </button>
                )}

                {onTrashArtwork && !isTrashed && (
                  <button
                    onClick={() => onTrashArtwork(artwork.slug)}
                    className="flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-wider bg-card hover:bg-red-50 dark:hover:bg-red-950/60 text-red-700 dark:text-red-400 border border-line hover:border-red-300 dark:hover:border-red-800 transition-colors cursor-pointer ml-auto font-bold rounded-xs"
                  >
                    <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                    <span>Trash</span>
                  </button>
                )}
              </div>

              {/* Title & Production Year */}
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase font-sans">
                {artwork.title}
              </h1>
              <p className="text-muted-foreground text-xs mt-1.5 font-mono">
                Original fine art work by Rory Skagen in <strong className="text-foreground font-bold">{artwork.year}</strong>
              </p>
            </div>

            {/* Structured Specifications Matrix */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-surface-deep border border-line font-mono text-[10px] shadow-xs">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                  <Ruler className="w-3 h-3 text-muted-foreground" /> Dimensions
                </span>
                <span className="font-bold text-foreground mt-1 block">
                  {artwork.dimensions}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {artwork.dimensions_cm}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                  <Layers className="w-3 h-3 text-muted-foreground" /> Medium / Substrate
                </span>
                <span className="font-bold text-foreground mt-1 block line-clamp-1">
                  {artwork.medium}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {artwork.edition}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                  <MapPin className="w-3 h-3 text-muted-foreground" /> Location / Studio
                </span>
                <span className="font-bold text-foreground mt-1 block line-clamp-1">
                  {artwork.location || 'Austin, TX Studio'}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                  <Tag className="w-3 h-3 text-muted-foreground" /> Price / Purchase
                </span>
                <span className="font-bold text-foreground text-sm mt-1 block">
                  {artwork.price}
                </span>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-2">
              <button
                onClick={() => setInquiryOpen(true)}
                className="w-full py-3.5 px-6 bg-primary text-primary-foreground text-[10px] uppercase font-bold tracking-[0.2em] hover:opacity-90 transition-opacity cursor-pointer shadow-md rounded-xs"
              >
                {artwork.status === 'Available'
                  ? 'Inquire About Original'
                  : artwork.status === 'Limited Edition'
                  ? 'Request Limited Edition Print'
                  : 'Studio Inquiries'}
              </button>
            </div>
          </div>

          {/* Narrative & Source File Tabs */}
          <div className="bg-card border border-line shadow-xs transition-colors">
            <div className="flex items-center border-b border-line bg-surface-deep text-[10px] font-mono">
              <button
                onClick={() => setActiveTab('narrative')}
                className={`flex-1 py-2.5 uppercase tracking-wider transition-colors font-bold cursor-pointer ${
                  activeTab === 'narrative'
                    ? 'border-b-2 border-line-strong text-foreground bg-card'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Curatorial Narrative
              </button>
              <button
                onClick={() => setActiveTab('source')}
                className={`flex-1 py-2.5 uppercase tracking-wider transition-colors font-bold cursor-pointer ${
                  activeTab === 'source'
                    ? 'border-b-2 border-line-strong text-foreground bg-card'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Drive Record ({artwork.slug}.md)
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'narrative' ? (
                <div
                  onClick={handleMarkdownClick}
                  dangerouslySetInnerHTML={{ __html: artwork.renderedHtml || '' }}
                  className="prose prose-zinc dark:prose-invert max-w-none text-foreground/85 text-xs sm:text-sm leading-relaxed"
                />
              ) : (
                <div className="space-y-3 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-muted-foreground uppercase tracking-wider">
                    <span>File Path: {artwork.slug}.md</span>
                    <button
                      onClick={() => onEditInStudio()}
                      className="text-foreground hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit in Studio
                    </button>
                  </div>
                  <pre className="p-4 bg-surface-deep border border-line text-foreground/85 font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed">
                    {artwork.narrative}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Zoom Lightbox Modal */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] uppercase tracking-widest">
            <div>
              <h3 className="font-bold text-white text-sm">{artwork.title}</h3>
              <p className="text-zinc-500">{artwork.year} • {artwork.medium} ({artwork.dimensions})</p>
            </div>
            <button
              onClick={() => setLightboxOpen(false)}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={artwork.renditions?.full?.url || artwork.renditions?.hero?.url || artwork.imageUrl}
              alt={artwork.title}
              className="max-h-[85vh] max-w-[90vw] object-contain border border-zinc-800 shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getArtworkSvg(artwork.slug);
              }}
            />
          </div>

          <div className="text-center text-[10px] font-mono uppercase tracking-widest text-zinc-400">
            Press ESC or click close to return to artwork details
          </div>
        </div>
      )}

      {/* Inquiry Dialog */}
      <InquiryModal
        artwork={artwork}
        isOpen={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
      />
    </div>
  );
};
