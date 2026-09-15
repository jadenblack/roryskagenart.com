# Recovered WordPress export — §3.D extraction, diff and dedupe

- **Generated:** 2026-09-15T18:48:19.286Z
- **Source:** `wayback/centraltexasmuralsbyroryskagen-20231217234521/` — WP Migrate 2.6.9 export of the live WordPress 6.4.2 site
- **Diff baseline:** `centraltexasmurals.com-v1` (the scrape this supersedes)
- **Canonical snapshot:** 138 artworks · 152 media assets
- **Read-only.** No database writes, no uploads. This is ADR 0001 Phase B.

## 1. What was read

| Table | Rows |
| :--- | ---: |
| `posts` (all types) | 728 |
| … published `post` | **62** |
| … `attachment` | 358 |
| `term_relationships` | 600 |
| `ngg_pictures` | 25 |
| `ngg_gallery` | 6 |

Tables parsed: `kZRTSN_aioseo_posts`, `kZRTSN_ngg_gallery`, `kZRTSN_ngg_pictures`, `kZRTSN_postmeta`, `kZRTSN_posts`, `kZRTSN_term_relationships`, `kZRTSN_term_taxonomy`, `kZRTSN_terms`

## 2. Diff against the scrape

### 2.0 Classification

| Outcome | Before dedupe | After dedupe | Meaning |
| :--- | ---: | ---: | :--- |
| **NEW** | 62 | **60** | no live artwork matched — the row would be created |
| **EXISTS** | 0 | **2** | merges into a live artwork |
| **COLLISION** | 0 | **0** | two source pages, one slug — a human must adjudicate |

The two columns differ by 2 record(s): PRD_V3 §2 dedupe knowledge applied after matching. ⚠️ **The matcher classified both of those NEW** — it scores the pairs 0.833 and 0.710, below its own 0.85 gate. Reporting only the left column would have said 62 new artworks where the answer is 60 plus 2 merges.

### 2.1 Coverage

- Artworks in **both**: 61
- Artworks **only** in the recovered export: 1
- Artworks **only** in the scrape: 0

### 2.2 Present in the export, absent from the scrape

| Artwork | Title | Images | Body (chars) |
| :--- | :--- | ---: | ---: |
| `business/capstar-mural` | Capstar Mural | 1 | 314 |

### 2.4 What the export adds to shared artworks

- **Body text:** 61 of 61 shared artworks gain a description the scrape did not have.
- **Images:** 59 of 61 gain images.
- **Total images:** scrape 10 → export 173 across shared artworks.
- **Authored alt text:** scrape 0 → export 15 strings.

## 3. Content inventory — "desc, meta"

- Posts with a non-empty body: **62 / 62**
- Posts with images: **62 / 62** (38 have more than one, max 21)
- Distinct image references in bodies: **174**
- Posts with authored alt text: **5 / 62**
- Attachments carrying `_wp_attachment_image_alt`: **2 / 358**
- NextGEN pictures with *authored* alt text: **13 / 25** (of which 13 link to a published post)
- AIOSEO rows carrying an authored SEO title or description: **0 / 423**

> ⚠️ **There is no separate SEO copy to recover.** AIOSEO holds 423 rows and **zero** authored titles or descriptions. The post body *is* the description, which is why §2.3 counts body coverage rather than meta coverage. Any "meta description" on the v3 site has to be derived from the body, not imported.

## 4. Taxonomy model (Q6)

Derived from `term_relationships` over published posts — not from WordPress's denormalised `count`, which includes drafts and revisions.

| Term | Slug | Role | Posts | Why |
| :--- | :--- | :--- | ---: | :--- |
| Interior | `interior` | **project-type** | 40 | describes what the work is — belongs in a `project_type` dimension |
| Business | `business` | **project-type** | 32 | describes what the work is — belongs in a `project_type` dimension |
| Exterior | `exterior` | **project-type** | 20 | describes what the work is — belongs in a `project_type` dimension |
| Restaurant | `restaurant` | **project-type** | 13 | describes what the work is — belongs in a `project_type` dimension |
| Event | `event` | **project-type** | 12 | describes what the work is — belongs in a `project_type` dimension |
| Retail | `retail` | **project-type** | 8 | describes what the work is — belongs in a `project_type` dimension |
| Featured | `featured` | **curation** | 6 | describes where the work is shown — a curation flag, not a project type |
| Signage | `signage` | **project-type** | 5 | describes what the work is — belongs in a `project_type` dimension |
| Home | `home` | **curation** | 3 | describes where the work is shown — a curation flag, not a project type |
| Museum | `museum` | **project-type** | 3 | describes what the work is — belongs in a `project_type` dimension |

`curation` terms describe *where* a work is shown and must not be modelled as project types — filing a mural under both `interior` and `featured` as types would put it in two contradictory buckets. `noise` terms are WordPress defaults no post should carry.

## 5. Duplicate review queue — only §5.1 blocks the write

### 5.1 Certain merges — blocked from insert

| Source record | Merges into | Basis |
| :--- | :--- | :--- |
| `business/marcia-ball-cd-cover` | `marcia-ball` | known-pair |
| `featured/austin-postcard-mural` | `austin-postcard` | known-pair |

⚠️ Both PRD_V3 §2 pairs are here **even though the fuzzy matcher scores them 0.833 and 0.710** — below its own 0.85 gate. A threshold-only approach would classify both NEW and insert two duplicate artworks (R-01). Applied merges this run: 2.

### 5.2 Possible duplicates — inserted, not merged

| Kind | Score | Candidate | Against | Series? | Evidence |
| :--- | ---: | :--- | :--- | :--- | :--- |
| shared-image | 1.000 | `restaurant/aztec-mural-for-casino-el-camino` | `restaurant/casino-el-camino-mural` | no | 4 shared image(s) |
| intra-source | 0.714 | `restaurant/aztec-mural-for-casino-el-camino` | `restaurant/casino-el-camino-mural` | no | 4 shared image(s) |
| near-miss | 0.714 | `business/greetings-from-78752` | `greetings-from-texas` | **yes** | shared series name only |
| near-miss | 0.627 | `business/greetings-from-navasota-mural` | `greetings-from-texas` | **yes** | shared series name only |

**Owner decision (2026-09-15): these are inserted as separate artworks and adjudicated in the studio dashboard afterwards.** They are **not** blocked and **not** merged — so this queue is a post-ingest cleanup list, never a precondition for the write. Only §5.1 gates the write.

⚠️ **Measured precision of the review band on this corpus is 0/2.** 2 of 4 candidates share a leading run with the live title and *both* names continue past it — the signature of a series sibling (`Greetings from 78752` vs live `Greetings from Texas`), not a duplicate. They are kept rather than dropped: recall matters more than tidiness in a queue a human reads. Expect to dismiss the series-shaped rows and to act only on the image-overlap ones.

## 6. Media plan

- **Images to render + upload:** 168 across 61 artworks
- **Linkable immediately:** 3 (the rest wait for the artwork row)
- **Skipped:** 0

⚠️ **Object count, not bytes, is the risk (R-17).** The source media is ~17 MB, so the rendered WebP set lands in the low single-digit MB — trivial for the 1 GB free tier. The risk is that 168 objects are planned against 152 registered media rows today, and Supabase backups do not cover the bucket at all.

## 7. Registry collisions (R-18)

None — no planned `public_id` would take an existing artwork's registry key.

## 8. Warnings

- 1 pair(s) of records inside the ingested corpus resemble each other. A source-vs-canonical matcher cannot detect these.
- 2 source record(s) sit in the 0.6–0.85 review band. They are NOT blocked — a false merge silently destroys an artwork, so each needs a human call. ⚠️ 2 of them share a leading run with the live title and both names continue past it, which is the shape of a series sibling rather than a duplicate.
- AIOSEO holds 423 rows and **zero** authored titles or descriptions — there is no separate SEO copy to recover, so the post body IS the description.
- `featured/good-morning-austin-mural`: resolved 1 image(s) by basename after the declared upload path proved wrong (WordPress records the upload month, not the month the post was edited in)
- **57 records:** no authored alt text for any image

  <details><summary>Show the 57</summary>

  - `business/360-condominiums`
  - `event/70s-mural`
  - `home/andy-roddick-mural`
  - `business/austin-childrens-museum`
  - `featured/austin-postcard-mural`
  - `restaurant/aztec-mural-for-casino-el-camino`
  - `business/beerland-mural`
  - `event/blue-ribbon-day-mural`
  - `business/capstar-mural`
  - `restaurant/casino-el-camino-mural`
  - `business/cezanne-mural`
  - `business/cowboy-mural`
  - `featured/facebook-2`
  - `business/flosports`
  - `event/gaylord-christmas`
  - `event/govalle-elementary-school`
  - `business/greetings-from-78752`
  - `business/greetings-from-navasota-mural`
  - `business/h-e-b-austin`
  - `business/heb-print-mural`
  - `museum/hello-world`
  - `business/high-5-bowling-mural`
  - `event/hill-country-food-and-wine-tasting`
  - `restaurant/home-slice-pizza-mural`
  - `business/independence-brewery-mural`
  - `business/jack-nicholson-mural`
  - `business/lotus-flower-mural`
  - `business/lululemon-mural`
  - `business/magazine-illustration-for-life-and-letters`
  - `business/mandala-trading`
  - `business/marcia-ball-cd-cover`
  - `event/mjm-texas-stampede-for-children`
  - `restaurant/more-home-slice`
  - `home/motorcycle-mural-—-california-dreamin`
  - `event/mural-for-junior-league`
  - `restaurant/mural-for-manny-hattans-deli`
  - `event/napoleon-crossing-the-alps-mural`
  - `business/nvidia`
  - `business/old-coffee-mural`
  - `event/positivenegative-mural`
  - `business/pulte-homes-murals`
  - `featured/rgm-advisors-mural`
  - `restaurant/romantic-scenes-mural`
  - `business/rooster-teeth-mural`
  - `restaurant/schlotzskys-deli-murals`
  - `business/shady-grove-mural-at-dell-childrens-medical-center`
  - `restaurant/spaghetti-western-mural`
  - `event/stage-backdrop`
  - `retail/storyville`
  - `business/sweet-spot`
  - `business/texas-childrens-urgent-care`
  - `museum/the-lorax`
  - `signage/the-peoples-pool-hall`
  - `museum/theater-backdrop-mural`
  - `restaurant/threadgills-mural`
  - `restaurant/tiki-masks`
  - `restaurant/tx-burger-mural`

  </details>

---

Machine-readable: [`wayback_recovered_extraction.json`](./wayback_recovered_extraction.json) · [`wayback_recovered_dedupe.json`](./wayback_recovered_dedupe.json).

**Nothing has been written to the database.** The next steps are Phase 4, and the roadmap gates them on Phases 0/1/2.
