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
} as const;
