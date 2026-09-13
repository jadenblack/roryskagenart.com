import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2, Tags } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { api } from '../../lib/adminApi';

interface Term {
  id: string;
  type: string;
  slug: string;
  name: string;
  sort_order: number;
}

const TYPES = [
  { value: 'series', label: 'Gallery series' },
  { value: 'tag', label: 'Tags' },
  { value: 'medium', label: 'Mediums' },
  { value: 'location', label: 'Locations' },
];

export const TaxonomiesAdminView: React.FC = () => {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState('series');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('series');
  const [saving, setSaving] = useState(false);
  const [confirmTerm, setConfirmTerm] = useState<Term | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ terms: Term[] }>('/api/taxonomies');
      setTerms(data.terms || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load taxonomies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scoped = terms.filter((t) => t.type === activeType);

  const createTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/taxonomies', {
        method: 'POST',
        body: { type: newType, name: newName.trim() },
      });
      setCreateOpen(false);
      setNewName('');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to create term');
    } finally {
      setSaving(false);
    }
  };

  const move = async (term: Term, direction: -1 | 1) => {
    const siblings = scoped;
    const idx = siblings.findIndex((t) => t.id === term.id);
    const swapWith = siblings[idx + direction];
    if (!swapWith) return;
    // Optimistically reorder
    setTerms((all) => {
      const updated = all.map((t) => {
        if (t.id === term.id) return { ...t, sort_order: swapWith.sort_order };
        if (t.id === swapWith.id) return { ...t, sort_order: term.sort_order };
        return t;
      });
      return updated;
    });
    try {
      await api(`/api/taxonomies/${term.id}`, { method: 'PATCH', body: { sort_order: swapWith.sort_order } });
      await api(`/api/taxonomies/${swapWith.id}`, { method: 'PATCH', body: { sort_order: term.sort_order } });
    } catch (err: any) {
      setError(err.message || 'Failed to reorder');
      load();
    }
  };

  const rename = async (term: Term, name: string) => {
    if (!name.trim() || name === term.name) return;
    try {
      await api(`/api/taxonomies/${term.id}`, { method: 'PATCH', body: { name: name.trim() } });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to rename');
    }
  };

  const remove = async (term: Term) => {
    try {
      await api(`/api/taxonomies/${term.id}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete term');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={activeType}
          onChange={(e) => setActiveType(e.target.value)}
          className="w-48"
          options={TYPES}
        />
        <span className="text-xs text-muted-foreground">{scoped.length} terms</span>
        <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New term
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : scoped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <Tags className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No terms for this type yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{TYPES.find((t) => t.value === activeType)?.label}</CardTitle>
            <CardDescription>
              Order controls public gallery filter ordering. Series values feed the artwork edit form.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {scoped.map((term, idx) => (
              <div
                key={term.id}
                className="flex items-center gap-2 rounded-lg border border-border p-2"
              >
                <div className="flex flex-col">
                  <button
                    className="rounded p-0.5 hover:bg-muted disabled:opacity-30 cursor-pointer"
                    disabled={idx === 0}
                    onClick={() => move(term, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-0.5 hover:bg-muted disabled:opacity-30 cursor-pointer"
                    disabled={idx === scoped.length - 1}
                    onClick={() => move(term, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  defaultValue={term.name}
                  onBlur={(e) => rename(term, e.target.value)}
                  className="h-8 flex-1"
                />
                <code className="hidden rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground sm:block">
                  {term.slug}
                </code>
                <Button variant="ghost" size="icon" onClick={() => setConfirmTerm(term)} aria-label={`Delete term ${term.name}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Delete-term confirmation (replaces window.confirm) */}
      <Dialog open={!!confirmTerm} onOpenChange={(open) => !open && setConfirmTerm(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle>Delete term?</DialogTitle>
                <DialogDescription>
                  “{confirmTerm?.name}” will be removed from this taxonomy. Artworks keep their current series value.
                </DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setConfirmTerm(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirmTerm) remove(confirmTerm);
                    setConfirmTerm(null);
                  }}
                >
                  Delete term
                </Button>
              </div>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle>New taxonomy term</DialogTitle>
                <DialogDescription>Slugs are generated from the name automatically.</DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" form="term-create-form" size="sm" disabled={saving || !newName.trim()}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </div>
            </div>
          </DialogHeader>
          <form id="term-create-form" onSubmit={createTerm} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="term-type">Type</Label>
              <Select
                id="term-type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                options={TYPES}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="term-name">Name *</Label>
              <Input
                id="term-name"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Neon Americana"
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
