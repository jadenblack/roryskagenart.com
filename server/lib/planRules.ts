/**
 * Pure planning-board rules.
 *
 * Everything here is side-effect free and unit-tested offline
 * (`src/test/planRules.test.ts`). `server/routes/plan.ts` owns the database; it
 * delegates every *decision* — what a valid submission looks like, what an anonymous
 * caller is allowed to set, which status changes are legal — to this file. That is the
 * same split as `server/lib/userAdmin.ts`, and for the same reason: a decision made
 * inside a route that talks to Postgres is a decision no test can reach.
 *
 * ⚠️ THE RULE THAT MUST NOT BE "SIMPLIFIED" LATER.
 * `source`, `source_ref` and `author_id` are **never** read from a request body. They
 * are fixed by the door the request arrived on, or derived from the session. This is
 * what stops an anonymous caller filing as staff, and it is the single thing about this
 * design that has to survive contact with a future contributor who wants to let the
 * client send "just one more field".
 *
 * Corollary, and it is enforced here rather than trusted: an anonymous submission has
 * `author_id = null` even when it arrives from a signed-in browser. Resolving a session
 * on an unauthenticated route would mean a Supabase call on every anonymous write, and
 * the two intake doors are supposed to have *different contracts*, not one contract with
 * a hint of session. The optional `email` on the public door is the identity it gets.
 */

import {
  PLAN_LIMITS,
  PLAN_KINDS,
  PLAN_PRIORITIES,
  PLAN_SOURCES,
  PLAN_STATUSES,
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STAFF_KINDS,
  STATUS_LABELS,
  KIND_LABELS,
  RELEASE_STATUSES,
  RELEASE_STATUS_LABELS,
  canTransitionStatus,
  isShippedStatus,
  nextStatuses,
  type PlanKind,
  type PlanPriority,
  type PlanSource,
  type PlanStatus,
  type ReleaseStatus,
  type StaffKind,
} from '../../src/lib/planVocabulary';
import { normalizeEmail } from './userAdmin';

// Re-exported so a caller needs one import, exactly as `userAdmin.ts` re-exports
// `src/lib/roles.ts` rather than making every route import both.
export {
  PLAN_KINDS,
  PLAN_LIMITS,
  PLAN_PRIORITIES,
  PLAN_SOURCES,
  PLAN_STATUSES,
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STAFF_KINDS,
  STATUS_LABELS,
  KIND_LABELS,
  RELEASE_STATUSES,
  RELEASE_STATUS_LABELS,
  canTransitionStatus,
  isShippedStatus,
  nextStatuses,
};
export type { PlanKind, PlanPriority, PlanSource, PlanStatus, ReleaseStatus, StaffKind };

/* ------------------------------------------------------------------ *
 * Guards                                                              *
 * ------------------------------------------------------------------ */

export function isStaffKind(value: unknown): value is StaffKind {
  return typeof value === 'string' && (STAFF_KINDS as readonly string[]).includes(value);
}

export function isPlanKind(value: unknown): value is PlanKind {
  return typeof value === 'string' && (PLAN_KINDS as readonly string[]).includes(value);
}

export function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === 'string' && (PLAN_STATUSES as readonly string[]).includes(value);
}

export function isPlanPriority(value: unknown): value is PlanPriority {
  return typeof value === 'string' && (PLAN_PRIORITIES as readonly string[]).includes(value);
}

export function isReleaseStatus(value: unknown): value is ReleaseStatus {
  return typeof value === 'string' && (RELEASE_STATUSES as readonly string[]).includes(value);
}

/** Cheap shape check, so a malformed id is a 400 instead of a Postgres cast error. */
export function isUuid(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/* ------------------------------------------------------------------ *
 * List filters                                                        *
 * ------------------------------------------------------------------ */

export const PLAN_LIST_DEFAULT_LIMIT = 200;
export const PLAN_LIST_MAX_LIMIT = 500;

export interface PlanListFilters {
  kind: PlanKind | null;
  status: PlanStatus | null;
  target_release: string | null;
  limit: number;
}

/**
 * Validate the board's query string.
 *
 * An unrecognised filter is a **400**, not an empty list. A filter that silently matches
 * nothing is indistinguishable from a filter that correctly matches nothing, so the
 * studio would read "no bugs" when the truth is "you misspelled `bug`".
 *
 * Query values arrive as `string | string[] | ParsedQs`, so an array is collapsed to its
 * first element rather than stringified — `?kind=bug&kind=idea` should behave like
 * `?kind=bug`, not like the literal `"bug,idea"`.
 */
export function buildListFilters(query: unknown): BuildOutcome<PlanListFilters> {
  const raw = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>;
  const single = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);
  const isBlank = (value: unknown): boolean =>
    value === undefined || value === null || String(value).trim() === '';

  const kindRaw = single(raw.kind);
  let kind: PlanKind | null = null;
  if (!isBlank(kindRaw)) {
    const requested = String(kindRaw).trim().toLowerCase();
    if (!isPlanKind(requested)) {
      return { error: `Kind filter must be one of: ${PLAN_KINDS.join(', ')}.` };
    }
    kind = requested;
  }

  const statusRaw = single(raw.status);
  let status: PlanStatus | null = null;
  if (!isBlank(statusRaw)) {
    const requested = String(statusRaw).trim().toLowerCase();
    if (!isPlanStatus(requested)) {
      return { error: `Status filter must be one of: ${PLAN_STATUSES.join(', ')}.` };
    }
    status = requested;
  }

  const releaseRaw = single(raw.release);
  let targetRelease: string | null = null;
  if (!isBlank(releaseRaw)) {
    const requested = String(releaseRaw).trim();
    if (requested.length > PLAN_LIMITS.release) {
      return { error: `Release filter must be ${PLAN_LIMITS.release} characters or fewer.` };
    }
    targetRelease = requested;
  }

  const limitRaw = single(raw.limit);
  let limit = PLAN_LIST_DEFAULT_LIMIT;
  if (!isBlank(limitRaw)) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > PLAN_LIST_MAX_LIMIT) {
      return {
        error: `Limit must be a whole number between 1 and ${PLAN_LIST_MAX_LIMIT}.`,
      };
    }
    limit = parsed;
  }

  return { value: { kind, status, target_release: targetRelease, limit } };
}

/* ------------------------------------------------------------------ *
 * Outcome envelope                                                    *
 * ------------------------------------------------------------------ */

/**
 * `value` on success, `error` on failure — never both, never neither.
 *
 * Both members declare both keys (optional, `undefined`) so a caller can read
 * `parsed.value` after `if (parsed.error) return …` without a narrowing dance. This
 * matters more than usual here: `tsconfig.json` sets no `strict` and no
 * `strictNullChecks`, so union narrowing that depends on `undefined` being absent from
 * the other member would compile to something surprising.
 */
export type BuildOutcome<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

/* ------------------------------------------------------------------ *
 * Field readers                                                       *
 * ------------------------------------------------------------------ */

/** Trim, collapse `''` to `null`, and cap. `label` only shapes the error message. */
function readText(value: unknown, max: number, label: string): BuildOutcome<string | null> {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== 'string') return { error: `${label} must be text.` };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { value: null };
  if (trimmed.length > max) return { error: `${label} must be ${max} characters or fewer.` };
  return { value: trimmed };
}

/** `author_name` is a convenience copy of the profile's name, capped like the profile. */
function readName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= PLAN_LIMITS.name ? trimmed : null;
}

/**
 * Normalise the public door's `page_url`.
 *
 * It is **telemetry, not content**: it tells the studio which page generated a
 * submission. So a value that cannot be made sense of is **dropped, never rejected** —
 * refusing a collector's message because their referrer was odd would be absurd. It is
 * length-capped and stripped of control characters because it is attacker-controlled
 * text that will be rendered in the admin list.
 */
export function readPageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Control characters are stripped rather than escaped: this value is rendered in the
  // admin list and copied into a `title` attribute, and it is never meant to be multi-line.
  const trimmed = value.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (trimmed.length === 0 || trimmed.length > PLAN_LIMITS.pageUrl) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return trimmed;
}

/* ------------------------------------------------------------------ *
 * Create                                                              *
 * ------------------------------------------------------------------ */

export type IntakeDoor = 'public' | 'studio';

/** The signed-in staff member. Comes from the session, never from the body. */
export interface PlanAuthor {
  id: string;
  email: string;
  name?: string | null;
}

export interface IntakeContext {
  door: IntakeDoor;
  /** Present only on the `studio` door. */
  author?: PlanAuthor | null;
  /** Raw `page_url` as sent by the public form. Read only on the `public` door. */
  pageUrl?: unknown;
}

/** A row ready to `INSERT`, with every derived column already decided. */
export interface PlanItemInput {
  kind: PlanKind;
  title: string;
  body: string | null;
  status: PlanStatus;
  priority: PlanPriority | null;
  target_release: string | null;
  source: PlanSource;
  source_ref: string | null;
  author_id: string | null;
  author_name: string | null;
  author_email: string | null;
  page_url: string | null;
}

/**
 * Validate and coerce a create request into a row.
 *
 * The two doors are deliberately asymmetric — the anonymous one accepts strictly less:
 *
 * | | `public` | `studio` |
 * | :--- | :--- | :--- |
 * | `kind` | forced to `'suggestion'` | required, one of `STAFF_KINDS` |
 * | `source` | forced to `'public'` | forced to `'studio'` |
 * | `status` | forced to `'new'` | forced to `'new'` |
 * | `priority`, `target_release` | forced to `null` | optional |
 * | `email` | optional, validated | ignored — taken from the session |
 * | `page_url` | stored | ignored |
 */
export function buildPlanItemInput(body: unknown, ctx: IntakeContext): BuildOutcome<PlanItemInput> {
  const raw = (
    body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  ) as Record<string, unknown>;
  const isPublic = ctx.door === 'public';

  const title = readText(raw.title, PLAN_LIMITS.title, 'Title');
  if (title.error) return { error: title.error };
  if (!title.value) return { error: 'A title is required.' };

  const description = readText(raw.body, PLAN_LIMITS.body, 'Description');
  if (description.error) return { error: description.error };

  // ── kind ────────────────────────────────────────────────────────────
  // The public door does not get a say. It files a suggestion, always — which is what
  // `source = 'public'` and the `suggestion` kind together mean to the studio.
  let kind: PlanKind;
  if (isPublic) {
    kind = 'suggestion';
  } else {
    const requested = typeof raw.kind === 'string' ? raw.kind.trim().toLowerCase() : '';
    if (!isStaffKind(requested)) {
      return { error: `Kind must be one of: ${STAFF_KINDS.join(', ')}.` };
    }
    kind = requested;
  }

  // ── priority and target_release: studio-only ────────────────────────
  // A member of the public cannot triage their own request, and cannot label it for a
  // release they do not know exists.
  let priority: PlanPriority | null = null;
  let targetRelease: string | null = null;
  if (!isPublic) {
    const requestedPriority =
      typeof raw.priority === 'string' ? raw.priority.trim().toLowerCase() : '';
    if (requestedPriority) {
      if (!isPlanPriority(requestedPriority)) {
        return { error: `Priority must be one of: ${PLAN_PRIORITIES.join(', ')}.` };
      }
      priority = requestedPriority;
    }

    const release = readText(raw.target_release, PLAN_LIMITS.release, 'Release label');
    if (release.error) return { error: release.error };
    targetRelease = release.value;
  }

  // ── identity: never from the body ───────────────────────────────────
  const author = isPublic ? null : ctx.author ?? null;

  let authorEmail: string | null = null;
  if (isPublic) {
    // Optional. If it *is* supplied it must be a real address: a silently dropped typo
    // means the studio cannot follow up on the one submission that mattered, and the
    // submitter believes they left a way to be reached.
    const supplied = raw.email;
    if (supplied !== undefined && supplied !== null && String(supplied).trim() !== '') {
      const email = normalizeEmail(supplied);
      if (!email) return { error: 'That email address does not look right.' };
      authorEmail = email;
    }
  } else if (author?.email) {
    authorEmail = normalizeEmail(author.email);
  }

  return {
    value: {
      kind,
      title: title.value,
      body: description.value,
      status: 'new',
      priority,
      target_release: targetRelease,
      source: isPublic ? 'public' : 'studio',
      // Set by the seed script and by future linking work, never by a request. A caller
      // that could choose its own idempotency key could silently swallow another item's
      // insert (the partial unique index on this column).
      source_ref: null,
      author_id: isPublic ? null : author?.id ?? null,
      author_name: isPublic ? null : readName(author?.name),
      author_email: authorEmail,
      // Read from the body rather than required from the caller, so a future route cannot
      // forget to pass it and silently lose the telemetry. `ctx.pageUrl` is the fallback
      // the route supplies from the `Referer` header when the form did not send one.
      page_url: isPublic ? readPageUrl(raw.page_url ?? ctx.pageUrl) : null,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Update                                                              *
 * ------------------------------------------------------------------ */

export interface PlanItemPatch {
  title?: string;
  body?: string | null;
  kind?: StaffKind;
  status?: PlanStatus;
  priority?: PlanPriority | null;
  target_release?: string | null;
}

export interface PatchContext {
  /**
   * The row as it exists now. Only the status is needed — the transition map is keyed on
   * it — but the caller reads the whole row anyway, so widening this later costs nothing.
   */
  current: { status: PlanStatus };
}

/**
 * Validate an incoming PATCH body.
 *
 * Unknown keys are **ignored rather than rejected**, so the client can send a whole row
 * back without ceremony — the same choice `buildUserPatch` makes, for the same reason.
 *
 * Two deliberate omissions:
 *   * `source`, `source_ref` and `author_*` are not patchable. Provenance is not an
 *     editable field; if it were, an editor could launder a public submission into a
 *     staff one.
 *   * a `status` equal to the current status is dropped rather than written. The row did
 *     not change, so it must not have its `updated_at` churned by the trigger — and a
 *     patch that contains nothing else is correctly reported as empty.
 */
export function buildPlanItemPatch(body: unknown, ctx: PatchContext): BuildOutcome<PlanItemPatch> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'No fields provided.' };
  }
  const raw = body as Record<string, unknown>;
  const patch: PlanItemPatch = {};

  if ('title' in raw) {
    const title = readText(raw.title, PLAN_LIMITS.title, 'Title');
    if (title.error) return { error: title.error };
    if (!title.value) return { error: 'A title is required.' };
    patch.title = title.value;
  }

  if ('body' in raw) {
    const description = readText(raw.body, PLAN_LIMITS.body, 'Description');
    if (description.error) return { error: description.error };
    patch.body = description.value;
  }

  if ('kind' in raw) {
    const requested = typeof raw.kind === 'string' ? raw.kind.trim().toLowerCase() : '';
    if (!isStaffKind(requested)) {
      return {
        error: `Kind must be one of: ${STAFF_KINDS.join(', ')}. 'suggestion' records how an item arrived and cannot be set.`,
      };
    }
    patch.kind = requested;
  }

  if ('status' in raw) {
    const requested = typeof raw.status === 'string' ? raw.status.trim().toLowerCase() : '';
    if (!isPlanStatus(requested)) {
      return { error: `Status must be one of: ${PLAN_STATUSES.join(', ')}.` };
    }
    if (requested !== ctx.current.status) {
      if (!canTransitionStatus(ctx.current.status, requested)) {
        const allowed = nextStatuses(ctx.current.status);
        return {
          error:
            `Cannot move from ${STATUS_LABELS[ctx.current.status]} to ${STATUS_LABELS[requested]}. ` +
            (allowed.length > 0
              ? `Allowed from here: ${allowed.map((s) => STATUS_LABELS[s]).join(', ')}.`
              : 'This item is at a terminal status.'),
        };
      }
      patch.status = requested;
    }
  }

  if ('priority' in raw) {
    const requested = typeof raw.priority === 'string' ? raw.priority.trim().toLowerCase() : '';
    if (!requested || raw.priority === null) {
      patch.priority = null;
    } else if (!isPlanPriority(requested)) {
      return { error: `Priority must be one of: ${PLAN_PRIORITIES.join(', ')}.` };
    } else {
      patch.priority = requested;
    }
  }

  if ('target_release' in raw) {
    const release = readText(raw.target_release, PLAN_LIMITS.release, 'Release label');
    if (release.error) return { error: release.error };
    patch.target_release = release.value;
  }

  if (Object.keys(patch).length === 0) {
    return { error: 'No updatable fields provided.' };
  }

  return { value: patch };
}

/**
 * The column each patchable key writes to. A hard-coded map rather than a name
 * transformation, because the route interpolates these strings into the `SET` clause and
 * a column name derived from request input is how injection gets in.
 */
export const PATCH_COLUMNS: Record<keyof PlanItemPatch, string> = {
  title: 'title',
  body: 'body',
  kind: 'kind',
  status: 'status',
  priority: 'priority',
  target_release: 'target_release',
};

/* ------------------------------------------------------------------ *
 * Releases (v3.2.0 — Group)                                          *
 * ------------------------------------------------------------------ */

/**
 * Read a `YYYY-MM-DD` date.
 *
 * The regex is not enough on its own — it accepts `2026-02-31`, and so does Postgres on some
 * `DateStyle` settings. Round-tripping through `Date` and comparing the formatted result back
 * is what actually rejects a day that does not exist.
 */
function readDate(value: unknown, label: string): BuildOutcome<string | null> {
  if (value === undefined || value === null || String(value).trim() === '') return { value: null };
  if (typeof value !== 'string') return { error: `${label} must be a date.` };
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { error: `${label} must be YYYY-MM-DD.` };
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    return { error: `${label} is not a real date.` };
  }
  return { value: trimmed };
}

/** A `plan_releases` row ready to INSERT. */
export interface PlanReleaseInput {
  version: string;
  title: string | null;
  status: ReleaseStatus;
  target_date: string | null;
  notes: string | null;
  shipped_at: string | null;
}

/**
 * Validate a create request for a release.
 *
 * `version` is required: it is the join key to the derived release history, so a release
 * without one cannot be cross-linked and would be invisible to the one view that joins them.
 */
export function buildPlanReleaseInput(
  body: unknown,
  ctx: { now?: string } = {},
): BuildOutcome<PlanReleaseInput> {
  const raw = (
    body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  ) as Record<string, unknown>;

  const version = readText(raw.version, PLAN_LIMITS.release, 'Version');
  if (version.error) return { error: version.error };
  if (!version.value) return { error: 'A version is required.' };

  const title = readText(raw.title, PLAN_LIMITS.title, 'Title');
  if (title.error) return { error: title.error };

  const notes = readText(raw.notes, PLAN_LIMITS.notes, 'Notes');
  if (notes.error) return { error: notes.error };

  const target = readDate(raw.target_date, 'Target date');
  if (target.error) return { error: target.error };

  let status: ReleaseStatus = 'planned';
  const requested = typeof raw.status === 'string' ? raw.status.trim().toLowerCase() : '';
  if (requested) {
    if (!isReleaseStatus(requested)) {
      return { error: `Status must be one of: ${RELEASE_STATUSES.join(', ')}.` };
    }
    status = requested;
  }

  return {
    value: {
      version: version.value,
      title: title.value,
      status,
      target_date: target.value,
      notes: notes.value,
      // Derived, never accepted from the client: a caller must not be able to create a
      // release that claims a ship date it never had.
      shipped_at: isShippedStatus(status) ? ctx.now ?? new Date().toISOString() : null,
    },
  };
}

export interface PlanReleasePatch {
  version?: string;
  title?: string | null;
  status?: ReleaseStatus;
  target_date?: string | null;
  notes?: string | null;
  /** Written by the rule when the status moved. Never settable from the request body. */
  shipped_at?: string | null;
}

export interface ReleasePatchContext {
  current: { status: ReleaseStatus; shipped_at: string | null };
  /** Injectable so the derived `shipped_at` is testable offline. */
  now?: string;
}

/**
 * Validate a PATCH for a release.
 *
 * `shipped_at` is **not** a patchable field — it is derived from the status, in both
 * directions:
 *
 *   - moving *to* `shipped` records the timestamp, and keeps an existing one, so correcting
 *     a release's title does not backdate it;
 *   - moving *away* from `shipped` clears it, because a release whose status says
 *     `cancelled` while still carrying a ship date is a contradiction the studio would have
 *     to resolve by hand.
 *
 * Taking it from the body instead would let a client mark a release shipped with whatever
 * date it liked, which is the same class of bug as an item choosing its own `source`.
 */
export function buildPlanReleasePatch(
  body: unknown,
  ctx: ReleasePatchContext,
): BuildOutcome<PlanReleasePatch> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'No fields provided.' };
  }
  const raw = body as Record<string, unknown>;
  const patch: PlanReleasePatch = {};

  if ('version' in raw) {
    const version = readText(raw.version, PLAN_LIMITS.release, 'Version');
    if (version.error) return { error: version.error };
    if (!version.value) return { error: 'A version is required.' };
    patch.version = version.value;
  }

  if ('title' in raw) {
    const title = readText(raw.title, PLAN_LIMITS.title, 'Title');
    if (title.error) return { error: title.error };
    patch.title = title.value;
  }

  if ('notes' in raw) {
    const notes = readText(raw.notes, PLAN_LIMITS.notes, 'Notes');
    if (notes.error) return { error: notes.error };
    patch.notes = notes.value;
  }

  if ('target_date' in raw) {
    const target = readDate(raw.target_date, 'Target date');
    if (target.error) return { error: target.error };
    patch.target_date = target.value;
  }

  if ('status' in raw) {
    const requested = typeof raw.status === 'string' ? raw.status.trim().toLowerCase() : '';
    if (!isReleaseStatus(requested)) {
      return { error: `Status must be one of: ${RELEASE_STATUSES.join(', ')}.` };
    }
    if (requested !== ctx.current.status) {
      patch.status = requested;
      if (isShippedStatus(requested)) {
        patch.shipped_at = ctx.current.shipped_at ?? ctx.now ?? new Date().toISOString();
      } else if (ctx.current.shipped_at) {
        patch.shipped_at = null;
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return { error: 'No updatable fields provided.' };
  }

  return { value: patch };
}

/**
 * The column each patchable release key writes to — a hard-coded map, for the same reason as
 * `PATCH_COLUMNS`: the route interpolates these strings into the `SET` clause.
 */
export const RELEASE_PATCH_COLUMNS: Record<keyof PlanReleasePatch, string> = {
  version: 'version',
  title: 'title',
  status: 'status',
  target_date: 'target_date',
  notes: 'notes',
  shipped_at: 'shipped_at',
};
