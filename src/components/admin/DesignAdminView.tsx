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
  BookmarkPlus,
  Trash2,
  Star,
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
  const { palette, setPalette, resetPalette, savePalette, isLoading, customStyles, saveStyle, deleteStyle } = usePalette();
  const { setTheme, isDark } = useTheme();
  const [draft, setDraft] = useState<ThemePalette>(palette);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [styleName, setStyleName] = useState('');
  const [styleBusy, setStyleBusy] = useState(false);
  const [styleNotice, setStyleNotice] = useState<string | null>(null);

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

  /** Save the current draft as a named reusable style (server-persisted). */
  const handleSaveStyle = async () => {
    setStyleBusy(true);
    setStyleNotice(null);
    setError(null);
    const result = await saveStyle({ label: styleName, palette: draft });
    if (result.success) {
      setStyleNotice(`Style “${styleName.trim() || 'Untitled style'}” saved to your styles library.`);
      setStyleName('');
    } else {
      setError(result.error || 'Failed to save style');
    }
    setStyleBusy(false);
  };

  /** Save-and-set-default in one step: persist the style, then publish it as the live palette. */
  const handleSaveAndSetDefault = async () => {
    setStyleBusy(true);
    setStyleNotice(null);
    setError(null);
    const saveResult = await saveStyle({ label: styleName, palette: draft });
    if (!saveResult.success) {
      setError(saveResult.error || 'Failed to save style');
      setStyleBusy(false);
      return;
    }
    const publishResult = await savePalette(draft);
    if (publishResult.success) {
      setSavedAt(new Date().toLocaleTimeString());
      setStyleNotice(`Style “${styleName.trim() || 'Untitled style'}” saved and set as the default for every visitor.`);
      setStyleName('');
    } else {
      setError(publishResult.error || 'Failed to set default');
    }
    setStyleBusy(false);
  };

  const handleDeleteStyle = async (id: string, label: string) => {
    setStyleBusy(true);
    setError(null);
    const result = await deleteStyle(id);
    if (result.success) {
      setStyleNotice(`Style “${label}” deleted.`);
    } else {
      setError(result.error || 'Failed to delete style');
    }
    setStyleBusy(false);
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

      {/* Custom styles library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookmarkPlus className="h-4 w-4" /> Your styles
          </CardTitle>
          <CardDescription>
            Save the current swatches as a named style. Saved styles appear here for one-click reuse — “Save & set default” also publishes it to every visitor (no flash on reload).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="style-name">Style name</Label>
              <input
                id="style-name"
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                placeholder="e.g. Gallery Warm 1998"
                className="mt-1 flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && styleName.trim()) handleSaveStyle();
                }}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSaveStyle} disabled={styleBusy}>
              {styleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
              Save style
            </Button>
            <Button size="sm" onClick={handleSaveAndSetDefault} disabled={styleBusy}>
              {styleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              Save & set default
            </Button>
          </div>

          {styleNotice && (
            <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> {styleNotice}
            </p>
          )}

          {customStyles.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {customStyles.map((style) => {
                const isActive =
                  draft.light.background.toLowerCase() === style.palette.light.background.toLowerCase() &&
                  draft.dark.background.toLowerCase() === style.palette.dark.background.toLowerCase();
                return (
                  <div
                    key={style.id}
                    className={`group relative rounded-lg border p-3 text-left transition-colors ${
                      isActive ? 'border-ring ring-1 ring-ring' : 'border-border'
                    }`}
                  >
                    <button
                      onClick={() => applyLive(style.palette)}
                      className="w-full cursor-pointer text-left"
                      aria-label={`Apply style ${style.label}`}
                    >
                      <div className="flex items-center gap-1">
                        {[style.palette.light.background, style.palette.light.card, style.palette.light.borderStrong, style.palette.dark.background, style.palette.dark.card].map((c, i) => (
                          <span
                            key={i}
                            className="h-6 w-6 rounded-md border border-black/10"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <p className="mt-2.5 text-sm font-medium leading-tight">{style.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{style.description}</p>
                    </button>
                    <button
                      onClick={() => handleDeleteStyle(style.id, style.label)}
                      disabled={styleBusy}
                      className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive focus:opacity-100 group-hover:opacity-100 cursor-pointer"
                      aria-label={`Delete style ${style.label}`}
                      title="Delete style"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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
