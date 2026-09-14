# `/plan` — Specification Index

Status of every planning document in this directory. **Read `../AGENTS.md` first** — it holds the
verified current state; these documents are historical specs and design records.

| Document | Status | Covers | Superseded by / notes |
| :--- | :--- | :--- | :--- |
| [`PRD_V2.1_CLOUDINARY_EXIT.md`](./PRD_V2.1_CLOUDINARY_EXIT.md) | ✅ **Implemented** | Cloudinary → Supabase Storage migration (stages v2.1–v2.4) | Delivered across `5b6a857`, `7be31a5`, `406def2` |
| [`PRD_V2.9_CLEANUP_AND_OPTIMIZATION.md`](./PRD_V2.9_CLEANUP_AND_OPTIMIZATION.md) | ✅ **Implemented** | Cloudinary decommission, dead-code purge, RLS hardening, server modularization, bundle split | Delivered in `406def2` |
| [`DRAFT_FEATURE_PULL_REQUEST.md`](./DRAFT_FEATURE_PULL_REQUEST.md) | ⛔ **Superseded** | Early Cloudinary-era Supabase sync proposal | Architecture since modularized; see `../AGENTS.md` |
| [`PRD_V3_WAYBACK_DATA_MIGRATION.md`](./PRD_V3_WAYBACK_DATA_MIGRATION.md) | 🔜 **Planned (v3)** | Merge both archived predecessor sites into the Supabase catalog | Next milestone |

---

## Reading order for a new agent

1. [`../AGENTS.md`](../AGENTS.md) — verified current state, schema, write path, guardrails.
2. [`PRD_V3_WAYBACK_DATA_MIGRATION.md`](./PRD_V3_WAYBACK_DATA_MIGRATION.md) — the work in flight.
3. This index — only dip into the historical specs when you need the *why* behind an earlier decision.

## Conventions

- Specs are **frozen at the point of implementation**. When work ships, flip the status here and add
  the commit that delivered it — do not silently rewrite history.
- Any statement in a spec that contradicts `../AGENTS.md` is **stale**; `AGENTS.md` wins.
