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
  Cloud, 
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
  onEditInExplorer: (filePath: string) => void;
  onOpenCloudinary?: () => void;
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
  onEditInExplorer,
  onOpenCloudinary,
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
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-3 sm:p-4 font-mono text-[10px] shadow-xs transition-colors">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 hover:text-black dark:hover:text-white uppercase tracking-wider border border-zinc-300 dark:border-zinc-800 transition-colors cursor-pointer font-bold rounded-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Gallery</span>
        </button>

        {/* Record Counter & Next/Prev Controls */}
        <div className="flex items-center gap-3">
          <span className="text-zinc-600 dark:text-zinc-500 uppercase tracking-widest hidden sm:inline font-bold">
            ARTWORK <strong className="text-zinc-950 dark:text-white">{currentIndex + 1}</strong> OF{' '}
            <strong className="text-zinc-700 dark:text-zinc-400">{allArtworks.length}</strong>
          </span>

          <div className="flex items-center gap-1 bg-[#F2F1EC] dark:bg-zinc-900 p-1 border border-zinc-300 dark:border-zinc-800 rounded-xs">
            <button
              onClick={() => prevArtwork && onSelectArtwork(prevArtwork.slug)}
              title={`Previous: ${prevArtwork?.title}`}
              className="flex items-center gap-1 px-2.5 py-1 text-zinc-700 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Prev</span>
            </button>
            <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-800"></span>
            <button
              onClick={() => nextArtwork && onSelectArtwork(nextArtwork.slug)}
              title={`Next: ${nextArtwork?.title}`}
              className="flex items-center gap-1 px-2.5 py-1 text-zinc-700 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs"
            >
              <span className="hidden md:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={copyShareLink}
            title="Copy direct link to this artwork"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-400 hover:text-black dark:hover:text-white border border-zinc-300 dark:border-zinc-800 transition-colors uppercase tracking-wider font-bold rounded-xs cursor-pointer"
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
          <div className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 p-4 sm:p-6 overflow-hidden shadow-xs transition-colors">
            {/* Interactive Image Frame */}
            <div
              onClick={() => setLightboxOpen(true)}
              className="relative aspect-[4/3] bg-[#F7F6F2] dark:bg-zinc-900/60 overflow-hidden flex items-center justify-center p-4 border border-zinc-200 dark:border-zinc-800/80 cursor-zoom-in group/img"
            >
              <img
                src={artwork.renditions?.hero?.url || artwork.imageUrl}
                alt={artwork.title}
                width={artwork.renditions?.hero?.width || undefined}
                height={artwork.renditions?.hero?.height || undefined}
                className="w-full h-full object-contain transition-transform duration-500 group-hover/img:scale-[1.02]"
                style={artwork.renditions?.lqip ? { backgroundImage: `url(${artwork.renditions.lqip})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getArtworkSvg(artwork.slug);
                }}
              />

              {/* Click to expand pill */}
              <div className="absolute bottom-3 right-3 bg-white/95 dark:bg-black/90 border border-zinc-300 dark:border-zinc-800 px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest text-zinc-900 dark:text-zinc-300 flex items-center gap-1.5 opacity-90 group-hover/img:opacity-100 transition-opacity font-bold shadow-xs">
                <ZoomIn className="w-3 h-3" />
                <span>Zoom Artwork</span>
              </div>
            </div>

            {/* File Path Indicator below image */}
            <div className="mt-4 flex items-center justify-between text-[10px] text-zinc-600 dark:text-zinc-500 font-mono flex-wrap gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <span className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-400 font-bold">
                <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                <span className="truncate">{artwork.slug}.md</span>
              </span>

              <div className="flex items-center gap-3">
                {onOpenCloudinary && (
                  <button
                    onClick={onOpenCloudinary}
                    className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 uppercase tracking-wider text-[9px] cursor-pointer font-bold"
                  >
                    <Cloud className="w-3 h-3" /> CDN Photo Sync
                  </button>
                )}
                <button
                  onClick={() => onEditInExplorer(artwork.filePath)}
                  className="text-zinc-950 dark:text-white hover:underline flex items-center gap-1 uppercase tracking-wider text-[9px] cursor-pointer font-bold"
                >
                  <Edit3 className="w-3 h-3" /> Edit in Drive
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
          <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-xs transition-colors">
            <div>
              {/* Series & Status Badges */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3 text-[9px] font-mono uppercase tracking-widest font-bold">
                <span className="px-2.5 py-0.5 bg-[#F2F1EC] dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700">
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
                        ? 'bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                        : artwork.status === 'Limited Edition'
                        ? 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-black/60 dark:text-zinc-500 dark:border-zinc-800'
                    }`}
                  >
                    {artwork.status === 'Hidden' ? 'Hidden' : isDisabled ? 'Disabled' : isStored ? 'Studio Storage' : artwork.status}
                  </span>
                </div>
              </div>

              {/* Lifecycle Actions Toolbar */}
              <div className="flex items-center gap-2 mb-4 p-2 bg-[#F2F1EC] dark:bg-black border border-zinc-300 dark:border-zinc-800/80 text-[10px] font-mono flex-wrap rounded-xs">
                <span className="text-zinc-600 dark:text-zinc-500 uppercase text-[9px] tracking-wider mr-1 font-bold">STUDIO CONTROLS:</span>
                
                {onToggleHeroSlider && (
                  <button
                    onClick={() => onToggleHeroSlider(artwork.slug)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] uppercase tracking-wider border transition-all cursor-pointer font-bold rounded-xs ${
                      artwork.heroSlider
                        ? 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700 shadow-xs'
                        : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800'
                    }`}
                    title={artwork.heroSlider ? 'Remove from Homepage Hero Slider' : 'Show in Homepage Hero Slider'}
                  >
                    <Sparkles className={`w-3 h-3 ${artwork.heroSlider ? 'text-amber-600 dark:text-amber-400 fill-amber-500/20' : 'text-zinc-400'}`} />
                    <span>Hero Slider: {artwork.heroSlider ? 'ON' : 'OFF'}</span>
                  </button>
                )}

                {onToggleEnable && (
                  <button
                    onClick={() => onToggleEnable(artwork.slug)}
                    className={`flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-wider border transition-colors cursor-pointer font-bold rounded-xs ${
                      isDisabled
                        ? 'bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                        : 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800'
                    }`}
                  >
                    {isDisabled ? <Power className="w-3 h-3 text-purple-600 dark:text-purple-400" /> : <EyeOff className="w-3 h-3 text-zinc-500" />}
                    <span>{isDisabled ? 'Unhide Work' : 'Hide Work'}</span>
                  </button>
                )}

                {onToggleArchive && (
                  <button
                    onClick={() => onToggleArchive(artwork.slug)}
                    className={`flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-wider border transition-colors cursor-pointer font-bold rounded-xs ${
                      isStored
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800'
                    }`}
                  >
                    {isStored ? <RotateCcw className="w-3 h-3 text-amber-600 dark:text-amber-400" /> : <Box className="w-3 h-3 text-zinc-500" />}
                    <span>{isStored ? 'To Showroom' : 'To Storage'}</span>
                  </button>
                )}

                {onTrashArtwork && !isTrashed && (
                  <button
                    onClick={() => onTrashArtwork(artwork.slug)}
                    className="flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-wider bg-white hover:bg-red-50 text-red-700 border border-zinc-300 hover:border-red-300 dark:bg-zinc-900 dark:hover:bg-red-950/80 dark:text-red-400 dark:border-zinc-800 transition-colors cursor-pointer ml-auto font-bold rounded-xs"
                  >
                    <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                    <span>Trash</span>
                  </button>
                )}
              </div>

              {/* Title & Production Year */}
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 dark:text-white uppercase font-sans">
                {artwork.title}
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1.5 font-mono">
                Original fine art work by Rory Skagen in <strong className="text-zinc-950 dark:text-white font-bold">{artwork.year}</strong>
              </p>
            </div>

            {/* Structured Specifications Matrix */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-[#F7F6F2] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-[10px] shadow-xs">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1 font-bold">
                  <Ruler className="w-3 h-3 text-zinc-500" /> Dimensions
                </span>
                <span className="font-bold text-zinc-950 dark:text-white mt-1 block">
                  {artwork.dimensions}
                </span>
                <span className="text-[9px] text-zinc-500">
                  {artwork.dimensions_cm}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1 font-bold">
                  <Layers className="w-3 h-3 text-zinc-500" /> Medium / Substrate
                </span>
                <span className="font-bold text-zinc-950 dark:text-white mt-1 block line-clamp-1">
                  {artwork.medium}
                </span>
                <span className="text-[9px] text-zinc-500">
                  {artwork.edition}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1 font-bold">
                  <MapPin className="w-3 h-3 text-zinc-500" /> Location / Studio
                </span>
                <span className="font-bold text-zinc-950 dark:text-white mt-1 block line-clamp-1">
                  {artwork.location || 'Austin, TX Studio'}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1 font-bold">
                  <Tag className="w-3 h-3 text-zinc-500" /> Price / Purchase
                </span>
                <span className="font-bold text-zinc-950 dark:text-white text-sm mt-1 block">
                  {artwork.price}
                </span>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-2">
              <button
                onClick={() => setInquiryOpen(true)}
                className="w-full py-3.5 px-6 bg-zinc-900 text-white dark:bg-white dark:text-black text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer shadow-md rounded-xs"
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
          <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 shadow-xs transition-colors">
            <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-[#F2F1EC] dark:bg-black text-[10px] font-mono">
              <button
                onClick={() => setActiveTab('narrative')}
                className={`flex-1 py-2.5 uppercase tracking-wider transition-colors font-bold cursor-pointer ${
                  activeTab === 'narrative'
                    ? 'border-b-2 border-zinc-950 dark:border-white text-zinc-950 dark:text-white bg-white dark:bg-zinc-900/40'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-300'
                }`}
              >
                Curatorial Narrative
              </button>
              <button
                onClick={() => setActiveTab('source')}
                className={`flex-1 py-2.5 uppercase tracking-wider transition-colors font-bold cursor-pointer ${
                  activeTab === 'source'
                    ? 'border-b-2 border-zinc-950 dark:border-white text-zinc-950 dark:text-white bg-white dark:bg-zinc-900/40'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-300'
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
                  className="prose prose-zinc dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-300 text-xs sm:text-sm leading-relaxed"
                />
              ) : (
                <div className="space-y-3 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-500 uppercase tracking-wider">
                    <span>File Path: {artwork.slug}.md</span>
                    <button
                      onClick={() => onEditInExplorer(artwork.filePath)}
                      className="text-zinc-900 dark:text-white hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit in Drive Files
                    </button>
                  </div>
                  <pre className="p-4 bg-[#F7F6F2] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed">
                    {artwork.rawContent}
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
