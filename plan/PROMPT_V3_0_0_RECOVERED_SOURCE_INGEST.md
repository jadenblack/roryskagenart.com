# Handoff prompt — v3.0.0 recovered-source ingest

> **How to use:** copy everything from `## BEGIN PROMPT` to `## END PROMPT` into a fresh session.
> It is self-contained: the new session has not seen this conversation.
>
> Written 2026-09-15 11:25 America/Sao_Paulo, immediately after Phases **3.A** (PR #24) and **3.B**
> (PR #25) were completed. The recovered archive described in §3 was supplied by the repo owner the
> same day and had not been analysed before this session.
>
> Every number in §3 was read from the dump itself with a hand-rolled SQL parser. **They are not above
> suspicion** — §5 requires the new session to re-derive them before designing anything.
>
> ⚠️ **Read §4 before trusting `plan/ROADMAP_V3.md`.** The working-tree copy is stale; the correct one
> is on an unmerged branch.

---

## BEGIN PROMPT

You are working in the repository at
`C:\Users\jaden.black\dev.local\clients\roryskagen\roryskagenart.com` (Windows 10, Git Bash), on the
**v3.0.0 data-migration program** for the artist's site. `AGENTS.md` is the canonical project guide —
read it first. Then read `memory/MEMORY.md` and the most recent file in `memory/` (start with
`memory/2026-09-15.md`); they record the state of the program and the traps already paid for.

### 1. What the program is

v3.0.0 merges two defunct legacy sites into the live Supabase-backed studio: **centraltexasmurals.com**
(mural work) and **roryskagen.com** (fine art). The governing constraint is
`docs/adr/0001-schema-as-code-before-data-migration.md` — **schema lands before data, always**. The
sequenced plan is `plan/ROADMAP_V3.md`; the domain framing is
`plan/PRD_V3_WAYBACK_DATA_MIGRATION.md`. Read **PRD_V3 §2, "Critical framing: this is a MERGE, not a
cold seed"**, before touching anything: both source sites partly describe artworks that *already exist*
in the live catalogue, so every ingested record must be classified NEW / EXISTS / COLLISION against
live data and never blindly inserted.

### 2. Read the roadmap from the branch, not the working tree

⚠️ **The working-tree `plan/ROADMAP_V3.md` is stale.** PR **#23** (`docs/v3-roadmap-rebaseline`,
commit `045788a`) is a **sibling** of #24, not an ancestor, so the working-tree roadmap stops at Q15
and has no §3.A/§3.B/§3.C, no R-17…R-21, and no Q16–Q18.

Read it as:

```bash
git show 045788a:plan/ROADMAP_V3.md
```

**If #23 has merged by the time you start, read the working-tree copy instead** — it will then be the
re-baselined one. Check with `gh pr view 23 --json state,mergedAt`.

PRs **#23, #24 and #25 are open and unmerged by deliberate choice. Do not merge or rebase them.**

### 3. What you have been given — and why the framing matters

The owner supplied a recovered archive at
`wayback/centraltexasmuralsbyroryskagen-20231217234521/`, describing it as *"the original WordPress
site of the depreciated Central Texas Murals website, which should contain all post and media data,
given the Wayback Machine download appears to be missing a significant portion of Rory's mural work
product."*

**That description understates it, and the difference changes the plan.** This is **not another
Wayback scrape**. It is a **complete WP Migrate (Deluxe) 2.6.9 export of the live WordPress site**,
taken 2023-12-17, containing a real MySQL dump *and* the site's actual media library:

- `wpmigrate-export.json` — `"name": "Central Texas Murals by Rory Skagen"`, domain
  `https://centraltexasmurals.com`, path `/home/vio/public_html/sites_skagen/wp_centexmurals`,
  `wpVersion: 6.4.2`, WP Migrate `2.6.9`, PHP 8.2.13, **MariaDB 10.6.16**.
- `database.sql` — 13,789,838 bytes / 82,457 lines. Header: `Database: vio_wp_centexmurals`,
  **table prefix `kZRTSN_`**, Post Types: revision, attachment, nav_menu_item, page, post,
  Multisite: false. 52 tables.
- `files/` — **509 MB / 9,027 files**.

**Grounded measurements** (already parsed; also reproduced in `memory/2026-09-15.md` — re-verify them,
do not trust them):

| Fact | Value |
| :--- | :--- |
| `kZRTSN_posts` | **728 rows** = **358 attachments** (`image/jpeg`) + **302 revisions** + **63 posts** (62 `publish`) + **3 pages** (`services`, `contact`, `murals`) + 2 `nav_menu_item` + 1 `auto-draft` |
| Post bodies | **62 of 63 posts have substantial `post_content`** (median 743 chars) — authored HTML, **not** reconstructed page chrome. Only 2 posts have an excerpt. |
| `kZRTSN_postmeta` | 915 rows over 425 distinct `post_id`: `_wp_attached_file` ×358, `_wp_attachment_metadata` ×358, `_thumbnail_id` ×18, `_wp_old_slug` ×8 (values include `new-mural-for-whole-foods`, `good-morning-austin-mural-2`), `_wp_attachment_image_alt` **×2 only** |
| NextGEN | `kZRTSN_ngg_pictures` **25 rows**, **25/25 have `alttext`**, 5/25 have `description`; `kZRTSN_ngg_gallery` **6 galleries**: `showcase`, `duluth-theater-mural`, `mellow-mushroom-murals`, `to-the-moon`, `good-morning-austin`, `fresh-planet` |
| Terms | 16 terms, 11 categories, 600 `term_relationships`. Post dates 2010-01-11 → 2023-12-17 |
| Media on disk | **1,828 JPGs — 1,478 derivatives, ~350 originals.** Upload partitions `_/2010` (901), `_/2011` (402), `_/2015` (214), `_/2016` (57), `_/2017` (17), `_/2018` (237), plus `uploads/quarantine/` |
| Derivative sizes | `-150x150` ×330, `-270x150` ×217, `-310x150` ×213, `-310x310` ×168, `-300x225` ×50, `-590x400` ×26, `-576x400` ×23, `-225x300` ×23, `-432x400` ×13, … |
| Ignorable tables | Wordfence `wf*`/`wfls_*`, `aioseo_*`, `bpspro_*`, `actionscheduler_*` |

#### 3.1 The scale comparison that justifies this work

The current v3 source — the read-only extraction of `wayback/centraltexasmurals.com-v1` — yielded
**61 pages, only 7 of which had any image at all**. This export contains **63 real mural posts with
authored bodies and ~350 original images**. Posts present here that are absent or thin in the scrape
include `texas-childrens-urgent-care` (5,787 chars), `facebook-2` (2,976), `casino-el-camino-mural`
(2,580), `aztec-mural-for-casino-el-camino` (2,325), `mjm-texas-stampede-for-children` (2,102),
`duluth-theater` (1,936), `pulte-homes-murals` (1,835), `rgm-advisors-mural` (1,748),
`andy-roddick-mural` (1,732), plus three titles not seen at all in the archive:
`motorcycle-mural-—-calif…`, `more-home-slice`, `greetings-from-78752`.

**Therefore: treat this as a SOURCE UPGRADE, not an addition.** Both sources describe the *same* site,
so this one must be **reconciled against, and will probably supersede, `centraltexasmurals.com-v1`**.
Do not append a second corpus — that is how the live catalogue gets duplicate artworks (**R-01**).

### 4. Scope: propose a new §3.D — do not reopen 3.A or 3.B

Phases **3.A (extraction + reconcile)** and **3.B (bulk media registration path)** are complete and
shipped in PRs #24 and #25. **Do not rework them.**

⚠️ **`§3.C` is not a free slot — it is "Exit criteria (ADR 0001 Phase B gate)".** Phase 3 currently
declares *"Two deliverables"* (`§3.A`, `§3.B`). Adding a third source makes it **three**, so propose a
**new `§3.D — Recovered-source reconciliation`** and state that Phase 3's own framing must change from
two deliverables to three. Put the roadmap amendment **on the branch that owns the re-baselined
roadmap** (`045788a`, PR #23) if it is still open; otherwise put it in your own PR and say so.

> **Unrelated, but note it in your report rather than fixing it here:** `045788a`'s `§3.C` still shows
> two open checkboxes for 3.B (*"the render stage has produced a manifest…"*, *"`wayback-render.ts`
> and `wayback-register.ts --dry-run` both run clean"*) and the line *"3.B is not started"*. **PR #25
> makes all of that stale** — 3.B is complete. That is a one-commit docs follow-up owed to #23, not
> part of this work.

### 5. Method

**First, confirm the source.** Re-derive the §3 counts from the dump yourself before designing
anything. If your numbers disagree with the table, **stop and say so** — the table came from a
hand-rolled parser.

**Corpus shape on disk — verified 2026-09-15, and the §3 media numbers are CONFIRMED.** The export's
`files/` tree is mostly noise: of 9,029 files, **5,831 are bundled plugin code** and **893 are theme
code** — neither is media. The real corpus is `files/wp-content/uploads/_/` **only**:

| | count |
| :--- | ---: |
| files under `uploads/` | 1,834 |
| JPGs under `uploads/` | **1,828** |
| — of which `-<w>x<h>` derivatives | **1,478** |
| — of which originals | **350** |

That matches §3's *"1,828 JPGs … 1,478 of the 1,828 JPGs here are derivatives"* and *"~350 originals"*
**exactly**, so the §3 media figures are trustworthy even though the prompt invites you to re-derive
them. Uploads span `_/2010 … _/2018`, plus `quarantine/` which holds only an `index.php`.
⚠️ **Scope every media walk to `uploads/`** — a naive `find files/` picks up plugin and theme sample
images and inflates the counts (it returns 2,340 JPGs, not 1,828).

**Reading the dump.** Do **not** stand up MariaDB unless you conclude it is genuinely necessary. The
dump is plain, well-formed `INSERT INTO \`kZRTSN_table\` (cols) VALUES (...), (...) ;` spanning
multiple lines, and parses cleanly in Python.

⚠️ **The parser trap that already cost one full pass.** Whitespace between SQL tokens is
**insignificant and must be discarded, not accumulated**. A reader that appends the space following a
comma turns `post_type` into `' attachment'`, so every exact-match filter silently returns **zero
rows** — the analysis looks *empty* rather than *wrong*. Write the state machine so whitespace outside
a quoted value is skipped while the current token is still empty, and handle both `\'` escapes and
`''` doubling inside quoted values.

**Classify before you plan.** Reuse the existing pure classifier in `scripts/lib/waybackReconcile.ts`
so the new corpus produces the **same** NEW / EXISTS / COLLISION shape as the current one — that is
what makes the two sources diffable, and **the diff is the deliverable**.
`scripts/lib/waybackExtract.ts` + `scripts/wayback-extract.ts` show the established extraction shape
(deterministic, re-runnable, committed JSON).

⚠️ **Re-run the extract script after editing anything in `scripts/lib/wayback*`** — the committed JSON
can silently lag its own library. That has already happened once here: narratives shipped full of
sidebar chrome.

**Media rules — already paid for. Adopt them; do not re-derive them.**

- ⚠️ **A WordPress `-<w>x<h>` basename is a server-side resize, never an original.** **0 of the 152
  live registry rows match that pattern.** Drop the derivative when the original is available; keep it
  only when it is the sole surviving copy (a 590 px photo beats no photo). **1,478 of the 1,828 JPGs
  here are derivatives**, so this rule does most of the work.
- ⚠️ **In `resolveMedia`, check the registry BEFORE the filesystem.** An image absent from disk that is
  *already in `media_assets`* is not unrecoverable — ten images were mislabelled that way once
  (Cloudinary-era names such as `normal-gods-copy`), which asks the artist to re-supply what the studio
  already owns. A registry hit settles the question; disk presence only downgrades what the registry
  lacks.
- ⚠️ **`public_id = slug` holds ONLY for single-image artworks** — `public_id` *is* the bucket folder,
  and `facebook-2` has 3 images, `high-5-bowling-mural` 2. Multi-image ids are `{slug}--{basename}`
  (basename, not an index: an index renumbers and orphans objects). The 25 NextGEN pictures and 358
  attachments will stress this rule hard — expect it to be the main source of new questions.
- ⚠️ **R-18 is real, not hypothetical.** `generate-asset-registry.ts` indexes each row under its
  `public_id` **and** its `artwork_slug`, **first-wins**, so a `public_id` matching an existing artwork
  slug steals that artwork's image. `vintage-appeal/jungle-tempo-2` already collides on `jungle-tempo`
  (the `artwork_slug` of `boyhood-explorers-6`) and is held out of the current plan.
  `findRegistryCollisions()` in `scripts/lib/waybackMedia.ts` is the guard; the register stage aborts
  on a hit. Run every new id through it.
- ⚠️ **Never write an `original.*` object.** Q4 is a standing owner decision (full-resolution is never
  needed in the studio — POD sources originals off-studio), and S1 will delete the 151 legacy masters.
- **Linkage is gated on trust:** only `exact-slug` and `divergence-map` may write `artwork_slug`. The
  `_wp_old_slug` values in this dump (e.g. `new-mural-for-whole-foods`) are exactly the material a
  divergence map is made of — harvest them.
- **`--apply` is the write gate, not `--dry-run`** (matching `restore-catalog.ts`); `--dry-run` is an
  accepted spelling of the default, and `--dry-run --apply` must be rejected.

### 6. Questions this richer data can now settle — escalate, do not decide

Where this source turns a guess into evidence, present the evidence **and** a recommended answer for
the owner:

- **Q6** — mural project type. The **11 categories** and **6 named NextGEN galleries** are real
  taxonomy the scrape never gave you.
- **Q16 / G3** — the multi-image model, which blocks the Phase 4 schema extension. `facebook-2`
  (3 images), the 25 NextGEN pictures, and 600 `term_relationships` make the real shape visible.
- **Q18** — `artworks.year`. All 138 live rows currently carry the hardcoded `'2024'` default from
  `server/routes/artworks.ts:116`, and **79 of them have a real archive year that disagrees**. This
  dump carries **real `post_date` values from 2010 to 2023**, so the placeholder question can now be
  settled with evidence rather than by guessing.
- **G1** — `artworks.kind` (mural vs fine art).
- **G2** — provenance / source-site attribution.

### 7. Known limitation to state plainly, not paper over

**Alt text remains largely unavailable.** `_wp_attachment_image_alt` covers only **2 of 358**
attachments, and NextGEN's `alttext` is filename-derived for most of the originals it covers. 25/25
NextGEN pictures technically have an `alttext`, but that is not the same as a human-written
description. **Report the true coverage; do not present filename-derived strings as authored alt
text.**

### 8. ⚠️ Repository hazard — now neutralised

`wayback/centraltexasmuralsbyroryskagen-20231217234521/` is **522 MB across 9,029 files**.

- ✅ **An ignore rule now exists** (added 2026-09-15, `.gitignore` line ~30):
  `wayback/centraltexasmuralsbyroryskagen-*/`. It is timestamp-wildcarded so a re-export is covered
  too. `git status` is clean and **`git add -A` can no longer stage it** — verified with
  `git add -A --dry-run`.
- ⚠️ **`git add -A` / `git add .` is now safe *for this path*, but stay disciplined** — stage explicit
  paths anyway. Committing it would write 522 MB into git history permanently.
- ⚠️ **The rest of `wayback/` is deliberately NOT ignored.** `centraltexasmurals.com-v1/` (147 files)
  and `roryskagen.com-v1/` (404 files) are **tracked**, and they are the extraction inputs *and* the
  diff baseline. **Do not "tidy" them into the ignore rule** — the diff against
  `centraltexasmurals.com-v1` is the deliverable.
- ⚠️ **`git clean -xfd` would now DELETE the export**, because it is ignored. Never run it here.
- **`wayback/` must stay byte-identical** — it is an immutable archive. Verify with `git status`
  before and after your run.

### 9. Deliverable and acceptance criteria

Produce, as a **new PR** (never a push to `main`):

1. A **pure, re-runnable extraction** of the recovered export in the established
   `scripts/lib/wayback*` + `scripts/wayback-*.ts` shape, emitting committed JSON.
2. A **reconciliation report** classifying the recovered corpus NEW / EXISTS / COLLISION and **diffing
   it against the `centraltexasmurals.com-v1` extraction** — showing, per artwork, which source is
   richer and which should win. **That diff, not the raw row count, is what the owner needs to read.**
3. A **media plan** produced through `scripts/lib/waybackMedia.ts`, including a collision check against
   the live `media_assets` registry.
4. Tests in `src/test/` in the existing style, asserting against the committed extraction. The current
   suite is **523 tests across 37 files** — keep it green and growing.
5. Any **staged SQL** goes in `supabase/staged/`. ⚠️ **That directory is inert** — `migrationPlan.ts`
   and `migrationSafety.test.ts` are both pinned to `supabase/migrations`, so staged SQL is never
   auto-applied. Promote it only in the Phase 4 PR. Migrations must be additive and idempotent, and any
   touch-core file must sort after `2026_09_01_baseline_core_tables.sql`.

**Acceptance:**

- **Zero database writes.** This phase is read-only extraction and planning, exactly like 3.A and 3.B.
  Phase 3's exit criterion is that nothing reaches Supabase.
- **`wayback/` byte-identical.**
- **Both gates green: `npm run lint` AND `npm test`.** They are not interchangeable — vitest does not
  typecheck, and `tsconfig` here lacks `strictNullChecks`, so a broken union narrowing passes tests and
  fails only lint. Run `npm run smoke` too if you touch `server.ts` mounts.
- Report the PR number, the branch, and the gate results.

### 10. Hard constraints

- ⚠️ **Never push `main`.** Push only a feature or `release/x.y.z` branch. Pushing `main` first makes
  GitHub refuse the PR and lands commits in production ahead of the gates.
- ⚠️ **Merge only when `mergeStateStatus=CLEAN`**, and use `gh pr merge --merge`, never `--squash`.
- ⚠️ **PRs #23–#26 are open and unmerged by deliberate choice. Do not merge or rebase them.**
- ⚠️ **Git ref plumbing — RESOLVED 2026-09-15: it is an agent-sandbox issue, NOT a machine or repo
  defect.** Inside the agent sandbox a nested branch ref can be created then pruned, leaving an unborn
  `HEAD` (`git rev-parse HEAD` fails while `git log <sha>` and
  `git push origin <sha>:refs/heads/<branch>` still work). **In a normal terminal nothing is wrong.**
  An agent must therefore **push by SHA** and must not rely on git creating a nested ref. **Never run
  `git checkout`/`switch` while `HEAD` is unborn** — that once deleted nine tracked `plan/*.md` files.
  **Never run `git refs migrate`** — it destroyed `.git`. Full evidence, including the out-of-tree
  control test that settled it: `DIAGNOSIS_GIT_REF_PLUMBING_FIX.md`.
  ⚠️ **Do NOT run `PROMPT_GIT_REF_PLUMBING_FIX.md`** — it is superseded, and all five of its fixes are
  unnecessary (Defender, Google Drive, `rename()`, repo relocation and reftable are all discredited).

### 11. Stop and report before writing code

Begin with: **(a)** a short report confirming what the artifact actually is; **(b)** your re-derived
counts, flagged against §3; **(c)** the scope you propose (§3.D) and where it lands relative to
`045788a`; **(d)** the three owner questions you think this source can now answer with evidence.
**Wait for my go-ahead before writing code.**

## END PROMPT

---

## Related

- [`PRD_V3_WAYBACK_DATA_MIGRATION.md`](./PRD_V3_WAYBACK_DATA_MIGRATION.md) — the migration's own spec.
  **§2 is required reading** (MERGE, not cold seed).
- [`ROADMAP_V3.md`](./ROADMAP_V3.md) — ⚠️ **stale in the working tree**; read `045788a`'s copy.
- [`PROMPT_GIT_REF_PLUMBING_FIX.md`](./PROMPT_GIT_REF_PLUMBING_FIX.md) — run this **first** if branch
  creation is failing.
- `memory/2026-09-15.md` — the dump reconnaissance, the parser trap, and the scale comparison.
