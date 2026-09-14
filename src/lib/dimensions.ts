/**
 * Dimension parsing for the catalog.
 *
 * `artworks.dimensions` is free text written by hand, and the live data shows
 * every shape it takes:
 *
 *   "48\" x 60\""                     inches, quoted
 *   "3.5ft x 5ft"                     feet, murals
 *   "42 x 60 in (107 × 152 cm)"       inches with a metric restatement
 *   "3.5ft x 5ft (3.5FT X 5FT)"       feet with a redundant restatement
 *   "- (-)"                           unknown
 *
 * Both the dossier header and the Scale & Proportions visualizer need real
 * numbers, so this module is the single place that turns that text into inches.
 * Pure and dependency-free; unit-tested offline in `src/test/dimensions.test.ts`.
 */

export type Orientation = 'landscape' | 'portrait' | 'square' | 'unknown';

export interface ParsedDimensions {
  /** Width in inches, or null when the string could not be parsed. */
  widthIn: number | null;
  /** Height in inches, or null when the string could not be parsed. */
  heightIn: number | null;
  /** The record used feet notation — typically a mural or a large panel. */
  inFeet: boolean;
  orientation: Orientation;
  /** True when both dimensions are known. */
  resolved: boolean;
}

const UNKNOWN: ParsedDimensions = {
  widthIn: null,
  heightIn: null,
  inFeet: false,
  orientation: 'unknown',
  resolved: false,
};

/** Strip a trailing "(…)" restatement so only the primary measurement remains. */
function stripParenthetical(raw: string): string {
  return raw.replace(/\([^)]*\)/g, ' ').trim();
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseDimensions(raw: string | null | undefined): ParsedDimensions {
  if (!raw || typeof raw !== 'string') return UNKNOWN;

  const normalized = stripParenthetical(raw.replace(/[×✕]/g, 'x')).toLowerCase().trim();
  if (!normalized) return UNKNOWN;

  const inFeet = /\d\s*(?:ft|feet|foot|')/.test(normalized);

  // Split on the separator between the two measurements. `x` is the only
  // separator used in the corpus, but be forgiving about surrounding spaces.
  const parts = normalized.split(/\s*x\s*/);
  if (parts.length < 2) return UNKNOWN;

  const [rawW, rawH] = parts;
  let width = toNumber(rawW.match(/(\d+(?:\.\d+)?)/)?.[1]);
  let height = toNumber(rawH.match(/(\d+(?:\.\d+)?)/)?.[1]);

  if (width === null || height === null) return UNKNOWN;

  // Feet is always written explicitly in this catalog ("3.5ft x 5ft"), so a
  // bare pair of numbers is inches — the safe reading for small works such as
  // "8 x 10", which a size heuristic would otherwise inflate twelvefold.
  if (inFeet) {
    width *= 12;
    height *= 12;
  }

  width = Math.round(width * 10) / 10;
  height = Math.round(height * 10) / 10;

  const orientation: Orientation =
    Math.abs(width - height) < 1 ? 'square' : width > height ? 'landscape' : 'portrait';

  return { widthIn: width, heightIn: height, inFeet, orientation, resolved: true };
}

export interface FormattedDimensions {
  /** e.g. `48 × 60 in` — '' when the string could not be parsed. */
  imperial: string;
  /** e.g. `122 × 152 cm` — '' when the string could not be parsed. */
  metric: string;
  /** Both, e.g. `48 × 60 in (122 × 152 cm)`. */
  label: string;
  /** Feet-and-inches reading for large works, e.g. `3′ 6″ × 5′`. */
  feetLabel: string;
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Convert inches to a feet′ inches″ reading. */
export function toFeetInches(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rest = Math.round((inches - feet * 12) * 10) / 10;
  if (feet === 0) return `${trim(rest)}″`;
  if (rest === 0) return `${feet}′`;
  return `${feet}′ ${trim(rest)}″`;
}

export function formatDimensions(raw: string | null | undefined): FormattedDimensions {
  const parsed = parseDimensions(raw);
  if (!parsed.resolved || parsed.widthIn === null || parsed.heightIn === null) {
    const fallback = (raw || '').trim();
    return { imperial: '', metric: '', label: fallback, feetLabel: '' };
  }

  const { widthIn, heightIn } = parsed;
  const imperial = `${trim(widthIn)} × ${trim(heightIn)} in`;
  const metric = `${Math.round(widthIn * 2.54)} × ${Math.round(heightIn * 2.54)} cm`;
  const feetLabel = `${toFeetInches(widthIn)} × ${toFeetInches(heightIn)}`;

  return { imperial, metric, label: `${imperial} (${metric})`, feetLabel };
}

/**
 * Aspect ratio (width / height) of an image, or null when it is unknown.
 * Used to check the artwork's recorded dimensions against the photograph.
 */
export function imageAspect(width?: number | null, height?: number | null): number | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  return width / height;
}

/**
 * How far two aspect ratios diverge, as a fraction. 0 is identical; 0.2 means
 * one is 20% off the other. Null when either ratio is unknown.
 */
export function aspectDrift(a: number | null, b: number | null): number | null {
  if (a === null || b === null || a <= 0 || b <= 0) return null;
  return Math.abs(a - b) / b;
}
