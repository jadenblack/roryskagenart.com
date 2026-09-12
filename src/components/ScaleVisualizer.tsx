import React from 'react';
import { ArtworkRecord } from '../types';
import { Home } from 'lucide-react';

interface ScaleVisualizerProps {
  artwork: ArtworkRecord;
}

export const ScaleVisualizer: React.FC<ScaleVisualizerProps> = ({ artwork }) => {
  const isMural = artwork.dimensions.includes("'") || artwork.scaleCategory === 'monumental';

  return (
    <div className="bg-card border border-line p-6 relative overflow-hidden font-mono shadow-xs transition-colors rounded-xs">
      <div className="flex items-center justify-between mb-4 text-[10px]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-line-strong inline-block"></div>
          <h4 className="uppercase tracking-widest text-foreground font-black">
            Scale &amp; Proportions Visualizer
          </h4>
        </div>
        <span className="text-foreground/80 bg-surface-deep border border-line px-2.5 py-0.5 uppercase font-bold rounded-xs">
          {artwork.dimensions} ({artwork.dimensions_cm || ''})
        </span>
      </div>

      {/* Visual Simulation Canvas */}
      <div className="relative h-64 sm:h-80 bg-surface-deep border border-line overflow-hidden flex flex-col justify-end p-6 rounded-xs">
        {/* Gallery Wall Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--line)_1px,transparent_1px),linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-40"></div>

        {/* Floor Line */}
        <div className="absolute bottom-0 inset-x-0 h-8 bg-muted border-t border-line flex items-center justify-between px-4 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
          <span>FLOOR (0&apos;)</span>
          <span>WALL CENTER</span>
          <span>CEILING (10&apos;)</span>
        </div>

        {/* Content staging */}
        <div className="relative z-10 flex items-end justify-center gap-8 sm:gap-16 pb-3">
          {/* 1. Human Figure Silhouette Reference (approx 5'10" / 178cm) */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-10 h-36 sm:h-44 bg-line-strong relative flex flex-col items-center justify-start pt-2 border border-muted-foreground rounded-xs">
              <div className="w-3.5 h-3.5 bg-foreground/70 mb-1 rounded-full"></div>
              <div className="w-7 h-16 bg-foreground/50"></div>
              <div className="w-5 h-16 flex gap-1 mt-1">
                <div className="w-2 h-full bg-foreground/50"></div>
                <div className="w-2 h-full bg-foreground/50"></div>
              </div>
            </div>
            <span className="text-[9px] text-muted-foreground mt-2 uppercase font-bold">Human (5&apos;10&quot;)</span>
          </div>

          {/* 2. Scaled Artwork Rendering */}
          <div className="flex flex-col items-center max-w-[65%]">
            <div
              className={`relative border-2 border-line-strong shadow-xl overflow-hidden bg-card flex items-center justify-center transition-all ${
                isMural
                  ? 'w-56 sm:w-80 h-36 sm:h-48 border-dashed border-line-strong ring-1 ring-black/20 dark:ring-white/20'
                  : artwork.scaleCategory === 'large'
                  ? 'w-36 sm:w-48 h-28 sm:h-36'
                  : artwork.scaleCategory === 'small'
                  ? 'w-20 sm:w-28 h-16 sm:h-22'
                  : 'w-28 sm:w-36 h-24 sm:h-30'
              }`}
            >
              <img
                src={artwork.imageUrl}
                alt={artwork.title}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[9px] text-foreground mt-2 font-bold text-center uppercase tracking-wider font-sans">
              {artwork.title}
            </span>
          </div>

          {/* 3. Designer Sofa / Bench for scale */}
          <div className="hidden sm:flex flex-col items-center flex-shrink-0">
            <div className="w-32 h-14 bg-line relative border border-muted-foreground/60 relative rounded-xs">
              <div className="absolute inset-x-2 bottom-1 h-5 bg-line-strong"></div>
            </div>
            <span className="text-[9px] text-muted-foreground mt-2 uppercase font-bold">Bench (6&apos;)</span>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground mt-3 text-center uppercase tracking-widest font-bold">
        Scale visualization mapped against standard 10-foot studio gallery wall &amp; human scale.
      </p>
    </div>
  );
};
