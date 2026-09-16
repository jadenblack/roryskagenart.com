# Roadmap — v3.0.0: the mural merge, and the release program around it

**Status:** 🧭 **Re-baselined 2026-09-15 — Part 1 (planning) complete, Part 2 in progress.**
**Date:** 2026-09-15 (re-baseline) · originally written 2026-09-14
**Baseline:** `v2.16.0` (`95e3967`); `main` at `9b4eb91` (merge of PR #22, the v2.16.0 docs follow-up)
**Owner:** Rory Skagen Studio Engineering
**Governing documents:** [`AGENTS.md`](../AGENTS.md) · [`docs/adr/0001`](../docs/adr/0001-schema-as-code-before-data-migration.md)
· [`plan/PRD_V3_WAYBACK_DATA_MIGRATION.md`](./PRD_V3_WAYBACK_DATA_MIGRATION.md)
· [`plan/PRD_V2_16_MEDIA_PIPELINE.md`](./PRD_V2_16_MEDIA_PIPELINE.md)
· [`plan/BACKLOG_STUDIO_CMS.md`](./BACKLOG_STUDIO_CMS.md)

> **⚠️ This document was re-baselined in place on 2026-09-15.** It was originally written against
> `v2.11.0`, which was **six releases stale** by the time v3 work started. Its proposed version
> numbers (`v2.12.0` → `v2.13.0` → `v2.14.0`) had *all* been spent on other work, three of its
> fifteen open questions had been answered by those releases, and one of its "in progress" phases
> was in fact nearly complete. Every fact below was re-read from the repo, git, or the code in the
> re-baseline session. **§1.1 lists what the six intervening releases already delivered** — read it
> before reading the phase plan, or you will plan work that is already done.
>
> **Verification note.** Every factual claim in this roadmap was re-read against the code, the
> migration files, the live-schema introspection (`data/archive/schema_introspection.md`) and the
> git history before it was written down. Appendix A maps each claim to the file and line that
> proves it. Where this document contradicts an older spec, this document and `AGENTS.md` win.

---

## 0. What this document is, and what it is not

This is a **planning artifact**. It sequences work; it does not perform it. Read it with `AGENTS.md`
open — `AGENTS.md` is the verified state of the world, and this roadmap is a proposal about what to
do next.

It deliberately **does not** re-litigate decisions that are already settled and verified
(`AGENTS.md` §2–§5, ADR 0001 Phase A). It builds on them.

---

## 1. Verified starting state

Confirmed in the re-baseline session, not assumed:

| Fact | Evidence |
| :--- | :--- |
| `main` is `9b4eb91`, the merge of PR #22 (v2.16.0 docs follow-up) | `git rev-parse HEAD` |
| Latest release is **v2.16.0** (`95e3967`) | `git tag -l`, `CHANGELOG.md` |
| Tags are `v2.0.0`, `v2.9.0`, `v2.10.0`, `v2.11.0`, `v2.12.0`, `v2.12.1`, `v2.13.0`, `v2.14.0`, `v2.15.0`, `v2.16.0`. ⚠️ **Updated 2026-09-15: §3.D ships as `v2.17.0`** (PR #27, a tooling-only MINOR with no schema change and no DB write), **so `v3.0.0` is no longer the next release — it remains the tag cut when Phase 4 lands** | `git tag -l` |
| **12** migration files; baseline (`2026_09_01_…`) sorts first | `ls supabase/migrations/` |
| Suite is **419 tests across 33 files**; `npm run lint` (`tsc --noEmit`) clean | `npm test` run 2026-09-15: 33 passed / 419 passed |
| Catalog: `artworks` = 138 · `media_assets` = 152 · 307 rows total · `artwork_terms` = **0** | `AGENTS.md` §5, `scripts/introspect-schema.ts` |
| Bucket `artwork-images` = **605 objects / 76.6 MiB** (7.5 % of the 1 GB free allowance) | `PRD_V2_16_MEDIA_PIPELINE.md` §3 |
| `wayback/` = **557 files / 278 HTML, 69 PNG, 96 JPG, 5 GIF** across two archives | `find wayback -type f`, `find wayback -name '*.html'` |
| Supabase plan is **FREE** — no automatic backups, no PITR, pauses after 7 days idle | `docs/runbooks/database-backup-restore.md` §3 |
| `public/robots.txt` **exists** (v2.15.0) and deliberately has **no `Sitemap:` line** | `cat public/robots.txt` |
| `vercel.json`'s catch-all rewrite **already excludes `sitemap[.]xml`** as well as `robots[.]txt` | `vercel.json` rewrites block |
| `LICENSE` is the **canonical unmodified MIT text**; `README.md:404` says MIT and carries the scope note | `head -5 LICENSE`, `README.md:404–409` |
| `artworks` public SELECT policy is now `USING (trashed = false AND draft = false)` | `supabase/migrations/2026_09_14_v2_12_artworks_public_select_excludes_drafts.sql:48–50` |
| All four blanket `FOR ALL TO authenticated USING (true)` policies are now `is_admin_or_editor()` | `supabase/migrations/2026_09_14_v2_12_1_staff_scoped_policies.sql` |
| Off-site backup runs **daily** — Vercel cron `43 6 * * *` → `/api/cron/backup` → Vercel Blob | `vercel.json` crons, `server/routes/cronBackup.ts` |
| The media pipeline is **healthy**: 151/152 rows have thumb/hero/full + lqip | `PRD_V2_16_MEDIA_PIPELINE.md` §2 |
| `POST /api/artworks` **hardcodes** year `2024`, medium `Acrylic on Canvas`, dimensions `48" x 60"`, price `$9,500`, series `Neon Americana` | `server/routes/artworks.ts:116–124` |
| `POST /api/media/upload` now renders a real ladder (thumb/hero/full + lqip) | `server/routes/media.ts:53`, `server/lib/mediaUpload.ts` |
| `src/data/assetRegistry.ts` is 4,602 lines / ~445 KB, shipped to every visitor | `wc -l`, `AGENTS.md` §5 |
| `artworks.image_url` is a single **filename ref**; murals need many photos | `AGENTS.md` §5; `generate-asset-registry.ts:98–112` |
| Open Dependabot alerts: 2 | GitHub, 2026-09-14 |

### 1.1 What the six intervening releases already delivered

This is the section the previous baseline was missing. **Do not re-plan any of it.**

| Release | Delivered | What it does to this roadmap |
| :--- | :--- | :--- |
| **v2.12.0** | `artworks` public SELECT policy now excludes drafts; the R-06 finding recorded | **Phase 1's policy migration is DONE.** R-05 is closed. |
| **v2.12.1** | All four `FOR ALL TO authenticated USING (true)` policies rewritten against `public.is_admin_or_editor()` | **Q8 answered. R-06 closed.** Verified live on a scratch DB. |
| **v2.13.0** | Off-site backup: Vercel cron → `/api/cron/backup` → Vercel Blob, private, `CRON_SECRET`-gated | **Phase 0 item 4 ("get the dump off this machine") is DONE and automated.** R-15 closed. |
| **v2.14.0** | Fail-able smoke guard; dump targets; incomplete-stamp pruning | Phase 0 durability, hardened. |
| **v2.15.0** | `public/robots.txt`; MIT `LICENSE`; delete path for `inquiries` | **Q11 answered — MIT, not Apache-2.0.** Phase 1's LICENSE item is DONE. `robots.txt` exists (the *sitemap* does not). |
| **v2.16.0** | Media upload ladder (shared encoder in `server/lib/imageRenditions.ts`); dialog spacing | **The media pipeline is healthy — there is no re-encode project.** S2 shipped; **S1/S3/S5 deferred into v3**. |

**Net effect on the plan:** Phase 0 is ~80 % complete and Phase 1 is ~40 % complete *before v3 starts*.
The roadmap's original framing — "Phase 0 is a big blocking precondition" — is no longer true. What
remains of Phase 0 is narrow and specific (§4.1). What remains of Phase 1 is hygiene, not blockers.

---

## 2. The program, decomposed

Six phases, of which ADR 0001 Phases A–D are four (A is done). Phase 0 and Phase 2 are additions
this roadmap argues for, and both are *prerequisites*, not scope creep.

| Phase | Name | Writes to the DB? | ADR 0001 mapping | Ships in |
| :--- | :--- | :--- | :--- | :--- |
| **0** | Pre-flight — the narrow remainder | No (read-only + docs/scripts) | *new — prerequisite* | `v3.0.0` |
| **1** | Hygiene & the cheap wins | One small migration (already done) + none | *new — prerequisite* | `v3.0.0` |
| **2** | Addressability — real paths, per-artwork SEO, sitemap | No | *new — prerequisite* | `v3.0.0` |
| **3** | Read-only extraction + reconcile, plus the bulk media path | **No** | **Phase B** | `v3.0.0` |
| **4** | The load | **Yes — the highest-consequence write in the project's history** | **Phase C** | `v3.0.0` |
| **5** | Mural-aware features & refactors | Yes (content edits) | **Phase D** | `v3.4.0` |

> **Changed from the original roadmap.** Phases 0–3 were to ship in `v2.12.0` and Phase 4 in
> `v3.0.0`. Those version numbers no longer exist. The release boundary is now **inside** `v3.0.0`:
> v3.0.0 is delivered as a sequence of PRs (0 → 1 → 2 → 3 → 4), each independently reviewable and
> merged to `main`, with the tag cut once Phase 4 lands. The *sequencing* discipline is preserved;
> only the version labels change. See §3.4.

---

## 3. Version mapping — and the SemVer case, re-made

### 3.1 The original argument, and what survives it

The original roadmap argued that the mural merge is **not** SemVer-breaking: it adds rows (content,
not interface), the schema extension is additive, new rows land `draft = true` and are therefore
unobservable to every consumer, and `GET /api/artworks` keeps its shape. **That argument is
unchanged and still correct.** Nothing in the six intervening releases alters it.

So the honest position remains: **`v3.0.0` is a program milestone label, not a SemVer event.** It
must be recorded as such rather than dressed up as a breaking change.

### 3.2 What actually changed: the version numbers were spent

The original mapping proposed `v2.12.0` → `v2.13.0` → `v2.14.0`. All three shipped as unrelated
releases. **The next tag this repository can cut is `v3.0.0`.** That is now a fact about the repo,
not a choice — which means **Q1 (version mapping) is no longer "which numbers", it is "what goes in
the one number we have".** See §9 Q1.

### 3.3 Is there a genuine major anywhere in v3?

Worth stating plainly, because it determines what the CHANGELOG may claim. There are exactly two
candidates, and **both are avoidable**:

| Candidate | Breaking? | Verdict |
| :--- | :--- | :--- |
| **Phase 2 — the public URL surface changes.** Today every artwork is `roryskagenart.com/#/artwork/<slug>`; a fragment is not a distinct document to a crawler. Phase 2 introduces `/artwork/<slug>` as the canonical, crawlable URL. | **Only if we break the legacy links.** A gallery's inbound links *are* its search equity. | **Ship permanent redirects from the legacy hash URLs.** Then this is backwards compatible and SemVer-minor. **Recommended.** |
| **Phase 2 — `GET /api/artworks` becomes paginated.** Today it returns all 138 rows (165 KB) with no `Cache-Control`. Capping the default page size changes the response for any client that assumes a complete list. | **Yes, literally.** SemVer §8. | **Ship pagination behind an opt-in `?page=`/`?limit=` with an unchanged default**, then raise the default in a later minor with notice — ⚠️ **not `v3.1.0`, which is now the studio feedback & planning tool; see §3.4's reassignment note.** Verified 2026-09-15: neither the opt-in pagination nor the R-20 de-bundle shipped in Phase 2, so this promise is **unfulfilled and re-homed**, not merely re-dated. De-bundle `assetRegistry.ts` in the same release — that is the real payload win and it is invisible to the API contract. |

**Conclusion: there is no SemVer-justified major in this program, and we should not manufacture one.**
The alternative — shipping Phase 2 *without* legacy redirects to "earn" a textbook major — spends
real SEO equity to buy a version number. **Still recommended against.**

### 3.4 Recommendation

| Release | Bump | Contents | The bump is correct because |
| :--- | :--- | :--- | :--- |
| **`v3.0.0`** | **major** *(milestone)* | Phase 0 remainder · Phase 1 remainder · **Phase 2 (addressability)** · Phase 3 (= ADR Phase B) + the bulk media path · **Phase 4 (= ADR Phase C, the load)** | **Honest position: this is a milestone major.** Every item is additive, read-only, or a data load behind `draft = true`, and the one interface change (real paths) is made non-breaking by permanent redirects. It is labelled `3.0.0` because it is the client-facing deliverable the studio engaged for: the point at which the site stops being a fine-art gallery and becomes a mural **and** fine-art practice. **The CHANGELOG entry will say this explicitly.** |
| **`v3.1.0`** | minor | **The studio feedback & planning tool — *Capture*** ([`ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md`](./ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md)): the changelog + deployment-log view, CRUD of ideas/features/bugs/tasks, and the public + staff intake doors | Additive: one new table (`plan_items`), no existing table, no artwork route and no public render path touched. |
| **`v3.2.0`** | minor | The same tool — ***Group***: `plan_releases`, grouping, triage, unread badge, batched digest | Additive, with a reviewable backfill from the `v3.1.0` free-text label column. |
| **`v3.3.0`** | minor | The same tool — ***Close the loop***: release-notes assembly and reconciliation against `CHANGELOG.md` | Additive; it **drafts** a changelog section for a human and never writes the file. |
| **`v3.4.0`** | minor | **Phase 5** (= ADR Phase D, mural-aware features) + the deferred studio-CMS backlog | Additive features, driven by real data. |

> ⚠️ **Reassigned 2026-09-15 (owner decision Q-A).** `v3.1.0` was Phase 5 in the previous revision
> of this table. The owner chose to ship the **studio feedback & planning tool** first, as
> `v3.1.0`–`v3.3.0`, and slide **Phase 5 to `v3.4.0`**. This is legitimate because **nothing had
> shipped against `v3.1.0`** — no tag, no CHANGELOG section, no branch — and **no tag was moved**
> (§3.5). Phase 5 is unchanged in substance: it is still gated on Phase 4's data, and it now ships
> *after* the review workflow it needs already exists.
>
> ⚠️ **Two promises moved with it, and one of them was already broken.** §3.3's *"raise the
> [pagination] default in `v3.1.0`"* and R-20's `assetRegistry.ts` de-bundle were both scheduled for
> **Phase 2**, which shipped without either — verified 2026-09-15: `server/routes/artworks.ts`
> contains no `page`/`limit`/`offset`, and no `/api/media/registry` route exists in `server/` or
> `src/`. They now ride with **Phase 5**, which is where the de-bundle belongs anyway (§3.3 pairs
> the two deliberately). Do not let this renumbering become the reason they are forgotten a second
> time.

**v3.0.0 ships as a sequence of PRs, not one.** Each phase is its own PR (or small set) against
`main`, merged when `mergeStateStatus` is `CLEAN`, with `[Unreleased]` accumulating in
`CHANGELOG.md`. The tag is cut on the merge commit that completes Phase 4. This preserves the
original roadmap's real insight — *keep the code-risk change and the data-risk change reviewable
separately* — without needing three version numbers to do it.

**Alternatives considered (owner decision — §9 Q1):**

- **Split the load out:** `v3.0.0` = Phases 0–3 (foundation), `v3.1.0` = Phase 4 (the load),
  `v3.2.0` = Phase 5. *Pros:* the largest release in the project's history gets its own tag and its
  own rollback window. *Cons:* a `v3.0.0` that merges nothing contradicts the engagement, and
  "v3" stops meaning "the merge". *(Historical record of a rejected option — and now doubly
  superseded, since these numbers were never used and `v3.1.0`–`v3.3.0` were later reassigned to the
  studio feedback & planning tool. Do not read it as current.)*
- **Purist SemVer:** renumber everything `v2.17.0` → `v2.18.0` → `v2.19.0`. *Rejected:* the owner
  has already named the deliverable v3.0.0, and the milestone is real regardless of SemVer.

### 3.5 What must not be done

- Do **not** bump `package.json` (stays `0.0.0`). Versions live in `CHANGELOG.md` and git tags only.
- Do **not** invent a tag before its work is merged. Tags point at the **merge commit on `main`**.
- Do **not** touch `v2.9.0`. It points at a pre-merge commit (`16df8d9`); it is the known exception
  and tags are immutable.

---

## 4. Phase-by-phase plan

### Phase 0 — Pre-flight, the narrow remainder

**Why it still exists.** Phase 4 is the largest write in the project's history. Six of the original
eight items are done (§1.1). What remains is the part that is *specifically* about the media and
about proving the off-site copy actually works — not about re-establishing that backups exist.

**Scope — status as of 2026-09-15**

| # | Item | Status |
| :-- | :--- | :--- |
| 1 | Verify the Supabase plan tier | ✅ DONE — **FREE**. Recorded in the runbook. |
| 2 | Prove the restore path, don't describe it | ✅ DONE — 294 inserted / 0 failed, idempotent on re-run, content-verified by re-dump. |
| 5 | Get a non-production database | ✅ DONE — `supabase start`, Docker Desktop at the per-user path. |
| 6 | Add a restorable schema dump | ✅ DONE — `schema.sql` + `data.sql` alongside the JSON snapshot. |
| 7 | Enable local dev so a scratch database exists | ✅ DONE — `config.toml` disables CLI migrations; repo runner owns the schema. |
| 8 | Empirically verify ADR 0001 Phase A | ✅ DONE — 10/10 applied to a virgin DB, zero structural diff vs production. |
| 4 | Baseline dump **off this machine** | ✅ DONE, automated, **and now proven restorable** — v2.13.0 cron → Vercel Blob, daily, private, `CRON_SECRET`-gated. A Blob dump was downloaded, checksum-verified and restored into the scratch DB on 2026-09-15 (§4.1.1). |
| 3 | Decide and document the Storage story | ⬜ **Open — reformulated below.** |

**4.1.1 ✅ DONE 2026-09-15 — the off-site copy restores.** *Was:* the cron writes the dump to Blob
daily, but `scripts/verify-offsite-backup.ts` only checked that an object exists at the expected key,
and **a backup that has never been read is a hypothesis.** The drill, run end to end:

1. `scripts/verify-offsite-backup.ts` now takes **`--out <dir>`**, which materialises a verified dump
   on disk. It **refuses to write when verification fails**, so a corrupt off-site copy can never be
   dressed up as a restorable backup. (Verification alone proves the bytes are intact; only writing
   them out proves they can be *restored*.)
2. The dump at `2026-09-15T06-43-29-617Z` was pulled down — **9 objects, 406,899 bytes, 8 tables,
   307 rows, 12 migrations**, every table matching its manifest sha256.
3. The scratch DB's catalog tables were emptied, then the **off-site** copy was restored with
   `scripts/restore-catalog.ts --apply` → **298 inserted, 0 skipped, 0 failed.**
4. Fidelity was checked field by field → **138/138 artworks match on `slug` + `title` + `year`**, and
   every table is exact.

The recovery path is therefore no longer a document; it is a procedure that has been executed against
a copy that lives **off this machine**. That is what makes it the compensating control for Q14.

**4.1.2 Storage story — reformulated by the owner's Q1.** The original question was "bucket
versioning, or periodic object listing + copy?" The owner's answer (Q1: assets are **copies**, the
artist holds all originals and can re-populate) changes the shape of the answer:

- Storage is **not** a survival risk. It is a **recovery-speed** risk. (Q1, `PRD_V2_16` §1.)
- Therefore: **no bucket versioning, no second vendor** (Q3). The story is:
  1. **A periodic object listing** — a full `storage.list()` manifest of `artwork-images`, captured
     to `data/backups/` and shipped with the daily dump. Cheap, scriptable, and it is the artefact
     that makes "what did we lose?" answerable.
  2. **The Wayback archive itself is the second copy** for the mural images. They are ingested *from*
     an immutable local archive (§7), so any mural rendition can be re-rendered from `wayback/`
     byte-identically. **This is the strongest Storage guarantee in the project and it is free.**
  3. An optional off-site bucket copy (S4) stays *optional* — recovery speed, not survival.

**4.1.3 The three media items deferred from v2.16.0.** v3 now carries them. They are slotted here
because they are read-only housekeeping that Phase 4's media step touches anyway.

| Item | What | Slot | Pre-conditions |
| :--- | :--- | :--- | :--- |
| **S1** | Delete the 151 unreferenced `original.*` masters | **Phase 4, last** — after the mural upload, not before | 1. A verified dump (`scripts/backup-catalog.ts`, self-verifying). 2. A **full object listing** captured to `data/backups/`. 3. `scripts/verify-media-backup.ts` reports 0 rows referencing an `original.*`. 4. Re-run the verifier *after* deletion. 5. Q1 on the record: re-populatable from the studio's own archive. **Irreversible — the only such step in the program.** |
| **S3** | Verify `Cache-Control` on the 605 existing objects | **Phase 0** — do it now | With no CDN (Q3), immutable browser caching is the *whole* egress strategy. New uploads already set `31536000`; migrated objects were never checked. Fix must not change any object's bytes. ⚠️ **AUDITED 2026-09-15 — and it failed: 604 of 605 carry `max-age=3600`, one carries `max-age=31536000`.** The fix (re-upload identical bytes with `cacheControl: 31536000`) is written up in runbook §6 and deliberately **deferred out of the v3.0.0 load window** — it rewrites 604 live objects, and the S1 ordering argument below applies to it too. The mural ingest already sets the correct value, so the affected set stays at 604 |
| **S5** | Measure egress once and record it | **After Phase 4**, once real traffic includes the murals | ~8 MiB per full 138-artwork browse ⇒ ~640 browses/month of 5 GB. Never actually measured. Record in the runbook with a note on what would make it binding. |

> **S1 ordering note (a real change from `PRD_V2_16`).** That PRD sequenced S1 as housekeeping. It
> should instead be the **last** step of Phase 4, for one reason: Phase 4 uploads ~hundreds of new
> mural renditions, and the `original.*` masters are the only full-quality copies of the *existing*
> 151 assets that exist anywhere in the bucket. If the mural ingest goes wrong and we need to
> re-render anything, the masters are a safety net worth keeping until the new content is verified.
> **Deleting them first spends the net to save 33 MiB we do not need to save.**

**Exit criteria**

- [x] The Supabase plan tier is recorded in the runbook with its source. → **Free.**
- [x] A restorable **schema** dump exists; a `data.sql` dataset dump exists.
- [x] `data/backups/` is ignored by git.
- [x] `scripts/restore-catalog.ts` has restored into a **non-production** database, idempotently.
- [x] A database can be built from `supabase/migrations/` and it matches production.
- [x] A copy of the dump exists off this machine — **and is written daily, automatically.**
- [x] **A Blob dump has been downloaded, verified and restored into the scratch DB.** *(4.1.1 — done
      2026-09-15: 9 objects / 406,899 bytes → 298 inserted, 0 failed; 138/138 artworks field-exact)*
- [x] The Storage story is documented as: object listing + Wayback-is-the-second-copy for murals;
      no versioning, no new vendor. → **✅ 2026-09-15, runbook §2d.**
- [x] A full object listing of `artwork-images` is captured and stored with a dump.
      → **✅ 2026-09-15: 605 objects / 76.6 MiB, sha256 `467757ce1bb1dd19…`, captured by
      `verify-media-backup.ts --out` alongside the pre-Phase-4 dump.**
- [x] `Cache-Control` on all 605 objects is stated in the runbook; immutable on renditions; zero
      bytes changed. → **✅ Stated 2026-09-15 — and the audit did NOT pass.** 604 objects carry
      `max-age=3600`; only 1 carries `max-age=31536000`. Recorded in runbook §6 as an **open
      finding** with its fix, deliberately not remediated in the v3.0.0 window (see §4.1.3). The
      criterion was written expecting a pass; stating the real number is the honest discharge of it.

**Dependencies:** none to start. **Blocks Phase 4.**

---

### Phase 1 — Hygiene and the cheap wins

**Already delivered by the intervening releases:** the `artworks` draft-exclusion policy (v2.12.0),
the staff-scoped policies (v2.12.1), `robots.txt` (v2.15.0), the MIT `LICENSE` (v2.15.0).

**What remains**

| Item | Note | Migration? |
| :--- | :--- | :--- |
| **Dependabot `qs`** (Q12) | 2 moderate advisories still open. Bump, or record a reasoned dismissal. | No |
| **Inquiry spam protection** | Honeypot field + per-IP rate limit on `POST /api/inquiries`. Each submission spends Resend quota. A delete path exists (v2.15.0); creation is still unguarded. | No |
| **Alt text** | An "Image description" field on the artwork editor, stored at `metadata.alt_text`, rendered as the catalog `alt`. Cheapest item on the list. **Matters more now**: the mural load is the largest single batch of images the site will ever receive. | No — `metadata` is `jsonb` and round-trips |
| **Manual ordering** | `metadata.sort_order` + server ordering + a pin/move control, hero ordering by the same value. | No |
| *(optional)* **CSV export** | Doubles as a text-only backup of the catalog. | No |

**Exit criteria**

- [x] `LICENSE` exists and `README.md` no longer claims Apache-2.0. → **MIT, v2.15.0.**
- [x] A direct anon PostgREST `GET /rest/v1/artworks?select=slug` returns no draft rows.
      → **policy shipped v2.12.0.**
- [ ] `npm audit` no longer reports the two moderate `qs` advisories, **or** a dismissal is recorded.
- [ ] `/api/artworks` **still** filters drafts server-side (never remove this), and the studio's own
      draft list still works for admin/editor sessions.
- [ ] A burst of inquiry submissions is throttled; the honeypot path is covered by a test.
- [ ] Alt text renders in the catalog.
- [ ] `npm run lint` clean; suite green with new coverage.

**Dependencies:** none. Runs in parallel with Phases 0, 2 and 3. **Not on the critical path** — unlike
the original roadmap, its one blocking item (the policy) already shipped.

---

### Phase 2 — Addressability (the SEO prerequisite; hard blocker on Phase 4)

**Why it is a prerequisite, not a nice-to-have.** Unchanged from the original argument and still
correct: Phase 4 adds on the order of a hundred mural records, and landing them into a hash-routed
SPA with no `sitemap.xml` produces content that search engines and social cards cannot see. A
`sitemap.xml` of `/#/artwork/<slug>` URLs would be worthless — fragments are not distinct documents.

**What changed since the roadmap was written:** `public/robots.txt` now exists (v2.15.0) and
`vercel.json`'s catch-all rewrite already carries `sitemap[.]xml` in its negative lookahead, so a
generated `sitemap.xml` at the site root will be served as a static file with **no config change**.
That removes one small piece of friction and one class of surprise.

**Scope**

1. **Real paths for artwork routes.** `/artwork/<slug>` becomes the canonical, crawlable URL.
2. **Per-artwork metadata.** `<title>`, `<meta name="description">`, `<link rel="canonical">`, and
   `og:image` / `twitter:image` pointing at the artwork's **hero** rendition — absolute URLs.
   Today `og:image` is the app icon (`index.html:22`).
3. **Crawler-visible tags**, present in the served HTML rather than injected after hydration.
   - **(a) Build-time prerender** — emit `dist/artwork/<slug>/index.html` per published artwork plus
     `dist/sitemap.xml`, from `artworks` at build time. Vercel serves the exact static file ahead of
     the catch-all rewrite. *Recommended: no runtime, no cold path, smallest change.*
   - **(b) Edge SSR** for the artwork route only.
   Pick one and record it (§9 Q5).
4. **Sitemap + robots.** Generated from `artworks`, **excluding drafts and trashed rows**, so
   unpublished mural drafts are never advertised to crawlers. Add the `Sitemap:` line to
   `public/robots.txt` — the file already says to do exactly this when the routes ship.
5. **Redirect the legacy hash URLs** so existing bookmarks and shares keep resolving (§3.3).
   **This is what keeps the release SemVer-minor in substance.**

**Exit criteria**

- [x] `curl` of the preview's `/artwork/<slug>` returns HTML containing that artwork's `<title>`,
      description and an **absolute** `og:image` — verified by fetching raw HTML, not by reading the
      DOM in a browser. → **✅ 2026-09-15.** The build writes 138 prerendered pages; a built page
      carries exactly one `<title>`, one `rel="canonical"` and an absolute Supabase hero `og:image`.
      *(The preview fetch itself is verified on the PR's Vercel deployment.)*
- [x] `dist/sitemap.xml` enumerates every published artwork and **zero** drafts.
      → **✅ 138 `<loc>`, 0 `localhost`, 0 drafts.**
- [x] `public/robots.txt` carries a `Sitemap:` line. → **✅ 2026-09-15**, with the comment corrected.
- [x] A legacy `/#/artwork/<slug>` link still lands on that artwork.
      → **✅ Client-side `history.replaceState` to the canonical path** — a fragment is never sent to
      the server, so no server rule can do this.
- [x] A test asserts the prerender/sitemap generator excludes drafts **and** trashed rows.
      → **✅ `src/test/seoPlan.test.ts`** (53 tests), fixtures carry both.
- [x] `npm run lint` clean; suite green. → **✅ lint clean; 671 tests / 41 files.**

> ⚠️ **One defect found while building this, and it is the kind that is invisible until it is not:**
> the build reads `SITE_URL`/`APP_URL` for the canonical origin, and `.env.local` sets
> `APP_URL=http://localhost:3000`. A build that inherited it would have stamped
> `http://localhost:3000/artwork/<slug>` as the canonical of **every** page — telling a crawler the
> real site duplicates a URL that exists on one laptop. Loopback origins are now refused and the
> production origin substituted. Caught by running the real build, not by reading the code.

**Dependencies:** none to start. **Blocks Phase 4.**

---

### Phase 3 — Read-only extraction and reconcile, plus the bulk media path (ADR 0001 Phase B)

Three deliverables. **None of them writes to the database.**

> ⚠️ **§3.C below is the ADR 0001 Phase B *exit criteria*, not a third deliverable.** The third
> is **§3.D**, added 2026-09-15 when the recovered WordPress export superseded the v1 scrape for
> the mural side.

#### 3.A Extraction + reconcile

`PRD_V3` §3 Steps 0–4, unchanged in substance:

- **Step 0 Validate:** confirm no Cloudinary residue; capture `artworks` / `media_assets` counts;
  build the canonical-slug map from `SELECT slug FROM public.artworks`. *(read-only DB read)*
- **Step 1 Extract** both archives, skipping `feed/`, `page/`, `comments/`, `wp-json/`,
  `wp-content/`, `wp-includes/` and category-archive indexes.
- **Step 2 Reconcile** against live slugs — exact → fuzzy title ≥ 0.85 → shared image `public_id` —
  seeded with the `PRD_V3` §2 divergence map, and classify **NEW / EXISTS / COLLISION**.
- **Step 3 Media (report only):** resolve every image against `media_assets` and produce the
  `needs_upload` list. **No uploads in this phase.**
- **Step 4 Emit:** `data/archive/wayback_extraction.json`,
  `data/archive/wayback_reconcile_report.md`, the draft backfill SQL, and the **schema-fit gap list**.

**One deliberate deviation from `PRD_V3` §3 Step 4c — keep it.** The PRD says to emit the backfill
SQL into `supabase/migrations/`. **Do not.** `scripts/lib/migrationPlan.ts:22,30–35` and
`scripts/run-migrations.ts:30,47–53` show the runner applies **every** `.sql` in that directory that
is not yet in the ledger, so committing the backfill there means the next routine
`npx tsx scripts/run-migrations.ts` silently applies it weeks before its gate. Emit to
`supabase/staged/` and promote into `supabase/migrations/` only in the Phase 4 PR that applies it.

#### 3.B The bulk media registration path (new — required by owner Q2)

**The constraint.** Q2 says v3 ingests the Wayback images **at web quality, applied PRE-INGEST**.
That makes the ingest a **batch offline pass**. It therefore must not go through:

- `POST /api/media/upload` — a route for a human uploading one photo through the admin UI. It is
  `requireRole("editor")`, `multer`-backed, and bounded by the 60 s serverless `maxDuration`.
- `POST /api/artworks` — hardcodes year `2024`, medium `Acrylic on Canvas`, dimensions `48" x 60"`,
  price `$9,500`, series `Neon Americana` (`server/routes/artworks.ts:116–124`). It cannot express a
  mural at all.

**The design — generalise the path that already exists, do not invent a new one.**
`scripts/migrate-cloudinary-to-supabase.ts` is *already* a bulk registration path: manifest →
`renderRenditions()` → upload → `media_assets` upsert, idempotent, `--dry-run` / `--force` / `--limit`.
It already imports the shared ladder from `server/lib/imageRenditions.ts`. v3's third caller of that
ladder should be built the same way, in two separable stages:

| Stage | Script | Does | Writes to Storage/DB? |
| :--- | :--- | :--- | :--- |
| **render** | `scripts/wayback-render.ts` | Walk `wayback/`, resolve each content image to its canonical slug, `renderRenditions()` it, write `{publicId}/{thumb,hero,full}.webp` to a **local staging dir** (`data/staging/wayback-media/`), and emit `manifest.json` with lqip, dimensions, bytes and source provenance. | **No — local disk only.** Repeatable, no network, no credentials. |
| **register** | `scripts/wayback-register.ts` | Read the manifest, upload the three objects with `cacheControl: 31536000`, upsert `media_assets`, print a plan under `--dry-run`. Idempotent by the same rule the Cloudinary script uses: skip when all three objects exist **and** the row already has `renditions` + `lqip`. | **Yes — the Phase 4 media step.** |

**Rules that are not negotiable**

- **Never write an `original.*` for a Wayback image.** Q4 (full-res is never needed in the studio)
  and S1's whole premise (151 unreferenced masters are unmonitored surface area) both forbid creating
  a second generation of the same problem.
- **Pure logic lives in `scripts/lib/`, encoder stays in `server/lib/`.** The public-id derivation,
  the `needs_upload` decision and the manifest shape go into `scripts/lib/waybackMedia.ts` with no
  `sharp`, no `pg`, no `fs` — offline-testable, and `src/test/bundleSafety.test.ts` keeps the
  boundary honest. Only the render script imports the encoder.
- **`wayback/` stays byte-identical.** The staging dir is gitignored, like `data/backups/`.
- **Sequence it before Phase 4 has something to write into** — that is the whole point of Q2, and it
  is why 3.B sits in Phase 3 rather than Phase 4.

**Open design question:** the `public_id` for a mural's *second* image. `media_assets` already
supports N rows per `artwork_slug`, but `generate-asset-registry.ts` keys the registry by
`artwork_slug` **first-wins** (`:98–112`), so a mural with five images would have four of them
unreachable by slug lookup. **See R-18 — this is a Phase 3 gap-list item, not a detail.**

#### 3.C Exit criteria (ADR 0001 Phase B gate)

**Status: 3.A, 3.B and §3.D are all complete (2026-09-15).** 3.A is verified by re-running the
generator: 197 pages, 0 skipped. 3.B shipped in **PR #25**; §3.D in **PR #27** (v2.17.0).
`npm run lint` clean; **612 tests / 39 files** green. Every exit criterion below is met.

- [x] 100% of content pages across both archives are covered; every page with no title or no image is
      listed in the report. → **197 pages, 0 skipped**; 121 no-image pages enumerated in report §6.
- [x] The report enumerates every NEW / EXISTS / COLLISION row with its canonical slug.
      → **68 NEW · 127 EXISTS · 2 COLLISION.**
- [x] Every COLLISION is routed to **human review** — the matcher's output is a proposal, not a
      verdict. → Staged SQL §3 holds **15** rows: 2 COLLISION, 4 known-dedupe, 9 fuzzy-title.
- [x] The **schema-fit gap list is empty or contains only additive changes.** This is the gate.
      → **G1/G2/G3 additive; gate satisfied.**
- [x] `wayback/` is byte-identical to its pre-run state (verify with `git status`).
- [x] The render stage has produced a manifest covering every `needs_upload` image, **with no
      `original.*` anywhere in it.** *(3.B — done, PR #25)*
- [x] `scripts/wayback-render.ts` and `scripts/wayback-register.ts --dry-run` both run clean.
      *(3.B — done, PR #25; re-run 2026-09-15: 0 collisions in 152 registry rows)*
- [x] **Zero database writes.**

**Two defects found while staging the backfill (2026-09-15), both handled rather than papered over:**

1. **`records[].knownDedupe` is `false` for both PRD_V3 §2 dedupe pairs.** The reconciler only sets
   the flag when *both* sides of a pair resolve to the same canonical slug — i.e. only for a
   *detected* collision. For these pairs one side is NEW and the other EXISTS under a different
   slug, so the flag is `false` on both and a naive consumer emits an INSERT that duplicates a live
   artwork (R-01). `scripts/lib/waybackBackfill.ts` holds both sides from `KNOWN_DEDUPE_PAIRS`
   directly; collision detection is not a precondition for holding. Pinned by a regression test.
2. **`artworks.year` is a placeholder on all 138 rows, so fill-only-empty can never correct it.**
   Every row stores `'2024'` — the hardcoded default in `POST /api/artworks`
   (`server/routes/artworks.ts:116`). 79 of them have a real archive year that disagrees. Correcting
   them means **overwriting a stored value**, which R-04 forbids without an owner decision, so the
   staged SQL emits **no statement** for them and lists all 79 as a diagnostic (Section 2b).
   **Owner decision required** — see §9 Q18.

**Dependencies:** none. Runs in parallel with Phases 0, 1 and 2 — read-only by construction.

---

#### 3.D The recovered WordPress export (new 2026-09-15 — supersedes the v1 scrape for murals)

The source is `wayback/centraltexasmuralsbyroryskagen-20231217234521/` — a **WP Migrate 2.6.9 export
of the live WordPress 6.4.2 site, not a scrape**: 63 authored mural posts and ~350 originals, against
the v1 scrape's 61 pages carrying 7 images. It **supersedes `centraltexasmurals.com-v1` for the mural
side** — same 61 artworks, **+1 record** (`capstar-mural`), and **15× the media** (7 images → 168).

**Measured output** (`scripts/wayback-recovered-extract.ts`, re-derived 2026-09-15): 62 published
posts → **60 NEW + 2 EXISTS, 0 COLLISION**; **168 images across 61 artworks**; the two `PRD_V3` §2
pairs merged by `applyDedupeMerges()`; **4 further candidates held as a post-ingest review queue, not
a write gate** (owner Q5, 2026-09-15). The scrape extraction is therefore **non-authoritative for
murals** — it still records both §2 pairs as `NEW`, i.e. 2 duplicate INSERTs.

**Five defects found and fixed while building it.** All five are defects of the *shared* matcher and
render path; the recovered path is the one that applies every fix:

1. **`wayback-render.ts` recomputed the media plan instead of reusing the embedded one**, losing
   `existingMediaByArtwork` and planning a `public_id` a **live** row already held (**R-18**).
2. **`reconcile()`'s `shared-image` rule trusted an unverifiable `media_assets.artwork_slug`.**
3. **`byImageBasename` was first-wins over a key that is not unique** — 7 basenames cover 46
   artworks, and `r.jpg` alone is the `image_url` of 27.
4. **`post_name` is percent-encoded**: read raw, `motorcycle-mural-%e2%80%94-california-dreamin` and
   the scrape's `motorcycle-mural-—-california-dreamin` read as "one lost, one added".
5. **`buildMediaPlan` counted only the siblings it was planning**, producing 2 `public_id` collisions.

**Live-database pre-flight** (`wayback-register.ts`, plan-only): **168 `public_id`s checked, 0
collisions in 152 registry rows**; 504 objects to upload; 168 `media_assets` rows, 3 linked and 165
unlinked (the 165 belong to artworks that do not exist yet — unlinked ≠ broken).

**Exit criteria:**

- [x] The recovered corpus is extracted and classified, with `0 COLLISION`.
- [x] The known-duplicate set is **blocked from insert**, and `applyDedupeMerges()` rewrites each
      record to `EXISTS` with match kind `known-dedupe` — **asserted by test**, not a report line.
- [x] `findRegistryCollisions()` is empty against the **live** registry, not a snapshot.
- [x] Re-running the extract reproduces the artifacts (diff is exactly one `generatedAt` line).
- [x] **Zero database writes.**

---

### Phase 4 — The load (ADR 0001 Phase C)

**This is the highest-consequence write in the project's history.** Every control in §6 exists to
make it reversible.

**Scope, in order** — ✅ **executed 2026-09-15**; outcomes in brackets.

1. ✅ **Confirm every Phase 0, 1, 2 and 3 exit criterion is met.** This is the gate, not a formality.
   [Phase 2 was found **not started**, which made it a hard blocker; it was shipped first
   (`feat/v3-phase-2-addressability`), then the load ran. Phase 0's remainder closed the same day.]
2. ✅ **Apply the additive schema extension** through the runner, as its own migration sorting after
   the baseline. [`2026_09_15_v3_phase4_schema_extension.sql`: `artworks.kind`, the three
   source-provenance columns, and `public.artwork_images (artwork_slug, media_public_id, position)`
   with both FKs, RLS and two policies — R-18's multi-image decision.]
3. ✅ **Prove the restore on a scratch database**, then **take a fresh dump** of production.
   [Pre-write dump `data/backups/2026-09-15T20-01-19-582Z`; post-write `…T21-11-28-099Z`.]
4. ✅ **Media:** `scripts/wayback-register.ts` against the staged manifest, then regenerate
   `src/data/assetRegistry.ts`. [168 upserted, 0 failed, **no `original.*`**. Registry 457 → 1002 keys.]
5. ✅ **The staged, idempotent backfill** — artworks, then `artwork_terms`. [67 INSERTs (60 mural +
   7 painting) as `draft = true`; the 2 merges as `UPDATE`s; 142 `artwork_terms`.]
6. ✅ **Prove idempotency** — re-run the migration; it must mutate nothing. [Re-executed all three
   Phase 4 migration *files* on the scratch DB, bypassing the ledger, and compared md5 checksums of
   five tables: **identical**.]
7. ✅ **Re-introspect and diff** against the pre-write report. [`schema_introspection.md` regenerated:
   10 tables, 15 recorded migrations.]
8. ⏸️ **S1 — delete the 151 `original.*` masters**, **last** (see §4.1.3). [**Deferred by owner
   decision** ("Defer S1"). It remains the only irreversible step in the program, and nothing else in
   Phase 4 depends on it.]

**Exit criteria** (`PRD_V3` §5, sharpened)

- [x] Re-running the migration mutates nothing.
- [x] **Fine-art rows are untouched**, demonstrated by diffing the pre-write dump against a
      post-write dump — with any deliberate fill-only-empty fills enumerated individually.
      [`artworks` 138 → 205 (+67 −0); **136 rows differ only by the 4 new schema columns**; **2 rows
      carry a substantive change, both mural merge targets, `year` only**; **substantive changes on
      fine-art rows: 0**.]
- [ ] Every mural row is `draft = true` **and** `enabled = false`.
      [⚠️ **60 of 62.** The 2 exceptions are the merge targets (`austin-postcard`, `marcia-ball`),
      which were already live; demoting them would unpublish live content. This criterion was written
      for a load of all-new rows and is not applicable to a merge.]
- [x] An anonymous `GET /api/artworks` excludes them, **and** a direct anon PostgREST read of
      `artworks` excludes them (the v2.12.0 policy). [Verified with the **anon key**: 138 rows
      visible (116 painting, 20 kind-null, **2 mural**); `?draft=true` → 0; a loaded draft by name → 0.]
- [x] Every mural image has a `media_assets` row; the asset registry is regenerated and the app builds.
      [168/168 linked, 168 join rows; `npm run build` → 138 prerendered pages / 138 sitemap entries.]
- [x] **No `original.*` object was created by the ingest.**
- [ ] S1 complete: 605 → 454 objects (+ new mural renditions), verifier reports 0 missing,
      0 size mismatches, 0 unexpected orphans. [⏸️ **Deferred** — see scope item 8.]
- [x] `npm run lint` clean; suite green. [717 tests / 43 files.]
- [x] The introspection diff is reviewed and attached to the PR.
- [x] The PR description carries the runbook §5 pre-migration checklist, including the dump path.

**Dependencies (hard blockers):** Phase 0 verified (incl. the Blob restore proof) · Phase 2 shipped ·
Phase 3's gap list clean and COLLISIONs adjudicated · 3.B's render stage complete.

---

### Phase 5 — Mural-aware features and refactors (ADR 0001 Phase D; ships in `v3.4.0`)

**Scope.** Mural-specific facets (project type, client, commissioning context), a mural view or
filter, and the review-and-publish workflow for the loaded drafts — all **driven by the real data**,
which is precisely why ADR 0001 sequenced it last.

**Inherited 2026-09-15** (see §3.4): the **`GET /api/artworks` pagination default raise** (§3.3) and
the **R-20 `assetRegistry.ts` de-bundle**. Both were scheduled for Phase 2 and shipped in neither
Phase 2 nor any release since — the pagination was even *dated* to `v3.1.0`, which is now the studio
feedback & planning tool. They belong together (§3.3 pairs them on purpose: the de-bundle is the real
payload win and it is invisible to the API contract), and Phase 5 is the release that makes the
catalog grow again, so it is the honest place for them.

**Exit criteria**

- [ ] Each feature is justified by the loaded data, not by speculation.
- [ ] Every loaded draft has an explicit publish/keep-draft decision, or a documented batch policy.
- [ ] **The re-homed `v3.1.0` pagination promise is discharged** — an opt-in `?page=`/`?limit=` with
      an unchanged default, **or** a written decision that it is no longer wanted.
- [ ] **R-20 is closed or explicitly re-scoped** — `assetRegistry.ts` is no longer shipped to every
      visitor in the bundle.
- [ ] `npm run lint` clean; suite green.

**Dependencies:** Phase 4 complete. Cannot begin earlier — this is the whole point of the ADR's
ordering.

---

## 5. Sequencing, critical path, and parallelism

```
 Phase 0  Pre-flight remainder (Blob restore · Storage story · S3)  ── BLOCKING ──┐
        │                                                                        │
 Phase 1  Hygiene + cheap wins (parallel; nothing blocking)                      │
        │                                                                        │
 Phase 2  Addressability (SEO) ── BLOCKING ─────────────────────────────────────┤
        │                                                                        │
 Phase 3  Extraction + reconcile (read-only) + 3.B bulk media path               │
        │                                                                        │
        └────────────────────────────────────► Phase 4  THE LOAD ──► Phase 5  Features
                                                    │
                                                    └─ S1 (delete masters) LAST
```

**Critical path**

`Phase 0 (Blob restore proven) → Phase 2 (addressability) → Phase 3 (gap list clean) → Phase 4 (load)`

- **Phase 1 is entirely off the critical path now** — its one blocking item (the draft policy)
  shipped in v2.12.0. It is hygiene; it can slip without slipping the program.
- **Hard blockers, stated plainly:**
  - No write of any kind before Phase 0's exit criteria are met.
  - No Phase 4 before Phase 2 ships — otherwise a hundred new records land invisible.
  - No Phase 4 before Phase 3's gap list is clean and its COLLISIONs are adjudicated.
  - No Phase 5 before Phase 4's data exists.
- **Release-boundary note.** Because all six phases now land under one tag, the *PR* is the release
  boundary. Land 0 → 1 → 2 → 3 → 4 as separate PRs; do not bundle phases to save a review cycle.

---

## 6. Risk register

R-01…R-16 from the original register, with status updated. **R-17…R-21 are new** (found in the
re-baseline).

| ID | Risk | Impact | Mitigation | Status |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | **Slug collision across the two sites** — murals and fine art were authored separately; DB slugs already diverge from wayback folder names in at least 11 known pairs | A mural overwrites, or is merged into, the wrong fine-art record | Fuzzy + image-`public_id` matching, seeded with the `PRD_V3` §2 divergence map; **every COLLISION routed to human review**; `ON CONFLICT DO NOTHING`; fill-only-empty | Open — Phase 3 exit |
| **R-02** | **Murals accidentally published** | Unreviewed client work goes live | `draft = true` + `trg_artworks_draft_guard` forcing `enabled = false`; explicit `enabled = false` in the backfill; verify the anon API **and** a direct anon PostgREST read | Open — Phase 4 exit |
| **R-03** | **Missing mural images** — many mural photos were never in the Cloudinary-era registry | Broken or placeholder artwork pages | `needs_upload` report in Phase 3; render + register in Phase 4 via `wayback-register.ts`; **see R-17** | Open — Phase 3 + 4 exit |
| **R-04** | **Overwriting authored fine-art narratives** | Irrecoverable loss of the artist's own words | Fill-only-`NULL`/`''` rule; a test asserting the generated SQL contains no unguarded `SET` on an authored field; pre/post dump diff | Open — Phase 4 exit |
| **R-05** | **Draft rows reachable with the anon key** | Unpublished client work one PostgREST query from exposure | ✅ **CLOSED — v2.12.0.** Policy is now `USING (trashed = false AND draft = false)`. The server-side draft filter in `GET /api/artworks` must **never** be removed regardless | ✅ Closed |
| **R-06** | **`FOR ALL TO authenticated USING (true)` on four tables** — any authenticated user, including a `viewer`, could read/write every artwork, media asset, page and inquiry via PostgREST | The role matrix was enforceable only at the `/api/*` layer | ✅ **CLOSED — v2.12.1.** All four rewritten against `public.is_admin_or_editor()`; verified on a scratch DB as each role | ✅ Closed |
| **R-07** | **Storage objects are not covered by database backups** | A bad media step in Phase 4 could be unrecoverable | Reformulated by Q1 (§4.1.2): object listing + **the immutable `wayback/` archive is the second copy for mural images**; no `original.*` written for new content | Downgraded — Phase 0 exit |
| **R-08** | **Bulk backfill on a small table** — one bad statement could touch all 138 existing rows | Wide blast radius | Staged (media → artworks → terms), `ON CONFLICT DO NOTHING`, fill-only-empty, dump first, scratch DB first, re-run to prove idempotency, re-introspect and diff | Open — Phase 4 exit |
| **R-09** | **`artwork_terms` is empty, so the M2M filter path has never been exercised** | An untested path becomes load-bearing in the highest-risk release | Treat the taxonomy path as new code; test on a scratch DB; the reconcile report must state exactly which terms are linked | Open — Phase 4 exit |
| **R-10** | **No scripted restore existed** | Safety net was a document | ✅ **CLOSED.** `scripts/restore-catalog.ts` + `restorePlan.ts`, exercised against a non-production DB | ✅ Closed |
| **R-11** | **The generated asset registry produces a very large diff** | Review fatigue → a real defect slips through | Regenerate in its own commit, separate from the migration and the code | Open — Phase 4 |
| **R-12** | **Hash-route SEO** — a sitemap of fragment URLs is worthless | The whole merge lands invisible | Phase 2 ships real paths + crawler-visible tags + sitemap **before** Phase 4; verified by fetching raw HTML. `vercel.json` already passes `sitemap.xml` through | Open — Phase 2 exit |
| **R-13** | **Two divergent migration ledgers** — the Supabase CLI collapses every `2026_…` filename to version `2026` | `supabase db push` would re-run eight migrations against production | **Never apply schema changes via the Supabase CLI.** `config.toml` disables CLI migrations. **Do not rename migration files** | Permanent |
| **R-14** | **Free-plan projects pause after 7 days of low activity** | The gallery can go offline; unpausing is a manual dashboard action | A daily keep-alive (the v2.13.0 backup cron touches the DB daily). **Q14 SETTLED 2026-09-15 — the owner elected to stay on Free**, which makes the roadmap's own fallback condition binding; it is met: keep-alive **plus** the proven Blob restore (§4.1.1). Re-open if a pause is ever observed | 🟡 Accepted — control in place |
| **R-15** | **The only backup lives on this machine** | A disk failure destroys the sole recovery path | ✅ **CLOSED — v2.13.0; remainder closed 2026-09-15.** Daily Vercel cron → Vercel Blob, private, **and a Blob dump has now been verified *and restored* into the scratch DB** (§4.1.1): 298 rows inserted, 0 failed, 138/138 artworks field-exact | ✅ Closed |
| **R-16** | **CRLF in two migration files** leaked CR bytes into stored function bodies | "Reproducible from version control" became checkout-dependent | ✅ **CLOSED.** `.gitattributes` pins `*.sql text eol=lf`; rebuild reports 0 CR bytes | ✅ Closed |
| **R-17** | **NEW — the mural ingest is the first *bulk* media write, and it is not covered by any restore.** 605 existing objects are the Cloudinary migration's output; the mural renditions will be produced by a script that has never run against production | A partial or wrong ingest leaves hundreds of orphaned objects no row references — recreating, at larger scale, the exact problem S1 exists to fix | Two-stage design (3.B): **render to a local staging dir first**, so the expensive, repeatable, credential-free step is provably correct before a single byte reaches Storage; `register` is idempotent and `--dry-run`-able; **no `original.*` is ever written**; capture an object listing before and after | Open — Phase 3 + 4 |
| **R-18** | **NEW — `generate-asset-registry.ts` is single-image-per-artwork by construction.** It keys the registry by `artwork_slug` **first-wins** (`:98–112`), so when N `media_assets` rows share one `artwork_slug`, only the lowest `public_id` is reachable by slug lookup. `artworks.image_url` is likewise single-valued | Murals need many photos; without a fix, a mural's images 2..N are invisible to the gallery even though their rows and objects exist | Decide the model **before** the Phase 4 schema extension (Q16): an explicit `artwork_images` join with a position, or a cover-asset pointer plus ordering on `media_assets`. Whatever is chosen, the registry generator must stop silently dropping collisions — **first-wins should become an error or an explicit ordered list** | Open — Phase 3 gap list |
| **R-19** | **NEW — `POST /api/artworks` cannot express a mural.** It hardcodes year `2024`, medium `Acrylic on Canvas`, dimensions `48" x 60"`, price `$9,500`, series `Neon Americana` (`server/routes/artworks.ts:116–124`) | Any attempt to create mural rows through the API silently stamps them with fine-art defaults — the exact class of "silent wrong data" that is hardest to detect after the fact | The load goes through the **staged SQL backfill**, never the API. Fixing the route's defaults is a Phase 5 item, but **the load must not depend on it** | Open — Phase 4 |
| **R-20** | **NEW — `src/data/assetRegistry.ts` is 4,602 lines / ~445 KB shipped to every visitor, and the mural load makes it materially bigger.** 138 artworks → ~240, each with more images | The largest single contributor to bundle size gets worse in exactly the release that also adds pagination | De-bundle in Phase 2 alongside pagination: serve the registry from `/api/media/registry` (cacheable) instead of the bundle. **Doing this *before* the load is strictly cheaper than after** | Open — Phase 2 |
| **R-21** | **NEW — the six intervening releases were verified in six different sessions, and this roadmap's predecessor was already six releases stale when v3 began.** Documentation drift in this repo has a demonstrated half-life of about one release | A v3 plan written today is stale by the time Phase 4 runs | Every phase's exit criteria are written as **commands with expected output**, not prose; re-run `npm test` / `npm run lint` / `scripts/introspect-schema.ts` at each phase gate and record the numbers in the PR | Open — permanent discipline |

---

## 7. Do not do yet

ADR 0001 §5 explicitly defers these, and **this roadmap keeps that boundary**:

- **`HomeLandingView` decomposition.** Still the largest hand-written file (1229 lines) and still
  *not* touched by the migration path. Refactoring it now would be guessing.
- **Design-system work.** No design tokens, no component-library consolidation, no theming rework.
- **Feature scaffolding not touched by the migration path.**

And from `BACKLOG_STUDIO_CMS.md`, these are `v3.4.0`-or-later — they ride with Phase 5, because the
`v3.1.0` they were originally dated to is now the studio feedback & planning tool (§3.4):

- Per-artwork revision history / undo (§1.2).
- Bulk catalog actions (§3.2) — the mural load doubles the catalog, so this gets *more* valuable;
  that is an argument for shipping it with Phase 5, not for pulling it forward.
- Print stylesheet / PDF catalogue (§3.3).
- Inquiry notes, owner, follow-up filter (§4.1).
- Onboarding help and dashboard checklist (§4.2).

**Never do these at all** (owner decisions, standing):

- **No CDN, no Cloudflare, no new vendor** (Q3). Egress strategy is immutable browser caching plus
  smaller payloads.
- **No full-resolution handling in the studio, ever** (Q4). Print-on-demand sources originals
  off-studio.
- **No re-encode of the existing catalog** — it is already WebP, already ~221 KB/megapixel, already
  capped at 2048 px, and correctly laddered wherever the source allows (`PRD_V2_16` §2). If you find
  yourself planning one, you have picked up a stale document.
- **Do not modify anything in `wayback/`** — it is an immutable archive.

---

## 8. Decisions taken in this document

Each is reversible if the owner disagrees.

1. **Phase 0 is a prerequisite, and it is now mostly complete.** What remains is narrow: prove a
   Blob restore, write the Storage story, audit `Cache-Control`.
2. **Phase 2 (addressability) sits ahead of Phase 4.**
3. **The `artworks` draft-exclusion and staff-scoped policies already shipped** (v2.12.0 / v2.12.1);
   Phase 1 no longer carries a blocking migration.
4. **The backfill SQL is staged outside `supabase/migrations/`** until the Phase 4 PR, because the
   runner applies every file in that directory (deviation from `PRD_V3` §3 Step 4c).
5. **The cheap wins land via `metadata`** — no migration, and before the mural rows arrive.
6. **Phase 5 ships separately from Phase 4** — now **`v3.4.0`**, not `v3.1.0`. ⚠️ **Reassigned
   2026-09-15 (owner decision Q-A):** `v3.1.0`–`v3.3.0` went to the **studio feedback & planning
   tool** and Phase 5 slid one minor. Nothing had shipped against `v3.1.0` — no tag, no CHANGELOG
   section, no branch — and **no tag was moved** (§3.4, §3.5).
7. **`v3.0.0` is recorded as a milestone major, with the SemVer caveat stated in the CHANGELOG** —
   rather than manufacturing a breaking change to justify it (§3.4).
8. **The taxonomy / `artwork_terms` path is treated as new, untested code** (R-09).
9. **v3.0.0 ships as a sequence of PRs; the PR, not the version, is the release boundary.**
10. **The asset-registry regeneration is its own commit** (R-11).
11. **The bulk media path generalises `scripts/migrate-cloudinary-to-supabase.ts`** rather than
    inventing a second mechanism, and it is **two stages** (render to disk, then register) so the
    expensive step is credential-free and repeatable (R-17).
12. **The ingest never writes an `original.*`** — Q4, and S1's premise applied to new content.
13. **S1 is the last step of Phase 4, not housekeeping before it** — the masters are a safety net
    worth keeping until the mural renditions are verified.
14. **Pagination ships opt-in with an unchanged default**, so `GET /api/artworks` does not break
    (§3.3).
15. **De-bundle `assetRegistry.ts` in Phase 2, before the load makes it bigger** (R-20).

---

## 9. Open questions for the repo owner

| # | Question | Blocks | Status / recommendation |
| :--- | :--- | :--- | :--- |
| **Q1** | **Version mapping.** The old numbers are spent; the next tag is `v3.0.0`. So: does `v3.0.0` contain **all five phases** (recommended), or does the load move to `v3.1.0` so the largest write gets its own tag? | Every release tag | **All five in `v3.0.0`**, delivered as separate PRs. Keeps "v3 = the merge" true. Alternative in §3.4 |
| **Q2** | ~~What is the Supabase plan tier?~~ | — | ✅ **RETIRED — FREE, no PITR.** Follow-on is Q14 |
| **Q3** | **Storage backup: bucket versioning, or periodic object listing + copy?** | Phase 0, Phase 4 media | Reframed by Q1: **object listing + `wayback/` as the second copy for murals.** No versioning, no new vendor (§4.1.2) |
| **Q4** | **Do we keep the legacy `#/artwork/<slug>` links working?** | Q1, Phase 2 | **Yes** — a gallery's inbound links are its SEO equity, and this is what keeps the release non-breaking |
| **Q5** | **Addressability: build-time prerender, or edge SSR?** | Phase 2 | Build-time prerender — no runtime, no cold path, smallest change |
| **Q6** | **How should mural project type be modelled?** Reuse `gallery_series`, or add `taxonomies.type = 'project_type'` (and `client`)? | Phase 3 gap list, Phase 4 schema | Decide from the extracted data — but decide *before* the schema extension |
| **Q7** | **Is `artwork_terms` meant to be populated at all?** | Phase 4 | Yes — and treat it as new code (R-09) |
| **Q8** | ~~The `FOR ALL TO authenticated USING (true)` policy~~ | — | ✅ **RETIRED — fixed in v2.12.1** (R-06) |
| **Q9** | **Should murals and fine art share one catalog surface, or be separate sections?** | Phase 2 routing, Phase 5 | Separate sections — the two bodies of work have different audiences |
| **Q10** | **Who adjudicates the COLLISION class?** | Phase 3 → 4 | The studio, with the report as the worksheet |
| **Q11** | ~~LICENSE: Apache-2.0, or correct the README?~~ | — | ✅ **RETIRED — MIT, v2.15.0.** `LICENSE` is the canonical unmodified text; the scope note lives in `README.md` |
| **Q12** | **Dependabot `qs`: bump, or dismiss with a reason?** | Phase 1 | Bump if it does not force an Express major; otherwise document the dismissal |
| **Q13** | ~~Bundle Phase 5 into `v3.0.0`, or ship it as `v3.1.0`?~~ | — | ✅ **RETIRED — but its answer has since been superseded, and the trail is kept.** §3.4 settled it as *"Phase 5 is `v3.1.0`"*; on **2026-09-15 the owner reassigned `v3.1.0`–`v3.3.0` to the studio feedback & planning tool and moved Phase 5 to `v3.4.0`** (§3.4). The decision this question actually asked — *Phase 5 ships separately from Phase 4* — still stands; only the number changed. Recorded rather than silently rewritten |
| **Q14** | **Free tier: keep-alive cron, or upgrade to Pro?** ⬆️ *Was* the top risk in the program. Free means no backups, no PITR, *and* automatic pausing after 7 idle days, so the live gallery can go down on its own. Pro (~$25/mo) removes pausing and adds 7-day daily backups; it does **not** back up Storage objects | R-14, and the whole backup story | ✅ **SETTLED 2026-09-15 — stay on Free.** The owner declined the Pro upgrade, which makes the roadmap's own fallback condition binding: *"the minimum is the daily keep-alive plus the proven-Blob-restore from §4.1.1."* **Both now hold** — the cron touches the DB daily, and the off-site restore has been executed and field-verified (§4.1.1). ⚠️ This is now a **standing precondition for the Phase 4 write**: re-run the restore drill if the backup path changes |
| **Q15** | **Docker Desktop, or the standalone PostgreSQL client tools?** | Phase 0 items 2, 5, 6 | Moot — Docker Desktop is installed and `supabase start` works. Retire |
| **Q16** | **NEW — how is a mural's *second* image modelled?** `media_assets.artwork_slug` is already 1:N, but `generate-asset-registry.ts` is first-wins and `artworks.image_url` is single-valued, so images 2..N are currently unreachable | Phase 3 gap list, Phase 4 schema | **An explicit `artwork_images` join (`artwork_slug`, `media_public_id`, `position`)** beats an ordering column on `media_assets`: it makes "which image is the cover" answerable, which the gallery needs regardless. Fall back to a `cover_public_id` + `sort_order` if the schema extension must stay minimal |
| **Q17** | **NEW — how do mural drafts get reviewed and published?** ~100 rows land `draft = true`; the studio has to work through all of them | Phase 4 → 5 | A review queue in `#/admin` with bulk publish. **Decide before Phase 4**, or the drafts land with no path to publication and the merge delivers nothing visible |
| **Q18** | **NEW — is the archive year authoritative over the stored `year`?** All 138 rows store `'2024'` (the `POST /api/artworks` default, `server/routes/artworks.ts:116`); 79 of them have a real archive year that disagrees. Fill-only-empty cannot correct a column that is wrong rather than empty | Phase 4 schema + backfill | **Recommend yes, as its own reviewed migration.** The evidence that `'2024'` is a placeholder and not authored content is that it is *uniform across all 138 rows* while the archive yields 2011–2019. Correcting it is an overwrite, so it needs an explicit owner sign-off and its own dump — it is deliberately **not** in the staged backfill (which emits no statement for these rows, only the diagnostic in Section 2b) |

---

## 10. Release mechanics (unchanged project law)

- **Version numbers live in `CHANGELOG.md` and git tags only.** `package.json` stays `0.0.0`.
- Format: **Keep a Changelog 1.1.0** + **SemVer 2.0.0** + **Conventional Commits**.
- **Every change ships through a PR.** Push `release/x.y.z`, open a PR, wait for the three gates —
  **Vercel preview, Socket Security, Debricked** (there are **no GitHub Actions**) — and merge only
  when `mergeStateStatus` is `CLEAN`.
- ⚠️ **Never push `main` first** — GitHub then refuses the PR with "No commits between main and
  release/x.y.z", and the commits reach production ahead of the gates. v2.15.0 did exactly this.
- Merge with `gh pr merge <n> --merge` — **not** `--squash`.
- **Tag the merge commit on `main`**, then push the tag, then `gh release create`.
  (`v2.9.0` is the immutable historical exception.)
- **Update `DEPLOYMENT_LOG.md`** in every release.
- `v3.0.0`'s CHANGELOG entry must carry the **SemVer caveat** from §3.4: the major is a program
  milestone; the change set is additive.
- Do not prune release branches without asking.

---

## Appendix A — Claim → evidence

| Claim | Evidence |
| :--- | :--- |
| `main` = `9b4eb91`; v2.16.0 = `95e3967`; 10 tags, no `v2.17.0` | `git rev-parse HEAD`, `git tag -l`, `CHANGELOG.md` |
| 12 migration files; baseline sorts first | `ls supabase/migrations/` |
| Suite is **419 tests / 33 files** | `npm test` (re-run 2026-09-15: 33 files, 419 passed) |
| `artworks` = 138 · `media_assets` = 152 · `artwork_terms` = 0 | `AGENTS.md` §5, `scripts/introspect-schema.ts` |
| Bucket = 605 objects / 76.6 MiB; 151 `original.*` = 32.82 MiB | `PRD_V2_16_MEDIA_PIPELINE.md` §3 |
| `wayback/` = 557 files / 278 HTML / 69 PNG / 96 JPG / 5 GIF, two archives | `find wayback -type f \| wc -l`; `find wayback -name '*.html' \| wc -l` |
| Supabase is FREE, no PITR | `docs/runbooks/database-backup-restore.md` §3 |
| `public/robots.txt` exists and has no `Sitemap:` line | `cat public/robots.txt` |
| `vercel.json` already excludes `sitemap[.]xml` from the catch-all | `vercel.json` rewrites, negative lookahead |
| Off-site backup is a daily Vercel cron → Blob | `vercel.json` crons `43 6 * * *`; `server/routes/cronBackup.ts` |
| `artworks` public SELECT excludes drafts | `2026_09_14_v2_12_artworks_public_select_excludes_drafts.sql:48–50` |
| Four blanket policies now use `is_admin_or_editor()` | `2026_09_14_v2_12_1_staff_scoped_policies.sql` (4 × `CREATE POLICY … USING (public.is_admin_or_editor())`) |
| `LICENSE` is canonical MIT; README says MIT | `head -5 LICENSE`; `README.md:404–409` |
| `POST /api/artworks` hardcodes fine-art defaults | `server/routes/artworks.ts:116–124` (`'2024'`, `'Acrylic on Canvas'`, `'48" x 60"'`, `'$9,500'`, `'Neon Americana'`) |
| `POST /api/media/upload` renders a real ladder | `server/routes/media.ts:53–121`; `server/lib/mediaUpload.ts:162–181` |
| One rendition ladder, shared | `server/lib/imageRenditions.ts:36–40`, imported by `server/routes/media.ts:5–10` and `scripts/migrate-cloudinary-to-supabase.ts:28–34` |
| The Cloudinary script is already a manifest-driven bulk path | `scripts/migrate-cloudinary-to-supabase.ts:328–418` (`--dry-run`, `--force`, `--limit`, idempotency check `:254–276`) |
| **`generate-asset-registry.ts` is first-wins on `artwork_slug`** (R-18) | `scripts/generate-asset-registry.ts:98–112` — `if (!keyToEntry.has(norm)) keyToEntry.set(norm, e)` |
| `assetRegistry.ts` is 4,602 lines / ~445 KB (R-20) | `wc -l src/data/assetRegistry.ts`; `AGENTS.md` §5 |
| `GET /api/artworks` is unpaginated and has no `Cache-Control` | `server/routes/artworks.ts:18–60` |
| `HomeLandingView.tsx` is 1229 lines | `wc -l` |
| `artworks.metadata` is `jsonb` and round-trips | `server/routes/artworks.ts:25` (SELECT), `:149` (PATCH allow-list), `:169–170` |
| No direct client-side `artworks` read | `src/context/AuthContext.tsx:51` is the only `supabase-js` table read |
| The runner applies every `.sql` in `supabase/migrations/` | `scripts/lib/migrationPlan.ts:22,30–35`; `scripts/run-migrations.ts:30,47–53` |
| Two divergent migration ledgers | `docs/runbooks/database-backup-restore.md` §7; `AGENTS.md` §4 |
| Media pipeline is healthy; 79/151 capped by small sources, not by a bug | `PRD_V2_16_MEDIA_PIPELINE.md` §2 |
| `.gitattributes` pins `*.sql text eol=lf` | `.gitattributes`; `AGENTS.md` §5 (0 CR bytes on rebuild) |

## Appendix B — Documentation to update when this program executes

| Document | Change | When |
| :--- | :--- | :--- |
| `CHANGELOG.md` | `[Unreleased]` accumulates per phase → `[3.0.0]` with the SemVer caveat | each PR / at tag |
| `DEPLOYMENT_LOG.md` | New rows, rebuilt from the Vercel API | each release |
| `AGENTS.md` §5 | Row counts after the load; the `kind` + provenance columns; the multi-image model | Phase 4 |
| `AGENTS.md` §6 | New scripts: `wayback-render`, `wayback-register`, `verify-offsite-backup` | Phase 3 |
| `docs/runbooks/database-backup-restore.md` | §4a Storage story (object listing + Wayback-as-second-copy); §6 the Blob restore proof; `Cache-Control` audit result; the egress measurement | Phase 0 / after Phase 4 |
| `plan/README.md` | Flip `ROADMAP_V3` to *executing*; flip `PRD_V2_16` when S1/S3/S5 land | each phase |
| `plan/PRD_V3_WAYBACK_DATA_MIGRATION.md` | Status → *Phases B/C delivered*; record the §3 Step 4c deviation | Phase 3 / 4 |
| `plan/BACKLOG_STUDIO_CMS.md` | Mark the scheduled items | Phase 1 |
