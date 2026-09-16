/**
 * The studio feedback & planning board — the API for capability C1 (history), C2 (capture),
 * C4 (triage) and C5 (status) of `plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md`.
 *
 * SIX ENDPOINTS, TWO DOORS, AND WHY THE GUARDS ARE NOT UNIFORM:
 *
 *   GET    /api/plan/history        requireAuth                  the derived release history
 *   POST   /api/plan/feedback       public + honeypot + limit    the anonymous door
 *   POST   /api/plan/items          requireAuth + per-user limit  the staff door
 *   GET    /api/plan/items          requireAuth + editor
 *   PATCH  /api/plan/items/:id      requireAuth + editor
 *   DELETE /api/plan/items/:id      requireAuth + editor
 *
 * `planRouter.use(...)` is therefore deliberately **absent**: a router-wide guard would
 * either close the public door or open the board, and §3.4 requires them to differ. The
 * nav items in `src/components/admin/AdminNav.ts` carry `minRole` values that mirror
 * these guards exactly — `AGENTS.md` §8 makes that a rule, not a preference, and
 * `src/test/adminNavGuard.test.ts` asserts it.
 *
 * Every decision lives in `server/lib/planRules.ts`; this file owns the SQL and the HTTP.
 */

import { Router } from "express";
import { query } from "../../src/server/db";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  buildListFilters,
  buildPlanItemInput,
  buildPlanItemPatch,
  isUuid,
  PATCH_COLUMNS,
  PLAN_STATUSES,
  type PlanItemInput,
  type PlanStatus,
} from "../lib/planRules";
import { PUBLIC_WRITE_LIMITS, clientIp, honeypotGate, rateLimit } from "../lib/requestGuards";
import { RELEASE_LOG } from "../../src/data/releaseLog.generated";

export const planRouter = Router();

/**
 * The columns every read and write returns.
 *
 * A hard-coded constant, interpolated into the SQL strings below. Nothing derived from a
 * request ever reaches a SQL string in this file — the one place that builds a statement
 * dynamically is the PATCH, and it iterates the hard-coded `PATCH_COLUMNS` map.
 */
const ITEM_COLUMNS = `id, kind, title, body, status, priority, target_release,
       source, source_ref, author_id, author_name, author_email, page_url,
       created_at, updated_at`;

/* ------------------------------------------------------------------ *
 * C1 — the release history                                            *
 * ------------------------------------------------------------------ */

/**
 * The generated projection of `CHANGELOG.md` + `DEPLOYMENT_LOG.md`.
 *
 * ⚠️ Imported, not read from disk. `api/index.js` is a single esbuild bundle and nothing
 * else in `server/` touches the filesystem; an `fs` read would work locally and be a
 * packaging risk in the serverless function, and it would put an untestable I/O call in
 * the middle of the request. The artifact is checked in, so the cost is that
 * `npx tsx scripts/generate-release-log.ts` must run when either document changes —
 * which `src/test/releaseLogSync.test.ts` enforces at merge time.
 *
 * `requireAuth` and no role check: the history is static, already public in the git
 * history and the deployed site's own release notes, and §3.4 gives the Changelog nav
 * item no `minRole`. A `viewer` must be able to read it.
 */
planRouter.get("/history", requireAuth, (_req, res) => {
  return res.json({ success: true, log: RELEASE_LOG });
});

/* ------------------------------------------------------------------ *
 * C2 — the anonymous door                                             *
 * ------------------------------------------------------------------ */

/**
 * Public feedback. No session, no account, no email sent.
 *
 * The honeypot runs first because it is free, then the rate limit, then validation. A
 * tripped honeypot answers **201 with a plausible success** rather than an error: a bot
 * told "rejected" learns which field to leave alone. See `server/lib/requestGuards.ts`.
 *
 * The response is deliberately bare. It does not echo the row, the id or the email —
 * an anonymous submitter gains nothing from them, and a public endpoint that returns a
 * created record is a public endpoint that can be probed for other people's records.
 */
planRouter.post(
  "/feedback",
  honeypotGate(),
  rateLimit({ rule: PUBLIC_WRITE_LIMITS.feedback }),
  async (req, res) => {
    const body = req.body || {};
    const parsed = buildPlanItemInput(body, {
      door: "public",
      // The form sends the page it was opened from; the header is the fallback for a client
      // that did not. Both are telemetry, and `readPageUrl` drops anything that is not an
      // http(s) URL rather than failing the submission.
      pageUrl: req.get("referer"),
    });
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    try {
      await insertItem(parsed.value);
      return res.status(201).json({ success: true });
    } catch (err: any) {
      console.error("[plan] public feedback insert failed:", err?.message ?? err);
      return res.status(500).json({ error: "Could not record that feedback. Please try again." });
    }
  }
);

/* ------------------------------------------------------------------ *
 * C2/C4/C5 — the staff door and the board                             *
 * ------------------------------------------------------------------ */

/**
 * Create an item as studio staff. Any signed-in role may knock — §3.4 is explicit that a
 * `viewer` can file but cannot read the board.
 *
 * ⚠️ `source` and `author_id` come from `req.cmsUser`, never from `req.body`. A caller
 * that posts `{"source":"studio"}` on the public door still gets `'public'`.
 */
planRouter.post(
  "/items",
  requireAuth,
  // Keyed by account, not address: a studio on one office IP must not be throttled as a
  // single caller, and the guard is about a runaway client, not about abuse.
  rateLimit({
    rule: PUBLIC_WRITE_LIMITS.planItems,
    keyFor: (req) => req.cmsUser?.id ?? clientIp(req),
  }),
  async (req, res) => {
    const parsed = buildPlanItemInput(req.body, {
      door: "studio",
      author: {
        id: req.cmsUser!.id,
        email: req.cmsUser!.email,
        name: req.cmsUser!.name,
      },
    });
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    try {
      const item = await insertItem(parsed.value);
      return res.status(201).json({ success: true, item });
    } catch (err: any) {
      console.error("[plan] staff item insert failed:", err?.message ?? err);
      return res.status(500).json({ error: err.message || "Failed to create the item." });
    }
  }
);

/**
 * The board.
 *
 * The response carries three things rather than one, because all three come from the same
 * page load and a second endpoint would be a seventh route to mount, smoke-test and guard:
 *
 *   * `items`    — the filtered list;
 *   * `releases` — `SELECT DISTINCT target_release`, the autocomplete's source;
 *   * `summary`  — status/source counts, which the dashboard card needs ("open items",
 *                  "awaiting triage") and the board header shows for free.
 */
planRouter.get("/items", requireAuth, requireRole("editor"), async (req, res) => {
  const filters = buildListFilters(req.query);
  if (filters.error) {
    return res.status(400).json({ error: filters.error });
  }
  const { kind, status, target_release: release, limit } = filters.value;

  try {
    const items = await query(
      `SELECT ${ITEM_COLUMNS}
         FROM public.plan_items
        WHERE ($1::text IS NULL OR kind = $1)
          AND ($2::text IS NULL OR status = $2)
          AND ($3::text IS NULL OR target_release = $3)
        ORDER BY created_at DESC
        LIMIT $4`,
      [kind, status, release, limit]
    );

    const releases = await query<{ target_release: string }>(
      `SELECT DISTINCT target_release
         FROM public.plan_items
        WHERE target_release IS NOT NULL
        ORDER BY target_release`
    );

    const counts = await query<{ status: string; source: string; count: number }>(
      `SELECT status, source, count(*)::int AS count
         FROM public.plan_items
        GROUP BY status, source`
    );

    return res.json({
      success: true,
      items: items.rows,
      releases: releases.rows.map((row) => row.target_release),
      summary: summarise(counts.rows),
    });
  } catch (err: any) {
    console.error("[plan] board query failed:", err?.message ?? err);
    return res.status(500).json({ error: err.message || "Failed to load the board." });
  }
});

/**
 * Triage an item.
 *
 * The row is read first so `buildPlanItemPatch` can judge the status change against the
 * *current* status — a transition rule needs both ends, and re-reading inside the UPDATE
 * would race. The read is also what turns an unknown id into a 404 instead of a silent
 * zero-row success.
 */
planRouter.patch("/items/:id", requireAuth, requireRole("editor"), async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return res.status(400).json({ error: "That is not a valid item id." });
  }

  try {
    const existing = await query<{ status: PlanStatus }>(
      `SELECT status FROM public.plan_items WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Item not found." });
    }

    const parsed = buildPlanItemPatch(req.body, {
      current: { status: existing.rows[0].status },
    });
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }
    const patch = parsed.value;

    // The SET clause is assembled from `PATCH_COLUMNS`, a hard-coded map of patchable key
    // → column name. Request data supplies only *values* (as bound parameters); a column
    // name derived from request input is how injection gets in.
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, column] of Object.entries(PATCH_COLUMNS)) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        params.push((patch as Record<string, unknown>)[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }
    // `buildPlanItemPatch` refuses an empty patch, so `sets` is never empty here.
    params.push(id);

    const updated = await query(
      `UPDATE public.plan_items
          SET ${sets.join(", ")}
        WHERE id = $${params.length}
        RETURNING ${ITEM_COLUMNS}`,
      params
    );

    // `updated_at` is not in the SET clause: `trg_plan_items_touch` maintains it, so the
    // timestamp cannot be forgotten by a future caller and cannot be forged by a client.
    return res.json({ success: true, item: updated.rows[0] });
  } catch (err: any) {
    console.error("[plan] update failed:", err?.message ?? err);
    return res.status(400).json({ error: err.message || "Failed to update the item." });
  }
});

/**
 * Remove an item.
 *
 * A real delete, not a soft one. The board is a working list, and a board that accumulates
 * invisible tombstones is a board whose counts lie. The v3.2.0 review workflow, if it needs
 * history, gets an audit trail rather than a `deleted_at` column bolted on here.
 */
planRouter.delete("/items/:id", requireAuth, requireRole("editor"), async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return res.status(400).json({ error: "That is not a valid item id." });
  }

  try {
    const deleted = await query<{ id: string }>(
      `DELETE FROM public.plan_items WHERE id = $1 RETURNING id`,
      [id]
    );
    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: "Item not found." });
    }
    return res.json({ success: true, deleted: deleted.rows[0].id });
  } catch (err: any) {
    console.error("[plan] delete failed:", err?.message ?? err);
    return res.status(500).json({ error: err.message || "Failed to delete the item." });
  }
});

/* ------------------------------------------------------------------ *
 * Helpers                                                             *
 * ------------------------------------------------------------------ */

/** One INSERT, used by both doors so their column lists cannot drift apart. */
async function insertItem(item: PlanItemInput) {
  const result = await query(
    `INSERT INTO public.plan_items (
       kind, title, body, status, priority, target_release,
       source, source_ref, author_id, author_name, author_email, page_url
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${ITEM_COLUMNS}`,
    [
      item.kind,
      item.title,
      item.body,
      item.status,
      item.priority,
      item.target_release,
      item.source,
      item.source_ref,
      item.author_id,
      item.author_name,
      item.author_email,
      item.page_url,
    ]
  );
  return result.rows[0];
}

export interface PlanBoardSummary {
  total: number;
  /** Not `done` and not `declined` — what the studio still has to think about. */
  open: number;
  /** Public submissions nobody has looked at yet. This is the dashboard badge. */
  awaitingTriage: number;
  byStatus: Record<PlanStatus, number>;
}

/**
 * Fold the grouped count rows into the shape the UI wants.
 *
 * `byStatus` is seeded with every status so a zero is a zero rather than a missing key —
 * a chart that silently omits an empty series is a chart that lies about the backlog.
 */
function summarise(rows: { status: string; source: string; count: number }[]): PlanBoardSummary {
  const byStatus = Object.fromEntries(PLAN_STATUSES.map((status) => [status, 0])) as Record<
    PlanStatus,
    number
  >;
  let total = 0;
  let open = 0;
  let awaitingTriage = 0;

  for (const row of rows) {
    const count = Number(row.count) || 0;
    total += count;
    if (Object.prototype.hasOwnProperty.call(byStatus, row.status)) {
      byStatus[row.status as PlanStatus] += count;
    }
    if (row.status !== "done" && row.status !== "declined") open += count;
    if (row.source === "public" && row.status === "new") awaitingTriage += count;
  }

  return { total, open, awaitingTriage, byStatus };
}
