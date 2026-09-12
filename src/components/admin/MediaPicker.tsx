import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Images, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { api, apiUpload } from '../../lib/adminApi';
import { cn } from '../../lib/utils';

interface MediaPickerProps {
  /** Current image URL value (controlled by the parent form). */
  value: string;
  onChange: (url: string) => void;
  /** Artwork slug used to organize uploads and link media_assets rows. */
  artworkSlug?: string;
}

interface MediaItem {
  public_id: string;
  url: string;
  thumbnail_url: string | null;
  artwork_slug: string | null;
}

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // server limit: 30MB

/**
 * Featured-image control for the artwork dialog: drag-and-drop / file-picker
 * upload to Supabase Storage (registered in media_assets) plus a browsable
 * picker over the existing media library. The chosen URL lands in the
 * parent form's image_url and persists with the artwork on save.
 */
export const MediaPicker: React.FC<MediaPickerProps> = ({ value, onChange, artworkSlug }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const data = await api<{ media: MediaItem[] }>('/api/media');
      setLibrary(data.media || []);
    } catch {
      setLibrary([]);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (libraryOpen) loadLibrary();
  }, [libraryOpen, loadLibrary]);

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Limit is 30MB.`);
        return;
      }
      setUploading(true);
      try {
        // Read intrinsic dimensions client-side so media_assets gets them
        const dims = await new Promise<{ width: number | null; height: number | null }>((resolve) => {
          const img = new Image();
          const objectUrl = URL.createObjectURL(file);
          img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(objectUrl);
          };
          img.onerror = () => {
            resolve({ width: null, height: null });
            URL.revokeObjectURL(objectUrl);
          };
          img.src = objectUrl;
        });

        const fd = new FormData();
        fd.append('file', file);
        if (artworkSlug) fd.append('artwork_slug', artworkSlug);
        if (dims.width) fd.append('width', String(dims.width));
        if (dims.height) fd.append('height', String(dims.height));

        const data = await apiUpload<{ media: { url: string } }>('/api/media/upload', fd);
        onChange(data.media.url);
      } catch (err: any) {
        setUploadError(err.message || 'Upload failed.');
      } finally {
        setUploading(false);
      }
    },
    [artworkSlug, onChange]
  );

  const filteredLibrary = library.filter(
    (m) =>
      !librarySearch ||
      m.public_id.toLowerCase().includes(librarySearch.toLowerCase()) ||
      (m.artwork_slug || '').toLowerCase().includes(librarySearch.toLowerCase())
  );

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
  };

  return (
    <div className="space-y-2">
      {/* Current selection preview */}
      {value ? (
        <div className="flex items-start gap-3">
          <img
            src={value}
            alt="Featured image"
            className="h-24 w-24 shrink-0 rounded-md border border-border object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = '0.3';
            }}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="truncate text-xs text-muted-foreground" title={value}>
              {value}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Replace
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setLibraryOpen((v) => !v)}>
                <Images className="h-3.5 w-3.5" />
                {libraryOpen ? 'Hide library' : 'Choose from library'}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onChange('')}>
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Drop zone */
        <div
          {...dropHandlers}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/40',
            dragActive && 'border-primary bg-primary/5'
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {uploading ? 'Uploading…' : 'Drag & drop an image here, or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, GIF, or AVIF · up to 30MB</p>
        </div>
      )}

      {/* Library toggle is reachable in both states (empty + selected) */}
      {!value && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setLibraryOpen((v) => !v)}>
          <Images className="h-3.5 w-3.5" />
          {libraryOpen ? 'Hide library' : 'Choose from library'}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

      {/* Library browser */}
      {libraryOpen && (
        <div className="rounded-lg border border-border p-3">
          <Input
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Search library…"
            className="mb-2 h-8 text-xs"
          />
          {libraryLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLibrary.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No media assets found.</p>
          ) : (
            <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
              {filteredLibrary.map((item) => (
                <button
                  key={item.public_id}
                  type="button"
                  onClick={() => {
                    onChange(item.url);
                    setLibraryOpen(false);
                  }}
                  title={item.public_id}
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-md border border-border bg-muted transition-opacity hover:opacity-80',
                    value === item.url && 'ring-2 ring-primary'
                  )}
                >
                  <img
                    src={item.thumbnail_url || item.url}
                    alt={item.public_id}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
