/**
 * Planning-board vocabulary — shared by the browser bundle and the server.
 *
 * Same rationale as `src/lib/roles.ts`, which this file deliberately mirrors: the
 * Planning view renders the kind, status and priority pickers, and
 * `server/routes/plan.ts` validates the values that come back. Written twice, the two
 * lists eventually diverge and the UI offers a status the API rejects — a defect that
 * only appears in front of the studio, never in a test.
 *
 * `PLAN_LIMITS` lives here for the same reason: an input's `maxLength` and the server's
 * cap must be the same number, or the form lets a user type something the API refuses.
 *
 * Dependency-free and side-effect-free, so it is safe to import from React components
 * and from Express routes alike.
 */

export const PLAN_KINDS = ['idea', 'feature', 'bug', 'task', 'suggestion'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

/**
 * The kinds the **staff** door accepts, and the only kinds a PATCH may set.
 *
 * `suggestion` is absent on purpose. It is what the anonymous door produces, and it is
 * what marks an item as having come from the public — so re-labelling a staff item as a
 * "suggestion" would be meaningless. Note the direction this *does* allow: changing a
 * public row's `kind` to `feature`/`bug`/`task` is how a suggestion is promoted, and
 * `source` stays `'public'` throughout, which is exactly what the migration's
 * single-vocabulary comment intends.
 */
export const STAFF_KINDS = ['idea', 'feature', 'bug', 'task'] as const;
export type StaffKind = (typeof STAFF_KINDS)[number];

export const PLAN_STATUSES = ['new', 'accepted', 'planned', 'in_progress', 'done', 'declined'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_PRIORITIES = ['low', 'medium', 'high'] as const;
export type PlanPriority = (typeof PLAN_PRIORITIES)[number];

export const PLAN_SOURCES = ['studio', 'public'] as const;
export type PlanSource = (typeof PLAN_SOURCES)[number];

/**
 * The lifecycle of a **release**, which is deliberately not the lifecycle of an item.
 *
 * An item is `done` when its work is finished; a release is `shipped` when the release went
 * out. Sharing one enum would either make `done` mean two different things or force a label
 * like "done (shipped)", so they stay separate and are joined by
 * `plan_items.release_id → plan_releases.id`.
 */
export const RELEASE_STATUSES = ['planned', 'in_progress', 'shipped', 'cancelled'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
};

/**
 * Whether a status means "this release went out".
 *
 * One function, because `shipped_at` is written from it and the two must not drift: a
 * release whose status says `shipped` while `shipped_at` is NULL is a release the studio
 * cannot give a date for, which is the one question a release row exists to answer.
 */
export function isShippedStatus(status: ReleaseStatus): boolean {
  return status === 'shipped';
}

/**
 * Reduce a version label to the comparison form, so a plan release can be joined to the
 * historical CHANGELOG block that documents it.
 *
 * This exists because the two sides are punctuated differently and nothing else enforces
 * agreement: `CHANGELOG.md` heads its blocks `## [3.2.0]`, while `plan_releases.version` is
 * free text the studio types — the `v3.1.0` board it grew out of held `v3.2.0`, `backlog` and
 * `someday` in one column. Joining the raw strings would match nothing and look identical to
 * "this release was never documented", which is precisely the wrong answer to show the studio.
 *
 * Minimal on purpose: strip a leading `v`, trim, lowercase. It does **not** pad `3.2` to
 * `3.2.0`, because guessing which of the two the studio meant is worse than failing to match.
 */
export function normalizeVersion(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^[vV]\s*/, '').toLowerCase();
}

export const KIND_LABELS: Record<PlanKind, string> = {
  idea: 'Idea',
  feature: 'Feature request',
  bug: 'Bug',
  task: 'Task',
  suggestion: 'Suggestion',
};

export const STATUS_LABELS: Record<PlanStatus, string> = {
  new: 'New',
  accepted: 'Accepted',
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
  declined: 'Declined',
};

export const PRIORITY_LABELS: Record<PlanPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const SOURCE_LABELS: Record<PlanSource, string> = {
  studio: 'Studio',
  public: 'Public',
};

/**
 * Statuses an item may move to from each status.
 *
 * WHY A MAP AT ALL, ON A BOARD ONE PERSON OPERATES.
 * Because two of these edges are genuinely wrong and the board should refuse them rather
 * than record them: nothing reaches `declined` from `done` (that is what delete is for —
 * "we shipped it" and "we rejected it" must not both be true), and nothing reaches
 * `planned` from `done` without going back through `in_progress` (a shipped item is not
 * silently unshipped). Everything else is permissive: `done` reopens, `declined` is
 * reconsidered, and any status may jump straight to `done` because a small board does not
 * need a ceremony to say "that's finished".
 *
 * The UI uses this to hide impossible options; `buildPlanItemPatch` uses it to refuse
 * them. One definition, so the two cannot disagree.
 */
export const STATUS_TRANSITIONS: Record<PlanStatus, readonly PlanStatus[]> = {
  new: ['accepted', 'planned', 'in_progress', 'done', 'declined'],
  accepted: ['planned', 'in_progress', 'done', 'declined'],
  planned: ['in_progress', 'done', 'declined'],
  in_progress: ['done', 'declined'],
  done: ['new', 'in_progress'],
  declined: ['new', 'accepted'],
};

/** True when `to` is reachable from `from`. A same-status move is a no-op, not a violation. */
export function canTransitionStatus(from: PlanStatus, to: PlanStatus): boolean {
  if (from === to) return true;
  return (STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/** The statuses reachable from `from`, for a picker. Excludes `from` itself. */
export function nextStatuses(from: PlanStatus): readonly PlanStatus[] {
  return STATUS_TRANSITIONS[from] ?? [];
}

/** Length caps. Shared so a form's `maxLength` and the API's limit are one number. */
export const PLAN_LIMITS = {
  title: 160,
  body: 8000,
  release: 60,
  pageUrl: 500,
  /** Matches `profiles.full_name`'s practical length; `author_name` is denormalised. */
  name: 120,
  /** Release notes. Long enough for a paragraph per release, short enough to render inline. */
  notes: 4000,
} as const;
