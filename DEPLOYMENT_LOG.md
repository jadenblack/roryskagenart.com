# Deployment Log

This document tracks all production and preview deployments for **`roryskagenart.com`** hosted on **Vercel** (`ventureio/roryskagen`).

---

## Production Environments & Domains

- **Primary Custom Domain:** [https://roryskagenart.com](https://roryskagenart.com)
- **Secondary Domain:** [https://www.roryskagenart.com](https://www.roryskagenart.com)
- **Vercel Production Alias:** [https://roryskagen.vercel.app](https://roryskagen.vercel.app)
- **Project Console:** `ventureio / roryskagen`
- **Connected Database:** Supabase PostgreSQL (`supabase-roryskagen` - `orphcusijzkxpxkzapjp.supabase.co`)
- **Storage Bucket:** `artwork-images` (Supabase Storage)

---

## Deployment History (Latest to Earliest)

| Date (UTC) | Version | Deployment URL | Status | Build Time | Target | Associated Commits / Milestone |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-09-14** | **v2.12.0** | [`roryskagen-6bdmr4283-ventureio.vercel.app`](https://roryskagen-6bdmr4283-ventureio.vercel.app) | `● Ready` | 22s | Production | `f5cf64c`: PR #7 — recoverability: scripted restore path, target-aware TLS, migration-ledger RLS, SQL line-ending policy, deterministic backups, `artworks` draft-exclusion policy (Current Active) |
| 2026-09-14 | v2.12.0-preview | [`roryskagen-30qktwved-ventureio.vercel.app`](https://roryskagen-30qktwved-ventureio.vercel.app) | `● Ready` | 22s | Preview | `80dafa0`: `release/v2.12.0` preview (PR #7) |
| **2026-09-14** | post-v2.11.0 | [`roryskagen-805gsqagx-ventureio.vercel.app`](https://roryskagen-805gsqagx-ventureio.vercel.app) | `● Ready` | 20s | Production | `fac2360`: PR #6 — archive sweep and deployment-log reconciliation (docs-only; no release cut) |
| 2026-09-14 | post-v2.11.0-preview | [`roryskagen-f29yvagl5-ventureio.vercel.app`](https://roryskagen-f29yvagl5-ventureio.vercel.app) | `● Ready` | 22s | Preview | `6087cf3`: `docs/archive-sweep` preview (PR #6) |
| **2026-09-14** | **v2.11.0** | [`roryskagen-megh7ufrr-ventureio.vercel.app`](https://roryskagen-megh7ufrr-ventureio.vercel.app) | `● Ready` | 22s | Production | `5122812`: PR #5 — studio operations: user administration, branded email, catalog dossier, true-to-scale drawing, role-gated nav |
| 2026-09-14 | v2.11.0-preview | [`roryskagen-ppaqvs6aa-ventureio.vercel.app`](https://roryskagen-ppaqvs6aa-ventureio.vercel.app) | `● Ready` | 21s | Preview | `467bd14`: `release/v2.11.0` preview |
| **2026-09-14** | **v2.10.0** | [`roryskagen-janycb9ok-ventureio.vercel.app`](https://roryskagen-janycb9ok-ventureio.vercel.app) | `● Ready` | 22s | Production | `962587e`: PR #4 — schema as code, reproducibility & rollback path |
| 2026-09-14 | v2.10.0-preview | [`roryskagen-ltwemien7-ventureio.vercel.app`](https://roryskagen-ltwemien7-ventureio.vercel.app) | `● Ready` | 20s | Preview | `48b01b9`: `release/v2.10.0` preview |
| **2026-09-14** | **v2.9.0** | [`roryskagen-oup13vzfl-ventureio.vercel.app`](https://roryskagen-oup13vzfl-ventureio.vercel.app) | `● Ready` | 22s | Production | `de294d0`: PR #3 — v2.9.0 release-notes completion |
| 2026-09-14 | v2.9.0-preview | [`roryskagen-luvktp6wq-ventureio.vercel.app`](https://roryskagen-luvktp6wq-ventureio.vercel.app) | `● Ready` | 21s | Preview | `40641d0`: `docs/v2.9.0-changelog` preview |
| **2026-09-14** | **v2.9.0** | [`roryskagen-6bywenhlm-ventureio.vercel.app`](https://roryskagen-6bywenhlm-ventureio.vercel.app) | `● Ready` | 20s | Production | `fd2ff25`: PR #2 — documentation & context reconciliation |
| 2026-09-14 | v2.9.0-preview | [`roryskagen-3fpbilkpx-ventureio.vercel.app`](https://roryskagen-3fpbilkpx-ventureio.vercel.app) | `● Ready` | 20s | Preview | `6b4be84`: `release/v2.9.0` preview |
| **2026-09-14** | **v2.9.0** | [`roryskagen-kdewt7lyy-ventureio.vercel.app`](https://roryskagen-kdewt7lyy-ventureio.vercel.app) | `● Ready` | 22s | Production | `8e14fda`: Full-bleed home hero, profiles RLS 500 fix |
| **2026-09-13** | **v2.9.0** | [`roryskagen-7l5crbs05-ventureio.vercel.app`](https://roryskagen-7l5crbs05-ventureio.vercel.app) | `● Ready` | 22s | Production | `a43fe40`: Artwork drafts, autosave, shadcn/ui primitives, test suite |
| **2026-09-13** | **v2.9.0** | [`roryskagen-8exvnt9u9-ventureio.vercel.app`](https://roryskagen-8exvnt9u9-ventureio.vercel.app) | `● Ready` | 18s | Production | `406def2`: Cloudinary residue cleanup, RLS hardening, server modularization |
| **2026-09-12** | **v2.8.0** | [`roryskagen-5ugjqo1bo-ventureio.vercel.app`](https://roryskagen-5ugjqo1bo-ventureio.vercel.app) | `● Ready` | 22s | Production | `411138a`: Theme palette, PageHeader, design admin |
| **2026-09-12** | **v2.7.0** | [`roryskagen-fgsmx4fqk-ventureio.vercel.app`](https://roryskagen-fgsmx4fqk-ventureio.vercel.app) | `● Ready` | 20s | Production | `b5e6c3b`: Track `api/index.js` for remote Vercel CI |
| **2026-09-12** | **v2.6.0** | [`roryskagen-i1ma7ozgd-ventureio.vercel.app`](https://roryskagen-i1ma7ozgd-ventureio.vercel.app) | `● Ready` | 20s | Production | `8db6c44`: Drag-and-drop uploader + media picker |
| **2026-09-12** | **v2.5.0** | [`roryskagen-br83wfqzg-ventureio.vercel.app`](https://roryskagen-br83wfqzg-ventureio.vercel.app) | `● Ready` | 20s | Production | `7f040c4`: Supabase single source of truth |
| **2026-09-12** | v2.4.1 | [`roryskagen-krbi5vu8n-ventureio.vercel.app`](https://roryskagen-krbi5vu8n-ventureio.vercel.app) | `● Error` | 2s | Production | Routing declaration test |
| **2026-09-12** | **v2.4.0** | [`roryskagen-efocaczfa-ventureio.vercel.app`](https://roryskagen-efocaczfa-ventureio.vercel.app) | `● Ready` | 22s | Production | `8a165b6`, `b640e59`: CJS scoping & serverless route repair |
| **2026-09-12** | v2.3.2 | [`roryskagen-5i3si5m0l-ventureio.vercel.app`](https://roryskagen-5i3si5m0l-ventureio.vercel.app) | `● Error` | 2s | Production | ESM / CJS module boundary debugging |
| **2026-09-12** | v2.3.1 | [`roryskagen-bep5qkpf9-ventureio.vercel.app`](https://roryskagen-bep5qkpf9-ventureio.vercel.app) | `● Error` | 2s | Production | `vercel.json` JSON escape syntax fix |
| **2026-09-12** | **v2.3.0** | [`roryskagen-7fb2tkhjb-ventureio.vercel.app`](https://roryskagen-7fb2tkhjb-ventureio.vercel.app) | `● Ready` | 7s | Production | `b68b523`, `41f08e6`: PR #1 CMS Admin Dashboard with shadcn/ui |
| **2026-09-11** | **v2.2.0** | [`roryskagen-t2f0zd7ss-ventureio.vercel.app`](https://roryskagen-t2f0zd7ss-ventureio.vercel.app) | `● Ready` | 30s | Production | `ceb0674`, `7be31a5`: Bundled Express serverless function |
| **2026-09-11** | v2.2.0-rc | [`roryskagen-nd813sakx-ventureio.vercel.app`](https://roryskagen-nd813sakx-ventureio.vercel.app) | `● Ready` | 32s | Production | Serverless pre-bundling validation |
| **2026-09-11** | **v2.1.0** | [`roryskagen-3losagkmx-ventureio.vercel.app`](https://roryskagen-3losagkmx-ventureio.vercel.app) | `● Ready` | 18s | Production | `5b6a857`: Supabase Storage & Sharp Rendition Pipeline |
| **2026-09-10** | **v2.0.0** | [`roryskagen-7ua9x1ntz-ventureio.vercel.app`](https://roryskagen-7ua9x1ntz-ventureio.vercel.app) | `● Ready` | 18s | Production | `796bf03`: Production Baseline Tag (`v2.0.0`) |
| **2026-09-09** | v2.0.0-rc2 | [`roryskagen-noyq3jg1e-ventureio.vercel.app`](https://roryskagen-noyq3jg1e-ventureio.vercel.app) | `● Ready` | 24s | Production | `908d105`: Resend email notifications integration |
| **2026-09-09** | v2.0.0-rc1 | [`roryskagen-jx8xlyj9j-ventureio.vercel.app`](https://roryskagen-jx8xlyj9j-ventureio.vercel.app) | `● Ready` | 27s | Production | `47dc025`: Supabase PostgreSQL client integration |
| **2026-08-25** | v1.2.0 | [`roryskagen-2qdv1twxq-ventureio.vercel.app`](https://roryskagen-2qdv1twxq-ventureio.vercel.app) | `● Ready` | 17s | Production | `fbaeccf`: Hero slider management & terminology polish |
| **2026-08-20** | v1.1.0 | [`roryskagen-acqklljqv-ventureio.vercel.app`](https://roryskagen-acqklljqv-ventureio.vercel.app) | `● Ready` | 19s | Production | `1cf4d89`, `b77846b`: Navigation revamp & client vault |
| **2026-08-19** | v1.0.1 | [`roryskagen-3fpmyg0om-ventureio.vercel.app`](https://roryskagen-3fpmyg0om-ventureio.vercel.app) | `● Ready` | 10s | Production | `105bd5d`, `7789398`: Native auth & state persistence |
| **2026-08-18** | **v1.0.0** | [`roryskagen-exi06l3r8-ventureio.vercel.app`](https://roryskagen-exi06l3r8-ventureio.vercel.app) | `● Ready` | 20s | Production | `4a159ca`, `faa6d37`: Initial baseline deployment |

---

## Key Deployment Milestones & Architecture Evolution

1. **Phase I: Monolithic Client SPA (Aug 18 – Aug 25, 2026)**
   - Deployed as pure static Vite output.
   - Images served via Cloudinary and local mock state.
2. **Phase II: Data Layer & Media Migration (Sep 9 – Sep 11, 2026)**
   - Transitioned to Supabase PostgreSQL database and Supabase Storage bucket.
   - Batch generated sharp image renditions (`thumb`, `hero`, `full`, `lqip`).
3. **Phase III: Serverless Express Migration (Sep 11, 2026)**
   - Transitioned Express API into a single bundled Vercel serverless function (`/api/index.js`).
4. **Phase IV: Studio Admin CMS with shadcn/ui (Sep 12, 2026)**
   - Modern administration dashboard at `/#/admin`.
   - Idempotent SQL migration pipeline and Supabase single source of truth.
5. **Phase V: Design System & Theme Engine (Sep 12, 2026)**
   - Modernized editorial theme palette and PageHeader components live on `roryskagenart.com`.
6. **Phase VI: Release Engineering & Schema-as-Code (Sep 14, 2026)**
   - Releases now go through a PR gate: a Vercel preview deployment plus Socket Security and
     Debricked checks must pass before merge to `main` (`v2.9.0` onward).
   - Baseline schema migration (`2026_09_01_baseline_core_tables.sql`) makes the database
     reproducible from version control; read-only schema introspection and a catalog
     backup/restore runbook were added (`v2.10.0`).
7. **Phase VII: Studio Operations (Sep 14, 2026)**
   - Staff-management console (edit / invite / re-invite / reset), branded studio email from a
     single shell, role-gated navigation and actions, and a true-to-scale Scale & Proportions
     drawing (`v2.11.0`).
8. **Phase VIII: Recoverability & Rehearsal (Sep 14, 2026 — Present)**
   - ADR 0001 Phase A verified by destruction and rebuild: 10 of 10 migrations recreate the schema
     in a virgin database with no structural difference from production. The restore path is
     scripted and rehearsed end-to-end, backups are deterministic and diffable, a local Supabase
     stack provides a scratch database to rehearse against, and the `artworks` public read policy
     no longer exposes drafts (`v2.12.0`).

---

## Maintaining this log

Rows are one per notable deployment. To refresh after a release, list deployments with their
commit SHAs (this is how the `v2.9.0`–`v2.11.0` rows above were reconstructed):

```bash
vercel ls roryskagen --yes --json | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  for (const x of JSON.parse(s).deployments.slice(0,15))
    console.log([new Date(x.createdAt).toISOString().slice(0,16),
      (x.target||'-').padEnd(10), (x.meta.githubCommitSha||'').slice(0,7),
      (x.meta.githubCommitRef||'?').padEnd(18), x.url].join('  '));
});"
```

Do **not** invent a row. Every URL, commit and build time here came from the Vercel API.
