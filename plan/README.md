# `/plan` — Specification Index

Status of every planning document in this directory. **Read `../AGENTS.md` first** — it holds the
verified current state; these documents are historical specs and design records.

| Document | Status | Covers | Superseded by / notes |
| :--- | :--- | :--- | :--- |
| [`PRD_V2.1_CLOUDINARY_EXIT.md`](./PRD_V2.1_CLOUDINARY_EXIT.md) | ✅ **Implemented** | Cloudinary → Supabase Storage migration (stages v2.1–v2.4) | Delivered across `5b6a857`, `7be31a5`, `406def2` |
| [`PRD_V2.9_CLEANUP_AND_OPTIMIZATION.md`](./PRD_V2.9_CLEANUP_AND_OPTIMIZATION.md) | ✅ **Implemented** | Cloudinary decommission, dead-code purge, RLS hardening, server modularization, bundle split | Delivered in `406def2` |
| [`DRAFT_FEATURE_PULL_REQUEST.md`](./DRAFT_FEATURE_PULL_REQUEST.md) | ⛔ **Superseded** | Early Cloudinary-era Supabase sync proposal | Architecture since modularized; see `../AGENTS.md` |
| [`PRD_V3_WAYBACK_DATA_MIGRATION.md`](./PRD_V3_WAYBACK_DATA_MIGRATION.md) | ✅ **Prerequisites satisfied** | Merge both archived predecessor sites into the Supabase catalog | Next milestone. §0 blocking prerequisites delivered in `v2.10.0` — see [ADR 0001](../docs/adr/0001-schema-as-code-before-data-migration.md) |
| [`BACKLOG_STUDIO_CMS.md`](./BACKLOG_STUDIO_CMS.md) | 📋 **Proposed** | Prioritised studio-CMS backlog for a non-technical operator (ordering, undo, spam, SEO, a11y, export, inquiry follow-up) | Written against `v2.11.0`. Every item verified against code + live schema. **Not scheduled** |

Related material outside this directory:

- [`../docs/adr/`](../docs/adr/) — Architecture Decision Records. **ADR 0001** governs the v3
  sequencing (baseline schema → read-only extract → load → feature work).
- [`../docs/runbooks/`](../docs/runbooks/) — operational procedures: the catalog backup/restore
  runbook that Phase A required, and the Supabase email-branding runbook (two-mailer model) added in
  `v2.11.0`.

---

## Reading order for a new agent

1. [`../AGENTS.md`](../AGENTS.md) — verified current state, schema, write path, guardrails.
2. [`PRD_V3_WAYBACK_DATA_MIGRATION.md`](./PRD_V3_WAYBACK_DATA_MIGRATION.md) — the work in flight.
3. This index — only dip into the historical specs when you need the *why* behind an earlier decision.

## Conventions

- Specs are **frozen at the point of implementation**. When work ships, flip the status here and add
  the commit that delivered it — do not silently rewrite history.
- Any statement in a spec that contradicts `../AGENTS.md` is **stale**; `AGENTS.md` wins.
