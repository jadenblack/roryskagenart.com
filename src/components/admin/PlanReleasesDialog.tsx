import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  History,
  Loader2,
  Package,
  Pencil,
  Plus,
  Rocket,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { api } from '../../lib/adminApi';
import {
  PLAN_LIMITS,
  RELEASE_STATUSES,
  RELEASE_STATUS_LABELS,
  isShippedStatus,
  normalizeVersion,
  type ReleaseStatus,
} from '../../lib/planVocabulary';
import type { PlanReleaseRecord } from '../../lib/planTypes';
import type { ReleaseLog } from '../../data/releaseLog.generated';

/**
 * The releases — capability C3 (group) of
 * `plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md`, tasks 2 and 7 of `v3.2.0`.
 *
 * Two jobs that belong together because they are the same screen in the studio's head:
 * "what is coming out" and "has it been written up". The second is the cross-link, and it
 * stays a **join, never a merge** (D1): this reads `GET /api/plan/history`, which is a
 * projection of `CHANGELOG.md`, and matches on version. Nothing here writes to the changelog
 * and nothing here changes what the changelog says.
 *
 * ⚠️ THE STATUS SELECT IS THE SHIP TRANSITION. There is no "ship" button, because the only
 * thing shipping means is `status = 'shipped'` — and `shipped_at` is derived from that by
 * `buildPlanReleasePatch`, which also keeps an existing date so a title correction cannot
 * backdate a release. A separate button would be a second way to write the same column.
 *
 * ⚠️ DELETING A RELEASE DOES NOT DELETE ITS ITEMS. `plan_items.release_id` is
 * `ON DELETE SET NULL`, so removing a release ungroups its items rather than taking the
 * studio's thinking with it. The confirmation says so, because "delete" next to a list of
 * work otherwise reads as deleting the work.
 */

interface PlanReleasesDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after any create/update/delete so the board re-reads its releases. */
  onChanged: () => void | Promise<void>;
}

interface ReleasesResponse {
  success: boolean;
  releases: PlanReleaseRecord[];
}

interface HistoryResponse {
  success: boolean;
  log: ReleaseLog;
}

type ChangelogRelease = ReleaseLog['changelog'][number];

interface ReleaseFormState {
  version: string;
  title: string;
  status: ReleaseStatus;
  target_date: string;
  notes: string;
}

const EMPTY_FORM: ReleaseFormState = {
  version: '',
  title: '',
  status: 'planned',
  target_date: '',
  notes: '',
};

const RELEASE_VARIANT: Record<
  ReleaseStatus,
  'default' | 'success' | 'warning' | 'info' | 'destructive' | 'secondary'
> = {
  planned: 'info',
  in_progress: 'default',
  shipped: 'success',
  cancelled: 'secondary',
};

export const PlanReleasesDialog: React.FC<PlanReleasesDialogProps> = ({
  open,
  onClose,
  onChanged,
}) => {
  const [releases, setReleases] = useState<PlanReleaseRecord[]>([]);
  const [changelog, setChangelog] = useState<ChangelogRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<ReleaseFormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<PlanReleaseRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PlanReleaseRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [releaseData, historyData] = await Promise.all([
        api<ReleasesResponse>('/api/plan/releases'),
        api<HistoryResponse>('/api/plan/history'),
      ]);
      setReleases(releaseData.releases || []);
      setChangelog(historyData.log?.changelog || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load the releases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2500);
  };

  /**
   * Version → the CHANGELOG block that documents it.
   *
   * Keyed on the normalised version, because the two sides disagree on punctuation and
   * nothing enforces agreement: the changelog heads blocks `## [3.1.0]`, while the studio
   * types `v3.1.0`. Matching the raw strings would report every release as undocumented.
   */
  const changelogByVersion = useMemo(() => {
    const map = new Map<string, ChangelogRelease>();
    for (const entry of changelog) {
      if (entry.version) map.set(normalizeVersion(entry.version), entry);
    }
    return map;
  }, [changelog]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (release: PlanReleaseRecord) => {
    setForm({
      version: release.version,
      title: release.title ?? '',
      status: release.status,
      target_date: release.target_date ?? '',
      notes: release.notes ?? '',
    });
    setEditing(release);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setFormError(null);
  };

  const save = async () => {
    const version = form.version.trim();
    if (!version) {
      setFormError('A version is required — it is how a release joins to the history.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const body = {
        version,
        title: form.title.trim() || null,
        status: form.status,
        target_date: form.target_date.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await api(`/api/plan/releases/${editing.id}`, { method: 'PATCH', body });
        flash('Release updated.');
      } else {
        await api('/api/plan/releases', { method: 'POST', body });
        flash('Release created.');
      }
      closeForm();
      await load();
      await onChanged();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save that release.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (release: PlanReleaseRecord, status: ReleaseStatus) => {
    if (status === release.status) return;
    setBusyId(release.id);
    setError(null);
    try {
      await api(`/api/plan/releases/${release.id}`, { method: 'PATCH', body: { status } });
      flash(
        isShippedStatus(status)
          ? `${release.version} marked as shipped.`
          : `${release.version} moved to ${RELEASE_STATUS_LABELS[status]}.`,
      );
      await load();
      await onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to move that release.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    setError(null);
    try {
      await api(`/api/plan/releases/${pendingDelete.id}`, { method: 'DELETE' });
      flash(`${pendingDelete.version} removed. Its items are now unfiled.`);
      setPendingDelete(null);
      await load();
      await onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to remove that release.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    // Two sibling dialogs, not a nested one: the delete confirmation is its own modal, and
    // Radix nests happily but the focus trap then belongs to the outer dialog's subtree.
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Releases</DialogTitle>
          <DialogDescription>
            What the studio is working towards, and whether the changelog says it happened.
            Grouping an item under a release is done from the board.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </p>
          )}
          {notice && (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              {notice}
            </p>
          )}

          {loading ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading releases…
            </p>
          ) : releases.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No releases yet. Create one to start grouping the board.
            </p>
          ) : (
            releases.map((release) => {
              const entry = changelogByVersion.get(normalizeVersion(release.version));
              // A shipped release with no changelog entry is the drift the v3.3.0
              // reconciliation view is built to surface. Naming it here costs one line and
              // is the first place the two sources are ever read side by side.
              const undocumented = isShippedStatus(release.status) && !entry;

              return (
                <div
                  key={release.id}
                  className="rounded-lg border border-border p-3"
                  data-testid="plan-release-row"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{release.version}</span>
                        <Badge variant={RELEASE_VARIANT[release.status]}>
                          {RELEASE_STATUS_LABELS[release.status]}
                        </Badge>
                        {typeof release.item_count === 'number' && (
                          <span className="text-xs text-muted-foreground">
                            {release.item_count} item{release.item_count === 1 ? '' : 's'}
                          </span>
                        )}
                        {release.target_date && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            target {release.target_date}
                          </span>
                        )}
                        {release.shipped_at && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Rocket className="h-3.5 w-3.5" />
                            shipped {release.shipped_at.slice(0, 10)}
                          </span>
                        )}
                      </div>
                      {release.title && (
                        <p className="mt-1 text-sm text-muted-foreground">{release.title}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <Select
                        value={release.status}
                        disabled={busyId === release.id}
                        onChange={(e) =>
                          changeStatus(release, e.target.value as ReleaseStatus)
                        }
                        className="h-8 w-36 text-xs"
                        options={RELEASE_STATUSES.map((status) => ({
                          value: status,
                          label: RELEASE_STATUS_LABELS[status],
                        }))}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => openEdit(release)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setPendingDelete(release)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* The cross-link. A join on version; nothing is written back. */}
                  <div className="mt-2 border-t border-border pt-2 text-xs">
                    {entry ? (
                      <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                        <History className="h-3.5 w-3.5" />
                        CHANGELOG {entry.version}
                        {entry.date ? ` · ${entry.date}` : ''}
                        {` · ${entry.sections.length} section${entry.sections.length === 1 ? '' : 's'}`}
                      </span>
                    ) : (
                      <span
                        className={
                          undocumented
                            ? 'flex items-center gap-1.5 text-amber-600 dark:text-amber-500'
                            : 'flex items-center gap-1.5 text-muted-foreground'
                        }
                      >
                        {undocumented ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <History className="h-3.5 w-3.5" />
                        )}
                        {undocumented
                          ? `Shipped, but no CHANGELOG entry for ${release.version} yet.`
                          : `No CHANGELOG entry for ${release.version} yet.`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* ── Create / edit ─────────────────────────────────────── */}
          {showForm ? (
            <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {editing ? `Edit ${editing.version}` : 'New release'}
                </span>
                <Button variant="ghost" size="icon" onClick={closeForm} title="Cancel">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="release-version">Version</Label>
                  <Input
                    id="release-version"
                    value={form.version}
                    maxLength={PLAN_LIMITS.release}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    placeholder="v3.2.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="release-status">Status</Label>
                  <Select
                    id="release-status"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as ReleaseStatus })
                    }
                    options={RELEASE_STATUSES.map((status) => ({
                      value: status,
                      label: RELEASE_STATUS_LABELS[status],
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="release-target">Target date</Label>
                  <Input
                    id="release-target"
                    type="date"
                    value={form.target_date}
                    onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="release-title">Title</Label>
                <Input
                  id="release-title"
                  value={form.title}
                  maxLength={PLAN_LIMITS.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="What this release is for"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="release-notes">Notes</Label>
                <Textarea
                  id="release-notes"
                  value={form.notes}
                  maxLength={PLAN_LIMITS.notes}
                  rows={3}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Anything the studio needs to remember about this one."
                />
              </div>

              {formError && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeForm} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create release'}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New release
            </Button>
          )}
        </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deleting a release ungroups its items; the copy says so rather than implying the
          work disappears with the label. */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {pendingDelete?.version}?</DialogTitle>
            <DialogDescription>
              The release goes away; its items do not. They become unfiled and stay on the
              board.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busyId === pendingDelete?.id}>
              <Trash2 className="h-4 w-4" />
              Remove release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
