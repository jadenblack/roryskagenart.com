# Reconnaissance — the recovered WordPress export, and what it changes about v3.0.0

> **Status:** reconnaissance + analysis only. **No code written, no branch, no PR, nothing staged.**
> This is the §11 report required by [`PROMPT_V3_0_0_RECOVERED_SOURCE_INGEST.md`](./PROMPT_V3_0_0_RECOVERED_SOURCE_INGEST.md).
> It answers §11 (a)–(d) and stops for the owner's go-ahead.
>
> Written 2026-09-15. Every number below was re-derived from the dump in this session with a
> corrected SQL tuple reader; the parser lives at `%TEMP%\v3recon\` and nothing was written into
> `wayback/` (verified byte-identical).

---

## 0. Headline

The owner's description — *"the original WordPress site … which should contain all post and media
data, given the Wayback Machine download appears to be missing a significant portion of Rory's mural
work product"* — is **right about the media and wrong about the coverage.**

It is not another Wayback scrape. It is a **complete WP Migrate (Deluxe) 2.6.9 export of the live
WordPress 6.4.2 site**, taken 2023-12-17: a real MySQL dump plus the site's actual media library.

The two corpora describe **the same 61 artworks**. The recovered export does not add many records —
it adds **depth**, and the depth is enormous:

| | `centraltexasmurals.com-v1` (today's v3 source) | Recovered WP export |
| :--- | ---: | ---: |
| mural records | 61 pages | **62 published posts** |
| with an authored body | **0** (page chrome only) | **62** (median 743 ch) |
| with ≥ 1 image | **7** | **62** |
| distinct images referenced | 14 `needs_upload` | **174** (173 on disk) |
| **net-new images vs the live registry** | **11** | **169** |
| multi-image records | 5 | **38** (max **21**) |
| taxonomy actually used | 0 | **11 categories / 144 relationships** |
| authored alt text | 0 | **13** (NextGEN) + 2 (WP) |
| real dates | page snapshot | **2010-03-17 … 2023-12-17** |

**So: this is a source upgrade that supersedes `centraltexasmurals.com-v1` for the mural side.**
It must be reconciled against it, never appended (R-01).

Two consequences that need an owner decision before any code is written:

1. **The media plan grows ~15×** — 11 images → 169 images, **33 objects → ~519 objects**. Bytes stay
   small (17.0 MB of source ⇒ roughly 3–5 MB of WebP renditions), so **storage is not the risk;
   object count and R-17 are.**
2. **Two of the 62 posts are not new at all** — and both are the `PRD_V3` §2 known dedupe pairs,
   scoring **below** the matcher's 0.85 gate. See §3.

---

## 1. What the artifact actually is — §11 (a)

| Field | Value (from `wpmigrate-export.json` + the dump header) |
| :--- | :--- |
| Name | `Central Texas Murals by Rory Skagen` |
| Domain | `https://centraltexasmurals.com` |
| Path | `/home/vio/public_html/sites_skagen/wp_centexmurals` |
| WordPress | **6.4.2** |
| WP Migrate | **2.6.9** (Deluxe) |
| PHP / DB | 8.2.13 / **MariaDB 10.6.16** |
| Export date | **2023-12-17 23:45 UTC** |
| `database.sql` | **13,789,838 B** / 82,457 lines · `Database: vio_wp_centexmurals` · prefix **`kZRTSN_`** · 52 tables · Multisite: false |
| `files/` | **509 MB / 9,027 files** |

**It is a live-site database export, not a crawl.** That distinction is the whole point: it carries
`post_content` as authored HTML, real `post_date` values, the taxonomy, and the original media — none
of which a Wayback capture of the rendered page can give you.

---

## 2. Re-derived counts, flagged against §3 — §11 (b)

**The §3 table is substantially correct.** All four media figures reproduce **exactly**, including
the trap: a naive `find files/` returns **2,340** JPGs against the true **1,828** under `uploads/`.

### 2.1 Confirmed exactly

| §3 claim | Re-derived | |
| :--- | :--- | :--- |
| `kZRTSN_posts` 728 rows | 728 | ✅ |
| 358 attachments, all `image/jpeg` | 358 | ✅ |
| 302 revisions | 302 | ✅ |
| 63 posts (62 `publish`) | 63 (62 + 1 auto-draft) | ✅ |
| 3 pages: `services`, `contact`, `murals` | identical | ✅ |
| 2 `nav_menu_item` | 2 | ✅ |
| 62/63 posts with substantial body, median 743 | 62/63, median **743** | ✅ |
| 2 posts with an excerpt | 2 | ✅ |
| `kZRTSN_postmeta` 915 rows / 425 distinct `post_id` | 915 / 425 | ✅ |
| `_wp_attached_file` ×358 · `_wp_attachment_metadata` ×358 · `_thumbnail_id` ×18 · `_wp_attachment_image_alt` **×2** | identical | ✅ |
| NextGEN `ngg_pictures` 25 rows, 25/25 `alttext`, 5/25 `description` | identical | ✅ |
| 6 galleries: `showcase`, `duluth-theater-mural`, `mellow-mushroom-murals`, `to-the-moon`, `good-morning-austin`, `fresh-planet` | identical | ✅ |
| 16 terms · 11 categories · 600 `term_relationships` | identical | ✅ |
| 1,834 files / **1,828 JPGs** / **1,478** derivatives / **~350** originals | 1,834 / 1,828 / 1,478 / **350** | ✅ |
| Derivative size histogram (`-150x150` ×330, `-270x150` ×217, …) | identical | ✅ |
| Naive `find files/` = 2,340 JPGs | 2,340 | ✅ |

### 2.2 Five corrections

1. **§3's post-type list sums to 729, not 728.** `358 + 302 + 63 + 3 + 2 + 1 = 729`. The
   `auto-draft` is a **`post_status` of one of the 63 posts**, not a sixth row. The row count is
   right; the breakdown double-counts one row.

2. **The `post_date` range 2010-01-11 → 2023-12-17 is the all-post-types range**, and its earliest
   row is the **`services` page** (`2010-01-11 22:31:32`), not a post. **Posts** span
   **2010-03-17 22:58:09 → 2023-12-17 17:42:24**.

3. **`_wp_old_slug` is 8 rows but only 2 carry a value.** Six are `NULL`. The usable values are
   exactly **`new-mural-for-whole-foods`** and **`good-morning-austin-mural-2`**. §3's *"×8 (values
   include …)"* overstates the divergence-map material by 4×. **Seed the map with 2 entries, not 8.**

4. **NextGEN alt text is better than §3 says — the §7 framing is inverted.** §7 warns that
   *"NextGEN's `alttext` is filename-derived for most of the originals"*. Measured: of 25 pictures,
   **12 have `alttext` equal to the filename stem — and 8 of those 12 are *derivative* filenames**,
   which are not originals at all. **13 of 25 (13 of 17 originals) carry a genuinely human-written
   string**: `James Bond`, `Mifune Original`, `The Shining Original`, `Original Crab Monster Mural`,
   `Original Eye Monster Mural`, `Original Mouth Monster Mural`, `Crab Monster Mural`, `Eye Monster
   Mural`, `Mouth Monster Mural`, `Mifune`, `The Shining`, `Good Morning Austin`, `Fresh Planet
   Mural`. **True authored-alt-text coverage is 15 strings, not 2.** See §5.3 for the caveat.

5. **§3.1's scale comparison overstates the coverage gap.** It names *three* titles *"not seen at all
   in the archive"* — `motorcycle-mural-—-calif…`, `more-home-slice`, `greetings-from-78752`.
   **All three are in `centraltexasmurals.com-v1`.** (`motorcycle-mural-—-california-dreamin` is the
   *same post* as the export's URL-encoded `motorcycle-mural-%e2%80%94-california-dreamin`.) The
   **only** genuinely WP-only post is **`capstar-mural`** — 1 record, 671 chars, 1 image.
   ⇒ **the justification is depth, not coverage.** The depth case is stronger than §3.1's, but it
   should be argued correctly.

---

## 3. The diff against `centraltexasmurals.com-v1` — the deliverable (§11, §9.2)

**Record-level: the sets are almost identical.** Of the 62 published WP posts, **60 have a
same-slug twin in v1**, and v1's 61 pages are 60 shared + 1 name-encoding twin. Net record delta:
**+1 (`capstar-mural`)**.

**Depth-level: the export wins everywhere it matters.**

| | v1 | recovered export |
| :--- | ---: | ---: |
| records | 61 | 62 |
| records with a real body (> 200 ch) | **0** | **62** |
| records with ≥ 1 image | **7** | **62** |
| of the 60 shared records, gain an image v1 never had | — | **53** |
| distinct images referenced | 14 | **174** |
| — resolving on disk | 4 | **173** |
| — that are `-<w>x<h>` derivatives | 14 | **0** |
| — already in the live `media_assets` registry | 3 | **5** |
| — **net-new images** | **11** | **169** |
| records with > 1 image | 5 | **38** |

### 3.1 ⚠️ Two of the 62 posts are NOT new — and the matcher cannot see either

Both `PRD_V3` §2 **known dedupe pairs** are present in the export, and **both score below the 0.85
fuzzy gate**:

| WP post | Live row | Score | Status in `wayback_extraction.json` |
| :--- | :--- | ---: | :--- |
| `austin-postcard-mural` | `austin-postcard` ("Austin Postcard") | **0.833** | `NEW`, `matchKind: none`, `confidence: 0` |
| `marcia-ball-cd-cover` | `marcia-ball` ("Marcia Ball") | **0.710** | `NEW`, `matchKind: none`, `confidence: 0` |

**This is R-01, materialised, and it is already in the shipped 3.A output.** A consumer that trusts
`classification` emits two INSERTs that duplicate live artworks.

**3.A itself is sound** — `supabase/staged/2026_09_15_v3_wayback_backfill.sql` §3 correctly **holds**
both rows (comments only, no statements), because `waybackBackfill.ts` holds from
`KNOWN_DEDUPE_PAIRS` directly. **The defect is in the matcher, not the backfill.** But the same
blindness will recur on the 62-post corpus, so §3.D must carry the hold forward explicitly.

**Threshold evidence:** across all 62 posts the **maximum** fuzzy score against any of the 138 live
titles is **0.833**, and **0 posts score ≥ 0.85**. The 0.85 gate is *decisive* here — it is also
exactly where the two real duplicates sit. Recommend the §3.D reconcile **report every score in the
0.60–0.85 band** (12 candidates) rather than silently gating them.

### 3.2 The media linkage is unusually clean

- The post bodies reference **174 distinct images; 173 resolve on disk; 0 are derivatives** — the
  bodies link *originals*, never resizes. Compare the v1 scrape, whose 14 `needs_upload` refs were
  **all 14** `-590xNNN` derivatives.
- The single apparent miss (`2010/03/good_morning_mural.jpg`) is a **month-directory mismatch**: the
  file is at `uploads/_/2010/**04**/good_morning_mural.jpg`. **174 of 174 resolve by basename.** This
  is a concrete argument for the basename fallback in `resolveMedia`.
- **Only 5 of the 174 are already in the live registry** ⇒ **169 net-new images**, with **no
  `original.*` needed** (the bodies reference the 350 JPEG originals directly, and Q4 stands).

### 3.3 Two corpus traps the current rules do not cover

1. **The `_/` partition segment.** `_wp_attached_file` stores `2010/03/lunar_lander.jpg`, but the
   bytes live at `files/wp-content/uploads/**_/**2010/03/lunar_lander.jpg`. Joining on the bare
   relative path resolves **0 of 358**; joining through `_/` resolves **344 of 358**. The 14 misses
   are attachments with no surviving bytes. **A resolver that omits `_/` reports the whole media
   library as lost.**
2. **NextGEN is an index, not a corpus — and it renames.** Only **10 of 25** NextGEN filenames have
   bytes under the same name; there is **no `wp-content/gallery/` directory in the export at all**.
   The other 15 resolve to WordPress's *edit-duplicate* naming: `bond.jpg → bond-copy.jpg`,
   `mifune.jpg → mifune-copy.jpg`, `crab.jpg → crab-copy.jpg`, `good-morning-austin.jpg →
   good-morning-austin-jpg-copy.jpg`, … (verified on disk). **So NextGEN's 13 human alt strings are
   recoverable, but only via a `{stem}-copy.*` rule — not by name equality.** `to_the_moon.jpg` has
   no bytes under any variant.
   ⇒ **Never treat the 25 NextGEN rows as 25 new images.** They are a second index over media that
   is already counted in the 174, and they are the only source of authored alt text.

---

## 4. What this does to the media plan (§11, §9.3)

| | 3.B today (PR #25) | with the recovered source |
| :--- | ---: | ---: |
| images to register | 11 | **169** |
| artworks touched | 8 | **62** |
| **Storage objects** | **33** | **~519** |
| source bytes | — | 17.0 MB (median 69 KB, max 1.03 MB) |
| projected rendition bytes | — | **~3–5 MB** (WebP @ 2000 px cap) |

- **Bytes are a non-issue** — ~5 MB against a 1 GB Free quota.
- **Object count is the risk.** 519 objects is 15× the plan 3.B was reviewed against, and **R-17**
  is precisely about a bulk media write producing orphaned objects. The two-stage render→register
  design and the before/after object listing become *load-bearing*, not hygiene.
- The 3.B rules all still hold and all still do work: no `original.*`; `public_id = slug` only for
  single-image artworks (⇒ **37 of 62 posts need `{slug}--{basename}` ids**); `findRegistryCollisions()`
  before any id is written; `--apply` as the write gate.
- **Q16 is no longer a judgement call.** 38 of 63 posts carry more than one image and the largest
  carries **21**. The R-18 first-wins registry cannot express that. The evidence now favours an
  explicit **`artwork_images(artwork_slug, media_public_id, position)`** join.

---

## 5. Evidence for the open questions — §11 (d)

### 5.1 Q6 — mural project type: the taxonomy is real and it splits cleanly

11 categories are in genuine use, across **144 relationships touching posts**:

| Category | Posts | Reads as |
| :--- | ---: | :--- |
| Interior | 40 | project type |
| Business | 32 | project type |
| Exterior | 20 | project type |
| Restaurant | 13 | project type |
| Event | 12 | project type |
| Retail | 8 | project type |
| **Featured** | 6 | **curation flag** |
| Signage | 5 | project type |
| Museum | 3 | project type |
| **Home** | 3 | **curation flag** |
| Blogroll | 2 | WordPress default noise |

**Recommendation:** the 8 *project-type* values (Interior, Exterior, Business, Restaurant, Retail,
Museum, Event, Signage) belong in a `taxonomies.type = 'project_type'` dimension — **not** in
`gallery_series`, which is a fine-art concept (`Neon Americana` on all 138 live rows). `Featured`
and `Home` are curation flags and should **not** be modelled as project types. `Blogroll` is
WordPress noise and should be dropped. Note this makes `artwork_terms` (R-09, never exercised) a
**Phase 4 load with 144 rows** — the largest new write in the phase.

### 5.2 Q16 / G3 — multi-image: it is the norm, not the exception

| images | posts |
| ---: | ---: |
| 0 | 1 |
| 1 | 24 |
| 2 | 19 |
| 3 | 6 |
| 4 | 4 |
| 5 | 2 |
| 6 | 2 |
| 8 | 2 |
| 9 | 1 |
| 10 | 1 |
| **21** | 1 (`texas-childrens-urgent-care`) |

**38 of 63 posts are multi-image.** The v1 extraction recorded *"5 pages reference more than one"* —
an order of magnitude understated. **`artwork_images` join over a cover-pointer + sort-order.**
R-18 should be fixed in the same change (first-wins → an error or an ordered list).

### 5.3 Q18 — `artworks.year`: the placeholder question is now settled

The export carries **real `post_date` values for all 62 posts, 2010-03-17 → 2023-12-17**, while all
**138 live rows store `'2024'`** — uniform, and therefore a default rather than authored content.
Combined with the recorded finding that **79 of 138 rows have a disagreeing archive year**, the
recommendation in the roadmap (**archive year is authoritative, as its own reviewed migration**)
now rests on evidence on both sides. **Still an overwrite ⇒ still needs explicit sign-off.**

**On alt text — the honest position.** Authored alt text is **15 strings** (`_wp_attachment_image_alt`
×2 + 13 NextGEN), not "essentially zero" — but coverage is still **15 of 350 originals (~4%)**, and
the 13 NextGEN strings need the `{stem}-copy.*` rule from §3.3 to attach to a file. The two WP
strings (`Camp Bow Wow Mural Photo`, `Camp Bow Wow Mural Wall`) attach directly.
**Do not present the 12 filename-derived strings as authored alt text.**

### 5.4 G1 / G2 — now answerable without guessing

- **G1 (`artworks.kind`)**: all 62 posts are mural-site posts ⇒ `kind = 'mural'` is unambiguous for
  the entire new set, and every one of the 138 live rows is `gallerySeries = 'Neon Americana'` ⇒
  `kind = 'fine_art'`. **The discriminator is fully derivable.**
- **G2 (provenance)**: `source_site = 'centraltexasmurals.com'`, `source_url_path` from
  `post_name`, `source_archive_path` = the export-relative path. Available for all 62.

---

## 6. Proposed scope — §11 (c)

**A new `§3.D — Recovered-source reconciliation`.** Not a reopening of 3.A or 3.B.

⚠️ **`§3.C` is not a free slot** — it is *"Exit criteria (ADR 0001 Phase B gate)"*. Phase 3 declares
*"Two deliverables"* (`§3.A`, `§3.B`); a third source makes it **three**, so **Phase 3's own framing
must change** from two deliverables to three. Say so in the amendment.

**Where it lands.** PR **#23** (`docs/v3-roadmap-rebaseline`, `045788a`) is **still open and
unmerged** — verified this session: `045788a` is **not** an ancestor of `origin/main` (`9b4eb91`),
and `origin/main` is unchanged. So per the prompt's §4, **the roadmap amendment belongs on #23**,
not in a new PR.

**Deliverables (mirroring 3.A/3.B, zero DB writes):**

1. `scripts/lib/waybackRecovered.ts` (pure) + `scripts/wayback-recovered-extract.ts` — a
   deterministic, re-runnable extraction of the 62 posts (body, title, date, taxonomy, `_wp_old_slug`,
   inline image refs, NextGEN alt text), emitting committed JSON.
2. A reconciliation report classifying the recovered corpus **NEW / EXISTS / COLLISION** and
   **diffing it against `centraltexasmurals.com-v1` per artwork** — which source is richer, which
   wins. **This diff is the deliverable the owner reads.**
3. A media plan through the existing `scripts/lib/waybackMedia.ts` (**no new ladder**), including
   `findRegistryCollisions()` against the live 152-row registry.
4. Tests in `src/test/` asserting against the committed extraction; keep the suite green and growing
   from **523 / 37**.
5. Staged SQL (if any) into `supabase/staged/` — **inert**; promote only in the Phase 4 PR.

**Acceptance:** zero DB writes · `wayback/` byte-identical · **both** `npm run lint` **and**
`npm test` green · push a branch, never `main` · report PR number, branch, gate results.

**One open design decision I need from you:** whether §3.D **regenerates** the mural half of
`supabase/staged/2026_09_15_v3_wayback_backfill.sql` (the export supersedes v1 ⇒ the 3.A mural rows
are re-derived), or **layers** on top of it (v1 rows stay, the export only fills media and bodies).
Regenerating is cleaner but discards a reviewed artifact; layering keeps it but leaves two sources
of truth for the same 60 records.

---

## 7. What did NOT change

- `roryskagen.com-v1` (136 records) is **untouched** — this export is the mural site only.
- **3.A and 3.B are not reworked.** The staged SQL already holds both dedupe pairs correctly.
- The two known stale items stand and are **not** fixed here: `045788a`'s `§3.C` still shows 3.B as
  *"not started"* with two open checkboxes (a one-commit docs follow-up owed to #23), and
  `PROMPT_GIT_REF_PLUMBING_FIX.md` is superseded.
- **Q14 (Free vs Pro) remains the top risk**, now with ~519 objects instead of 33.

---

## 8. Questions for the owner

| # | Question | Why it blocks |
| :--- | :--- | :--- |
| **D1** | Proceed with **§3.D as scoped**, or narrow it? | Everything below |
| **D2** | **Regenerate** the mural half of the staged backfill from the export, or **layer** on top of 3.A? | Two sources of truth for 60 records |
| **D3** | **Q16**: adopt the `artwork_images` join now (evidence: 38/63 multi-image, max 21)? | Blocks the Phase 4 schema extension |
| **D4** | **Q18**: is the archive `post_date` authoritative over the stored `year`? (79 rows, overwrite) | Blocks the Phase 4 backfill |
| **D5** | **Q6**: `taxonomies.type='project_type'` for the 8 project types, `Featured`/`Home` as curation flags? | Blocks the Phase 4 schema extension; 144 new `artwork_terms` rows |
| **D6** | Confirm the export **supersedes** `centraltexasmurals.com-v1` for the mural side | Determines what the diff is *for* |
| **D7** | **Q14**: Free or Pro before Phase 4? Now ~519 objects, not 33 | R-14 / R-17 |

---

## Appendix — verification method

- Parser: `%TEMP%\v3recon\wpsql.py` — a token-level reader that **discards** insignificant
  whitespace (the trap that made `post_type` read as `' attachment'` and silently returned 0 rows),
  handles `\'` escapes and `''` doubling inside quoted values, and treats `NULL` as `None`.
- Drivers: `wprecon.py` (§2 counts), `wpdiff.py` (§3 diff), `wpshape.py` (§3.3, §5.2),
  `wpcollide.py` (§3.1).
- **Nothing was written into `wayback/`**; all scratch output is under `%TEMP%\v3recon\`.
- `wayback/centraltexasmuralsbyroryskagen-20231217234521/` remains **gitignored** — `git add -A`
  cannot stage it, and `git clean -xfd` **would delete it**. Never run it here.
