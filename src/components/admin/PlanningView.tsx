import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Layers,
  Lightbulb,
  List,
  ListChecks,
  Maximize2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { api } from '../../lib/adminApi';
import { cn } from '../../lib/utils';
import {
  KIND_LABELS,
  PLAN_LIMITS,
  PRIORITY_LABELS,
  RELEASE_STATUS_LABELS,
  SOURCE_LABELS,
  STAFF_KINDS,
  STATUS_LABELS,
  canTransitionStatus,
  nextStatuses,
  type PlanKind,
  type PlanStatus,
} from '../../lib/planVocabulary';
import type {
  PlanBoardSummary,
  PlanItemRecord,
  PlanReleaseRecord,
} from '../../lib/planTypes';
import { PlanItemDrawer } from './PlanItemDrawer';
import { PlanReleasesDialog } from './PlanReleasesDialog';

/**
 * The planning board — capability C2 (capture), C3 (group), C4 (triage) and C5 (status) of
 * `plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md`.
 *
 * WHAT IT DELIBERATELY IS NOT (a scope fence, not an oversight — §4 of the plan):
 * no comments, no audit trail, no attachments, no CSV export, no search, no drag-to-reorder.
 * `v3.3.0` closes the loop; building it here is how you build features for a tool nobody
 * uses yet.
 *
 * ⚠️ THE VOCABULARY IS IMPORTED, NOT RE-DECLARED.
 * `src/lib/planVocabulary.ts` is shared with `server/lib/planRules.ts`, so the kind/status/
 * priority pickers here can never offer a value the API rejects, and `canTransitionStatus`
 * hides the status moves the server would refuse. `PLAN_LIMITS` supplies every `maxLength`,
 * for the same reason: a form that lets you type more than the API accepts is a form that
 * fails after you have typed it.
 *
 * ⚠️ TWO VIEWS, ONE BOARD. `v3.2.0` groups by a real release, but the flat list stays — a
 * board you have to open a section to read is worse for the daily triage pass, and grouping
 * is a way of looking at the same rows, not a different set of rows. Both render
 * `PlanItemRow`, so a row cannot look one way in one view and another way in the other.
 *
 * A `viewer` never sees this screen — `ADMIN_NAV` gives Planning `minRole: 'editor'`, which
 * mirrors the server's `requireRole('editor')` on every read and write of the board. A viewer
 * *can* still file (the footer's intake door posts as them); knocking is not triaging.
 */

interface BoardResponse {
  success: boolean;
  items: PlanItemRecord[];
  /** `SELECT DISTINCT target_release` — the v3.1.0 free-text labels, for the autocomplete. */
  releases: string[];
  /** The v3.2.0 release entities. A separate key: `releases` above is a `string[]`. */
  planReleases: PlanReleaseRecord[];
  summary: PlanBoardSummary;
}

/** Badge colour per kind, so a bug reads differently from an idea at a glance. */
const KIND_VARIANT: Record<PlanKind, 'default' | 'success' | 'warning' | 'info' | 'destructive' | 'secondary'> = {
  idea: 'secondary',
  feature: 'info',
  bug: 'destructive',
  task: 'default',
  suggestion: 'warning',
};

const KIND_ICON: Record<PlanKind, React.ComponentType<{ className?: string }>> = {
  idea: Lightbulb,
  feature: Sparkles,
  bug: Bug,
  task: ListChecks,
  suggestion: Wand2,
};

const STATUS_VARIANT: Record<PlanStatus, 'default' | 'success' | 'warning' | 'info' | 'destructive' | 'secondary'> = {
  new: 'warning',
  accepted: 'info',
  planned: 'info',
  in_progress: 'default',
  done: 'success',
  declined: 'secondary',
};

interface FormState {
  kind: PlanKind;
  title: string;
  body: string;
  priority: string;
  target_release: string;
}

const EMPTY_FORM: FormState = {
  kind: 'idea',
  title: '',
  body: '',
  priority: '',
  target_release: '',
};

type ViewMode = 'flat' | 'grouped';

/** One section of the grouped view. `release` is `null` for the unfiled bucket. */
interface BoardGroup {
  release: PlanReleaseRecord | null;
  items: PlanItemRecord[];
}

/**
 * One row, rendered the same in both views.
 *
 * Moving an item between releases is a `release_id` PATCH and nothing else — the board sends
 * the **id**, not the version (`buildPlanItemPatch` rejects anything that is not a uuid, by
 * design: two releases can share a label across a rename, so a lookup-by-label would be
 * ambiguous). `''` is the `<select>` spelling of `null`, and the server accepts it as
 * "ungroup this item".
 */
const PlanItemRow: React.FC<{
  item: PlanItemRecord;
  releases: PlanReleaseRecord[];
  busy: boolean;
  onMove: (item: PlanItemRecord, releaseId: string | null) => void;
  onStatus: (item: PlanItemRecord, status: PlanStatus) => void;
  onEdit: (item: PlanItemRecord) => void;
  onDelete: (item: PlanItemRecord) => void;
  onOpen: (item: PlanItemRecord) => void;
}> = ({ item, releases, busy, onMove, onStatus, onEdit, onDelete, onOpen }) => {
  const Icon = KIND_ICON[item.kind];
  // The picker offers only what the server would accept, plus the current value.
  const allowed = [item.status, ...nextStatuses(item.status)].filter((status) =>
    canTransitionStatus(item.status, status)
  );

  return (
    <TableRow>
      <TableCell className="pl-4">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <button
              type="button"
              className="text-left font-medium hover:underline"
              onClick={() => onOpen(item)}
            >
              {item.title}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant={KIND_VARIANT[item.kind]}>{KIND_LABELS[item.kind]}</Badge>
              {item.source === 'public' && <Badge variant="outline">{SOURCE_LABELS.public}</Badge>}
              {item.author_email && (
                <span className="text-xs text-muted-foreground">{item.author_email}</span>
              )}
            </div>
            {item.body && (
              <p className="mt-1 line-clamp-2 max-w-xl text-xs text-muted-foreground">{item.body}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Select
          aria-label={`Status for ${item.title}`}
          value={item.status}
          onChange={(e) => onStatus(item, e.target.value as PlanStatus)}
          disabled={busy}
          className="h-8 w-36 text-xs"
          options={allowed.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
        />
        <Badge variant={STATUS_VARIANT[item.status]} className="mt-1">
          {STATUS_LABELS[item.status]}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {item.priority ? (
          <Badge variant={item.priority === 'high' ? 'warning' : 'secondary'}>
            {PRIORITY_LABELS[item.priority]}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      {/* The move control. Present in both views: in the grouped view it is how you file
          something, in the flat view it is how you file something without switching. */}
      <TableCell className="hidden lg:table-cell">
        <Select
          aria-label={`Release for ${item.title}`}
          value={item.release_id ?? ''}
          onChange={(e) => onMove(item, e.target.value === '' ? null : e.target.value)}
          disabled={busy}
          className="h-8 w-40 text-xs"
          options={[
            { value: '', label: 'No release' },
            ...releases.map((release) => ({ value: release.id, label: release.version })),
          ]}
        />
        {!item.release_id && item.target_release && (
          <div className="mt-1 text-xs text-muted-foreground">“{item.target_release}”</div>
        )}
      </TableCell>
      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
        {new Date(item.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title="Open" onClick={() => onOpen(item)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Edit" onClick={() => onEdit(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Delete" onClick={() => onDelete(item)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const ITEM_HEAD = (
  <TableHeader>
    <TableRow>
      <TableHead className="pl-4">Item</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="hidden md:table-cell">Priority</TableHead>
      <TableHead className="hidden lg:table-cell">Release</TableHead>
      <TableHead className="hidden lg:table-cell">Filed</TableHead>
      <TableHead className="pr-4 text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
);

export const PlanningView: React.FC = () => {
  const [items, setItems] = useState<PlanItemRecord[]>([]);
  const [releases, setReleases] = useState<string[]>([]);
  const [planReleases, setPlanReleases] = useState<PlanReleaseRecord[]>([]);
  const [summary, setSummary] = useState<PlanBoardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('flat');

  const [kindFilter, setKindFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [releaseFilter, setReleaseFilter] = useState('all');

  const [editing, setEditing] = useState<PlanItemRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PlanItemRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detail, setDetail] = useState<PlanItemRecord | null>(null);
  const [releasesOpen, setReleasesOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (kindFilter !== 'all') params.set('kind', kindFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (releaseFilter !== 'all') params.set('release', releaseFilter);
      const query = params.toString();

      const data = await api<BoardResponse>(`/api/plan/items${query ? `?${query}` : ''}`);
      setItems(data.items || []);
      setReleases(data.releases || []);
      setPlanReleases(data.planReleases || []);
      setSummary(data.summary || null);
      // Keep an open drawer pointing at the refreshed row rather than a stale copy.
      setDetail((current) =>
        current ? (data.items || []).find((row) => row.id === current.id) ?? null : null,
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load the planning board');
    } finally {
      setLoading(false);
    }
  }, [kindFilter, statusFilter, releaseFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (item: PlanItemRecord) => {
    setForm({
      kind: item.kind,
      title: item.title,
      body: item.body ?? '',
      priority: item.priority ?? '',
      target_release: item.target_release ?? '',
    });
    setFormError(null);
    setCreating(false);
    setEditing(item);
  };

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
    setFormError(null);
  };

  const dialogOpen = creating || editing !== null;

  const save = async () => {
    const title = form.title.trim();
    if (!title) {
      setFormError('A title is required.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        // Only the fields the form owns. `source`, `author_*` and `source_ref` are not
        // patchable — provenance is not an editable field.
        await api(`/api/plan/items/${editing.id}`, {
          method: 'PATCH',
          body: {
            title,
            body: form.body.trim() || null,
            kind: form.kind,
            priority: form.priority || null,
            target_release: form.target_release.trim() || null,
          },
        });
        flash('Item updated.');
      } else {
        await api('/api/plan/items', {
          method: 'POST',
          body: {
            kind: form.kind,
            title,
            body: form.body.trim() || null,
            priority: form.priority || null,
            target_release: form.target_release.trim() || null,
          },
        });
        flash('Item added to the board.');
      }
      closeDialog();
      await load();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save the item');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (item: PlanItemRecord, status: PlanStatus) => {
    if (status === item.status) return;
    setBusyId(item.id);
    setError(null);
    try {
      await api(`/api/plan/items/${item.id}`, { method: 'PATCH', body: { status } });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to move that item');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * File an item under a release, or ungroup it.
   *
   * `null` is a real move, not a no-op: it is how the studio says "this is not in that
   * release any more". The row keeps its `target_release` text, because that column is the
   * audit trail for the v3.2.0 backfill and is not cleared by re-filing.
   */
  const moveToRelease = async (item: PlanItemRecord, releaseId: string | null) => {
    if ((item.release_id ?? null) === releaseId) return;
    setBusyId(item.id);
    setError(null);
    try {
      await api(`/api/plan/items/${item.id}`, { method: 'PATCH', body: { release_id: releaseId } });
      const target = planReleases.find((release) => release.id === releaseId);
      flash(target ? `Filed under ${target.version}.` : 'Removed from its release.');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to move that item');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await api(`/api/plan/items/${pendingDelete.id}`, { method: 'DELETE' });
      setPendingDelete(null);
      flash('Item removed.');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to remove the item');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * The kinds the dialog may offer.
   *
   * `suggestion` is not a kind a staff member can *choose* — it records that a member of the
   * public filed the item. But an item already carrying it must still render, so the current
   * value is added back, labelled as what it is. Changing it away from `suggestion` is how a
   * public suggestion is promoted, and `source` stays `'public'` throughout.
   */
  const kindOptions = useMemo(() => {
    const options: { value: string; label: string }[] = STAFF_KINDS.map((kind) => ({
      value: kind,
      label: KIND_LABELS[kind],
    }));
    if (form.kind === 'suggestion') {
      options.unshift({ value: 'suggestion', label: `${KIND_LABELS.suggestion} (as filed)` });
    }
    return options;
  }, [form.kind]);

  /**
   * The grouped view's sections.
   *
   * Every release gets a section, including the empty ones — a release with nothing filed is
   * the studio's own signal that it has not been planned. The unfiled bucket is last and is
   * never dropped, because an item with no release is exactly the thing grouping exists to
   * surface rather than hide.
   */
  const groups = useMemo<BoardGroup[]>(() => {
    const byRelease = new Map<string, PlanItemRecord[]>();
    const unfiled: PlanItemRecord[] = [];
    for (const item of items) {
      if (item.release_id) {
        const bucket = byRelease.get(item.release_id);
        if (bucket) bucket.push(item);
        else byRelease.set(item.release_id, [item]);
      } else {
        unfiled.push(item);
      }
    }
    const sections = planReleases.map((release) => ({
      release,
      items: byRelease.get(release.id) ?? [],
    }));
    // An item filed under a release this board does not know about (deleted between the two
    // reads, or filed by another session) still has to appear somewhere.
    const known = new Set(planReleases.map((release) => release.id));
    for (const [id, bucket] of byRelease) {
      if (!known.has(id)) sections.push({ release: null, items: bucket });
    }
    return [...sections, { release: null, items: unfiled }];
  }, [items, planReleases]);

  const hasFilters = kindFilter !== 'all' || statusFilter !== 'all' || releaseFilter !== 'all';

  const rowProps = {
    releases: planReleases,
    onMove: moveToRelease,
    onStatus: changeStatus,
    onEdit: openEdit,
    onDelete: setPendingDelete,
    onOpen: setDetail,
  };

  return (
    <div className="space-y-4">
      {/* Header: what the studio has to think about, at a glance. */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Open', value: summary.open, hint: `${summary.total} on the board` },
            {
              label: 'Awaiting triage',
              value: summary.awaitingTriage,
              hint: 'public submissions nobody has read',
            },
            { label: 'In progress', value: summary.byStatus.in_progress ?? 0, hint: 'being worked on' },
            { label: 'Done', value: summary.byStatus.done ?? 0, hint: `${summary.byStatus.declined ?? 0} declined` },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* The view toggle. Grouping is a way of reading the same rows, so switching costs
            nothing and does not re-fetch. */}
        <div className="flex overflow-hidden rounded-md border border-border">
          {(
            [
              { mode: 'flat' as ViewMode, label: 'Flat', icon: List },
              { mode: 'grouped' as ViewMode, label: 'By release', icon: Layers },
            ]
          ).map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
                viewMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <Select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="w-40"
          options={[
            { value: 'all', label: 'All kinds' },
            ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
          options={[
            { value: 'all', label: 'All statuses' },
            ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Select
          value={releaseFilter}
          onChange={(e) => setReleaseFilter(e.target.value)}
          className="w-44"
          options={[
            { value: 'all', label: 'All releases' },
            ...releases.map((release) => ({ value: release, label: release })),
          ]}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setKindFilter('all');
              setStatusFilter('all');
              setReleaseFilter('all');
            }}
          >
            Clear filters
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => setReleasesOpen(true)}>
          <Layers className="h-4 w-4" />
          Releases
        </Button>
        <Button size="sm" className="ml-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New item
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <ListChecks className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {hasFilters ? 'Nothing matches those filters.' : 'The board is empty.'}
            </p>
            {!hasFilters && (
              <Button variant="outline" size="sm" className="mt-2" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add the first item
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'flat' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              {ITEM_HEAD}
              <TableBody>
                {items.map((item) => (
                  <PlanItemRow key={item.id} item={item} busy={busyId === item.id} {...rowProps} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group, index) => (
            <Card key={group.release?.id ?? `group-${index}`}>
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  {group.release ? (
                    <>
                      <CardTitle className="text-sm font-semibold">
                        {group.release.version}
                      </CardTitle>
                      <Badge variant="secondary">
                        {RELEASE_STATUS_LABELS[group.release.status]}
                      </Badge>
                      {group.release.title && (
                        <span className="text-xs text-muted-foreground">{group.release.title}</span>
                      )}
                    </>
                  ) : (
                    <CardTitle className="text-sm font-semibold">Not filed under a release</CardTitle>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {group.items.length} item{group.items.length === 1 ? '' : 's'}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                {group.items.length === 0 ? (
                  <p className="px-4 pb-4 text-xs text-muted-foreground">
                    Nothing filed against this release.
                  </p>
                ) : (
                  <Table>
                    {ITEM_HEAD}
                    <TableBody>
                      {group.items.map((item) => (
                        <PlanItemRow
                          key={item.id}
                          item={item}
                          busy={busyId === item.id}
                          {...rowProps}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {loading ? '' : `${items.length} item${items.length === 1 ? '' : 's'} shown`}
      </div>

      {/* Create / edit. One dialog for both, because the fields are the same minus status —
          status has its own control in the table, where the transition rules are visible. */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit item' : 'New item'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Change what this item says. Status is changed from the board.'
                : 'Anything the studio should think about: an idea, a feature, a bug or a task.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-kind">Kind</Label>
                <Select
                  id="plan-kind"
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as PlanKind })}
                  options={kindOptions}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-priority">Priority</Label>
                <Select
                  id="plan-priority"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  options={[
                    { value: '', label: 'Not triaged' },
                    ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-title">Title</Label>
              <Input
                id="plan-title"
                value={form.title}
                maxLength={PLAN_LIMITS.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What should change?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-body">Description</Label>
              <Textarea
                id="plan-body"
                value={form.body}
                maxLength={PLAN_LIMITS.body}
                rows={5}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Why it matters, and anything that would make it easier to do."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-release">Release label</Label>
              {/* A native datalist: the values come from SELECT DISTINCT, so the studio can pick
                  an existing label or type a new one. This is the v3.1.0 free-text column —
                  filing an item under a real release is the control in the Release column. */}
              <Input
                id="plan-release"
                list="plan-release-options"
                value={form.target_release}
                maxLength={PLAN_LIMITS.release}
                onChange={(e) => setForm({ ...form, target_release: e.target.value })}
                placeholder="v3.2.0, backlog, someday…"
              />
              <datalist id="plan-release-options">
                {releases.map((release) => (
                  <option key={release} value={release} />
                ))}
              </datalist>
            </div>

            {formError && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {formError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to board'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation. A real delete, so it asks — and says so plainly. */}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this item?</DialogTitle>
            <DialogDescription>
              “{pendingDelete?.title}” will be deleted permanently. If it was a bad idea rather
              than a mistake, set its status to Declined instead — the board keeps the reasoning.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busyId === pendingDelete?.id}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanItemDrawer
        item={detail}
        releases={planReleases}
        onClose={() => setDetail(null)}
        onChanged={load}
      />

      <PlanReleasesDialog
        open={releasesOpen}
        onClose={() => setReleasesOpen(false)}
        onChanged={load}
      />

      {notice && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          {notice}
        </div>
      )}
    </div>
  );
};
