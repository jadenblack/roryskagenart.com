import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_PALETTE,
  PALETTE_PRESETS,
  CSS_VAR_MAP,
  applyPaletteToDocument,
} from './PaletteContext';

/**
 * Palette system contracts (Design-menu drives ALL components).
 * Network is disabled globally (src/test/setup.ts) — these tests exercise
 * the pure/injectable parts, which is where the theming bugs lived.
 */

describe('CSS_VAR_MAP coverage', () => {
  it('maps every editable token to the shadcn variables the UI library consumes', () => {
    expect(CSS_VAR_MAP.background).toBe('--background');
    expect(CSS_VAR_MAP.foreground).toBe('--foreground');
    expect(CSS_VAR_MAP.card).toBe('--card');
    expect(CSS_VAR_MAP.surface).toBe('--surface');
    expect(CSS_VAR_MAP.surfaceDeep).toBe('--surface-deep');
    expect(CSS_VAR_MAP.border).toBe('--border');
    expect(CSS_VAR_MAP.borderStrong).toBe('--line-strong');
    expect(CSS_VAR_MAP.accent).toBe('--ring');
  });
});

describe('applyPaletteToDocument', () => {
  beforeEach(() => {
    document.getElementById('palette-vars')?.remove();
    document.documentElement.className = '';
  });

  it('injects light values in :root and dark values in a .dark block (never inline styles)', () => {
    applyPaletteToDocument(DEFAULT_PALETTE);
    const el = document.getElementById('palette-vars')!;
    expect(el).toBeTruthy();

    const text = el.textContent || '';
    // Both mode blocks exist
    expect(text).toContain(':root{');
    expect(text).toContain('.dark{');
    // Dark block carries the dark background, light block the light one
    expect(text).toMatch(/:root\{[^}]*--background:#e3e1da/);
    expect(text).toMatch(/\.dark\{[^}]*--background:#17171b/);

    // The old inline-var bug (light values beating .dark rules) is gone:
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('');
  });

  it('derives the popover token from card so menus/dialogs follow the palette', () => {
    applyPaletteToDocument({
      light: { ...DEFAULT_PALETTE.light, card: '#aabbcc' },
      dark: { ...DEFAULT_PALETTE.dark, card: '#112233' },
    });
    const text = document.getElementById('palette-vars')!.textContent || '';
    expect(text).toMatch(/:root\{[^}]*--popover:#aabbcc/);
    expect(text).toMatch(/\.dark\{[^}]*--popover:#112233/);
  });

  it('sanitizes malformed values (no CSS injection via admin input)', () => {
    applyPaletteToDocument({
      light: {
        ...DEFAULT_PALETTE.light,
        background: 'red; } body { background: url(https://evil)',
      },
      dark: { ...DEFAULT_PALETTE.dark },
    });
    const text = document.getElementById('palette-vars')!.textContent || '';
    expect(text).not.toContain('evil');
    expect(text).not.toContain('url(');
  });

  it('reuses the same style element on repeated applications (live preview updates)', () => {
    applyPaletteToDocument(DEFAULT_PALETTE);
    const first = document.getElementById('palette-vars');
    applyPaletteToDocument(PALETTE_PRESETS.paper.palette);
    const second = document.getElementById('palette-vars');
    expect(second).toBe(first);
    expect(second!.textContent).toMatch(/--background:#0c0c0e/);
  });
});

describe('PALETTE_PRESETS', () => {
  it('every preset defines complete light and dark palettes', () => {
    for (const [id, preset] of Object.entries(PALETTE_PRESETS)) {
      for (const mode of ['light', 'dark'] as const) {
        for (const key of Object.keys(DEFAULT_PALETTE[mode])) {
          expect(preset.palette[mode][key as keyof typeof preset.palette.light], `${id}.${mode}.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
      }
    }
  });

  it('includes the default as the first curated preset', () => {
    expect(PALETTE_PRESETS.stone.palette).toBe(DEFAULT_PALETTE);
  });
});
