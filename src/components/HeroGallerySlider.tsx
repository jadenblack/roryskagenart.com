import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Pause, 
  Play, 
  Maximize2, 
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ArtworkRecord } from '../types';
import { getArtworkSvg } from '../data/artAssets';

/**
 * First readable prose line of a narrative, with markdown scaffolding stripped.
 */
export function heroExcerpt(narrative: string): string {
  const line = narrative
    .split('\n')
    .map((l) => l.trim())
    .find(
      (l) =>
        l.length > 40 &&
        !l.startsWith('#') &&
        !l.startsWith('>') &&
        !l.startsWith('![') &&
        !l.startsWith('|') &&
        !l.startsWith('---') &&
        !l.startsWith('![[') &&
        !l.startsWith('[') &&
        !l.startsWith('←') &&
        !/return to (master )?(catalog|index)/i.test(l)
    );
  if (!line) return 'Curated masterwork in the retro-pop surrealist archive of Austin artist Rory Skagen.';
  return line
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_, _target, label) => label || _target)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_{2}([^_]+)_{2}/g, '$1')
    .trim();
}

interface HeroGallerySliderProps {
  artworks: ArtworkRecord[];
  onSelectArtwork: (slug: string) => void;
  onInquireArtwork?: (artwork: ArtworkRecord) => void;
  onOpenLightbox?: (artwork: ArtworkRecord) => void;
}

/**
 * Editorial hero stage — no frames, no boxes. A full-bleed crossfading
 * artwork canvas with the story set in an overlay: glass detail card,
 * ghost arrows, segment progress, dot-strip navigation.
 */
export const HeroGallerySlider: React.FC<HeroGallerySliderProps> = ({
  artworks,
  onSelectArtwork,
  onInquireArtwork,
  onOpenLightbox,
}) => {
  const heroItems = React.useMemo(() => {
    const valid = artworks.filter(
      (item) => item.heroSlider === true && item.enabled !== false && !item.trashed && item.status !== 'Hidden'
    );
    if (valid.length > 0) return valid;
    return artworks.filter((item) => item.enabled !== false && !item.trashed && item.status !== 'Hidden').slice(0, 6);
  }, [artworks]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  const SLIDE_DURATION = 7000;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const totalSlides = heroItems.length;

  const goToSlide = useCallback((index: number, newDirection: 1 | -1 = 1) => {
    if (totalSlides === 0) return;
    setDirection(newDirection);
    setCurrentIndex((index + totalSlides) % totalSlides);
  }, [totalSlides]);

  const nextSlide = useCallback(() => goToSlide(currentIndex + 1, 1), [goToSlide, currentIndex]);
  const prevSlide = useCallback(() => goToSlide(currentIndex - 1, -1), [goToSlide, currentIndex]);

  useEffect(() => {
    if (isPlaying && !isHovered && totalSlides > 1) {
      timerRef.current = setInterval(() => nextSlide(), SLIDE_DURATION);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isHovered, totalSlides, nextSlide]);

  useEffect(() => {
    if (currentIndex >= totalSlides && totalSlides > 0) setCurrentIndex(0);
  }, [currentIndex, totalSlides]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 50) nextSlide();
    else if (distance < -50) prevSlide();
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prevSlide();
    else if (e.key === 'ArrowRight') nextSlide();
  };

  if (totalSlides === 0) return null;

  const currentArtwork = heroItems[currentIndex];

  return (
    <div
      id="hero-gallery-slider-container"
      className="relative w-full my-2 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Rory Skagen Featured Artwork Slider"
    >
      {/* ── The Stage: full-bleed canvas, soft ambient glow behind the work ── */}
      <div className="relative min-h-[440px] sm:min-h-[520px] md:min-h-[580px] overflow-hidden rounded-2xl bg-surface-deep">
        {/* Crossfading artwork canvases */}
        <AnimatePresence initial={false}>
          <motion.div
            key={currentArtwork.slug}
            initial={{ opacity: 0, scale: 1.025 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {/* Soft ambient glow derived from the artwork itself */}
            <img
              src={currentArtwork.renditions?.hero?.url || currentArtwork.imageUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-3xl scale-125 opacity-25 dark:opacity-30"
            />
            {/* Vignette wash so overlay text always reads */}
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-black/25 dark:from-black/75 dark:via-black/25 dark:to-black/40" />

            {/* The artwork itself — matted, centered, elevated */}
            <div className="relative h-full w-full flex items-center justify-center p-6 sm:p-10 md:p-14">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="relative group/hero-img"
              >
                <div
                  onClick={() => (onOpenLightbox ? onOpenLightbox(currentArtwork) : onSelectArtwork(currentArtwork.slug))}
                  className="relative bg-white dark:bg-zinc-100 p-2 sm:p-3 shadow-2xl cursor-zoom-in transition-transform duration-500 hover:scale-[1.015]"
                >
                  <img
                    src={currentArtwork.renditions?.hero?.url || currentArtwork.imageUrl}
                    alt={currentArtwork.title}
                    width={currentArtwork.renditions?.hero?.width || undefined}
                    height={currentArtwork.renditions?.hero?.height || undefined}
                    loading="eager"
                    className="max-h-[300px] sm:max-h-[360px] md:max-h-[400px] max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getArtworkSvg(currentArtwork.slug);
                    }}
                  />
                  {/* Inspect pill */}
                  <div className="absolute bottom-4 right-4 bg-black/70 text-white px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest flex items-center gap-1.5 opacity-0 group-hover/hero-img:opacity-100 transition-opacity">
                    <Maximize2 className="w-3 h-3" />
                    <span>Inspect</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Floating glass detail card (bottom-left) ── */}
        <div className="absolute left-4 bottom-4 sm:left-6 sm:bottom-6 right-4 sm:right-auto sm:max-w-md z-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentArtwork.slug}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-white/25 bg-white/12 dark:bg-black/40 backdrop-blur-xl p-4 sm:p-5 shadow-xl"
            >
              <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.22em] text-white/75">
                <span className={`px-1.5 py-0.5 border font-bold ${
                  currentArtwork.status === 'Available'
                    ? 'bg-emerald-500/25 border-emerald-300/50 text-emerald-100'
                    : 'bg-white/15 border-white/30 text-white/90'
                }`}>
                  {currentArtwork.status}
                </span>
                <span>{currentArtwork.gallery_series || 'Studio Landmark'}</span>
                <span className="text-white/40">•</span>
                <span className="text-amber-300 font-bold">{currentArtwork.year}</span>
              </div>

              <button
                onClick={() => onSelectArtwork(currentArtwork.slug)}
                className="mt-2 block text-left text-xl sm:text-2xl font-serif font-black uppercase tracking-tight text-white leading-tight hover:underline decoration-white/40 underline-offset-4 cursor-pointer"
              >
                {currentArtwork.title}
              </button>

              <p className="mt-1.5 text-[11px] sm:text-xs text-white/75 leading-relaxed line-clamp-2 font-serif italic">
                {currentArtwork.narrative ? heroExcerpt(currentArtwork.narrative) : ''}
              </p>

              <div className="mt-3 flex items-center gap-2.5">
                <button
                  onClick={() => onSelectArtwork(currentArtwork.slug)}
                  className="px-3.5 py-2 bg-white text-black text-[9px] font-mono font-bold uppercase tracking-[0.18em] hover:bg-white/85 transition-colors cursor-pointer flex items-center gap-1.5 rounded-full"
                >
                  <span>Explore</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
                {onInquireArtwork && (
                  <button
                    onClick={() => onInquireArtwork(currentArtwork)}
                    className="px-3.5 py-2 border border-white/40 text-white text-[9px] font-mono font-bold uppercase tracking-[0.18em] hover:bg-white/15 transition-colors cursor-pointer rounded-full"
                  >
                    Inquire
                  </button>
                )}
                <span className="ml-auto text-[9px] font-mono font-bold text-white/70 tracking-widest">
                  {String(currentIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Ghost arrows (appear on hover) ── */}
        <button
          onClick={prevSlide}
          className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full border border-white/25 bg-black/25 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } hover:bg-black/50`}
          aria-label="Previous artwork"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={nextSlide}
          className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full border border-white/25 bg-black/25 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } hover:bg-black/50`}
          aria-label="Next artwork"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* ── Play/pause, top-right ── */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full border border-white/25 bg-black/25 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/50 transition-colors cursor-pointer"
          aria-label={isPlaying ? 'Pause autoplay' : 'Start autoplay'}
          title={isPlaying ? 'Pause autoplay' : 'Start autoplay'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ── Segment progress + dot-strip nav (outside the canvas) ── */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {heroItems.map((item, idx) => {
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={item.slug}
              onClick={() => goToSlide(idx, idx > currentIndex ? 1 : -1)}
              aria-label={`Jump to ${item.title}`}
              className="group relative h-8 rounded-full overflow-hidden cursor-pointer"
              style={{ width: isCurrent ? 'clamp(120px, 16vw, 200px)' : '32px' }}
            >
              {/* Track */}
              <span className="absolute inset-0 bg-line" />
              {/* Progress fill (only on the active segment) */}
              {isCurrent && isPlaying && !isHovered && (
                <span
                  key={`progress-${currentIndex}`}
                  className="absolute inset-y-0 left-0 bg-amber-500"
                  style={{ animation: 'heroProgress 7s linear forwards' }}
                />
              )}
              {isCurrent && (!isPlaying || isHovered) && (
                <span className="absolute inset-0 bg-amber-500" />
              )}
              {/* Label on active, dot on inactive */}
              {isCurrent ? (
                <span className="relative z-10 h-full flex items-center px-3 text-[9px] font-mono font-bold uppercase tracking-widest text-black truncate max-w-full">
                  {item.title}
                </span>
              ) : (
                <span className="relative z-10 h-full flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 group-hover:bg-foreground transition-colors" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes heroProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};
