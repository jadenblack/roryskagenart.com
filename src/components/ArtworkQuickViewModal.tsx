import React from 'react';
import { ArtworkRecord } from '../types';
import { X, Maximize2, Send, Tag, Layers, Calendar, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ArtworkQuickViewModalProps {
  artwork: ArtworkRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onInquire: (artwork: ArtworkRecord) => void;
  onInspectFull: (slug: string) => void;
}

export const ArtworkQuickViewModal: React.FC<ArtworkQuickViewModalProps> = ({
  artwork,
  isOpen,
  onClose,
  onInquire,
  onInspectFull
}) => {
  const { isAuthenticated } = useAuth();

  if (!isOpen || !artwork) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#0E0E12] border border-zinc-300 dark:border-zinc-800 shadow-2xl rounded-xs overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-1.5 transition-colors cursor-pointer rounded-xs"
          title="Close preview"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Media Frame (Left) */}
        <div className="md:w-3/5 bg-[#141416] flex items-center justify-center p-4 sm:p-8 relative min-h-[280px] md:min-h-[460px] overflow-hidden">
          {artwork.imageUrl ? (
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              referrerPolicy="no-referrer"
              className="max-h-[75vh] max-w-full object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-[1.02]"
            />
          ) : (
            <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest text-center">
              Original Studio Artwork
            </div>
          )}

          {/* Status Chip */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="px-2.5 py-1 bg-black/80 backdrop-blur-md text-white text-[10px] font-mono uppercase font-bold tracking-widest border border-zinc-700 rounded-xs">
              {artwork.status}
            </span>
            {artwork.year && (
              <span className="px-2.5 py-1 bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 text-[10px] font-mono font-bold rounded-xs border border-zinc-300 dark:border-zinc-700">
                {artwork.year}
              </span>
            )}
          </div>
        </div>

        {/* Details Pane (Right) */}
        <div className="md:w-2/5 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto font-sans space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">
                {artwork.gallery_series || 'Original Studio Collection'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-serif leading-tight">
                {artwork.title}
              </h2>
            </div>

            {/* Price and Specs */}
            <div className="p-3 bg-[#F2F1EC] dark:bg-zinc-900/80 border border-zinc-300 dark:border-zinc-800 rounded-xs space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-zinc-950 dark:text-white font-bold text-sm">
                <span>ESTIMATED VALUE</span>
                <span className="text-emerald-700 dark:text-emerald-400">{artwork.price || 'Inquire for Valuation'}</span>
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-800 space-y-0.5">
                <div><strong className="text-zinc-800 dark:text-zinc-300">Medium:</strong> {artwork.medium || 'Acrylic on Framed Panel'}</div>
                <div><strong className="text-zinc-800 dark:text-zinc-300">Dimensions:</strong> {artwork.dimensions || 'Custom Studio Scale'}</div>
                <div><strong className="text-zinc-800 dark:text-zinc-300">Origin:</strong> Austin, Texas Studio</div>
              </div>
            </div>

            {/* Narrative / Excerpt */}
            {artwork.narrative && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block font-bold">
                  ARTIST STATEMENT &amp; NARRATIVE
                </span>
                <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-serif italic border-l-2 border-zinc-400 dark:border-zinc-600 pl-3">
                  &ldquo;{artwork.narrative}&rdquo;
                </p>
              </div>
            )}

            {/* Tags */}
            {artwork.tags && artwork.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {artwork.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 rounded-xs"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5 font-mono text-xs">
            <button
              onClick={() => {
                onClose();
                onInquire(artwork);
              }}
              className="w-full py-3 bg-zinc-900 text-white dark:bg-white dark:text-black hover:bg-black dark:hover:bg-zinc-200 font-bold uppercase tracking-[0.2em] text-[11px] transition-colors cursor-pointer rounded-xs shadow-xs flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-600" />
              <span>Inquire to Acquire</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onInspectFull(artwork.slug);
              }}
              className="w-full py-2.5 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold uppercase tracking-[0.18em] text-[10px] transition-colors cursor-pointer rounded-xs flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Archive Dossier &amp; Scale</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
