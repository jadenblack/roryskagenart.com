import React from 'react';
import { ArtworkRecord } from '../types';
import { Home } from 'lucide-react';

interface ScaleVisualizerProps {
  artwork: ArtworkRecord;
}

export const ScaleVisualizer: React.FC<ScaleVisualizerProps> = ({ artwork }) => {
  const isMural = artwork.dimensions.includes("'") || artwork.scaleCategory === 'monumental';

  return (
    <div className="bg-white dark:bg-[#0D0D10] border border-zinc-300 dark:border-zinc-800 p-6 relative overflow-hidden font-mono shadow-xs transition-colors rounded-xs">
      <div className="flex items-center justify-between mb-4 text-[10px]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-zinc-900 dark:bg-white inline-block"></div>
          <h4 className="uppercase tracking-widest text-zinc-950 dark:text-white font-black">
            Scale &amp; Proportions Visualizer
          </h4>
        </div>
        <span className="text-zinc-800 dark:text-zinc-400 bg-[#F2F1EC] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-2.5 py-0.5 uppercase font-bold rounded-xs">
          {artwork.dimensions} ({artwork.dimensions_cm || ''})
        </span>
      </div>

      {/* Visual Simulation Canvas */}
      <div className="relative h-64 sm:h-80 bg-[#F7F6F2] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 overflow-hidden flex flex-col justify-end p-6 rounded-xs">
        {/* Gallery Wall Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-40"></div>

        {/* Floor Line */}
        <div className="absolute bottom-0 inset-x-0 h-8 bg-zinc-200 dark:bg-black border-t border-zinc-300 dark:border-zinc-800 flex items-center justify-between px-4 text-[9px] font-mono text-zinc-600 dark:text-zinc-600 uppercase tracking-wider">
          <span>FLOOR (0&apos;)</span>
          <span>WALL CENTER</span>
          <span>CEILING (10&apos;)</span>
        </div>

        {/* Content staging */}
        <div className="relative z-10 flex items-end justify-center gap-8 sm:gap-16 pb-3">
          {/* 1. Human Figure Silhouette Reference (approx 5'10" / 178cm) */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-10 h-36 sm:h-44 bg-zinc-400 dark:bg-zinc-800 relative flex flex-col items-center justify-start pt-2 border border-zinc-500 dark:border-zinc-700 rounded-xs">
              <div className="w-3.5 h-3.5 bg-zinc-600 dark:bg-zinc-600 mb-1 rounded-full"></div>
              <div className="w-7 h-16 bg-zinc-500 dark:bg-zinc-700"></div>
              <div className="w-5 h-16 flex gap-1 mt-1">
                <div className="w-2 h-full bg-zinc-500 dark:bg-zinc-700"></div>
                <div className="w-2 h-full bg-zinc-500 dark:bg-zinc-700"></div>
              </div>
            </div>
            <span className="text-[9px] text-zinc-600 dark:text-zinc-500 mt-2 uppercase font-bold">Human (5&apos;10&quot;)</span>
          </div>

          {/* 2. Scaled Artwork Rendering */}
          <div className="flex flex-col items-center max-w-[65%]">
            <div
              className={`relative border-2 border-zinc-900 dark:border-white shadow-xl overflow-hidden bg-white dark:bg-zinc-900 flex items-center justify-center transition-all ${
                isMural
                  ? 'w-56 sm:w-80 h-36 sm:h-48 border-dashed border-zinc-900 dark:border-white ring-1 ring-black/20 dark:ring-white/20'
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
            <span className="text-[9px] text-zinc-950 dark:text-white mt-2 font-bold text-center uppercase tracking-wider font-sans">
              {artwork.title}
            </span>
          </div>

          {/* 3. Designer Sofa / Bench for scale */}
          <div className="hidden sm:flex flex-col items-center flex-shrink-0">
            <div className="w-32 h-14 bg-zinc-300 dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-800 relative rounded-xs">
              <div className="absolute inset-x-2 bottom-1 h-5 bg-zinc-400 dark:bg-zinc-800"></div>
            </div>
            <span className="text-[9px] text-zinc-600 dark:text-zinc-500 mt-2 uppercase font-bold">Bench (6&apos;)</span>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-zinc-600 dark:text-zinc-500 mt-3 text-center uppercase tracking-widest font-bold">
        Scale visualization mapped against standard 10-foot studio gallery wall &amp; human scale.
      </p>
    </div>
  );
};
