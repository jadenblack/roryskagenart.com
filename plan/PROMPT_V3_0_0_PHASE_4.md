# PROMPT — v3.0.0 Phase 4: the first write

> **Status:** 📋 **Ready to run — but gated.** Written 2026-09-15, at the end of §3.D.
> **Read first:** [`RECON_V3_0_0_RECOVERED_SOURCE.md`](./RECON_V3_0_0_RECOVERED_SOURCE.md) (the
> reconnaissance this brief continues) and
> [`data/archive/wayback_recovered_diff_report.md`](../data/archive/wayback_recovered_diff_report.md)
> (the current measured run). `AGENTS.md` is canonical for stack, schema and conventions.
>
> ✅ **`ROADMAP_V3.md` is current on `main`.** PRs #23–#27 all merged on 2026-09-15 (`main` =
> `d078f0a`); read the working-tree copy normally. The earlier warning — *"read it as
> `git show 045788a:plan/ROADMAP_V3.md` until PR #23 merges"* — no longer applies.
>
> ✅ **The five gating decisions are answered** — see §2.1. Phase 4 is no longer blocked on the owner.

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
| §3.D recovered WordPress export | ✅ done (PR #27 → **v2.17.0**, merged) | 60 NEW + 2 merges, 168 images |
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

### 2.1 ✅ Answered by the owner — 2026-09-15

All five gates are **settled**. They are recorded here because a fresh session cannot reconstruct
them, and every one of them changes what Phase 4 writes.

| # | Decision | What it means for the write |
| :--- | :--- | :--- |
| **D2** | **Regenerate.** | The mural half of `supabase/staged/2026_09_15_v3_wayback_backfill.sql` is rebuilt from the **recovered** export. Do **not** layer on 3.A: that leaves two sources of truth for the same 60 records, and the 3.A mural rows would contradict the export that superseded them. ✅ **Implemented 2026-09-15 — but as a merge, not the "repoint" this cell originally prescribed.** See §3.0. |
| **D3 / Q16** | **Adopt the `artwork_images` join** — `(artwork_slug, media_public_id, position)`. | Phase 4 carries a schema extension. It makes "which image is the cover" answerable, and it is what makes images 2..N reachable at all (R-18). `generate-asset-registry.ts` must stop being silently first-wins. |
| **D4 / Q18** | **The archive `post_date` is authoritative for the mural rows.** | This is an **overwrite** of `artworks.year`, not a fill-only-empty pass — all 138 rows hold `'2024'` (the `POST /api/artworks` default) and 79 disagree with the archive. It needs its own reviewed migration and its own dump, and it stays **out** of the staged backfill. |
| **D5 / Q6** | **`taxonomies.type = 'project_type'`** for the 8 project types; `Featured` / `Home` become `curation` flags. | Unblocks the schema extension and the 144 `artwork_terms` rows. Filing a mural as both `interior` and `featured` would put it in two contradictory buckets. |
| **D7 / Q14** | **Stay on Supabase Free.** | Against this brief's own §2 recommendation. The roadmap's fallback condition is therefore binding — *"the minimum is the daily keep-alive plus the proven-Blob-restore from §4.1.1"* — and **both now hold**: §4.1.1 was closed 2026-09-15 (a Blob dump was checksum-verified and restored into the scratch DB — 298 rows inserted, 0 failed, 138/138 artworks field-exact). ⚠️ **R-07 is unchanged**: the repo dump is still the only recovery path, so back up *and verify* before the first write. |

---

## 3. What Phase 4 has to do

0. ✅ **Regenerate the staged backfill (D2) — DONE, see §3.0 below.** No longer a task.

### 3.0 D2 — what "regenerate" actually required (done 2026-09-15)

The earlier framing of this step — "repoint `scripts/wayback-stage-sql.ts` at
`wayback_recovered_extraction.json`" — was **wrong, and wrong in a way that exits 0.** The stager covers
**two** archives; the recovered export covers **one**. Repointing the source drops all **136 painting
records** silently. D2 is a **merge**, not a swap. Four coordinated changes were needed:

| # | Change | Without it |
| :-- | :--- | :--- |
| 1 | `mergeSources()` in `scripts/lib/waybackBackfill.ts` — drop the scrape's mural records, inject the recovered ones **at the first scrape-mural position** | paintings vanish (swap) or reorder (append) |
| 2 | Map `RECOVERED_MURAL_ARCHIVE` in `ARCHIVE_SITE` / `ARCHIVE_KIND` | murals land as `kind = 'other'`, `sourceSite` = the archive *directory* name — untyped, so nothing catches it |
| 3 | Refine the `KNOWN_DEDUPE_PAIRS` hold to skip records the recovered path **already merged** (`EXISTS` + `known-dedupe`) | the 2 merges become HELD rows and emit **no statement** — the merge is silently discarded |
| 4 | Emit `canonical` + `pages` from `wayback-recovered-extract.ts` | `buildBackfillPlan` reads `year`/`narrative`/`description`/`categories`/`wpPostId`/`publishedAt` from `pages`; without it all six are null and the file still renders |

⚠️ Change 3 is **conditional, not a removal** — the hold still fires for the scrape side, where the same
two pairs are still `NEW`. That is the R-01 guard. Both halves are asserted in
`src/test/waybackSourceMerge.test.ts` (16 tests). Invariant proven by statement-level diff: **0 painting
statements changed**, 59 scrape-mural INSERTs out, 62 recovered INSERTs in, 2 mural UPDATEs added.

⚠️ `publishedAt` from the two sources is **not** the same instant shape and **not** a uniform offset
(0 h or 6 h across the 60 overlapping murals). It is inert provenance inside `metadata.wayback` — never
cast it. Year is unaffected: **0 of 60 disagree**. Detail at `InsertRow.publishedAt`.

⚠️ D2 changes **only** the artwork INSERT/UPDATE half of the staged file. The stager still emits **no**
media rows and **no** `artwork_terms` — steps 2–4 below need new code, not another regeneration.

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

✅ **The stack is closed.** All five PRs merged to `main` on 2026-09-15 — **there are no open PRs**,
and the Phase 4 branch is a plain branch off `main`:

```
main d078f0a   ← #27 (release/v2.17.0, §3.D) is the tip
 ├── #26 docs/v3-handoff-prompts        05472dd → d23feb0
 ├── #24 feat/v3-phase-3a-extraction    2748aed → ec1d12b
 ├── #23 docs/v3-roadmap-rebaseline     045788a → e8cad05
 └── #25 feat/v3-phase-3b-media-path    8895914 → f8ac24d
     └── #27 release/v2.17.0            ff4a21a → d078f0a
```

⚠️ **The historical trap, kept because it will recur:** the stack was merged with `gh pr merge`,
which merges into a PR's **base** — and merging a parent does **not** retarget its child. #25 and #27
both had to be retargeted by hand (`gh pr edit <n> --base main`) before `main` could receive them.
If you stack a branch again, base it on the **immediate parent**, never on `main`.

⚠️ **Push by SHA, never by branch name:** `git push origin <sha>:refs/heads/<branch>`. Inside the
agent sandbox a nested ref write is silently pruned, and **a zero exit status is not evidence** —
verify every ref with `git ls-remote` / `git rev-parse`. See
[`DIAGNOSIS_GIT_REF_PLUMBING_FIX.md`](./DIAGNOSIS_GIT_REF_PLUMBING_FIX.md).
