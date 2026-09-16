import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { api } from '../../lib/adminApi';
import {
  KIND_LABELS,
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STAFF_KINDS,
  STATUS_LABELS,
  canTransitionStatus,
  nextStatuses,
  type PlanKind,
  type PlanPriority,
  type PlanStatus,
} from '../../lib/planVocabulary';
import type { PlanItemRecord, PlanReleaseRecord } from '../../lib/planTypes';

/**
 * One item, in full — capability C4 (triage) of
 * `plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md`, task 4 of `v3.2.0`.
 *
 * WHY A DIALOG AND NOT A SIDE SHEET. The repo has no sheet primitive, and adding one to
 * build a panel that slides in from the right would be new surface for a cosmetic
 * difference. This is the drawer in every way that matters: it opens over the board, keeps
 * the board's scroll position and filters, and closes without a navigation.
 *
 * ⚠️ `source_ref` IS RENDERED READ-ONLY, AND THAT IS A DELIBERATE DEVIATION.
 * Task 4 of the roadmap specifies "a link field bound to `source_ref`". The server refuses
 * to patch that column, and says why: `buildPlanItemPatch` excludes `source`, `source_ref`
 * and `author_*` because *provenance is not an editable field* — an editor who could rewrite
 * it could launder a public submission into a staff one. `buildPlanItemInput` goes further
 * and sets `source_ref` to `null` on every insert, because it doubles as the idempotency key
 * behind a partial unique index. So this renders the link when there is one and offers
 * nothing to type. Making it editable is a change to the rule and its stated reason, not a
 * gap in this component — see the note left in `plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md`.
 *
 * `release_id` is shown and not changed here on purpose: moving an item between releases is
 * the grouping UI's control, and two controls that write the same column from two places are
 * two places to keep in step.
 */

interface PlanItemDrawerProps {
  item: PlanItemRecord | null;
  /** Used only to name the release the item is filed under. */
  releases: PlanReleaseRecord[];
  onClose: () => void;
  /** Called after any successful write, so the board re-reads and the drawer re-opens fresh. */
  onChanged: () => void | Promise<void>;
}

/**
 * The kinds an item may be promoted to.
 *
 * `suggestion` is what the anonymous door produces, so promoting it means choosing one of the
 * staff kinds — and `source` stays `'public'` throughout. That is the whole point: the studio
 * says "this is a feature request" without also saying "a staff member filed it".
 */
const PROMOTE_TARGETS: PlanKind[] = ['feature', 'bug', 'task'];

/** True when the string is something a browser should be allowed to open. */
function isHttpUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const PlanItemDrawer: React.FC<PlanItemDrawerProps> = ({
  item,
  releases,
  onClose,
  onChanged,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const release = useMemo(
    () => (item?.release_id ? releases.find((r) => r.id === item.release_id) ?? null : null),
    [item?.release_id, releases],
  );

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2500);
  };

  /** One PATCH for the whole drawer, so every write reports failure the same way. */
  const patch = async (body: Record<string, unknown>, message: string) => {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/plan/items/${item.id}`, { method: 'PATCH', body });
      flash(message);
      await onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to update that item.');
    } finally {
      setBusy(false);
    }
  };

  if (!item) return null;

  // The picker offers what the server would accept, plus the value the row already carries.
  const statusOptions = [item.status, ...nextStatuses(item.status)]
    .filter((status) => canTransitionStatus(item.status, status))
    .map((status) => ({ value: status, label: STATUS_LABELS[status] }));

  // Widened to `string` so the current `suggestion` can be added back — `STAFF_KINDS` alone
  // would infer a union that excludes it, and an item already carrying it must still render.
  const kindOptions: { value: string; label: string }[] = STAFF_KINDS.map((kind) => ({
    value: kind,
    label: KIND_LABELS[kind],
  }));
  if (item.kind === 'suggestion') {
    kindOptions.unshift({ value: 'suggestion', label: `${KIND_LABELS.suggestion} (as filed)` });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-6">{item.title}</DialogTitle>
          <DialogDescription>
            {KIND_LABELS[item.kind]}
            {item.source === 'public' ? ` · ${SOURCE_LABELS.public}` : ` · ${SOURCE_LABELS.studio}`}
            {item.author_email ? ` · ${item.author_email}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {item.body ? (
            <p className="whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No description was given.
            </p>
          )}

          {/* ── Triage ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="drawer-status">Status</Label>
              <Select
                id="drawer-status"
                value={item.status}
                disabled={busy}
                onChange={(e) =>
                  patch({ status: e.target.value as PlanStatus }, 'Status updated.')
                }
                options={statusOptions}
              />
              {/* The badge, not just the select: the select shows what you can do next, the
                  badge shows what is true. A control that only ever displays your last
                  action is easy to misread as the current state. */}
              <div>
                <Badge variant="secondary">{STATUS_LABELS[item.status]}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="drawer-priority">Priority</Label>
              <Select
                id="drawer-priority"
                value={item.priority ?? ''}
                disabled={busy}
                onChange={(e) =>
                  patch(
                    { priority: e.target.value === '' ? null : (e.target.value as PlanPriority) },
                    'Priority updated.',
                  )
                }
                options={[
                  { value: '', label: 'Not triaged' },
                  ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drawer-kind">Kind</Label>
              <Select
                id="drawer-kind"
                value={item.kind}
                disabled={busy || item.kind === 'suggestion'}
                onChange={(e) => patch({ kind: e.target.value as PlanKind }, 'Kind updated.')}
                options={kindOptions}
              />
              {item.kind === 'suggestion' && (
                <p className="text-xs text-muted-foreground">
                  Promote it to change the kind — a suggestion keeps its public source either way.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Release</Label>
              <div className="flex h-9 items-center text-sm">
                {release ? (
                  <Badge variant="outline">{release.version}</Badge>
                ) : (
                  <span className="text-muted-foreground">
                    {item.target_release
                      ? `“${item.target_release}” (label only — not a release)`
                      : 'Not filed under a release'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Move it from the board’s release control.
              </p>
            </div>
          </div>

          {/* ── Promote ────────────────────────────────────────────── */}
          {item.kind === 'suggestion' && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-sm font-medium">Promote this suggestion</div>
              <p className="text-xs text-muted-foreground">
                One step, and it stays marked as filed by the public — promoting it changes what
                the studio calls it, not who it came from.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {PROMOTE_TARGETS.map((kind) => (
                  <Button
                    key={kind}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => patch({ kind }, `Promoted to ${KIND_LABELS[kind]}.`)}
                  >
                    <ArrowRight className="h-4 w-4" />
                    {KIND_LABELS[kind]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* ── Provenance, read-only ──────────────────────────────── */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4" />
              Source reference
            </div>
            {item.source_ref ? (
              isHttpUrl(item.source_ref) ? (
                <a
                  href={item.source_ref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary underline"
                >
                  {item.source_ref}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <code className="text-sm">{item.source_ref}</code>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                None recorded. This column is the item’s idempotency key and is written by the
                seed script, not by a form — so there is nothing to edit here.
              </p>
            )}

            {item.page_url && isHttpUrl(item.page_url) && (
              <p className="text-xs text-muted-foreground">
                Filed from{' '}
                <a
                  href={item.page_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  {item.page_url}
                </a>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>Filed {new Date(item.created_at).toLocaleString()}</span>
            <span>Updated {new Date(item.updated_at).toLocaleString()}</span>
          </div>
        </div>

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
        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
