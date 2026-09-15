# PROMPT — v3.0.0 Phase 4: the first write

> **Status:** 📋 **Ready to run — but gated.** Written 2026-09-15, at the end of §3.D.
> **Read first:** [`RECON_V3_0_0_RECOVERED_SOURCE.md`](./RECON_V3_0_0_RECOVERED_SOURCE.md) (the
> reconnaissance this brief continues) and
> [`data/archive/wayback_recovered_diff_report.md`](../data/archive/wayback_recovered_diff_report.md)
> (the current measured run). `AGENTS.md` is canonical for stack, schema and conventions.
>
> ⚠️ **Read `ROADMAP_V3.md` as `git show 045788a:plan/ROADMAP_V3.md` until PR #23 merges.** The
> working-tree copy is the *old* one — PR #23 is a **sibling** of #24, not an ancestor.

---

## 0. What this brief is for

Phase 4 is **the first v3 step that writes to Supabase**, and therefore the least reversible thing in
the program (**R-07**). Everything before it — 3.A, 3.B, §3.D — was read-only by construction.

This brief is self-contained on purpose: a fresh session has no memory of the §3.D work, and the
single most expensive failure mode here is acting on a stale premise while holding a write gate.

**Do not start Phase 4 until §2 is answered.** Five decisions block it.

---

## 1. Where the program actually stands (verified 2026-09-15)

| Stage | State | Evidence |
| :--- | :--- | :--- |
| 3.A extraction + reconcile + staged backfill | ✅ done (PR #24) | `data/archive/wayback_extraction.json` |
| 3.B bulk media registration path | ✅ done (PR #25) | `scripts/wayback-register.ts` |
| §3.D recovered WordPress export | ✅ done (this release) | 60 NEW + 2 merges, 168 images |
| **Phase 4 — the writes** | ⛔ **not started** | this brief |

**§3.D produced, and this is the input Phase 4 consumes:**

- **62 published mural posts** from the recovered export → **60 NEW** + **2 merges**
  (`marcia-ball-cd-cover` → `marcia-ball`, `austin-postcard-mural` → `austin-postcard`).
- **168 images across 61 artworks.** Rendered: **168/168, 0 failed, 504 objects, no `original.*`**
  (24 MB staging). Register pre-flight against the live DB: **168 of 168 entries, 0 collisions in
  152 registry rows**.
- **Only 3 of the 168 are linked** — and that is correct. Only `exact-slug` / `divergence-map` /
  `known-dedupe` write `artwork_slug`; the other 165 belong to **NEW** artworks that do not exist
  yet. They register **unlinked** and are linked after the artwork upsert. Unlinked ≠ broken.
- **§3.D supersedes `centraltexasmurals.com-v1`** for the mural side: same 61 artworks, **+1 record**
  (`capstar-mural`), and **15× the media** (7 images → 168).

⚠️ **The scrape extraction still carries a defect §3.D does not fix.** The committed
`data/archive/wayback_extraction.json` records **both** PRD_V3 §2 dedupe pairs as
`NEW proposed=…` — i.e. **2 duplicate INSERTs**. Only the recovered path applies
`applyDedupeMerges()`. If Phase 4 consumes the scrape extraction for mural records, it must run the
dedupe merge first. **Recommendation: treat the scrape extraction as non-authoritative for murals**
and consume the recovered one.

---

## 2. The five decisions that gate Phase 4

Answer these **before** writing anything. Each one changes the schema or the data that lands.

| # | Question | Why it blocks | Recommendation |
| :--- | :--- | :--- | :--- |
| **D2** | Does §3.D **regenerate** the mural half of `supabase/staged/2026_09_15_v3_wayback_backfill.sql`, or **layer** on top of 3.A? | Two sources of truth for the same 60 records, or a discarded reviewed artifact | **Regenerate.** The export supersedes v1; layering leaves the 3.A mural rows contradicting the export that replaced them |
| **D3 / Q16** | Adopt an `artwork_images` join now? | Blocks the Phase 4 schema extension | **Yes.** 38 of 63 recovered artworks are multi-image, max 21 — a single `image_url` cannot express them |
| **D4 / Q18** | Is the archive `post_date` authoritative over the stored `year`? | Blocks the backfill | **Yes, for the mural rows.** `artworks.year` is `'2024'` on **all 138** rows — the hardcoded `POST /api/artworks` default, not authored data — and **79 rows disagree** with the real archive year, so a fill-only-empty pass can never fix it |
| **D5 / Q6** | `taxonomies.type='project_type'` for the 8 project types, with `Featured`/`Home` as curation flags? | Blocks the schema extension; 144 new `artwork_terms` rows | **Yes.** `curation` terms describe *where* a work is shown; filing a mural under both `interior` and `featured` as types puts it in two contradictory buckets |
| **D7 / Q14** | Free or Pro **before** Phase 4? | **R-14 / R-17** — the top risk in the program | Decide with the real number in hand: ~**519 objects**, not the 33 the original PRD assumed |

---

## 3. What Phase 4 has to do

1. **Create the artwork rows** (60 NEW; 2 merge into live rows).
2. **Register the media** — `wayback-register.ts --apply` is the only write that exists today. It
   writes 504 objects and upserts 168 `media_assets` rows, most **unlinked**.
3. **Link the media** to the artworks it now belongs to. Until this runs, 165 rows carry
   `artwork_slug = NULL`.
4. **Write the taxonomies** — 144 `artwork_terms` rows, typed per D5.

⚠️ **Step 2 and step 3 are separate on purpose** (linkage is gated on match trust, so an
unadjudicated image is uploaded but not attached). That separation is also where **R-17** lives.

---

## 4. Hazards, in the order they will bite

- ⚠️ **R-07 — this is the least reversible step.** Supabase is the **free tier**: no automatic
  backups, no PITR, and it pauses after 7 days idle. **Run `npx tsx scripts/backup-catalog.ts`
  first, and verify it with `verify-backup.ts`.** The repo dump is the only recovery path.
  See `docs/runbooks/database-backup-restore.md`.
- ⚠️ **R-17 — a bulk media write can orphan rows.** 168 rows land before the artworks exist. If the
  artwork insert then fails, the media rows point at nothing. Order the writes so the artwork rows
  are recoverable, and verify `artwork_slug IS NULL` count returns to 0 after linking.
- ⚠️ **R-18 — `generate-asset-registry.ts` is first-wins.** A planned `public_id` equal to an
  existing artwork slug **takes that artwork's registry key away**, and a live artwork silently
  renders somebody else's photograph. `findRegistryCollisions()` is the guard; **non-empty means do
  not write.** This was a live defect this release fixed — do not let it back in by recomputing a
  media plan instead of reusing the embedded one.
- ⚠️ **R-01 — the dedupe verdict must be *fed back*.** Detection alone is inert:
  `applyDedupeMerges()` is what rewrites a blocked record to `EXISTS`. Both PRD_V3 §2 pairs score
  **below** the 0.85 fuzzy gate (0.833 and 0.710; **no** mural post scores ≥ 0.85), so a
  threshold-only approach inserts duplicates.
- ⚠️ **Never run migrations via the Supabase CLI** — two ledgers, and the `2026_*` files collapse.
  The CLI is fine for `start` / `db dump` only. DB writes go through
  `npx tsx scripts/run-migrations.ts` (idempotent, ledger `schema_migrations`) or
  `getSupabaseAdmin()`. **Never paste SQL into the dashboard.**
- ⚠️ **`supabase/staged/` is inert** — `migrationPlan.ts` and `migrationSafety.test.ts` are pinned to
  `supabase/migrations`. Promote staged SQL **in the Phase 4 PR**, not before.

---

## 5. Owner decisions in force

- **Q1** Assets are copies; the artist holds the originals ⇒ deleting the 151 unreferenced
  `original.*` masters is safe.
- **Q2** v3 ingests at **web quality**, and PRE-INGEST is a batch **offline** pass — **not**
  `POST /api/media/upload`, **not** `POST /api/artworks` (which hardcodes 2024 / "Acrylic on Canvas"
  / 48"x60" / $9,500 / "Neon Americana").
- **Q3** No Cloudflare, no new vendor.
- **Q4** 2000 px cap is fine; **full resolution is never needed in the studio**.
- **Q5 (2026-09-15)** ⚠️ **The duplicate review band is a post-ingest cleanup list, not a write
  gate.** The 4 `needsReview` candidates (2 `near-miss` series siblings, 1 `intra-source`, 1
  `shared-image`) are **inserted as separate artworks** and adjudicated by the artist in the studio
  dashboard afterwards. **Only the 2 certain PRD_V3 §2 pairs are merged** — inserting those is
  precisely the duplicate the requirement forbids.

---

## 6. The commands

```bash
# 0. BEFORE ANY WRITE — snapshot the only database there is, then verify the snapshot
npx tsx scripts/backup-catalog.ts
npx tsx scripts/verify-backup.ts --all

# 1. Re-derive the read-only inputs (safe, idempotent, no writes)
npx tsx scripts/wayback-recovered-extract.ts      # -> data/archive/wayback_recovered_*
npx tsx scripts/wayback-render.ts \
  --extraction data/archive/wayback_recovered_extraction.json \
  --staging data/staging/wayback-recovered

# 2. Plan-only pre-flight — MUST report 0 collisions before you continue
npx tsx scripts/wayback-register.ts --staging data/staging/wayback-recovered

# 3. THE WRITE (the only --apply in the program)
npx tsx scripts/wayback-register.ts --staging data/staging/wayback-recovered --apply

# 4. Regenerate the client asset map after any media change
npx tsx scripts/generate-asset-registry.ts

# 5. Gates — run BOTH; vitest does not typecheck
npm run lint && npm test
```

⚠️ **`--apply` is the write gate, not `--dry-run`.** Register refuses to write without it, and
re-checks collisions against the live registry first.

---

## 7. Definition of done

- [ ] All five decisions in §2 answered and recorded.
- [ ] A verified pre-write backup exists, and its path is reported.
- [ ] 60 artwork rows created; the 2 merges land as `EXISTS`, not as new rows.
- [ ] 168 `media_assets` rows upserted; **`artwork_slug IS NULL` count returns to 0** after linking.
- [ ] `findRegistryCollisions()` empty; `npm run lint` clean; `npm test` green.
- [ ] The 4 Q5 candidates are **present** in the catalog and listed for the artist.
- [ ] `data/archive/` artifacts regenerated and committed.

---

## 8. Release plumbing

✅ **Working as of 2026-09-15.** `.env.local` holds `GITHUB_TOKEN` — a **classic** PAT (`ghp_`), which
pushes and opens PRs.

⚠️ **A fine-grained PAT with read-only *contents* looks healthy and is not.** `ls-remote`, `gh api`
GETs and `gh pr list` all succeed, while every content write returns
**403 `Resource not accessible by personal token`**. If that happens, the PAT needs **Contents: Read
and write** (+ **Pull requests: Read and write**).
⚠️ **`gh api /repos/<owner>/<repo> --jq .permissions` is a trap** — it reports the **user's** role
(`push: true`), *not* the token's grants, so it happily says "push: true" for a token that cannot
push. **The only honest test is a real write.**

`gh` is **not** persistently authenticated — pass the token per command:

```bash
export GH_TOKEN="$(grep -E '^GITHUB_TOKEN=' .env.local | head -1 | cut -d= -f2- | tr -d '\r')"
```

The credential is **no longer embedded in `.git/config`** (stripped 2026-09-15 — that plaintext PAT
was itself a known defect); git authenticates through `gh` as a credential helper.
⚠️ The **in-app GitHub connector reports `unauthorized`** while the session context says
"connected" — do not trust the status, call it.

---

## 9. Branch topology — read this before you push

The open PRs are **stacked**, and getting this wrong produces a PR that duplicates another one:

```
main 9b4eb91
 ├── #23 docs/v3-roadmap-rebaseline      045788a
 ├── #24 feat/v3-phase-3a-extraction     2748aed
 │    └── #25 feat/v3-phase-3b-media-path 8895914
 │         └── release/v2.17.0 (this release, §3.D)
 └── #26 docs/v3-handoff-prompts         5ea20e6
```

⚠️ **#23 is a *sibling* of #24, not an ancestor.** A new §3.D/Phase 4 branch must be based on the
**immediate parent's branch**, never on `main` — otherwise its PR diff re-includes 3.A and 3.B.

⚠️ **Push by SHA, never by branch name:** `git push origin <sha>:refs/heads/<branch>`. Inside the
agent sandbox a nested ref write is silently pruned, and **a zero exit status is not evidence** —
verify every ref with `git ls-remote` / `git rev-parse`. See
[`DIAGNOSIS_GIT_REF_PLUMBING_FIX.md`](./DIAGNOSIS_GIT_REF_PLUMBING_FIX.md).
