# Rory Skagen Studio — Official Web Application & Fine Art Catalog

[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Backend-Express.js-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase_PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Cloudinary](https://img.shields.io/badge/CDN-Cloudinary-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com/)

Official digital gallery, catalog raisonné, and studio management application for celebrated Austin artist **Rory Skagen** ([roryskagenart.com](https://roryskagenart.com)). Renowned for defining Austin’s visual landscape—including the iconic *"Greetings from Austin"* South 1st Street mural—Rory Skagen's fine art oeuvre spans pop surrealism, neon Americana, retro-futurism, monumental public murals, and original acrylic and mixed-media canvases.

This full-stack application provides both an elegant, collector-grade public presentation and a powerful virtual studio inventory engine.

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Key Features](#key-features)
- [Data Engine & Storage Architecture](#data-engine--storage-architecture)
- [Directory Structure](#directory-structure)
- [API Endpoints](#api-endpoints)
- [Database Schema (Supabase / PostgreSQL)](#database-schema-supabase--postgresql)
- [Environment Variables](#environment-variables)
- [Installation & Local Development](#installation--local-development)
- [Deployment](#deployment)
- [Pull Request & Development Plans](#pull-request--development-plans)
- [License & Credits](#license--credits)

---

## Overview & Architecture

The application is architected as a modern full-stack application combining a high-performance React 18 client with a bundled Express.js backend and a PostgreSQL database on Supabase:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Rory Skagen Studio App                          │
├────────────────────────────────────────────────────────────────────────┤
│  Client Tier (React 18 + Vite + Tailwind CSS)                          │
│  ├── Collector Front: Landing, Curated Gallery Grid, Lightbox Focus    │
│  ├── Inquiries: Direct Art Acquisition & Commission Forms              │
│  ├── Studio Admin: Drive Explorer, Master Catalog Table, Trash Vault   │
│  └── GalleryStateEngine: Reactive Local State + Virtual File System    │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Backend Tier (Express.js)       │  Asset & Database Services          │
│  ├── /api/artworks CRUD          │  ├── Cloudinary Media CDN           │
│  ├── /api/inquiries capture      │  ├── Supabase PostgreSQL DB         │
│  ├── /api/pages management       │  └── Google Drive Virtual Tree      │
│  └── /api/cloudinary uploader    │                                     │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## Key Features

### 1. Collector & Visitor Experience
- **Dynamic Hero Showcase**: High-impact carousel highlighting select monumental paintings and museum-scale works.
- **Curated Gallery Grid**: Multi-dimensional filtering by gallery series (*Neon Americana*, *Pop Surrealism*, *Murals & Public Works*, etc.), medium, availability status (*Available*, *Reserved*, *Sold*), and size scale.
- **Artwork Focus & Lightbox View**: High-definition zoom imagery, physical metrics in both imperial and metric units, background narratives, provenance notes, and live pricing.
- **Acquisition Inquiry System**: Direct lead capture modal allowing serious collectors and gallery curators to inquire about individual works or commission custom pieces.
- **Ambient Lighting Themes**: Handcrafted dark/light studio aesthetics with seamless state persistence.

### 2. Studio Inventory & Asset Management
- **Master Catalog & Media Registry (`/registry`)**: Comprehensive master table displaying all 130+ fine art records with real-time status toggling, direct markdown export, and Cloudinary asset mapping.
- **Google Drive Virtual File System (`/explorer`)**: Visual file explorer mirroring the studio's Google Drive archive (`My Drive/Clients/roryskagen.com/website-content/`) with live YAML frontmatter editing and sync.
- **Two-Stage Trash Vault (`/trash`)**: Non-destructive inventory lifecycle allowing works to be staged in trash, restored, or permanently expunged.
- **Cloudinary Asset Manager (`xjilp2pq`)**: Direct image asset ingestion, URL signing, CDN cache busting, and asset health verification.

---

## Data Engine & Storage Architecture

The application implements a resilient, hybrid data flow:

1. **`GalleryStateEngine`**:
   - Manages an in-memory virtual file system consisting of posts (`posts/{slug}.md`), pages (`pages/{slug}.md`), image representations, and the root `index.md` catalog.
   - Provides reactive event subscription (`subscribe()`) ensuring instant UI re-renders across all active views upon any inventory modification.
   - Preserves user adjustments in `localStorage` for offline and session continuity.

2. **Supabase PostgreSQL Database**:
   - Stores authoritative persistent records for artworks, pages, inquiries, and media asset logs.
   - Accessed via server-side `/api/` endpoints to enforce security and bypass browser-side RLS constraints.

3. **Cloudinary Asset Pipeline**:
   - Delivers responsive, optimized WebP/JPEG assets globally from cloud storage.

---

## Directory Structure

```
├── .env.example              # Sample environment variable declarations
├── README.md                 # Project documentation (this file)
├── metadata.json             # AI Studio applet configuration & permissions
├── package.json              # Dependency manifests and run scripts
├── server.ts                 # Express backend API & Vite middleware entry
├── vite.config.ts            # Vite build configuration with Tailwind support
├── /plan                     # Technical specifications, RFCs, & Pull Requests
│   └── FEATURE_PULL_REQUEST.md # Full PR specification for Supabase Engine sync
├── /src
│   ├── App.tsx               # Root application router and view controller
│   ├── main.tsx              # React DOM entry point
│   ├── types.ts              # TypeScript interfaces for artworks, files, and state
│   ├── /components           # Extracted UI components & views
│   │   ├── Navbar.tsx        # Navigation header with routes & theme toggler
│   │   ├── HomeLandingView.tsx # Collector landing page & hero slider
│   │   ├── GalleryGrid.tsx   # Filterable fine art catalog grid
│   │   ├── ArtworkFocusView.tsx # Full-screen artwork detail & lightbox
│   │   ├── MasterRegistryTable.tsx # Studio inventory management registry
│   │   ├── DriveExplorer.tsx # Virtual Google Drive directory browser
│   │   ├── TrashView.tsx     # Studio trash vault for deleted items
│   │   ├── InquiryModal.tsx  # Collector purchase inquiry modal form
│   │   ├── ContactView.tsx   # Studio contact & commission inquiry page
│   │   ├── AboutView.tsx     # Artist biography & career retrospective
│   │   └── CloudinaryManager.tsx # Image asset uploader & registry inspector
│   ├── /context              # React context providers (AuthContext, ThemeContext)
│   ├── /data                 # Verified registries, Drive file system seed, mappings
│   │   ├── driveFileSystem.ts # Virtual Drive folder generator & file builder
│   │   ├── portfolioPostsData.ts # Catalog baseline records (130+ paintings)
│   │   ├── cloudinaryMap.ts  # CDN mapping resolver and asset dictionary
│   │   └── mediaAssetsData.ts # Media log entries with dimensions and formats
│   ├── /engine
│   │   └── galleryStateEngine.ts # Hybrid reactive state & virtual file system
│   └── /lib
│       └── supabase.ts       # Supabase client setup & environment loader
```

---

## API Endpoints

The Express server exposes the following RESTful endpoints on port `3000`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Server health check and timestamp |
| `GET` | `/api/artworks` | Query all artworks (supports `?include_trashed=true` & filters) |
| `GET` | `/api/artworks/:slug` | Retrieve single artwork details by slug |
| `POST` | `/api/artworks` | Create new artwork record in database |
| `PATCH` | `/api/artworks/:slug` | Update metadata, pricing, hero status, or flags |
| `DELETE` | `/api/artworks/:slug` | Soft trash (`trashed: true`) or permanent purge (`?permanent=true`) |
| `GET` | `/api/pages` | List published site pages (`about`, `contact`, etc.) |
| `GET` | `/api/pages/:slug` | Get markdown content for specific page |
| `POST` | `/api/inquiries` | Submit buyer/collector inquiry or commission request |
| `GET` | `/api/inquiries` | List submitted inquiries (admin review) |
| `POST` | `/api/cloudinary/upload` | Upload image file to Cloudinary CDN folder |

---

## Database Schema (Supabase / PostgreSQL)

The backend interacts with the following PostgreSQL tables:

```sql
-- 1. Artworks Table
CREATE TABLE IF NOT EXISTS public.artworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    year TEXT DEFAULT '2024',
    medium TEXT DEFAULT 'Acrylic on Canvas',
    dimensions TEXT DEFAULT '48" x 60"',
    price TEXT DEFAULT '$9,500',
    status TEXT DEFAULT 'Available',
    gallery_series TEXT DEFAULT 'Neon Americana',
    edition TEXT DEFAULT 'Original Painting',
    location TEXT DEFAULT 'Austin Studio',
    image_url TEXT,
    hero_slider BOOLEAN DEFAULT false,
    enabled BOOLEAN DEFAULT true,
    archived BOOLEAN DEFAULT false,
    trashed BOOLEAN DEFAULT false,
    trashed_at TIMESTAMPTZ,
    narrative TEXT DEFAULT '',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Inquiries Table
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artwork_slug TEXT,
    artwork_title TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'New',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Environment Variables

Configure the following variables in `.env` (refer to `.env.example`):

```bash
# Supabase PostgreSQL Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
POSTGRES_URL=postgresql://postgres:password@host:5432/postgres

# Cloudinary CDN Configuration
CLOUDINARY_CLOUD_NAME=xjilp2pq
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Application Port
PORT=3000
```

---

## Installation & Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/roryskagen/roryskagenart.git
   cd roryskagenart
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

4. **Run TypeScript verification & linter**:
   ```bash
   npm run lint
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```
   Compiles static client assets to `dist/` and bundles `server.ts` to `dist/server.cjs`.

6. **Start production server**:
   ```bash
   npm start
   ```

---

## Pull Request & Development Plans

All major architectural proposals and feature branches are documented in the `/plan` directory:

- [`/plan/FEATURE_PULL_REQUEST.md`](./plan/FEATURE_PULL_REQUEST.md): Comprehensive feature specification, code diffs, and testing instructions for the full **Supabase Database Synchronization & Engine Integration** PR.

---

## License & Credits

- **Artwork & Imagery**: © Rory Skagen. All rights reserved. Reproduction or distribution without prior written permission is strictly prohibited.
- **Application Code**: Licensed under the [Apache-2.0 License](./LICENSE).
