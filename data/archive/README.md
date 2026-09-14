# data/archive — Quarantined Migration Artifacts

These files are **not** part of the runtime application. They are frozen inputs and
intermediate outputs from the pre-cutover data-scrubbing work (September 9, 2026)
that produced the current Supabase catalog.

They are retained here for provenance and reproducibility only. Nothing in `src/`,
`server/`, or `api/` imports them. Treat this directory as read-only history.

| File | What it is |
| --- | --- |
| `all_cloudinary_assets.json` | Full dump of the legacy Cloudinary asset inventory (Cloudinary is decommissioned). |
| `confirmed_image_mappings.json` | Human-confirmed slug → image mappings used to seed the registry. |
| `precise_cloudinary_registry_mapping.json` | Precise legacy-registry-to-Cloudinary mapping table. |
| `user_media_parsed.json` | Parsed media records extracted from the prior CMS export. |
| `user_post_to_image_map.json` | Post → image association map from the same export. |
| `user_posts_parsed.json` | Parsed post/catalog entries from the prior CMS export. |
| `verified_posts_full.json` | Fully verified post records with narratives and image refs. |
| `portfolioPostsData.updated.json` | Orphaned legacy portfolio registry draft. Superseded by the live `public.artworks` table; moved out of `src/data/` on 2026-09-13 (v2.9.0) because it had no importers. |

## Relationship to the v3 data migration

The `wayback/` directory (outside this folder) holds static snapshots of the two
predecessor sites — `centraltexasmurals.com-v1` and `roryskagen.com-v1` — which are
the **source** for the planned v3 data migration. See
`plan/PRD_V3_WAYBACK_DATA_MIGRATION.md`. That migration is a **merge** into the
existing Supabase catalog, not a cold seed; these archived artifacts describe the
prior state that the merge must reconcile against.
