import React, { useMemo, useState } from 'react';
import {
  Search,
  Image as ImageIcon,
  Star,
  Archive,
  Trash2,
  RotateCcw,
  Eye,
  MoreHorizontal,
  Plus,
  Pencil,
  FilePen,
  Upload,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '../ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Switch } from '../ui/switch';
import { ArtworkRecord, UserRole } from '../../types';
import { cn } from '../../lib/utils';

interface CatalogViewProps {
  artworks: ArtworkRecord[];
  loading?: boolean;
  role: UserRole;
  onSelectArtwork?: (slug: string) => void;
  onToggleHero?: (slug: string, next: boolean) => void;
  onToggleEnabled?: (slug: string, next: boolean) => void;
  onToggleArchive?: (slug: string, next: boolean) => void;
  onTrash?: (slug: string) => void;
  onRestore?: (slug: string) => void;
  onPermanentDelete?: (slug: string) => void;
  onEdit?: (slug: string) => void;
  onCreate?: () => void;
  /** Publish (draft=false) / unpublish (draft=true) a work. */
  onSetDraft?: (slug: string, draft: boolean) => void;
}

type Mode = 'active' | 'drafts' | 'trash';

export const CatalogView: React.FC<CatalogViewProps> = ({
  artworks,
  loading,
  role,
  onSelectArtwork,
  onToggleHero,
  onToggleEnabled,
  onToggleArchive,
  onTrash,
  onRestore,
  onPermanentDelete,
  onEdit,
  onCreate,
  onSetDraft,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [seriesFilter, setSeriesFilter] = useState('all');
  const [mode, setMode] = useState<Mode>('active');
  const [confirmDelete, setConfirmDelete] = useState<ArtworkRecord | null>(null);
  const [confirmTrash, setConfirmTrash] = useState<ArtworkRecord | null>(null);

  const draftCount = useMemo(
    () => artworks.filter((a) => a.draft === true && !a.trashed && a.status !== 'Trashed').length,
    [artworks]
  );

  const canEdit = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';

  const seriesOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of artworks) {
      if (a.gallery_series) set.add(a.gallery_series);
    }
    return Array.from(set).sort().map((s) => ({ value: s, label: s }));
  }, [artworks]);

  const filtered = useMemo(() => {
    const inScope = artworks.filter((a) =>
      mode === 'trash'
        ? a.trashed || a.status === 'Trashed'
        : mode === 'drafts'
          ? a.draft === true && !a.trashed && a.status !== 'Trashed'
          : a.draft !== true && !a.trashed && a.status !== 'Trashed'
    );
    return inScope.filter((a) => {
      const matchesSearch =
        !search ||
        [a.title, a.slug, a.medium, a.gallery_series, a.year]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchesSeries = seriesFilter === 'all' || a.gallery_series === seriesFilter;
      return matchesSearch && matchesStatus && matchesSeries;
    });
  }, [artworks, search, statusFilter, seriesFilter, mode]);

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Available': return 'success';
      case 'Sold': return 'destructive';
      case 'Archived': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, slug, medium…"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
          options={[
            { value: 'all', label: 'All statuses' },
            ...['Available', 'Sold', 'Archived', 'Public Installation', 'Private Collection', 'Limited Edition', 'Disabled', 'Hidden']
              .map((s) => ({ value: s, label: s })),
          ]}
        />
        <Select
          value={seriesFilter}
          onChange={(e) => setSeriesFilter(e.target.value)}
          className="w-48"
          options={[{ value: 'all', label: 'All series' }, ...seriesOptions]}
        />
        <div className="flex rounded-md border border-border p-0.5">
          <button
            onClick={() => setMode('active')}
            className={cn(
              'rounded-sm px-3 py-1 text-xs font-medium cursor-pointer',
              mode === 'active' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Active
          </button>
          <button
            onClick={() => setMode('drafts')}
            className={cn(
              'rounded-sm px-3 py-1 text-xs font-medium cursor-pointer',
              mode === 'drafts' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Drafts{draftCount > 0 ? ` (${draftCount})` : ''}
          </button>
          <button
            onClick={() => setMode('trash')}
            className={cn(
              'rounded-sm px-3 py-1 text-xs font-medium cursor-pointer',
              mode === 'trash' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Trashed
          </button>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} works</span>
        {canEdit && onCreate && mode === 'active' && (
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4" /> New artwork
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {mode === 'trash' ? 'Trash is empty.' : mode === 'drafts' ? 'No drafts. Save one from the artwork editor.' : 'No artworks match your filters.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Work</TableHead>
                  <TableHead className="hidden lg:table-cell">Series</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Price</TableHead>
                  <TableHead className="hidden xl:table-cell">Hero</TableHead>
                  <TableHead className="hidden xl:table-cell">Enabled</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow
                    key={a.slug}
                    className={cn(onSelectArtwork && 'cursor-pointer')}
                    onClick={onSelectArtwork ? () => onSelectArtwork(a.slug) : undefined}
                  >
                    <TableCell className="pl-4">
                      <button
                        className="flex items-center gap-3 text-left cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectArtwork?.(a.slug);
                        }}
                      >
                        {a.imageUrl || a.featured_image ? (
                          <img
                            src={a.imageUrl || a.featured_image}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-md border border-border object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="max-w-[220px] truncate text-sm font-medium">{a.title}</div>
                          <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                            {a.year} · {a.medium}
                          </div>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="hidden max-w-[160px] truncate text-sm lg:table-cell">
                      {a.gallery_series || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusBadgeVariant(a.status)}>{a.status}</Badge>
                        {a.draft && <Badge variant="warning">Draft</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{a.price || '—'}</TableCell>
                    <TableCell className="hidden xl:table-cell" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <Switch
                          checked={!!a.heroSlider}
                          onCheckedChange={(v) => onToggleHero?.(a.slug, v)}
                        />
                      ) : (
                        a.heroSlider ? <Star className="h-4 w-4 text-amber-500" /> : null
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <Switch
                          checked={a.enabled !== false}
                          onCheckedChange={(v) => onToggleEnabled?.(a.slug, v)}
                        />
                      ) : (
                        <Badge variant={a.enabled !== false ? 'success' : 'secondary'}>
                          {a.enabled !== false ? 'On' : 'Off'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${a.title}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{a.title}</DropdownMenuLabel>
                            {mode === 'active' && (
                              <>
                                <DropdownMenuItem onSelect={() => onSelectArtwork?.(a.slug)}>
                                  <Eye className="h-4 w-4" /> View
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onEdit?.(a.slug)}>
                                  <Pencil className="h-4 w-4" /> Edit details
                                </DropdownMenuItem>
                                {onSetDraft && (
                                  <DropdownMenuItem onSelect={() => onSetDraft(a.slug, true)}>
                                    <FilePen className="h-4 w-4" /> Unpublish to draft
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => onToggleArchive?.(a.slug, !a.archived)}>
                                  <Archive className="h-4 w-4" /> {a.archived ? 'Unarchive' : 'Archive'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmTrash(a)}>
                                  <Trash2 className="h-4 w-4" /> Move to trash
                                </DropdownMenuItem>
                              </>
                            )}
                            {mode === 'drafts' && (
                              <>
                                {onSetDraft && (
                                  <DropdownMenuItem onSelect={() => onSetDraft(a.slug, false)}>
                                    <Upload className="h-4 w-4" /> Publish
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => onEdit?.(a.slug)}>
                                  <Pencil className="h-4 w-4" /> Edit details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmTrash(a)}>
                                  <Trash2 className="h-4 w-4" /> Move to trash
                                </DropdownMenuItem>
                              </>
                            )}
                            {mode === 'trash' && (
                              <>
                                <DropdownMenuItem onSelect={() => onRestore?.(a.slug)}>
                                  <RotateCcw className="h-4 w-4" /> Restore
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(a)}>
                                      <Trash2 className="h-4 w-4" /> Delete permanently
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Move-to-trash confirmation (PRD: destructive actions confirm) */}
      <Dialog open={!!confirmTrash} onOpenChange={(open) => !open && setConfirmTrash(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle>Move to trash?</DialogTitle>
                <DialogDescription>
                  “{confirmTrash?.title}” will be moved to the trash. You can restore it later from the Trash tab.
                </DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setConfirmTrash(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirmTrash) onTrash?.(confirmTrash.slug);
                    setConfirmTrash(null);
                  }}
                >
                  Move to trash
                </Button>
              </div>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Permanent delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle>Delete permanently?</DialogTitle>
                <DialogDescription>
                  “{confirmDelete?.title}” will be removed from the database forever. This cannot be undone.
                </DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirmDelete) onPermanentDelete?.(confirmDelete.slug);
                    setConfirmDelete(null);
                  }}
                >
                  Delete forever
                </Button>
              </div>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};
