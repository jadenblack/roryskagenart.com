import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/adminApi';

export interface ThemePaletteColors {
  /** Page background */
  background: string;
  /** Primary text color */
  foreground: string;
  /** Card / raised panel surface */
  card: string;
  /** Deep section surface (darker than background in light mode, near-black accents in dark) */
  surface: string;
  /** Deepest band — footer wells, hero backdrops */
  surfaceDeep: string;
  /** Hairline borders */
  border: string;
  /** Strong 2px structural borders */
  borderStrong: string;
  /** Amber-gold brand accent */
  accent: string;
}

export interface ThemePalette {
  light: ThemePaletteColors;
  dark: ThemePaletteColors;
}

export const DEFAULT_PALETTE: ThemePalette = {
  light: {
    background: '#e3e1da',
    foreground: '#1c1c20',
    card: '#eeede8',
    surface: '#eeede8',
    surfaceDeep: '#d8d6cd',
    border: '#c9c6bc',
    borderStrong: '#3a3a40',
    accent: '#d97706',
  },
  dark: {
    background: '#17171b',
    foreground: '#f0f0f2',
    card: '#1d1d22',
    surface: '#1d1d22',
    surfaceDeep: '#101013',
    border: '#33333a',
    borderStrong: '#52525c',
    accent: '#f59e0b',
  },
};

/** Curated presets surfaced as one-click starting points in the admin design menu. */
export const PALETTE_PRESETS: Record<string, { label: string; description: string; palette: ThemePalette }> = {
  stone: {
    label: 'Stone & Charcoal (Default)',
    description: 'Warm gallery stone light mode, charcoal gallery dark mode',
    palette: DEFAULT_PALETTE,
  },
  paper: {
    label: 'Paper & Ink',
    description: 'The original crisp paper-white / near-black studio look',
    palette: {
      light: {
        background: '#ecebe4',
        foreground: '#18181b',
        card: '#faf9f6',
        surface: '#faf9f6',
        surfaceDeep: '#e4e2da',
        border: '#d6d4cc',
        borderStrong: '#18181b',
        accent: '#d97706',
      },
      dark: {
        background: '#0c0c0e',
        foreground: '#f4f4f5',
        card: '#121215',
        surface: '#121215',
        surfaceDeep: '#09090c',
        border: '#2a2a30',
        borderStrong: '#3f3f46',
        accent: '#f59e0b',
      },
    },
  },
  desert: {
    label: 'Desert Dusk',
    description: 'Sunbaked adobe light mode, deep violet-brown dark mode',
    palette: {
      light: {
        background: '#e7ddd1',
        foreground: '#2b2118',
        card: '#f1e9df',
        surface: '#f1e9df',
        surfaceDeep: '#d9cbb8',
        border: '#cbbca7',
        borderStrong: '#4a3728',
        accent: '#c2410c',
      },
      dark: {
        background: '#1c1714',
        foreground: '#f3ede5',
        card: '#241d18',
        surface: '#241d18',
        surfaceDeep: '#14100d',
        border: '#3a2f26',
        borderStrong: '#5c4a3b',
        accent: '#f97316',
      },
    },
  },
  neon: {
    label: 'Neon Roadside',
    description: 'Cool blue-grey light mode, midnight navy with electric cyan accent',
    palette: {
      light: {
        background: '#e2e5e8',
        foreground: '#16202b',
        card: '#edeff2',
        surface: '#edeff2',
        surfaceDeep: '#d3d8dd',
        border: '#c3c9d0',
        borderStrong: '#2a3a4c',
        accent: '#0891b2',
      },
      dark: {
        background: '#12161c',
        foreground: '#eef2f6',
        card: '#181e26',
        surface: '#181e26',
        surfaceDeep: '#0b0e12',
        border: '#2b333f',
        borderStrong: '#455364',
        accent: '#22d3ee',
      },
    },
  },
};

interface PaletteContextType {
  palette: ThemePalette;
  setPalette: (next: ThemePalette) => void;
  resetPalette: () => void;
  savePalette: (next: ThemePalette) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}

const PaletteContext = createContext<PaletteContextType>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
  resetPalette: () => {},
  savePalette: async () => ({ success: false, error: 'not initialized' }),
  isLoading: false,
});

const CSS_VAR_MAP: Record<keyof ThemePaletteColors, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  surface: '--surface',
  surfaceDeep: '--surface-deep',
  border: '--border',
  borderStrong: '--line-strong',
  accent: '--ring',
};

/** Inline-var escape so malformed admin input can never inject CSS. */
const safeColor = (c: string): string => /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '';

export function applyPaletteToDocument(palette: ThemePalette) {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP) as [keyof ThemePaletteColors, string][]) {
    const lightValue = safeColor(palette.light[key]);
    if (lightValue) root.style.setProperty(cssVar, lightValue);
    else root.style.removeProperty(cssVar);
  }
  const darkBlock = Object.entries(CSS_VAR_MAP)
    .map(([key, cssVar]) => {
      const value = safeColor(palette.dark[key as keyof ThemePaletteColors]);
      return value ? `${cssVar}: ${value};` : '';
    })
    .filter(Boolean)
    .join(' ');
  let styleEl = document.getElementById('palette-dark-vars') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'palette-dark-vars';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `.dark{${darkBlock}}`;
}

export const PaletteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [palette, setPaletteState] = useState<ThemePalette>(DEFAULT_PALETTE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ settings: Record<string, unknown> }>('/api/settings');
        const stored = data?.settings?.theme_palette as ThemePalette | undefined;
        if (!cancelled && stored?.light && stored?.dark) {
          // Merge over defaults so newly-added keys stay populated
          setPaletteState({
            light: { ...DEFAULT_PALETTE.light, ...stored.light },
            dark: { ...DEFAULT_PALETTE.dark, ...stored.dark },
          });
        }
      } catch {
        // Public endpoint degrades gracefully; keep defaults
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyPaletteToDocument(palette);
  }, [palette]);

  const setPalette = useCallback((next: ThemePalette) => setPaletteState(next), []);

  const resetPalette = useCallback(() => setPaletteState(DEFAULT_PALETTE), []);

  const savePalette = useCallback(async (next: ThemePalette) => {
    try {
      await api('/api/settings', { method: 'PUT', body: { settings: { theme_palette: next } } });
      setPaletteState(next);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save palette' };
    }
  }, []);

  return (
    <PaletteContext.Provider value={{ palette, setPalette, resetPalette, savePalette, isLoading }}>
      {children}
    </PaletteContext.Provider>
  );
};

export const usePalette = () => useContext(PaletteContext);
