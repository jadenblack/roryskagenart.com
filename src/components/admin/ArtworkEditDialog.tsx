import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { ArtworkRecord } from '../../types';
import { MediaPicker } from './MediaPicker';

interface ArtworkEditDialogProps {
  open: boolean;
  artwork: ArtworkRecord | null; // null = create mode
  seriesOptions: string[];
  onClose: () => void;
  onSave: (
    payload: Partial<ArtworkRecord> & {
      slug?: string;
      image_url?: string;
      hero_slider?: boolean;
      draft?: boolean;
    }
  ) => Promise<{ success: boolean; error?: string; slug?: string }>;
  /** Called once after a create-mode save, so the parent can switch to editing the new record. */
  onCreated?: (slug: string) => void;
  /** Auto-save debounce window override (tests inject a tiny value). */
  autosaveDebounceMs?: number;
  /** Reports whether the open dialog holds unsaved edits (navigation guard input). */
  onDirtyChange?: (dirty: boolean) => void;
}

const STATUSES = [
  'Available', 'Sold', 'Archived', 'Public Installation',
  'Private Collection', 'Limited Edition', 'Disabled', 'Hidden',
];

/** Debounce window for draft auto-saves (ms). */
export const AUTOSAVE_DEBOUNCE_MS = 1200;

type AutosaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export const ArtworkEditDialog: React.FC<ArtworkEditDialogProps> = ({
  open,
  artwork,
  seriesOptions,
  onClose,
  onSave,
  onCreated,
  autosaveDebounceMs = AUTOSAVE_DEBOUNCE_MS,
  onDirtyChange,
}) => {
  const isCreate = !artwork;
  // The slug this dialog is actually editing. Starts as the prop's slug; once a
  // create-mode autosave/Save-as-draft POSTs, the new slug lands here and the
  // dialog keeps editing that record (drafts persist as you type).
  const [draftSlug, setDraftSlug] = useState<string | null>(null);
  const [autosave, setAutosave] = useState<AutosaveState>('idle');
  const [form, setForm] = useState({
    title: '',
    year: '',
    medium: 'Acrylic on Canvas',
    dimensions: '',
    price: '',
    status: 'Available',
    gallery_series: '',
    edition: 'Original Painting',
    location: '',
    image_url: '',
    narrative: '',
    hero_slider: false,
  });
  const [saving, setSaving] = useState(false);
  const [draftBusy, setDraftBusy] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Non-draft dirty close intercepted → confirm discard with the user. */
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Last persisted form JSON — the dirty baseline for autosave.
  const savedJsonRef = useRef('');
  // Slug this dialog instance was initialized with (form-reset guard).
  const initSlugRef = useRef<string | null | undefined>(undefined);

  const formJson = JSON.stringify(form);
  const isDirty = formJson !== savedJsonRef.current;
  // Autosave applies to persisted drafts only: create-mode needs an explicit
  // first Save-as-draft (title may still be empty), and published works must
  // not silently change while being edited.
  const canAutosave = open && !!draftSlug && artwork?.draft === true;

  // Reset the form ONLY when the dialog opens or the edited slug changes.
  // Deliberately NOT keyed on the artwork object identity: engine refreshes
  // recreate records, and resetting then would wipe the user's in-progress
  // edits between autosaves.
  const slugKey = artwork?.slug ?? null;
  useEffect(() => {
    if (!open) {
      initSlugRef.current = undefined;
      return;
    }
    if (initSlugRef.current === slugKey) return;
    initSlugRef.current = slugKey;
    setError(null);
    setDraftSlug(artwork?.slug ?? null);
    const initial = {
      title: artwork?.title || '',
      year: artwork?.year ? String(artwork.year) : String(new Date().getFullYear()),
      medium: artwork?.medium || 'Acrylic on Canvas',
      dimensions: artwork?.dimensions || '',
      price: artwork?.price || '',
      status: artwork?.status || 'Available',
      gallery_series: artwork?.gallery_series || seriesOptions[0] || '',
      edition: artwork?.edition || 'Original Painting',
      location: artwork?.location || '',
      image_url: artwork?.imageUrl || artwork?.featured_image || '',
      narrative: artwork?.narrative || '',
      hero_slider: !!artwork?.heroSlider,
    };
    setForm(initial);
    savedJsonRef.current = JSON.stringify(initial);
    setAutosave('idle');
  }, [open, slugKey]);

  const set = (key: keyof typeof form, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (canAutosave) setAutosave('dirty');
  };

  /**
   * Core writer. Creates (POST) when no record exists yet, otherwise PATCHes.
   * `closeAfter` closes on success — used by Publish / Save changes; autosave
   * and Save-as-draft keep the dialog open so work continues.
   */
  const persist = async (nextDraft: boolean, closeAfter: boolean): Promise<boolean> => {
    if (!form.title.trim()) {
      if (!closeAfter) setError('Title is required before saving.');
      return false;
    }
    setSaving(true);
    setDraftBusy(nextDraft ? 'draft' : 'publish');
    setError(null);
    try {
      const payload = {
        ...(draftSlug ? { slug: draftSlug } : {}),
        title: form.title.trim(),
        year: form.year,
        medium: form.medium,
        dimensions: form.dimensions,
        price: form.price,
        status: form.status as ArtworkRecord['status'],
        gallery_series: form.gallery_series,
        edition: form.edition,
        location: form.location,
        image_url: form.image_url,
        narrative: form.narrative,
        hero_slider: form.hero_slider,
        draft: nextDraft,
      };
      const result = await onSave(payload);
      if (!result.success) {
        setError(result.error || 'Failed to save.');
        setAutosave('error');
        return false;
      }
      if (!draftSlug && result.slug) {
        setDraftSlug(result.slug);
        onCreated?.(result.slug);
      }
      savedJsonRef.current = JSON.stringify(form);
      if (closeAfter) {
        onClose();
      } else {
        setAutosave('saved');
      }
      return true;
    } finally {
      setSaving(false);
      setDraftBusy(null);
    }
  };

  // Debounced autosave: fires after the typing pauses, batches rapid input.
  useEffect(() => {
    if (!canAutosave || !isDirty || saving) return;
    if (!form.title.trim()) return; // nothing valid to persist yet
    const t = setTimeout(() => {
      void persist(true, false);
    }, autosaveDebounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formJson, canAutosave, isDirty, saving]);

  // Report unsaved state upward (AdminApp blocks in-app navigation while true).
  const dirtyNow = open && isDirty && !saving;
  useEffect(() => {
    onDirtyChange?.(dirtyNow);
  }, [dirtyNow]);

  /**
   * Guarded close (X, Cancel, Esc, overlay):
   *   - clean → close immediately
   *   - persisted draft with a valid title → flush, close only if the flush lands
   *   - anything else dirty (published works, untitled drafts) → confirm discard
   * Saving blocks closing entirely — the in-flight save closes on success.
   */
  const requestClose = () => {
    if (saving) return;
    if (!isDirty) {
      onClose();
      return;
    }
    if (canAutosave && form.title.trim()) {
      void (async () => {
        const ok = await persist(true, false);
        if (ok) onClose();
      })();
      return;
    }
    setConfirmDiscard(true);
  };

  // Browser/tab close safety net for ANY unsaved dialog edits (drafts flush
  // automatically; published edits need the explicit guard).
  useEffect(() => {
    if (!open || !isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [open, isDirty]);

  // Enter in the form submits the primary action (publish/save changes);
  // the draft button is an explicit secondary action.
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await persist(false, true);
  };

  // Primary action now lives in the sticky header (outside the form element);
  // delegate to the form's submit so Enter and the button share one path.
  const handlePrimaryClick = () => {
    (document.getElementById('artwork-edit-form') as HTMLFormElement | null)?.requestSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>        {/* scroll geometry now owned by DialogContent (PRD §5); close is guarded */}
        <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pr-16">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2">
                {draftSlug ? `Edit — ${form.title || artwork?.title}` : 'New artwork'}
                {(artwork?.draft || (draftSlug && !artwork)) && (
                  <Badge variant="warning" className="text-[10px] uppercase">Draft</Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {draftSlug && (artwork?.draft || !artwork)
                  ? 'Work-in-progress. Hidden from the public site; edits auto-save as you type.'
                  : draftSlug
                    ? 'Update catalog metadata. Changes apply immediately.'
                    : 'Add a new work. Save as draft to enable auto-save, or publish directly.'}
              </DialogDescription>
            </div>

            {/* Sticky action row — pinned with the header while the form scrolls */}
            <div className="flex shrink-0 items-center gap-1.5">
              {canAutosave && (
                <span
                  aria-live="polite"
                  className="mr-1 hidden items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground sm:flex"
                >
                  {autosave === 'dirty' && <span className="text-amber-600 dark:text-amber-400">Unsaved…</span>}
                  {autosave === 'saving' && (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>)}
                  {autosave === 'saved' && <span className="text-emerald-600 dark:text-emerald-400">✓ Saved</span>}
                  {autosave === 'error' && <span className="text-destructive">Save failed</span>}
                </span>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={requestClose}>Cancel</Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => persist(true, false)}
              >
                {saving && draftBusy === 'draft' && <Loader2 className="h-4 w-4 animate-spin" />}
                {draftSlug ? 'Save draft' : 'Save as draft'}
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={handlePrimaryClick}>
                {saving && draftBusy !== 'draft' && <Loader2 className="h-4 w-4 animate-spin" />}
                {!draftSlug ? 'Publish' : artwork?.draft ? 'Publish' : 'Save changes'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <form id="artwork-edit-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="aw-title">Title *</Label>
              <Input
                id="aw-title"
                required
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Greetings from Austin"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aw-year">Year</Label>
              <Input id="aw-year" value={form.year} onChange={(e) => set('year', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aw-medium">Medium</Label>
              <Input id="aw-medium" value={form.medium} onChange={(e) => set('medium', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aw-dimensions">Dimensions</Label>
              <Input
                id="aw-dimensions"
                value={form.dimensions}
                onChange={(e) => set('dimensions', e.target.value)}
                placeholder='48" x 60"'
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aw-price">Price</Label>
              <Input
                id="aw-price"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="$9,500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aw-status">Status</Label>
              <Select
                id="aw-status"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                options={STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aw-series">Gallery series</Label>
              <Select
                id="aw-series"
                value={form.gallery_series}
                onChange={(e) => set('gallery_series', e.target.value)}
                options={seriesOptions.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aw-edition">Edition</Label>
              <Input id="aw-edition" value={form.edition} onChange={(e) => set('edition', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aw-location">Location</Label>
              <Input id="aw-location" value={form.location} onChange={(e) => set('location', e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Featured image</Label>
              <MediaPicker
                value={form.image_url}
                onChange={(url) => set('image_url', url)}
                artworkSlug={isCreate ? undefined : artwork?.slug}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="aw-narrative">Narrative (markdown)</Label>
              <Textarea
                id="aw-narrative"
                rows={4}
                value={form.narrative}
                onChange={(e) => set('narrative', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                id="aw-hero"
                checked={form.hero_slider}
                onCheckedChange={(v) => set('hero_slider', v)}
              />
              <Label htmlFor="aw-hero">Show on homepage hero slider</Label>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        {/* Discard-changes confirmation: dirty non-draft close only. */}
        <Dialog open={confirmDiscard} onOpenChange={(o) => !o && setConfirmDiscard(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Discard unsaved changes?</DialogTitle>
              <DialogDescription>
                Your edits to “{form.title || artwork?.title}” haven’t been saved. Closing now keeps the catalog as it is.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmDiscard(false);
                  onClose();
                }}
              >
                Discard changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
