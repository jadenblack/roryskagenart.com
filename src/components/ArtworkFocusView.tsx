import React, { useState, useEffect } from 'react';
import { ArtworkRecord } from '../types';
import { ScaleVisualizer } from './ScaleVisualizer';
import { InquiryModal } from './InquiryModal';
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
  Cloud
} from 'lucide-react';

interface ArtworkFocusViewProps {
  artwork: ArtworkRecord;
  allArtworks: ArtworkRecord[];
  onBack: () => void;
  onSelectArtwork: (slug: string) => void;
  onNavigatePage: (slug: string) => void;
  onEditInExplorer: (filePath: string) => void;
  onOpenCloudinary?: () => void;
}

export const ArtworkFocusView: React.FC<ArtworkFocusViewProps> = ({
  artwork,
  allArtworks,
  onBack,
  onSelectArtwork,
  onNavigatePage,
  onEditInExplorer,
  onOpenCloudinary
}) => {
  const [activeTab, setActiveTab] = useState<'narrative' | 'scale' | 'source'>('narrative');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
      <div className="flex items-center justify-between flex-wrap gap-4 bg-[#0D0D10] border border-zinc-800 p-3 sm:p-4 font-mono text-[10px]">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white uppercase tracking-wider border border-zinc-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Collection</span>
        </button>

        {/* Record Counter & Next/Prev Controls */}
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 uppercase tracking-widest hidden sm:inline">
            ENTITY <strong className="text-white">{currentIndex + 1}</strong> OF{' '}
            <strong className="text-zinc-400">{allArtworks.length}</strong>
          </span>

          <div className="flex items-center gap-1 bg-zinc-900 p-1 border border-zinc-800">
            <button
              onClick={() => prevArtwork && onSelectArtwork(prevArtwork.slug)}
              title={`Previous: ${prevArtwork?.title}`}
              className="flex items-center gap-1 px-2.5 py-1 text-zinc-400 hover:text-white hover:bg-zinc-800 uppercase tracking-wider transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Prev</span>
            </button>
            <span className="w-px h-3 bg-zinc-800"></span>
            <button
              onClick={() => nextArtwork && onSelectArtwork(nextArtwork.slug)}
              title={`Next: ${nextArtwork?.title}`}
              className="flex items-center gap-1 px-2.5 py-1 text-zinc-400 hover:text-white hover:bg-zinc-800 uppercase tracking-wider transition-colors"
            >
              <span className="hidden md:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={copyShareLink}
            title="Copy direct link to this artwork"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors uppercase tracking-wider"
          >
            {copiedLink ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-bold">LINK COPIED</span>
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
          <div className="bg-black border border-zinc-800 p-4 sm:p-6 overflow-hidden">
            {/* Interactive Image Frame */}
            <div
              onClick={() => setLightboxOpen(true)}
              className="relative aspect-[4/3] bg-zinc-900/60 overflow-hidden flex items-center justify-center p-4 border border-zinc-800/80 cursor-zoom-in group/img"
            >
              <img
                src={artwork.imageUrl}
                alt={artwork.title}
                className="w-full h-full object-contain transition-transform duration-500 group-hover/img:scale-[1.02]"
              />

              {/* Click to expand pill */}
              <div className="absolute bottom-3 right-3 bg-black/90 border border-zinc-800 px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest text-zinc-300 flex items-center gap-1.5 opacity-90 group-hover/img:opacity-100 transition-opacity">
                <ZoomIn className="w-3 h-3" />
                <span>Zoom Canvas</span>
              </div>
            </div>

            {/* File Path Indicator below image */}
            <div className="mt-4 flex items-center justify-between text-[10px] text-zinc-500 font-mono flex-wrap gap-2 pt-3 border-t border-zinc-800">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                <span className="truncate">posts/{artwork.slug}.md</span>
              </span>

              <div className="flex items-center gap-3">
                {onOpenCloudinary && (
                  <button
                    onClick={onOpenCloudinary}
                    className="text-sky-400 hover:text-sky-300 flex items-center gap-1 uppercase tracking-wider text-[9px] cursor-pointer"
                  >
                    <Cloud className="w-3 h-3" /> Sync Real Photo
                  </button>
                )}
                <button
                  onClick={() => onEditInExplorer(artwork.filePath)}
                  className="text-white hover:underline flex items-center gap-1 uppercase tracking-wider text-[9px] cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> Edit Source File
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
          <div className="bg-[#0D0D10] border border-zinc-800 p-6 sm:p-8 space-y-6">
            <div>
              {/* Series & Status Badges */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3 text-[9px] font-mono uppercase tracking-widest">
                <span className="px-2 py-0.5 bg-zinc-900 text-white border border-zinc-700">
                  {artwork.gallery_series}
                </span>

                <span
                  className={`px-2 py-0.5 border ${
                    artwork.status === 'Available'
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/80'
                      : artwork.status === 'Public Installation'
                      ? 'bg-zinc-900 text-zinc-300 border-zinc-700'
                      : artwork.status === 'Limited Edition'
                      ? 'bg-zinc-900 text-zinc-300 border-zinc-700'
                      : 'bg-black/60 text-zinc-500 border-zinc-800'
                  }`}
                >
                  {artwork.status}
                </span>
              </div>

              {/* Title & Production Year */}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase font-sans">
                {artwork.title}
              </h1>
              <p className="text-zinc-400 text-xs mt-1.5 font-mono">
                Cataloged entity by Rory Skagen in <strong className="text-white">{artwork.year}</strong>
              </p>
            </div>

            {/* Structured Specifications Matrix */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-zinc-950 border border-zinc-800 font-mono text-[10px]">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                  <Ruler className="w-3 h-3 text-zinc-400" /> Dimensions
                </span>
                <span className="font-bold text-white mt-1 block">
                  {artwork.dimensions}
                </span>
                <span className="text-[9px] text-zinc-500">
                  {artwork.dimensions_cm}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-zinc-400" /> Substrate / Edition
                </span>
                <span className="font-bold text-white mt-1 block line-clamp-1">
                  {artwork.medium}
                </span>
                <span className="text-[9px] text-zinc-500">
                  {artwork.edition}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-zinc-400" /> Location
                </span>
                <span className="font-bold text-white mt-1 block line-clamp-1">
                  {artwork.location || 'Austin, TX'}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-zinc-400" /> Valuation
                </span>
                <span className="font-bold text-white text-sm mt-1 block">
                  {artwork.price}
                </span>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-2">
              <button
                onClick={() => setInquiryOpen(true)}
                className="w-full py-3 px-6 bg-white text-black text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                {artwork.status === 'Available'
                  ? 'Inquire for Acquisition'
                  : artwork.status === 'Limited Edition'
                  ? 'Request Limited Archival Print'
                  : 'Studio Inquiries & Provenance'}
              </button>
            </div>
          </div>

          {/* Narrative & Source File Tabs */}
          <div className="bg-[#0D0D10] border border-zinc-800">
            <div className="flex items-center border-b border-zinc-800 bg-black text-[10px] font-mono">
              <button
                onClick={() => setActiveTab('narrative')}
                className={`flex-1 py-2.5 uppercase tracking-wider transition-colors ${
                  activeTab === 'narrative'
                    ? 'border-b-2 border-white text-white font-bold bg-zinc-900/40'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Curatorial Narrative
              </button>
              <button
                onClick={() => setActiveTab('source')}
                className={`flex-1 py-2.5 uppercase tracking-wider transition-colors ${
                  activeTab === 'source'
                    ? 'border-b-2 border-white text-white font-bold bg-zinc-900/40'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Source Markdown (posts/{artwork.slug}.md)
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'narrative' ? (
                <div
                  onClick={handleMarkdownClick}
                  dangerouslySetInnerHTML={{ __html: artwork.renderedHtml || '' }}
                  className="prose prose-invert max-w-none text-zinc-300 text-xs sm:text-sm leading-relaxed"
                />
              ) : (
                <div className="space-y-3 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-zinc-500 uppercase tracking-wider">
                    <span>Virtual Drive Path: posts/{artwork.slug}.md</span>
                    <button
                      onClick={() => onEditInExplorer(artwork.filePath)}
                      className="text-white hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Open in Vault
                    </button>
                  </div>
                  <pre className="p-4 bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed">
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
              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              className="max-h-[85vh] max-w-[90vw] object-contain border border-zinc-800"
            />
          </div>

          <div className="text-center text-[10px] font-mono uppercase tracking-widest text-zinc-600">
            Press ESC or click close to return
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
