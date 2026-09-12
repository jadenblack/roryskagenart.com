import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';
import { Switch } from '../ui/switch';
import { ArtworkRecord } from '../../types';

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
    }
  ) => Promise<{ success: boolean; error?: string }>;
}

const STATUSES = [
  'Available', 'Sold', 'Archived', 'Public Installation',
  'Private Collection', 'Limited Edition', 'Disabled', 'Hidden',
];

export const ArtworkEditDialog: React.FC<ArtworkEditDialogProps> = ({
  open,
  artwork,
  seriesOptions,
  onClose,
  onSave,
}) => {
  const isCreate = !artwork;
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setForm({
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
      });
    }
  }, [open, artwork]);

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave({
      ...(isCreate ? {} : { slug: artwork!.slug }),
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
    });
    setSaving(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Failed to save.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'New artwork' : `Edit — ${artwork?.title}`}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Add a new work to the master catalog.'
              : 'Update catalog metadata. Changes apply immediately.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
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
              <Label htmlFor="aw-image">Image URL</Label>
              <Input
                id="aw-image"
                value={form.image_url}
                onChange={(e) => set('image_url', e.target.value)}
                placeholder="https://… or /images/…"
              />
              {form.image_url && (
                <img
                  src={form.image_url}
                  alt="Preview"
                  className="mt-2 h-24 rounded-md border border-border object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreate ? 'Create artwork' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
