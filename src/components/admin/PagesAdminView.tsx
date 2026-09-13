import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Plus, Save, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { api } from '../../lib/adminApi';
import { cn } from '../../lib/utils';

interface PageRow {
  slug: string;
  title: string;
  updated_at?: string;
}

export const PagesAdminView: React.FC = () => {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PageRow | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ pages: PageRow[] }>('/api/pages');
      setPages(data.pages || []);
    } catch (err: any) {
      // Fall back to engine-known pages when DB list is empty/unavailable
      setPages([]);
      setError(err.message || 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEditor = async (page: PageRow) => {
    setEditing(page);
    setTitle(page.title);
    setContent('');
    try {
      const data = await api<{ page: { title: string; content: string } }>(`/api/pages/${page.slug}`);
      setTitle(data.page?.title || page.title);
      setContent(data.page?.content || '');
    } catch {
      setContent('');
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/pages/${editing.slug}`, {
        method: 'PUT',
        body: { title, content },
      });
      setSaving(false);
      setEditing(null);
      load();
    } catch (err: any) {
      setSaving(false);
      setError(err.message || 'Failed to save page');
    }
  };

  const handleCreate = async () => {
    const slug = newSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/pages/${slug}`, {
        method: 'PUT',
        body: { title: newTitle || slug, content: '' },
      });
      setNewDialogOpen(false);
      setNewSlug('');
      setNewTitle('');
      setSaving(false);
      await load();
    } catch (err: any) {
      setSaving(false);
      setError(err.message || 'Failed to create page');
    }
  };

  const renderMarkdown = (md: string): string =>
    md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^[-*] (.*)$/gm, '<li>$1</li>')
      .replace(/\n/g, '<br/>');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {pages.length} page{pages.length === 1 ? '' : 's'}
        </span>
        <Button size="sm" className="ml-auto" onClick={() => setNewDialogOpen(true)}>
          <Plus className="h-4 w-4" /> New page
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : pages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No pages in the database yet. Create one, or note that pages content is also managed in the Drive
              explorer during migration.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Card key={page.slug} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openEditor(page)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <Badge variant="secondary">{page.slug}</Badge>
                </div>
                <CardTitle className="text-base">{page.title}</CardTitle>
                {page.updated_at && (
                  <CardDescription>
                    Updated {new Date(page.updated_at).toLocaleDateString()}
                  </CardDescription>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle>Edit page — {editing?.slug}</DialogTitle>
                <DialogDescription>Markdown content. Changes go live immediately on save.</DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save page
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="page-title">Title</Label>
              <Input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="page-content">Content (markdown)</Label>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPreview ? 'Hide preview' : 'Show preview'}
              </Button>
            </div>
            <div className={cn('grid gap-4', showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
              <Textarea
                id="page-content"
                rows={14}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-xs"
              />
              {showPreview && (
                <div
                  className="max-h-[400px] overflow-y-auto rounded-md border border-border bg-muted/30 p-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New page dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle>Create new page</DialogTitle>
                <DialogDescription>The slug becomes the public URL: /#/page/your-slug</DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreate} disabled={saving || !newSlug.trim()}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-page-title">Title</Label>
              <Input
                id="new-page-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Exhibitions"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-page-slug">Slug</Label>
              <Input
                id="new-page-slug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="exhibitions"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
