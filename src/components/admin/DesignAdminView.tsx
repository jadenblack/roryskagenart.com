import React, { useEffect, useState } from 'react';
import {
  Save,
  Loader2,
  Palette,
  RotateCcw,
  Sun,
  Moon,
  Check,
  Wand2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import {
  usePalette,
  DEFAULT_PALETTE,
  PALETTE_PRESETS,
  ThemePalette,
  ThemePaletteColors,
} from '../../context/PaletteContext';
import { useTheme } from '../../context/ThemeContext';

const COLOR_FIELDS: Array<{ key: keyof ThemePaletteColors; label: string; hint: string }> = [
  { key: 'background', label: 'Page background', hint: 'Main canvas behind everything' },
  { key: 'foreground', label: 'Text', hint: 'Primary text color' },
  { key: 'card', label: 'Cards & panels', hint: 'Raised surfaces' },
  { key: 'surface', label: 'Surface', hint: 'Cards, marquee borders, flat panels' },
  { key: 'surfaceDeep', label: 'Deep surface', hint: 'Footer wells, hero backdrop, form fields' },
  { key: 'border', label: 'Hairline border', hint: 'Dividers, input edges' },
  { key: 'borderStrong', label: 'Strong border', hint: 'The 2px gallery frames' },
  { key: 'accent', label: 'Accent', hint: 'Focus rings and brand glow' },
];

const SwatchRow: React.FC<{
  fields: typeof COLOR_FIELDS;
  colors: ThemePaletteColors;
  onChange: (key: keyof ThemePaletteColors, value: string) => void;
}> = ({ fields, colors, onChange }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {fields.map((f) => (
      <div key={f.key} className="flex items-center gap-3 rounded-md border border-border bg-background p-2.5">
        <input
          type="color"
          value={colors[f.key]}
          onChange={(e) => onChange(f.key, e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          aria-label={f.label}
        />
        <div className="min-w-0 flex-1">
          <Label className="block text-xs font-medium leading-tight">{f.label}</Label>
          <span className="block truncate text-[10px] text-muted-foreground">{f.hint}</span>
        </div>
        <input
          type="text"
          value={colors[f.key]}
          onChange={(e) => onChange(f.key, e.target.value)}
          className="w-24 shrink-0 rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] uppercase text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={`${f.label} hex value`}
        />
      </div>
    ))}
  </div>
);

export const DesignAdminView: React.FC = () => {
  const { palette, setPalette, resetPalette, savePalette, isLoading } = usePalette();
  const { setTheme, isDark } = useTheme();
  const [draft, setDraft] = useState<ThemePalette>(palette);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-sync draft when the server palette loads (or changes underneath us)
  useEffect(() => {
    setDraft(palette);
  }, [palette]);

  const applyLive = (next: ThemePalette) => {
    setDraft(next);
    setPalette(next); // live preview via inline CSS vars
  };

  const mutate = (mode: 'light' | 'dark', key: keyof ThemePaletteColors, value: string) => {
    applyLive({ ...draft, [mode]: { ...draft[mode], [key]: value } });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await savePalette(draft);
    if (result.success) {
      setSavedAt(new Date().toLocaleTimeString());
    } else {
      setError(result.error || 'Failed to save');
    }
    setSaving(false);
  };

  const handleRevert = () => {
    resetPalette();
    setSavedAt(null);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        {savedAt && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" /> Published at {savedAt}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Edits preview live on the whole site — publish to make them permanent for every visitor.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRevert} disabled={saving}>
            <RotateCcw className="h-4 w-4" /> Reset to default
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Publish palette
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4" /> Presets
          </CardTitle>
          <CardDescription>One-click starting points. Preview instantly, then tweak any swatch.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(PALETTE_PRESETS).map(([id, preset]) => {
            const isActive =
              draft.light.background.toLowerCase() === preset.palette.light.background.toLowerCase() &&
              draft.dark.background.toLowerCase() === preset.palette.dark.background.toLowerCase();
            return (
              <button
                key={id}
                onClick={() => applyLive(preset.palette)}
                className={`group rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'border-ring ring-1 ring-ring'
                    : 'border-border hover:border-muted-foreground/40'
                }`}
              >
                <div className="flex items-center gap-1">
                  {[preset.palette.light.background, preset.palette.light.card, preset.palette.light.borderStrong, preset.palette.dark.background, preset.palette.dark.card].map((c, i) => (
                    <span
                      key={i}
                      className="h-6 w-6 rounded-md border border-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <p className="mt-2.5 text-sm font-medium leading-tight">{preset.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{preset.description}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Light / Dark editors */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sun className="h-4 w-4 text-amber-500" /> Light theme
            </CardTitle>
            <CardDescription>
              {isDark ? 'Currently previewing dark mode — flip the toggle to see these live.' : 'Currently previewing light mode.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SwatchRow
              fields={COLOR_FIELDS}
              colors={draft.light}
              onChange={(key, value) => mutate('light', key, value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Moon className="h-4 w-4 text-sky-400" /> Dark theme
            </CardTitle>
            <CardDescription>
              {isDark ? 'Currently previewing dark mode.' : 'Currently previewing light mode — flip the toggle to see these live.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SwatchRow
              fields={COLOR_FIELDS}
              colors={draft.dark}
              onChange={(key, value) => mutate('dark', key, value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Live preview strip */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" /> Live preview
          </CardTitle>
          <CardDescription>
            Exactly how public pages will render in {isDark ? 'dark' : 'light'} mode right now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${isDark ? 'dark' : 'light'}`}>
            <div
              className="space-y-3 rounded-lg border-2 p-4"
              style={{ backgroundColor: 'var(--background)', borderColor: 'var(--line-strong)', color: 'var(--foreground)' }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] opacity-60">Public page mock</p>
              <p className="font-serif text-xl font-black uppercase">Rory Skagen Art</p>
              <div className="border p-3" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--line)' }}>
                <p className="font-serif text-sm font-bold uppercase">Kirunam — 2010</p>
                <p className="text-xs opacity-70">Enamel on steel panel • $4,500.00</p>
                <div className="mt-2 flex gap-2">
                  <span
                    className="px-2 py-1 text-[9px] font-mono font-bold uppercase"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    Available
                  </span>
                  <span
                    className="px-2 py-1 text-[9px] font-mono font-bold uppercase"
                    style={{ backgroundColor: 'var(--surface-deep)', color: 'var(--foreground)' }}
                  >
                    4' x 5'
                  </span>
                </div>
              </div>
              <button
                className="px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-widest"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Inquire on Piece
              </button>
            </div>

            <div
              className="space-y-3 rounded-lg border-2 p-4"
              style={{ backgroundColor: 'var(--surface-deep)', borderColor: 'var(--line-strong)', color: 'var(--foreground)' }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] opacity-60">Footer / deep well mock</p>
              <div className="space-y-1.5">
                <p className="font-serif text-base font-black uppercase">Studio Footer</p>
                <p className="text-xs opacity-70">Austin, Texas • Est. 1985</p>
                <p className="text-[11px] opacity-60">
                  Deep surfaces carry footers, form fields, and hero backdrops. Adjust “Deep surface” if text here feels dim.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                {(['background', 'card', 'surface', 'surfaceDeep', 'border', 'borderStrong'] as const).map((k) => (
                  <span
                    key={k}
                    title={k}
                    className="h-7 w-7 rounded-md border border-black/10"
                    style={{ backgroundColor: draft[isDark ? 'dark' : 'light'][k] }}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
