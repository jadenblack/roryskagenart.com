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
| [`ROADMAP_V3.md`](./ROADMAP_V3.md) | 🚧 **Re-baselined 2026-09-15; Part 2 executing** | The **v3.0.0 program**: six phases (pre-flight, hygiene, addressability, then ADR 0001 Phases B/C/D), the SemVer version mapping, sequencing with hard blockers, risk register (R-01…R-21) and open questions | **Start here for "what happens next."** Sequencing supersedes `PRD_V3`'s status; the two must be read together. **Re-baselined against `v2.16.0` on 2026-09-15** — the previous baseline was `v2.11.0`, six releases stale. §1.1 lists what those six releases already delivered; Q2/Q8/Q11 retired, Q14 escalated to the top risk, S1/S3/S5 slotted |
| [`PRD_V2_16_MEDIA_PIPELINE.md`](./PRD_V2_16_MEDIA_PIPELINE.md) | 🚧 **S2 shipped in v2.16.0; S1/S3/S5 deferred to v3** | **v2.16.0** media pipeline, **rescoped after the owner answered Q1–Q4**: delete the 151 `original.*` masters (now safe), give the admin upload route a real ladder, verify `Cache-Control` on the 605 existing objects, measure egress once | **Read this, not `PROMPT_V2_15_0`.** Owner decisions: assets are re-derivable copies (Q1) · v3 ingests Wayback at web quality **pre-ingest** (Q2) · **no CDN / no Cloudflare** (Q3) · 2000 px cap fine, full-res never in studio (Q4). §2 corrects a wrong diagnosis in the first draft. **Shipped:** S2 only (shared encoder + real upload ladder) — see `CHANGELOG.md` 2.16.0. **Deferred:** S1 (irreversible), S3, S5 |
| [`PROMPT_V2_15_0_STORAGE_CDN.md`](./PROMPT_V2_15_0_STORAGE_CDN.md) | ⛔ **Superseded** | Agent hand-off brief for a storage/CDN hardening release: WebP + resize re-encode, a real thumb/hero/full rendition ladder, dropping the 151 unreferenced `original.*` masters, and a CDN in front of Supabase Storage | ⚠️ **Not what `v2.15.0` shipped**, and ⚠️ **its premise is mostly wrong** — see `PRD_V2_16_MEDIA_PIPELINE.md` §2. The catalog is *already* WebP, already efficient (221 KB/MP), and already laddered where the source allows. Kept for provenance |
| [`PROMPT_V3_0_0_COMMENCEMENT.md`](./PROMPT_V3_0_0_COMMENCEMENT.md) | ▶️ **Use this to start v3** | Copy-paste brief for a **new session**: commence v3.0.0 by re-baselining `ROADMAP_V3.md` against `v2.16.0`, then executing Phase 0 / ADR 0001 Phase B | Written 2026-09-14 right after v2.16.0 shipped. Carries the verified current state, the **six stale facts** in `ROADMAP_V3.md` (§4), the owner's standing Q1–Q4 decisions, and the S1/S3/S5 items deferred from v2.16.0. Ends with a short version if you just want to get going |
| [`PROMPT_V3_ROADMAP_SESSION.md`](./PROMPT_V3_ROADMAP_SESSION.md) | ⛔ **Superseded** | Self-contained brief for the v3.0.0 roadmap session: re-baseline `ROADMAP_V3.md` **in place** and refine it | Written 2026-09-14 after PRs #14–#16 merged — now **four releases stale** (`v2.13.0`–`v2.16.0`). Superseded by `PROMPT_V3_0_0_COMMENCEMENT.md`, which carries the same task against a current baseline |
| [`PROMPT_V2_13_1_SESSION_REVIEW.md`](./PROMPT_V2_13_1_SESSION_REVIEW.md) | ⛔ **Superseded** | Verify-then-fix follow-up to v2.13.0 "backup durability" | Never run as written: the loose ends were folded into **v2.14.0** (PRs #14–#16 released together as one MINOR). Kept for provenance only |

Related material outside this directory:

- [`../docs/adr/`](../docs/adr/) — Architecture Decision Records. **ADR 0001** governs the v3
  sequencing (baseline schema → read-only extract → load → feature work).
- [`../docs/runbooks/`](../docs/runbooks/) — operational procedures: the catalog backup/restore
  runbook that Phase A required, and the Supabase email-branding runbook (two-mailer model) added in
  `v2.11.0`.

---

## Reading order for a new agent

1. [`../AGENTS.md`](../AGENTS.md) — verified current state, schema, write path, guardrails.
2. [`ROADMAP_V3.md`](./ROADMAP_V3.md) — the program: phases, sequencing, blockers, open questions.
3. [`PRD_V3_WAYBACK_DATA_MIGRATION.md`](./PRD_V3_WAYBACK_DATA_MIGRATION.md) — the migration's own spec
   (extraction steps, agent prompt, acceptance criteria).
4. This index — only dip into the historical specs when you need the *why* behind an earlier decision.

## Conventions

- Specs are **frozen at the point of implementation**. When work ships, flip the status here and add
  the commit that delivered it — do not silently rewrite history.
- Any statement in a spec that contradicts `../AGENTS.md` is **stale**; `AGENTS.md` wins.
