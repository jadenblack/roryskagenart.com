# Backlog — Studio CMS for a non-technical operator

> **Status:** Proposed — nothing here is committed to a release.
> **Written against:** `v2.11.0` (`5122812`). Every finding below was verified against the code and the
> live schema; file paths and column names are real, not illustrative.
> **Audience:** the studio operates this themselves. Each item is phrased by *what the operator
> experiences*, with the implementation note underneath for whoever builds it.

The goal is a CMS where a non-technical person can publish confidently: nothing they do should be
unrecoverable, nothing should move behind their back, and the results should be findable.

---

## Priority 1 — things that will bite a non-technical operator

### 1.1 Editing an artwork silently re-orders the catalog
`server/routes/artworks.ts:48` sorts every catalog listing with
`ORDER BY updated_at DESC, created_at DESC`. So **the piece you just edited jumps to the top of the
catalog**, and there is no way to put it back. There is no `sort_order` column on `artworks`.
The same ordering drives the **home hero slider** (`HeroGallerySlider.tsx:58` filters
`heroSlider === true` from that same list), so the artist cannot control the sequence of hero slides
either — it is "whatever was touched most recently".

*Implement:* add manual ordering. `artworks.metadata` is already `jsonb` and already round-trips
through the API, so a `metadata.sort_order` needs **no migration**; a real column is cleaner if you
prefer. Then add a "pin / move to top" control and drag-to-reorder in `CatalogView`, and order the
hero by the same value. This is likely the single most-felt annoyance.

### 1.2 There is no undo, and text edits are unrecoverable
The only recovery paths are Trash and Restore (which exist and work). But once a description or title
is overwritten and saved, the previous text is gone — the only "undo" in the codebase is the string
"cannot be undone" in the delete confirmations (`CatalogView.tsx:396`, `UsersAdminView.tsx:563`).
Draft autosave protects against a lost session, not against a bad edit.

*Implement:* a small `artwork_revisions` table (slug, snapshot jsonb, actor, created_at) written on
every update, with a "Restore this version" action and a per-artwork history list. Even a 20-revision
rolling window removes almost all fear of editing.

### 1.3 The public inquiry form has no spam protection
✅ **DELIVERED in `v3.1.0` (2026-09-15).** `POST /api/inquiries` now runs
`honeypotGate()` + `rateLimit({ rule: PUBLIC_WRITE_LIMITS.inquiries })` — 5 submissions per 30
minutes per IP, against a route that sends **two** Resend emails per hit. The honeypot field is
`company_website` (not `website`, which autofill would fill in and silently drop a real inquiry) and
the shared vocabulary lives in `src/lib/antiSpam.ts` so the form's render and the server's read
cannot drift. ⚠️ A tripped honeypot answers **201 with a plausible success**, never 400 — a bot
learns nothing. The guards were extracted into `server/lib/requestGuards.ts` (24 tests) precisely so
the *next* public door reuses them instead of inventing its own.

*Original entry, kept for provenance:* `POST /api/inquiries` had no captcha, honeypot, or rate
limiting. Each submission sends email through Resend, so the form was a direct path to a flooded
inbox and to burning email quota. ⚠️ **`v3.1.0` proved this was the repo's only unguarded public
write by making it the second one's prerequisite** — the planning tool's feedback door would
otherwise have shipped beside an unprotected twin.

### 1.4 Confirm the backup tier, or the safety net may not exist
✅ **RESOLVED — tier confirmed as Free (Q14, 2026-09-15), and the gap it exposed was closed in
`v2.13.0`.** The owner's decision was *stay on Free*, which makes the **Vercel Cron → Vercel Blob**
daily dump (`GET /api/cron/backup`, retention 14 recent + one per month) the project's only backup
rather than a belt-and-braces extra. That dump is verified end-to-end: manifest format v2 with a
sha256 per table, a self-verifying writer, and `scripts/verify-backup.ts` to re-check it.
⚠️ **Storage objects are still outside it** — `scripts/verify-media-backup.ts` *detects* a
rows ↔ objects mismatch (152 rows ↔ 605 objects, clean against production) but detection is not a
copy, so the 76.6 MiB bucket remains the one unrecoverable surface. See
`docs/runbooks/database-backup-restore.md` §6.

*Implement:* check the project's plan. If it is Free, schedule `scripts/backup-catalog.ts` (it is
already SELECT-only and writes to the gitignored `data/backups/`) to run on a schedule somewhere
offsite, and keep a separate copy of the Storage bucket. This is the item that decides whether
everything else on this list is recoverable.

---

## Priority 2 — the catalogue needs to be findable

### 2.1 Artwork pages cannot be indexed or shared properly
This is a hash-router SPA, so every artwork lives at `/#/artwork/<slug>`. Search engines and social
cards see **one** document: the `<title>`, `<meta name="description">` and `og:image` in
`index.html` are identical for all 138 works. `public/` contains **no `sitemap.xml` and no
`robots.txt`**. `og:image` is `/android-chrome-512x512.png` — the app icon, not the painting.

For a gallery, this is the highest business-impact gap: the artwork pages that should rank for the
artist's name and for each piece are effectively invisible, and every shared link shows the same
generic card.

*Implement:* the durable fix is real paths for artwork routes (History API) with per-page `<title>`,
description and `og:image` pointing at the artwork's hero rendition — which also needs either
pre-rendering or SSR, since crawlers must see the tags in the HTML. Then generate `sitemap.xml` from
`artworks` at build time and add `robots.txt`. Larger effort, but it is the difference between a
portfolio and a website nobody finds.

---

## Priority 3 — accessibility and professionalism

### 3.1 Artwork images have no alternative text
There is **no `alt_text` or `caption` column** on `artworks` (see the live schema in
`data/archive/schema_introspection.md`). The catalog renders images with `alt=""` — marked purely
decorative (`CatalogView.tsx:235`) — and the media library shows `alt={item.public_id}`, i.e. an
internal filename read aloud by a screen reader.

*Implement:* add an "Image description" field to the artwork editor and render it as the `alt`. As
with §1.1, `metadata` is already `jsonb`, so this needs no migration. It is an accessibility
requirement, and it is also free, meaningful content for search.

### 3.2 Bulk actions
`CatalogView` has **no multi-select** — no row checkboxes, no bulk operations. Assigning a series,
publishing, or archiving across the catalog means opening 138 dialogs one at a time.

*Implement:* row selection plus bulk Publish / Unpublish / Archive / assign-series, with a
confirmation that names the count.

### 3.3 No export — for a catalog raisonné
There is **no CSV, print, or PDF output anywhere**. A *catalog raisonné* is conventionally also a
document: collectors, insurers, and exhibition submissions all ask for one.

*Implement:* CSV export of the catalog is a small job and immediately useful (it also doubles as an
offline backup of the text fields). A print stylesheet for a collector-facing sheet, and eventually a
PDF, are natural follow-ups.

---

## Priority 4 — running the business from the studio

### 4.1 Inquiries stop at a status
`inquiries` supports `New / Contacted / Closed` (`server/routes/inquiries.ts:73`) — a reasonable
start. There is no notes field, no "last contacted" date, no owner, and no export. When a sale
depends on following up, that trail matters.

*Implement:* add `notes`, `last_contacted_at`, and optionally an assignee to `inquiries`, surface
them in `InquiriesView`, and add a follow-up filter ("Contacted, no reply in 14 days").

### 4.2 Onboarding for a non-technical user
The role legend added in `v2.11.0` (`UsersAdminView`) is exactly the right pattern. It is not applied
elsewhere, and there is no in-app help at all.

*Implement:* carry the same plain-language explanation into the other screens that have
non-obvious concepts (Draft vs Publish, Trash vs Delete, `hero_slider`, Taxonomies), and add a short
"getting started" checklist to the dashboard for a first-time operator. Small, and it removes most
support questions.

---

## Priority 5 — operational hygiene (already tracked)

- **`README.md` claims Apache-2.0 but no `LICENSE` file exists.** Either add the file or correct the
  claim — an ambiguous licence is a real problem for a commercial studio site.
- **2 moderate Dependabot vulnerabilities** on the default branch.
- **The `artworks` public SELECT policy does not exclude drafts** (`USING (trashed = false)`), so
  draft rows are reachable with the anon key via a direct PostgREST query. Not exploitable today only
  because the client reads through `/api/artworks`, which filters drafts server-side. **Never remove
  that server-side filter.** Tightening the policy to exclude `draft` and `trashed` is the fix.

---

## Suggested order

| # | Item | Effort | Why now |
| :--- | :--- | :--- | :--- |
| 1 | ✅ Verify backup tier / schedule exports (§1.4) | Low | Decides whether anything else is recoverable — **done: Free confirmed, cron dump live (`v2.13.0`)** |
| 2 | ✅ Spam protection on inquiries (§1.3) | Low | Protects a paid resource — **delivered in `v3.1.0`** |
| 3 | Manual catalog + hero ordering (§1.1) | Low–Med | Most-felt daily annoyance |
| 4 | Alt text field (§3.1) | Low | Accessibility + free SEO content |
| 5 | Artwork revision history (§1.2) | Med | Removes the fear of editing |
| 6 | CSV export (§3.3) | Low | Immediately useful; doubles as a text backup |
| 7 | Inquiry notes / follow-up (§4.1) | Low–Med | Turns inquiries into sales |
| 8 | Bulk actions (§3.2) | Med | Pays off across 138 works |
| 9 | Per-artwork SEO + sitemap (§2.1) | High | Highest business impact, largest change |
| 10 | Onboarding help (§4.2) | Low | Reduces support load |

Items 1–4 are individually small and together remove the sharpest edges. Item 9 is the one that
changes how the gallery performs in the world, and is best planned as its own release.
