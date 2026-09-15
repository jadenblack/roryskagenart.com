# PRD — v2.16.0: Media Pipeline (rescoped after owner decisions)

> **Status:** 📋 **DRAFT — proposed, not scheduled.** Written 2026-09-15.
> Supersedes [`PROMPT_V2_15_0_STORAGE_CDN.md`](./PROMPT_V2_15_0_STORAGE_CDN.md) and the first draft of
> this document. Owner answered the four blocking questions (§1), which **removed most of the scope**.
>
> **Read §2 first.** An earlier diagnosis in this document's lineage — that the rendition ladder is
> broken — was **wrong**, and is corrected here with the measurements that disproved it.

---

## 1. Owner decisions (2026-09-15)

| # | Question | Answer | Consequence |
| :--- | :--- | :--- | :--- |
| **Q1** | Are the 151 `original.*` objects the true masters, or re-derivable copies? | **Copies.** The artist holds all originals in a secure, durable backup and can re-populate at any point, now or later. | Deleting them is **safe**. The durability argument that blocked it disappears. An off-site bucket copy is no longer a hard gate — it becomes a convenience (§5 S4). |
| **Q2** | Does v3 ingest the 10 MB of Wayback snapshots, or true full-res originals? | **Wayback, at web quality, applied *pre-ingest*.** | v3's ingest is a **batch pre-pass**, not a runtime upload. It must **not** go through `POST /api/media/upload`, and must not rely on that route gaining an encoder (§7). |
| **Q3** | Cloudflare in front of Supabase Storage? | **No.** Unwanted stack complexity; only worth revisiting in the context of a move off Vercel. | The CDN work item is **deleted**. Browser caching is the entire egress strategy (§5 S3). |
| **Q4** | Is a 2000 px cap acceptable for `full`? | **Yes.** 2000 px for desktop is fine. Full-res is **never** needed in the studio; when print-on-demand arrives it will be sourced off-studio. | Confirms the cap, confirms deleting the masters, and **rules out ever building full-res handling into the studio**. The existing 2048 px cap is already compliant in spirit (§3). |

---

## 2. Correction: the rendition ladder is not broken

A previous draft of this document claimed the headline defect was a "dimensionally degenerate" ladder
— that 79 of 151 thumbnails were the same pixel size as the full image, so the grid downloaded
full-size images. **That was a misreading, and it drove a wrong scope.** The measurements:

- **72 of 151 rendition sets downscale correctly** (`thumb.width < full.width`). The ladder works.
- The **other 79 are capped by their source, not by a bug.** Median source width is **624 px** — below
  the 640 px thumbnail target. A 480 px source cannot yield a 640 px thumbnail; every encoder caps at
  source width, and doing anything else would mean upscaling. These assets are simply small.
- **Encoding is already efficient.** `full` averages **221 KB per megapixel** (p10 136, p90 309, max
  468) — squarely in the normal band for WebP q80–q88 photographic content. Re-encoding to q80 would
  recover very little.
- **The "18 assets over 2000 px" are all exactly 2048 px.** The Cloudinary migration already capped
  `full` at 2048. Re-capping at 2000 would save ~2 %.

**Conclusion: there is no meaningful re-encode project here.** The catalog is WebP, sensibly encoded,
correctly laddered, and already at the agreed resolution standard. The v2.15.0 brief's premise — and
this document's first draft — were both solving a problem that does not exist.

---

## 3. Verified measurements (2026-09-15, production, read-only)

Bucket `artwork-images`, 605 objects, **76.57 MiB** (7.5 % of the 1 GB free allowance):

| Rendition | Files | Size | Share | Notes |
| :--- | ---: | ---: | ---: | ---: |
| `original.*` | 151 | **32.82 MiB** | 42.8 % | Unreferenced by any row. Deletable per Q1/Q4. |
| `full` | 151 | 20.55 MiB | 26.8 % | Capped at 2048 px. 221 KB/MP median. |
| `hero` | 151 | 14.45 MiB | 18.9 % | 1280 px target. |
| `thumb` | 151 | 8.75 MiB | 11.4 % | 640 px target, capped at source. |
| other | 1 | ~0 MiB | — | |

- **Source widths:** p10 480 · median 624 · p90 2100 · max 2697. Only 18 sources exceed 2000 px.
- **151 of 152 rows** have `renditions` + `lqip`. **1 does not** — the asset created by
  `POST /api/media/upload`.
- **Egress, estimated:** average thumbnail 59.4 KB ⇒ a full 138-artwork grid browse is roughly
  **8.0 MiB** (upper bound; lazy-loading and pagination reduce it). Against 5 GB/month that is
  **~640 full browses per month.** Comfortable for this site's traffic, but it is the one number that
  could become binding — and it has never actually been measured.

---

## 4. What the decisions did to the scope

| Original item | Outcome |
| :--- | :--- |
| WebP re-encode of the catalog | **Removed** — already WebP, already efficient (§2). |
| Real thumb/hero/full ladder | **Removed** — already correct where physically possible (§2). |
| CDN in front of Storage | **Removed** — Q3. |
| Off-site bucket copy as a deletion gate | **Downgraded** to optional (Q1 makes re-population possible). |
| Drop 151 `original.*` masters | **Kept, and now safe** — reframed as housekeeping, not optimisation. |
| Renditions on the upload route | **Kept** — but as a fix for **admin uploads**, not as the v3 ingest path (Q2). |
| `Cache-Control` on existing objects | **Kept, and promoted** — with no CDN, it is the whole egress strategy. |
| Measure egress | **Kept** — currently unmeasured. |

---

## 5. Remaining scope

### S1 — Delete the 151 `original.*` masters

Safe per Q1, and correct per Q4 (full-res is never needed in the studio). Saves 32.82 MiB; the bucket
drops from 76.57 to **43.75 MiB (4.3 % of the allowance)**.

Be clear about *why*: the size saving is not the point — 4.3 % of a non-binding allowance buys
nothing. The point is that **151 objects sit in the bucket that no row references and no check would
notice the loss of.** They are unmonitored surface area. Deleting them removes the ambiguity.

**Acceptance:** 605 → 454 objects; `scripts/verify-media-backup.ts` still reports 0 missing, 0
size mismatches, 0 unexpected orphans; a verified dump taken first
(`scripts/backup-catalog.ts`); object list captured before deletion.

### S2 — Give `POST /api/media/upload` a real ladder

Today it inserts `VALUES ($1, $2, $2, …)`, so `url` and `thumbnail_url` are the same string, and
`renditions` / `lqip` are never written. It also takes `width`/`height` from client form data
(nullable) rather than from the decoded image.

This is a **live studio bug**, not a v3 prerequisite: any photo an admin uploads today gets no
thumbnail. Extract the encoder already in `scripts/migrate-cloudinary-to-supabase.ts` (the only
`sharp` usage) into a shared module; keep it out of `scripts/lib/` if it drags in forbidden imports
(`src/test/bundleSafety.test.ts` enforces that boundary).

**Acceptance:** one upload yields thumb + hero + full + lqip, populates `renditions`, and produces
`url !== thumbnail_url`. Covered by tests.

### S3 — Verify `Cache-Control` on the 605 existing objects (promoted)

With no CDN, immutable browser caching is the **entire** egress lever. New uploads already set
`cacheControl: "31536000"`; the 605 objects created by the Cloudinary migration were never checked.

**Acceptance:** a documented statement of what those objects carry; immutable caching on renditions;
no object's bytes changed by the fix.

### S4 — Off-site bucket copy (optional, downgraded)

Still an open gap in `docs/runbooks/database-backup-restore.md` §6, and still worth doing — the whole
bucket is ~44 MiB after S1. But Q1 removes the urgency: re-population from the studio's own archive
is possible, so this is now about **recovery speed**, not survival. Recommend doing it, do not gate
S1 on it.

### S5 — Measure egress once, and record it

The 8 MiB per full browse figure in §3 is an estimate. Read the real number from Supabase's usage
reporting after S1–S3 and record it in the runbook, with a note on what would make it binding
(~640 full browses/month today). Without one real measurement, any future optimisation is guesswork.

---

## 6. Explicitly not doing

- **No CDN and no new vendor.** Q3. Supabase's own edge plus immutable browser caching is the
  strategy. If egress ever binds, the first moves are smaller payloads, lazy loading and pagination —
  not another stack. A media move to R2/Bunny is only worth considering alongside a hosting change.
- **No re-encode of the catalog.** §2 — the gain is ~2 %.
- **No full-resolution handling in the studio, ever.** Q4. When print-on-demand arrives it sources
  full-res from off-studio; the studio app stays at web quality.
- **No off-site copy as a blocker.** Q1.
- **No video pipeline.** No video exists in the catalog or the Wayback archive. If video is added
  later it goes to a streaming CDN, never Supabase egress.

---

## 7. What this settles for v3.0.0

**Q2 makes v3's ingest a batch pre-pass, and that is a real design constraint.** It means:

1. The Wayback images are normalised **offline** — run the shared encoder over `wayback/` once,
   producing web-quality renditions on disk — and only then registered in the catalog.
2. It must **not** go through `POST /api/media/upload`. That route is for a human uploading one photo
   through the admin UI; it is not a bulk ingest path.
3. It must **not** go through `POST /api/artworks`, which hardcodes year 2024, "Acrylic on Canvas",
   48"x60", $9,500 and "Neon Americana" (2026-09-14 review).
4. → **v3 needs a bulk registration path.** That is a v3 Phase B deliverable, and it should be
   designed now so the pre-ingest pass has something to write into.

The other v3 prerequisites are unchanged from the 2026-09-14 review: `kind` + source-provenance
columns, multi-image support (`artworks.image_url` is single-valued), de-bundling
`assetRegistry.ts` (445 KB to every visitor), pagination + FTS on `GET /api/artworks`, and
per-artwork addressable routes (the prerequisite for `sitemap.xml`, which `public/robots.txt`
deliberately omits today).

---

## 8. Risks and rollback

| Risk | Mitigation |
| :--- | :--- |
| A master is deleted and later wanted | Q1: re-populatable from the studio's durable archive. A verified dump and the object list are taken before S1 regardless. |
| S2 changes admin upload behaviour | Response shape unchanged; covered by tests; the admin can still upload. |
| `sharp` leaks into the serverless bundle | Keep the encoder out of `scripts/lib/`; `bundleSafety.test.ts` fails the build if `pg`/`fs`/`dotenv` reach runtime code. |
| Deleting masters breaks an image | `verify-media-backup.ts` proves 0 rows reference them before deletion and is re-run after. |

**Rollback:** every row touched by S2 is recoverable from the pre-change dump (`renditions` is JSON).
S1 is the only irreversible step, which is why it carries a dump, an object listing, and Q1.

---

## 9. Recommendation on release shape

After §2 and the four decisions, what remains is **three small items** (S1, S2, S3) plus two
optional ones (S4, S5). That is a thin minor release.

**Recommendation:** ship **S2 now** — it is a live bug affecting everyday studio use — either as a
small `v2.16.0` or folded into v3 Phase 0. S1, S3 and S5 are housekeeping that v3 touches anyway and
can travel with it. Do not keep a "storage/CDN" release alive on the roadmap: the problem it was
named for does not exist, and a standing item like that invites someone to re-derive the wrong scope.

---

## 10. Acceptance criteria (release-level)

- [ ] 151 `original.*` objects deleted; bucket 605 → 454 objects / ~43.75 MiB; verifier clean.
- [ ] `POST /api/media/upload` produces thumb + hero + full + lqip, `url !== thumbnail_url`.
- [ ] `Cache-Control` on all 605 existing objects verified and documented; immutable on renditions.
- [ ] Real egress figure measured once and recorded in the runbook.
- [ ] No CDN, no new vendor, no full-res handling added anywhere.
- [ ] `npm run lint` and `npm test` green; PR gates CLEAN; tagged `v2.16.0` if cut.
