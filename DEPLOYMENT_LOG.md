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
| **2026-09-12** | **v2.8.0** | [`roryskagen-5ugjqo1bo-ventureio.vercel.app`](https://roryskagen-5ugjqo1bo-ventureio.vercel.app) | `● Ready` | 22s | Production | `411138a`: Theme palette, PageHeader, design admin (Current Active) |
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
5. **Phase V: Design System & Theme Engine (Sep 12, 2026 - Present)**
   - Modernized editorial theme palette and PageHeader components live on `roryskagenart.com`.
