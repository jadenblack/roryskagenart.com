import React from 'react';
import { ArtworkRecord } from '../types';
import { AlertTriangle, Ruler, Info } from 'lucide-react';
import {
  aspectDrift,
  formatDimensions,
  imageAspect,
  parseDimensions,
  toFeetInches,
} from '../lib/dimensions';

interface ScaleVisualizerProps {
  artwork: ArtworkRecord;
  /** Show the catalog data-quality note (image vs recorded proportions). */
  showDataWarning?: boolean;
}

/**
 * Gallery references, in inches. Everything in the drawing is expressed in
 * inches and rendered through an inch-based `viewBox`, so the proportions are
 * literally true rather than an artist's impression.
 */
const WALL_MIN_H = 120; // 10 ft reference wall
const WALL_MIN_W = 180; // 15 ft reference bay
const HANG_CENTER = 57; // museum-standard centre line above the floor
const HUMAN_H = 70; // 5′ 10″
const HUMAN_W = 18;
const BENCH_W = 72; // 6 ft bench
const BENCH_H = 30;
const EDGE = 12; // clearance from the wall edge to the outer reference

/**
 * True-to-scale comparison of an artwork against a gallery wall, a person and a
 * bench.
 *
 * The previous version sized the artwork from a hand-set `scaleCategory` and a
 * fixed canvas, so two works a foot apart looked identical and the drawing
 * disagreed with the dimensions printed beside it. This one derives every
 * measurement from `artworks.dimensions`, so it is correct by construction — and
 * it says so plainly when the dimensions are missing rather than inventing a
 * plausible-looking box.
 */
export const ScaleVisualizer: React.FC<ScaleVisualizerProps> = ({
  artwork,
  showDataWarning = false,
}) => {
  const parsed = parseDimensions(artwork.dimensions);
  const formatted = formatDimensions(artwork.dimensions);

  const header = (
    <div className="flex items-center justify-between mb-4 text-[10px]">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-line-strong inline-block"></div>
        <h4 className="uppercase tracking-widest text-foreground font-black">
          Scale &amp; Proportions
        </h4>
      </div>
      <span className="text-foreground/80 bg-surface-deep border border-line px-2.5 py-0.5 uppercase font-bold rounded-xs">
        {formatted.label || artwork.dimensions}
      </span>
    </div>
  );

  // ---- Unresolved dimensions: say so, do not fabricate a box ----------------
  if (!parsed.resolved || parsed.widthIn === null || parsed.heightIn === null) {
    return (
      <div className="bg-card border border-line p-6 relative overflow-hidden font-mono shadow-xs transition-colors rounded-xs">
        {header}
        <div className="flex flex-col items-center gap-2 border border-dashed border-line bg-surface-deep px-6 py-10 text-center">
          <Ruler className="h-6 w-6 text-muted-foreground" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            No dimensions recorded
          </p>
          <p className="max-w-sm text-[10px] leading-relaxed text-muted-foreground">
            This work has no usable size in the catalog, so a scale comparison
            cannot be drawn. Record the dimensions in the studio to enable it.
          </p>
        </div>
      </div>
    );
  }

  const artW = parsed.widthIn;
  const artH = parsed.heightIn;

  // The reference bay grows with the work so the artwork always fits with
  // clearance on both sides, and tall works get a taller room rather than
  // poking through the ceiling.
  const leftMargin = Math.max(HUMAN_W + EDGE * 2, artW * 0.18);
  const rightMargin = Math.max(BENCH_W + EDGE * 2, artW * 0.18);
  const wallW = Math.max(WALL_MIN_W, artW + leftMargin + rightMargin);
  const wallH = Math.max(WALL_MIN_H, artH + 2 * EDGE);

  const artX = leftMargin;
  // Hang on the museum centre line, then lift or drop it so it stays inside
  // the room — a 20-foot mural cannot be centred at 57 inches.
  const artCenterY = Math.min(
    Math.max(HANG_CENTER, artH / 2 + 2),
    wallH - artH / 2 - 2
  );
  // SVG y grows downward; y=0 is the ceiling.
  const artY = wallH - artCenterY - artH / 2;
  const floorY = wallH;
  const hangLineY = wallH - HANG_CENTER;

  const humanX = EDGE;
  const benchX = wallW - EDGE - BENCH_W;
  const benchY = floorY - BENCH_H;

  // Font and stroke sizes are expressed in inches so they scale with the
  // drawing and stay legible whether the bay is 15 ft or 60 ft wide.
  const fs = wallW / 60;
  const thin = Math.max(fs * 0.12, 0.35);
  const gridStep = 12;

  const artRatio = artW / artH;
  const photoRatio = imageAspect(
    artwork.renditions?.hero?.width,
    artwork.renditions?.hero?.height
  );
  const drift = aspectDrift(photoRatio, artRatio);
  const ratioMismatch = showDataWarning && drift !== null && drift > 0.15;

  const imageSrc = artwork.renditions?.hero?.url || artwork.imageUrl;

  const gridLines: React.ReactNode[] = [];
  for (let x = gridStep; x < wallW; x += gridStep) {
    gridLines.push(
      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={wallH} stroke="var(--line)" strokeWidth={thin} opacity={0.35} />
    );
  }
  for (let y = gridStep; y < wallH; y += gridStep) {
    gridLines.push(
      <line key={`h${y}`} x1={0} y1={y} x2={wallW} y2={y} stroke="var(--line)" strokeWidth={thin} opacity={0.35} />
    );
  }

  return (
    <div className="bg-card border border-line p-6 relative overflow-hidden font-mono shadow-xs transition-colors rounded-xs">
      {header}

      <div className="border border-line bg-surface-deep overflow-hidden rounded-xs">
        <svg
          viewBox={`0 0 ${wallW} ${wallH}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Scale drawing: ${artwork.title}, ${formatted.label}, shown against a ${toFeetInches(wallH)} wall, a ${toFeetInches(HUMAN_H)} person and a ${toFeetInches(BENCH_W)} bench.`}
          className="block w-full"
          style={{ height: 'auto', maxHeight: '26rem' }}
        >
          {/* Wall */}
          <rect x={0} y={0} width={wallW} height={wallH} fill="var(--surface-deep)" />
          {gridLines}

          {/* Ceiling + floor */}
          <line x1={0} y1={thin} x2={wallW} y2={thin} stroke="var(--line-strong)" strokeWidth={thin * 1.6} />
          <rect x={0} y={floorY - wallH * 0.03} width={wallW} height={wallH * 0.03} fill="var(--muted)" />
          <line x1={0} y1={floorY} x2={wallW} y2={floorY} stroke="var(--line-strong)" strokeWidth={thin * 2} />

          {/* Museum hanging centre line */}
          {artH < HANG_CENTER * 2 && (
            <>
              <line
                x1={0}
                y1={hangLineY}
                x2={wallW}
                y2={hangLineY}
                stroke="var(--line-strong)"
                strokeWidth={thin}
                strokeDasharray={`${fs * 0.8} ${fs * 0.6}`}
                opacity={0.7}
              />
              <text
                x={wallW - EDGE * 0.5}
                y={hangLineY - fs * 0.4}
                textAnchor="end"
                fontSize={fs * 0.78}
                fill="var(--muted-foreground)"
              >
                57″ hanging centre
              </text>
            </>
          )}

          {/* Human reference */}
          <g>
            <circle cx={humanX + HUMAN_W / 2} cy={floorY - HUMAN_H + HUMAN_W * 0.32} r={HUMAN_W * 0.32} fill="var(--line-strong)" />
            <rect
              x={humanX + HUMAN_W * 0.18}
              y={floorY - HUMAN_H + HUMAN_W * 0.72}
              width={HUMAN_W * 0.64}
              height={HUMAN_H * 0.5}
              rx={fs * 0.3}
              fill="var(--line-strong)"
            />
            <rect
              x={humanX + HUMAN_W * 0.24}
              y={floorY - HUMAN_H * 0.5}
              width={HUMAN_W * 0.22}
              height={HUMAN_H * 0.5}
              fill="var(--line-strong)"
            />
            <rect
              x={humanX + HUMAN_W * 0.54}
              y={floorY - HUMAN_H * 0.5}
              width={HUMAN_W * 0.22}
              height={HUMAN_H * 0.5}
              fill="var(--line-strong)"
            />
            <text
              x={humanX + HUMAN_W / 2}
              y={floorY + fs * 1.5}
              textAnchor="middle"
              fontSize={fs * 0.8}
              fill="var(--muted-foreground)"
            >
              Human 5′10″
            </text>
          </g>

          {/* Bench reference */}
          <g>
            <rect x={benchX} y={benchY + BENCH_H * 0.35} width={BENCH_W} height={BENCH_H * 0.65} rx={fs * 0.3} fill="var(--line)" stroke="var(--line-strong)" strokeWidth={thin} />
            <rect x={benchX + BENCH_W * 0.06} y={benchY} width={BENCH_W * 0.88} height={BENCH_H * 0.38} rx={fs * 0.3} fill="var(--line-strong)" />
            <text
              x={benchX + BENCH_W / 2}
              y={floorY + fs * 1.5}
              textAnchor="middle"
              fontSize={fs * 0.8}
              fill="var(--muted-foreground)"
            >
              Bench 6′
            </text>
          </g>

          {/* The artwork, at true scale */}
          <g>
            <rect
              data-artwork-frame
              data-width-in={artW}
              data-height-in={artH}
              x={artX}
              y={artY}
              width={artW}
              height={artH}
              fill="var(--card)"
              stroke="var(--line-strong)"
              strokeWidth={thin * 2.5}
            />
            {imageSrc && (
              <image
                href={imageSrc}
                x={artX}
                y={artY}
                width={artW}
                height={artH}
                preserveAspectRatio="xMidYMid slice"
              />
            )}
            <rect
              x={artX}
              y={artY}
              width={artW}
              height={artH}
              fill="none"
              stroke="var(--line-strong)"
              strokeWidth={thin * 2.5}
            />
          </g>

          {/* Width dimension line, above the work */}
          <g>
            <line x1={artX} y1={artY - fs * 1.6} x2={artX + artW} y2={artY - fs * 1.6} stroke="var(--foreground)" strokeWidth={thin} />
            <line x1={artX} y1={artY - fs * 2.1} x2={artX} y2={artY - fs * 1.1} stroke="var(--foreground)" strokeWidth={thin} />
            <line x1={artX + artW} y1={artY - fs * 2.1} x2={artX + artW} y2={artY - fs * 1.1} stroke="var(--foreground)" strokeWidth={thin} />
            <text
              x={artX + artW / 2}
              y={artY - fs * 2.3}
              textAnchor="middle"
              fontSize={fs * 0.85}
              fontWeight="bold"
              fill="var(--foreground)"
            >
              {formatted.imperial || `${artW} in`}
            </text>
          </g>

          {/* Height dimension line, left of the work */}
          <g>
            <line x1={artX - fs * 1.6} y1={artY} x2={artX - fs * 1.6} y2={artY + artH} stroke="var(--foreground)" strokeWidth={thin} />
            <line x1={artX - fs * 2.1} y1={artY} x2={artX - fs * 1.1} y2={artY} stroke="var(--foreground)" strokeWidth={thin} />
            <line x1={artX - fs * 2.1} y1={artY + artH} x2={artX - fs * 1.1} y2={artY + artH} stroke="var(--foreground)" strokeWidth={thin} />
            <text
              transform={`translate(${artX - fs * 2.6}, ${artY + artH / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize={fs * 0.85}
              fontWeight="bold"
              fill="var(--foreground)"
            >
              {formatted.feetLabel || `${toFeetInches(artH)}`}
            </text>
          </g>

          {/* Floor + ceiling labels */}
          <text x={EDGE * 0.4} y={floorY - fs * 0.4} fontSize={fs * 0.75} fill="var(--muted-foreground)">
            FLOOR
          </text>
          <text x={EDGE * 0.4} y={fs * 1.4} fontSize={fs * 0.75} fill="var(--muted-foreground)">
            CEILING {toFeetInches(wallH)}
          </text>
        </svg>
      </div>

      {/* Reference key */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-line-strong" /> Human 5′10″
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-line border border-line-strong" /> Bench 6′
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t border-dashed border-line-strong" /> Hanging centre 57″
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm border border-line-strong" /> Work to scale
        </span>
      </div>

      <p className="mt-3 flex items-start gap-2 text-[9px] leading-relaxed text-muted-foreground uppercase tracking-wider font-bold">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Drawn to true scale: the work is {formatted.feetLabel} in a {toFeetInches(wallH)} ×{' '}
          {toFeetInches(wallW)} reference bay, centred on the standard {HANG_CENTER}″ hanging line
          {parsed.inFeet ? ' (size recorded in feet)' : ''}.
        </span>
      </p>

      {ratioMismatch && (
        <p className="mt-3 flex items-start gap-2 border border-amber-500/40 bg-amber-500/5 p-2.5 text-[10px] leading-relaxed text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            The photograph&apos;s proportions differ from the recorded dimensions (
            {formatted.imperial}). One of the two is wrong — check the catalog entry.
          </span>
        </p>
      )}
    </div>
  );
};
