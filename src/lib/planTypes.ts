/**
 * Row shapes for the planning board, shared by the board and its two dialogs.
 *
 * These live in their own module rather than inside `PlanningView.tsx` for one reason: the
 * item drawer and the releases dialog both need them, and importing a type back out of a
 * component makes the two modules import each other. A component-cycle that only carries
 * types still loads fine in Vite, but it is invisible to `bundleSafety` and it turns a
 * shape change into a build-order question.
 *
 * ⚠️ THESE MIRROR `ITEM_COLUMNS` AND `RELEASE_COLUMNS` IN `server/routes/plan.ts`.
 * They are the *response* shapes, not the write shapes — the write shapes are
 * `PlanItemPatch` / `PlanReleasePatch` in `server/lib/planRules.ts`, and deliberately
 * narrower (see the note on `source_ref` there). Nothing here should gain a field the
 * server does not select.
 */

import type {
  PlanKind,
  PlanPriority,
  PlanSource,
  PlanStatus,
  ReleaseStatus,
} from './planVocabulary';

/** A `plan_items` row as `GET /api/plan/items` returns it. */
export interface PlanItemRecord {
  id: string;
  kind: PlanKind;
  title: string;
  body: string | null;
  status: PlanStatus;
  priority: PlanPriority | null;
  /** The `v3.1.0` free-text label. Kept when `v3.2.0` promoted releases to an entity. */
  target_release: string | null;
  /** The `v3.2.0` grouping key. `null` means the item is unfiled. */
  release_id: string | null;
  source: PlanSource;
  source_ref: string | null;
  author_name: string | null;
  author_email: string | null;
  page_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A `plan_releases` row.
 *
 * Every field the board's own light projection does not carry is optional, because `GET
 * /api/plan/items` returns only `id, version, title, status` — it is the same endpoint the
 * shipped `v3.1.0` board already called, so widening its projection would change a released
 * response shape. The releases dialog fetches `GET /api/plan/releases` and gets the lot.
 */
export interface PlanReleaseRecord {
  id: string;
  version: string;
  title: string | null;
  status: ReleaseStatus;
  target_date?: string | null;
  shipped_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Present only on `GET /api/plan/releases`, which counts items per release. */
  item_count?: number;
}

/** `GET /api/plan/items`. */
export interface PlanBoardSummary {
  total: number;
  open: number;
  awaitingTriage: number;
  byStatus: Record<PlanStatus, number>;
}
