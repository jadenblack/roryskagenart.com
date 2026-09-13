import React from 'react';
import { ArtworkRecord } from '../types';
import { X, Maximize2, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogClose, DialogTitle } from './ui/dialog';
import { useAuth } from '../context/AuthContext';

interface ArtworkQuickViewModalProps {
  artwork: ArtworkRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onInquire: (artwork: ArtworkRecord) => void;
  onInspectFull: (slug: string) => void;
}

/**
 * Quick-view modal on the shared shadcn/Radix Dialog (PRD §5): portal, focus
 * trap, scroll lock, working X via DialogClose, Esc + overlay dismiss. The
 * split-frame editorial design is preserved; the bespoke fixed-inset overlay
 * and its dead close button are gone.
 */
export const ArtworkQuickViewModal: React.FC<ArtworkQuickViewModalProps> = ({
  artwork,
  isOpen,
  onClose,
  onInquire,
  onInspectFull
}) => {
  const { isAuthenticated } = useAuth();
  void isAuthenticated;

  if (!artwork) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] sm:max-w-4xl p-0 gap-0 bg-card border-line rounded-xs overflow-hidden flex flex-col md:flex-row"
      >
        {/* Close button (Radix-wired) */}
        <DialogClose
          className="absolute top-3 right-3 z-20 text-muted-foreground hover:text-foreground bg-surface-deep border border-line p-1.5 transition-colors cursor-pointer rounded-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Close preview"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <DialogTitle className="sr-only">{artwork.title}</DialogTitle>

        {/* Media Frame (Left) */}
        <div className="md:w-3/5 bg-surface-deep flex items-center justify-center p-4 sm:p-8 relative min-h-[280px] md:min-h-[460px] overflow-hidden">
          {artwork.imageUrl ? (
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              referrerPolicy="no-referrer"
              className="max-h-[75vh] max-w-full object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-[1.02]"
            />
          ) : (
            <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest text-center">
              Original Studio Artwork
            </div>
          )}

          {/* Status Chip */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="px-2.5 py-1 bg-black/80 backdrop-blur-md text-white text-[10px] font-mono uppercase font-bold tracking-widest border border-line rounded-xs">
              {artwork.status}
            </span>
            {artwork.year && (
              <span className="px-2.5 py-1 bg-background/90 text-foreground text-[10px] font-mono font-bold rounded-xs border border-line">
                {artwork.year}
              </span>
            )}
          </div>
        </div>

        {/* Details Pane (Right) */}
        <div className="md:w-2/5 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto font-sans space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                {artwork.gallery_series || 'Original Studio Collection'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground font-serif leading-tight">
                {artwork.title}
              </h2>
            </div>

            {/* Price and Specs */}
            <div className="p-3 bg-surface-deep border border-line rounded-xs space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-foreground font-bold text-sm">
                <span>ESTIMATED VALUE</span>
                <span className="text-emerald-700 dark:text-emerald-400">{artwork.price || 'Inquire for Valuation'}</span>
              </div>
              <div className="text-[11px] text-muted-foreground pt-1 border-t border-line space-y-0.5">
                <div><strong className="text-foreground/80">Medium:</strong> {artwork.medium || 'Acrylic on Framed Panel'}</div>
                <div><strong className="text-foreground/80">Dimensions:</strong> {artwork.dimensions || 'Custom Studio Scale'}</div>
                <div><strong className="text-foreground/80">Origin:</strong> Austin, Texas Studio</div>
              </div>
            </div>

            {/* Narrative / Excerpt */}
            {artwork.narrative && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block font-bold">
                  ARTIST STATEMENT &amp; NARRATIVE
                </span>
                <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed font-serif italic border-l-2 border-line-strong pl-3">
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
                    className="px-2 py-0.5 bg-surface-deep border border-line text-[10px] font-mono text-muted-foreground rounded-xs"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="pt-4 border-t border-line space-y-2.5 font-mono text-xs">
            <button
              onClick={() => {
                onClose();
                onInquire(artwork);
              }}
              className="w-full py-3 bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-[0.2em] text-[11px] transition-colors cursor-pointer rounded-xs shadow-xs flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-600" />
              <span>Inquire to Acquire</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onInspectFull(artwork.slug);
              }}
              className="w-full py-2.5 bg-surface-deep hover:bg-muted border border-line text-foreground font-bold uppercase tracking-[0.18em] text-[10px] transition-colors cursor-pointer rounded-xs flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Archive Dossier &amp; Scale</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
