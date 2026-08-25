import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Maximize2, 
  Sparkles, 
  ArrowRight, 
  Eye, 
  Tag, 
  Layers,
  MapPin,
  Ruler
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ArtworkRecord } from '../types';
import { getArtworkSvg } from '../data/artAssets';

interface HeroGallerySliderProps {
  artworks: ArtworkRecord[];
  onSelectArtwork: (slug: string) => void;
  onInquireArtwork?: (artwork: ArtworkRecord) => void;
  onOpenLightbox?: (artwork: ArtworkRecord) => void;
}

export const HeroGallerySlider: React.FC<HeroGallerySliderProps> = ({
  artworks,
  onSelectArtwork,
  onInquireArtwork,
  onOpenLightbox,
}) => {
  // Filter for valid hero artworks: heroSlider flag is true and not disabled/trashed
  const heroItems = React.useMemo(() => {
    const valid = artworks.filter(
      (item) => item.heroSlider === true && item.enabled !== false && !item.trashed && item.status !== 'Hidden'
    );
    if (valid.length > 0) return valid;
    // Fallback if none explicitly tagged: use first 6 non-hidden artworks
    return artworks.filter((item) => item.enabled !== false && !item.trashed && item.status !== 'Hidden').slice(0, 6);
  }, [artworks]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Auto-play interval in ms
  const SLIDE_DURATION = 6000;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const totalSlides = heroItems.length;

  const goToSlide = useCallback((index: number, newDirection: 1 | -1 = 1) => {
    if (totalSlides === 0) return;
    setDirection(newDirection);
    setCurrentIndex((index + totalSlides) % totalSlides);
  }, [totalSlides]);

  const nextSlide = useCallback(() => {
    goToSlide(currentIndex + 1, 1);
  }, [goToSlide, currentIndex]);

  const prevSlide = useCallback(() => {
    goToSlide(currentIndex - 1, -1);
  }, [goToSlide, currentIndex]);

  // Handle autoplay
  useEffect(() => {
    if (isPlaying && !isHovered && totalSlides > 1) {
      timerRef.current = setInterval(() => {
        nextSlide();
      }, SLIDE_DURATION);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isHovered, totalSlides, nextSlide]);

  // Reset index if out of bounds after item updates
  useEffect(() => {
    if (currentIndex >= totalSlides && totalSlides > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, totalSlides]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance) {
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      nextSlide();
    }
  };

  if (totalSlides === 0) return null;

  const currentArtwork = heroItems[currentIndex];

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.35 }
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
      transition: {
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.25 }
      }
    })
  };

  return (
    <div 
      id="hero-gallery-slider-container"
      className="relative bg-white dark:bg-[#0c0c10] border-2 border-zinc-900 dark:border-zinc-700 shadow-xl overflow-hidden rounded-xs my-6 transition-colors select-none"
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
      {/* Top Header Bar inside Hero Container */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-zinc-950 text-white dark:bg-black border-b border-zinc-800 text-[10px] font-mono uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span className="font-bold text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Curated Hero Gallery
          </span>
          <span className="text-zinc-500 hidden sm:inline">•</span>
          <span className="text-zinc-400 hidden sm:inline">Spotlight Masterpieces</span>
        </div>

        {/* Slide count & Controls */}
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 font-bold tracking-widest">
            {String(currentIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
          </span>

          <div className="h-3 w-px bg-zinc-800 hidden sm:block"></div>

          {/* Autoplay Pause / Play Toggle */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 hover:text-amber-400 text-zinc-400 transition-colors cursor-pointer"
            title={isPlaying ? "Pause autoplay" : "Start autoplay"}
            aria-label={isPlaying ? "Pause autoplay" : "Start autoplay"}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Slide Area */}
      <div className="relative min-h-[380px] sm:min-h-[460px] md:min-h-[500px] flex items-center overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentArtwork.slug}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch"
          >
            {/* Left: High-Res Framed Artwork Presentation */}
            <div className="lg:col-span-7 bg-[#F7F6F2] dark:bg-zinc-950/80 p-6 sm:p-10 flex items-center justify-center relative overflow-hidden border-b lg:border-b-0 lg:border-r border-zinc-300 dark:border-zinc-800">
              {/* Subtle ambient background grid */}
              <div className="absolute inset-0 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none"></div>

              {/* Artwork Media Box */}
              <div 
                onClick={() => onOpenLightbox ? onOpenLightbox(currentArtwork) : onSelectArtwork(currentArtwork.slug)}
                className="relative max-h-[360px] sm:max-h-[420px] max-w-full aspect-[4/3] bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-700 shadow-md p-3 sm:p-5 flex items-center justify-center cursor-zoom-in group/hero-img transition-transform duration-300 hover:scale-[1.01]"
              >
                <img
                  src={currentArtwork.imageUrl}
                  alt={currentArtwork.title}
                  loading="eager"
                  className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover/hero-img:scale-[1.03]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getArtworkSvg(currentArtwork.slug);
                  }}
                />

                {/* Corner Status Tag */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                  <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider border shadow-xs ${
                    currentArtwork.status === 'Available'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : currentArtwork.status === 'Sold'
                      ? 'bg-zinc-800 text-white border-zinc-900'
                      : 'bg-amber-600 text-white border-amber-700'
                  }`}>
                    {currentArtwork.status}
                  </span>
                </div>

                {/* Inspect Zoom Pill */}
                <div className="absolute bottom-3 right-3 bg-black/85 text-white px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest flex items-center gap-1.5 opacity-90 group-hover/hero-img:opacity-100 transition-opacity font-bold shadow-xs">
                  <Maximize2 className="w-3 h-3" />
                  <span>Inspect</span>
                </div>
              </div>
            </div>

            {/* Right: Curatorial Details & Direct Actions */}
            <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-white dark:bg-[#0D0D10] space-y-6">
              <div className="space-y-4">
                {/* Series & Year Ribbon */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                  <span className="px-2 py-0.5 bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 font-bold text-zinc-900 dark:text-white">
                    {currentArtwork.gallery_series || 'Studio Landmark'}
                  </span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    Est. {currentArtwork.year}
                  </span>
                </div>

                {/* Artwork Title */}
                <h2 
                  onClick={() => onSelectArtwork(currentArtwork.slug)}
                  className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight text-zinc-950 dark:text-white font-serif hover:text-amber-700 dark:hover:text-amber-400 cursor-pointer transition-colors leading-tight"
                >
                  {currentArtwork.title}
                </h2>

                {/* Curatorial Specs Table */}
                <div className="grid grid-cols-2 gap-3 py-3 border-y border-zinc-200 dark:border-zinc-800 text-[11px] font-mono">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">Medium</span>
                    <span className="text-zinc-900 dark:text-zinc-200 font-semibold line-clamp-1">
                      {currentArtwork.medium}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">Dimensions</span>
                    <span className="text-zinc-900 dark:text-zinc-200 font-semibold">
                      {currentArtwork.dimensions}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">Studio Origin</span>
                    <span className="text-zinc-900 dark:text-zinc-200 font-semibold">
                      {currentArtwork.location || 'Austin, TX'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">Pricing / Valuation</span>
                    <span className="text-zinc-950 dark:text-amber-400 font-bold">
                      {currentArtwork.price}
                    </span>
                  </div>
                </div>

                {/* Curatorial Excerpt */}
                <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-serif line-clamp-3">
                  {currentArtwork.narrative ? currentArtwork.narrative.replace(/#+\s+/g, '').replace(/\[\[.*?\]\]/g, '') : "Curated masterwork in the retro-pop surrealist archive of Austin artist Rory Skagen."}
                </p>
              </div>

              {/* Call-to-action Action Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={() => onSelectArtwork(currentArtwork.slug)}
                  className="flex-1 py-3 px-5 bg-zinc-900 hover:bg-black text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-[10px] font-mono font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md rounded-xs group"
                >
                  <span>Explore Artwork</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>

                {onInquireArtwork && (
                  <button
                    onClick={() => onInquireArtwork(currentArtwork)}
                    className="py-3 px-5 bg-[#F2F1EC] dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-[10px] font-mono font-bold uppercase tracking-[0.15em] transition-colors cursor-pointer rounded-xs"
                  >
                    Contact Me
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Previous Slide Navigation Arrow */}
        <button
          onClick={prevSlide}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/95 dark:bg-black/90 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-zinc-900 dark:text-white border-2 border-zinc-900 dark:border-zinc-700 flex items-center justify-center transition-all cursor-pointer z-20 shadow-lg rounded-xs"
          aria-label="Previous artwork slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next Slide Navigation Arrow */}
        <button
          onClick={nextSlide}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/95 dark:bg-black/90 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-zinc-900 dark:text-white border-2 border-zinc-900 dark:border-zinc-700 flex items-center justify-center transition-all cursor-pointer z-20 shadow-lg rounded-xs"
          aria-label="Next artwork slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Bar & Slide Thumbnails Strip */}
      <div className="bg-[#F2F1EC] dark:bg-zinc-950 border-t border-zinc-300 dark:border-zinc-800 p-2 sm:p-3">
        {/* Animated Slide Progress Bar */}
        {isPlaying && !isHovered && (
          <div className="w-full bg-zinc-300 dark:bg-zinc-800 h-1 mb-2.5 overflow-hidden rounded-full">
            <div 
              key={currentIndex}
              className="h-full bg-amber-500 dark:bg-amber-400 transition-all"
              style={{
                animation: `heroProgress ${SLIDE_DURATION}ms linear forwards`
              }}
            />
          </div>
        )}

        {/* Thumbnail Selector Strip */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-2">
            {heroItems.map((item, idx) => {
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={item.slug}
                  onClick={() => goToSlide(idx, idx > currentIndex ? 1 : -1)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 border text-[9px] font-mono uppercase tracking-wider transition-all cursor-pointer rounded-xs flex-shrink-0 ${
                    isCurrent
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-900 dark:border-white shadow-xs font-bold'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 border-zinc-300 dark:border-zinc-800 hover:border-zinc-500'
                  }`}
                  aria-label={`Jump to slide ${idx + 1}: ${item.title}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                  <span className="truncate max-w-[120px]">{item.title}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-widest hidden md:block whitespace-nowrap pl-4">
            Toggle switch on edit page to customize hero gallery
          </div>
        </div>
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
