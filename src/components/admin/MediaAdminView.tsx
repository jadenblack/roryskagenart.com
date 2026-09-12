import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Check, Image as ImageIcon, Search, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { api } from '../../lib/adminApi';

interface MediaItem {
  public_id: string;
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
  artwork_slug: string | null;
  renditions?: Record<string, { path: string; width: number; height: number }> | null;
}

export const MediaAdminView: React.FC = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ media: MediaItem[] }>('/api/media');
      setMedia(data.media || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load media registry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyUrl = async (item: MediaItem) => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedId(item.public_id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  const filtered = media.filter(
    (m) =>
      !search ||
      m.public_id.toLowerCase().includes(search.toLowerCase()) ||
      (m.artwork_slug || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by public ID or artwork…"
            className="pl-8"
          />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} assets</span>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No media assets found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => (
            <Card key={item.public_id} className="group overflow-hidden">
              <div className="relative aspect-square overflow-hidden bg-muted">
                <img
                  src={item.thumbnail_url || item.url}
                  alt={item.public_id}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpath d="m21 15-5-5L5 21"/%3E%3C/svg%3E';
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="sm" variant="secondary" onClick={() => copyUrl(item)}>
                    {copiedId === item.public_id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center justify-center rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <CardContent className="p-2">
                <p className="truncate text-xs font-medium" title={item.public_id}>
                  {item.public_id}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {item.width && item.height ? `${item.width}×${item.height}` : item.format || ''}
                  </span>
                  {item.artwork_slug && (
                    <Badge variant="secondary" className="max-w-[80px] truncate px-1 text-[10px]">
                      {item.artwork_slug}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
