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

/** A named, saved style: the built-in presets and admin-created customs share this shape. */
export interface StylePreset {
  id: string;
  label: string;
  description: string;
  palette: ThemePalette;
  custom?: boolean;
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
  /** Admin-created named styles (server-persisted). */
  customStyles: StylePreset[];
  /** Persist a new/updated named style on the server. */
  saveStyle: (style: { id?: string; label: string; description?: string; palette: ThemePalette }) => Promise<{ success: boolean; error?: string; id?: string }>;
  /** Remove a named style (built-ins cannot be deleted). */
  deleteStyle: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const PaletteContext = createContext<PaletteContextType>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
  resetPalette: () => {},
  savePalette: async () => ({ success: false, error: 'not initialized' }),
  isLoading: false,
  customStyles: [],
  saveStyle: async () => ({ success: false, error: 'not initialized' }),
  deleteStyle: async () => ({ success: false, error: 'not initialized' }),
});

/**
 * Every CSS variable the admin palette drives, per mode. Covering the full
 * shadcn token set here (popover, muted, secondary, primary…) is what makes
 * the Design menu the single source of truth for ALL components — menus,
 * dialogs, badges and buttons all follow the saved palette.
 */
export const CSS_VAR_MAP: Record<keyof ThemePaletteColors, string> = {
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
const safeColor = (c: string): string => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '');

const cssBlock = (palette: ThemePaletteColors): string =>
  Object.entries(CSS_VAR_MAP)
    .map(([key, cssVar]) => {
      const value = safeColor(palette[key as keyof ThemePaletteColors]);
      return value ? `${cssVar}:${value};` : '';
    })
    .join('');

/**
 * Apply a palette as a stylesheet, not inline styles: light values live in a
 * `:root` block and dark values in a `.dark` block, exactly mirroring
 * index.css. Inline `:root` overrides would beat the `.dark` class rules and
 * franken-theme dark mode (light backgrounds under dark chrome) — that was
 * the open-menu popover bug. Popover/secondary/muted/primary are derived from
 * the editable tokens so every shadcn surface follows the palette.
 */
export function applyPaletteToDocument(palette: ThemePalette) {
  let styleEl = document.getElementById('palette-vars') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'palette-vars';
    // After the Vite-injected stylesheet so equal-specificity overrides win.
    document.head.appendChild(styleEl);
  }
  const rootVars = cssBlock(palette.light);
  const derived = (p: ThemePaletteColors): string =>
    `--popover:${safeColor(p.card) || p.card};--secondary:${safeColor(p.surface) || p.surface};--muted:${safeColor(p.surface) || p.surface};--primary:${safeColor(p.borderStrong) || p.borderStrong};--accent:${safeColor(p.surface) || p.surface};`;
  styleEl.textContent =
    `:root{${rootVars}${derived(palette.light)}}` + `\n.dark{${cssBlock(palette.dark)}${derived(palette.dark)}}`;
}

export const PaletteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [palette, setPaletteState] = useState<ThemePalette>(() => {
    // Hydrate from the boot script's cache first — zero flash, zero requests.
    try {
      const cached = localStorage.getItem('rory_studio_palette');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.light && parsed?.dark) {
          return {
            light: { ...DEFAULT_PALETTE.light, ...parsed.light },
            dark: { ...DEFAULT_PALETTE.dark, ...parsed.dark },
          };
        }
      }
    } catch {
      // Corrupt cache falls through to defaults
    }
    return DEFAULT_PALETTE;
  });
  const [customStyles, setCustomStyles] = useState<StylePreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ settings: Record<string, unknown> }>('/api/settings');
        const stored = data?.settings?.theme_palette as ThemePalette | undefined;
        if (!cancelled && stored?.light && stored?.dark) {
          const merged: ThemePalette = {
            light: { ...DEFAULT_PALETTE.light, ...stored.light },
            dark: { ...DEFAULT_PALETTE.dark, ...stored.dark },
          };
          setPaletteState(merged);
          // Keep the boot cache fresh so the next load paints immediately.
          try {
            localStorage.setItem('rory_studio_palette', JSON.stringify(merged));
          } catch {}
        }
        const styles = data?.settings?.style_presets as StylePreset[] | undefined;
        if (!cancelled && Array.isArray(styles)) {
          setCustomStyles(styles.filter((s) => s?.id && s?.palette?.light && s?.palette?.dark));
        }
      } catch {
        // Public endpoint degrades gracefully; keep cached/defaults
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
      try {
        localStorage.setItem('rory_studio_palette', JSON.stringify(next));
      } catch {}
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save palette' };
    }
  }, []);

  const saveStyle = useCallback(
    async ({ id, label, description, palette: stylePalette }: { id?: string; label: string; description?: string; palette: ThemePalette }) => {
      const cleanLabel = label.trim() || 'Untitled style';
      try {
        // Read-modify-write style_presets on the server
        const data = await api<{ settings: Record<string, unknown> }>('/api/settings');
        const existing = (data?.settings?.style_presets as StylePreset[] | undefined) || [];
        const finalId = id || `custom-${Date.now().toString(36)}`;
        const entry: StylePreset = {
          id: finalId,
          label: cleanLabel,
          description: description?.trim() || `Custom style saved ${new Date().toLocaleDateString()}`,
          palette: stylePalette,
          custom: true,
        };
        const next = [...existing.filter((s) => s.id !== finalId), entry];
        await api('/api/settings', { method: 'PUT', body: { settings: { style_presets: next } } });
        setCustomStyles(next);
        return { success: true, id: finalId };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to save style' };
      }
    },
    []
  );

  const deleteStyle = useCallback(async (id: string) => {
    try {
      const data = await api<{ settings: Record<string, unknown> }>('/api/settings');
      const existing = (data?.settings?.style_presets as StylePreset[] | undefined) || [];
      const next = existing.filter((s) => s.id !== id);
      await api('/api/settings', { method: 'PUT', body: { settings: { style_presets: next } } });
      setCustomStyles(next);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete style' };
    }
  }, []);

  return (
    <PaletteContext.Provider
      value={{ palette, setPalette, resetPalette, savePalette, isLoading, customStyles, saveStyle, deleteStyle }}
    >
      {children}
    </PaletteContext.Provider>
  );
};

export const usePalette = () => useContext(PaletteContext);
