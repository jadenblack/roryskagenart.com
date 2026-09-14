# Feature Pull Request: Supabase Database Synchronization & Engine Integration

> ⛔ **SUPERSEDED — historical record only (do not implement).**
>
> This proposal predates the architecture it describes. Since it was written the backend was
> **modularized** (`server/routes/*`), the engine was rebuilt as a DB-backed reactive store
> (`src/engine/galleryStateEngine.ts`), and Cloudinary was fully removed. Its assumptions no longer
> match the codebase — in particular the `public.artworks` schema shown here omits `draft` and the
> `taxonomies` / `artwork_terms` model, and the `GalleryAppEngine` / `batch-sync` surface it
> describes was never built in this form.
>
> **For the verified current state, read [`../AGENTS.md`](../AGENTS.md).** See
> [`README.md`](./README.md) for the status of every plan document.

**Branch / Context:** `feature/supabase-engine-sync`  
**Target:** `main`  
**Status:** Superseded (preserved as design history)  
**Author:** Rory Skagen Studio Engineering  
**Date:** September 9, 2026  
**Superseded:** September 13, 2026 (v2.9.0)  

---

## 1. Summary of Changes

This pull request establishes full bidirectional synchronization between the in-memory/virtual-filesystem state engine (`GalleryStateEngine` / `GalleryAppEngine`) and the Supabase PostgreSQL database tables (`public.artworks`, `public.pages`, `public.inquiries`, `public.media_assets`).

### Key Capabilities Preserved:
1. **GalleryAppEngine Supabase Connection**:
   - Integrated `@supabase/supabase-js` client into `GalleryStateEngine`.
   - Connected `initSupabaseRealtime()` to listen to live `postgres_changes` events on `public.artworks`.
   - Exposed global singleton aliases `GalleryAppEngine`, `GalleryAppEngineInstance`, and `galleryAppEngine`.
   - Added live `syncStatus` monitoring (`idle`, `syncing`, `success`, `error`) and event subscriber notifications.

2. **Batch Sync API & Direct Synchronization (`syncLocalArtworksToSupabase`)**:
   - Built a high-performance batch upsert method that maps client `ArtworkRecord` models to PostgreSQL column structures (`slug`, `title`, `year`, `medium`, `dimensions`, `price`, `status`, `gallery_series`, `edition`, `location`, `image_url`, `hero_slider`, `enabled`, `archived`, `trashed`, `trashed_at`, `narrative`, `metadata`).
   - Implemented `POST /api/artworks/batch-sync` on the Express/Node.js backend with `ON CONFLICT (slug) DO UPDATE` to reliably handle RLS constraints when anon client tokens lack table-level direct write permissions.

3. **Lifecycle State Mutation Persistence**:
   - Tied artwork mutations to asynchronous Supabase persistence via `syncArtworkRecordToSupabase`:
     - `toggleEnableArtwork(slug)`: Updates `enabled` and `status` in PostgreSQL.
     - `toggleArchiveArtwork(slug)`: Updates `archived` and `status` in PostgreSQL.
     - `toggleHeroSlider(slug)` & `setHeroSlider(slug, boolean)`: Updates `hero_slider` in PostgreSQL.
     - `trashArtwork(slug)`: Flags `trashed: true`, `status: 'Trashed'`, and `trashed_at: now` in PostgreSQL.
     - `restoreArtwork(slug)`: Reverts `trashed: false`, sets `status: 'Available'` in PostgreSQL.
     - `permanentlyDeleteArtwork(slug)`: Invokes `DELETE /api/artworks/:slug?permanent=true` to delete from PostgreSQL.
     - `createNewArtwork(...)`: Persists newly authored studio works directly to PostgreSQL.

4. **Master Registry UI Controls**:
   - Added an interactive **"Sync to Supabase"** action button in `MasterRegistryTable.tsx`.
   - Shows live sync feedback: `SYNC TO SUPABASE`, `SYNCING SUPABASE...` (with spinner), `SYNCED (count)`, and `RETRY SYNC`.

---

## 2. Detailed Code Diffs

### A. Backend API (`/server.ts`)
```typescript
// Batch Sync Local Artwork Data Records with PostgreSQL Table
app.post("/api/artworks/batch-sync", async (req, res) => {
  try {
    const rawRecords = req.body?.records || req.body?.artworks || [];
    if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
      return res.status(400).json({ error: "An array of artwork records is required." });
    }

    let syncedCount = 0;
    const upsertSql = `
      INSERT INTO public.artworks (
        slug, title, year, medium, dimensions, price, status,
        gallery_series, edition, location, image_url, hero_slider,
        enabled, archived, trashed, trashed_at, narrative, metadata,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        now(), now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        year = EXCLUDED.year,
        medium = EXCLUDED.medium,
        dimensions = EXCLUDED.dimensions,
        price = EXCLUDED.price,
        status = EXCLUDED.status,
        gallery_series = EXCLUDED.gallery_series,
        edition = EXCLUDED.edition,
        location = EXCLUDED.location,
        image_url = EXCLUDED.image_url,
        hero_slider = EXCLUDED.hero_slider,
        enabled = EXCLUDED.enabled,
        archived = EXCLUDED.archived,
        trashed = EXCLUDED.trashed,
        trashed_at = EXCLUDED.trashed_at,
        narrative = EXCLUDED.narrative,
        metadata = EXCLUDED.metadata,
        updated_at = now()
      RETURNING slug;
    `;

    for (const r of rawRecords) {
      if (!r || !r.slug || !r.title) continue;
      const slug = String(r.slug).toLowerCase().trim();
      const meta = typeof r.metadata === "object" ? JSON.stringify(r.metadata) : (r.metadata || "{}");

      await query(upsertSql, [
        slug,
        r.title,
        String(r.year || "2024"),
        r.medium || "Acrylic on Canvas",
        r.dimensions || '48" x 60"',
        r.price || "$9,500",
        r.status || "Available",
        r.gallery_series || "Neon Americana",
        r.edition || "Original Painting",
        r.location || "Austin Studio",
        r.image_url || r.imageUrl || r.featured_image || `/images/${slug}.svg`,
        r.hero_slider === true || r.heroSlider === true,
        r.enabled !== false,
        r.archived === true,
        r.trashed === true,
        r.trashed_at || r.trashedAt || (r.trashed ? new Date().toISOString() : null),
        r.narrative || "",
        meta
      ]);
      syncedCount++;
    }

    return res.json({
      success: true,
      syncedCount,
      message: `Successfully synchronized ${syncedCount} artwork records with Supabase PostgreSQL tables.`
    });
  } catch (err: any) {
    console.error("Batch sync artworks error:", err);
    return res.status(500).json({ error: err.message || "Failed to batch sync artwork records" });
  }
});
```

### B. State Engine (`/src/engine/galleryStateEngine.ts`)
```typescript
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export class GalleryStateEngine {
  // Supabase connection & live synchronization status
  public supabase = supabase;
  public isSupabaseConnected: boolean = isSupabaseConfigured;
  public syncStatus: {
    state: 'idle' | 'syncing' | 'success' | 'error';
    lastSyncedAt: string | null;
    recordsSynced: number;
    error?: string | null;
  } = {
    state: 'idle',
    lastSyncedAt: null,
    recordsSynced: 0,
    error: null,
  };

  private realtimeSubscription: any = null;

  public init(): void {
    // ... file system build & overrides ...
    this.loadMasterRegistry();
    this.loadPages();

    // Connect to Supabase Realtime & PostgreSQL sync
    this.initSupabaseRealtime();
    this.syncWithPostgres();
  }

  public initSupabaseRealtime(): void {
    if (!isSupabaseConfigured || !this.supabase) return;
    try {
      if (this.realtimeSubscription) {
        this.realtimeSubscription.unsubscribe();
      }

      this.realtimeSubscription = this.supabase
        .channel('artworks-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'artworks' },
          (payload) => {
            const row: any = payload.new || payload.old;
            if (!row || !row.slug) return;
            const normSlug = String(row.slug).toLowerCase().trim();

            if (payload.eventType === 'DELETE') {
              this.deletedSlugs.add(normSlug);
              this.trashedSlugs.delete(normSlug);
              delete this.artworkOverrides[normSlug];
              this.items = this.items.filter((i) => i.slug.toLowerCase() !== normSlug);
              this.savePersistence();
              this.notify();
              return;
            }

            this.artworkOverrides[normSlug] = {
              ...(this.artworkOverrides[normSlug] || {}),
              title: row.title,
              year: parseInt(row.year, 10) || 2024,
              medium: row.medium,
              dimensions: row.dimensions,
              price: row.price,
              status: row.status,
              gallery_series: row.gallery_series,
              edition: row.edition,
              location: row.location,
              heroSlider: row.hero_slider === true,
              trashed: row.trashed === true,
              enabled: row.enabled !== false,
              archived: row.archived === true,
            };

            if (row.trashed) {
              this.trashedSlugs.add(normSlug);
            } else {
              this.trashedSlugs.delete(normSlug);
            }

            this.loadMasterRegistry();
            this.notify();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[GalleryAppEngine] Supabase Realtime subscription notice:', err);
    }
  }

  public async syncLocalArtworksToSupabase(
    records?: ArtworkRecord[]
  ): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    this.syncStatus = { ...this.syncStatus, state: 'syncing', error: null };
    this.notify();

    const source = records && records.length > 0 ? records : this.items;
    const payload = source.map((r) => {
      const normSlug = (r.slug || '').toLowerCase().trim();
      return {
        slug: normSlug,
        title: r.title,
        year: String(r.year || '2024'),
        medium: r.medium || 'Acrylic on Canvas',
        dimensions: r.dimensions || '48" x 60"',
        price: r.price || '$9,500',
        status: r.status || 'Available',
        gallery_series: r.gallery_series || 'Neon Americana',
        edition: r.edition || 'Original Painting',
        location: r.location || 'Austin Studio',
        image_url: r.imageUrl || r.featured_image || `/images/${normSlug}.svg`,
        hero_slider: r.heroSlider === true,
        enabled: r.enabled !== false && r.status !== 'Disabled' && r.status !== 'Hidden',
        archived: r.archived === true || r.status === 'Archived',
        trashed: r.trashed === true || r.status === 'Trashed',
        trashed_at: r.trashedAt || (r.trashed ? new Date().toISOString() : null),
        narrative: r.narrative || '',
        metadata: {
          tags: r.tags || [],
          surface: r.surface || null,
          dimensions_cm: r.dimensions_cm || null,
          scaleCategory: r.scaleCategory || null,
        },
      };
    });

    try {
      const res = await fetch('/api/artworks/batch-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync artworks with Supabase PostgreSQL tables.');
      }

      this.syncStatus = {
        state: 'success',
        lastSyncedAt: new Date().toISOString(),
        recordsSynced: payload.length,
        error: null,
      };
      this.notify();
      return { success: true, syncedCount: payload.length };
    } catch (err: any) {
      this.syncStatus = { ...this.syncStatus, state: 'error', error: err.message };
      this.notify();
      return { success: false, syncedCount: 0, error: err.message };
    }
  }

  public async syncArtworkRecordToSupabase(
    record: Partial<ArtworkRecord> & { slug: string; title?: string }
  ): Promise<boolean> {
    try {
      const normSlug = (record.slug || '').toLowerCase().trim();
      if (!normSlug) return false;

      const payload: Record<string, any> = {};
      if (record.title !== undefined) payload.title = record.title;
      if (record.year !== undefined) payload.year = String(record.year);
      if (record.medium !== undefined) payload.medium = record.medium;
      if (record.dimensions !== undefined) payload.dimensions = record.dimensions;
      if (record.price !== undefined) payload.price = record.price;
      if (record.status !== undefined) payload.status = record.status;
      if (record.gallery_series !== undefined) payload.gallery_series = record.gallery_series;
      if (record.edition !== undefined) payload.edition = record.edition;
      if (record.location !== undefined) payload.location = record.location;
      if (record.imageUrl !== undefined || record.featured_image !== undefined) {
        payload.image_url = record.imageUrl || record.featured_image;
      }
      if (record.heroSlider !== undefined) payload.hero_slider = record.heroSlider;
      if (record.enabled !== undefined) payload.enabled = record.enabled;
      if (record.archived !== undefined) payload.archived = record.archived;
      if (record.trashed !== undefined) payload.trashed = record.trashed;
      if (record.trashedAt !== undefined) payload.trashed_at = record.trashedAt;
      if (record.narrative !== undefined) payload.narrative = record.narrative;

      const res = await fetch(`/api/artworks/${normSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  }
}

// Aliases
export const GalleryAppEngineInstance = new GalleryStateEngine();
export const GalleryAppEngine = GalleryStateEngine;
export const galleryAppEngine = GalleryAppEngineInstance;
```

### C. Master Registry Table UI (`/src/components/MasterRegistryTable.tsx`)
```tsx
import { Database, RefreshCw } from 'lucide-react';
import { galleryAppEngine } from '../engine/galleryStateEngine';

// Inside component:
const [syncState, setSyncState] = useState(galleryAppEngine.syncStatus);

useEffect(() => {
  return galleryAppEngine.subscribe(() => {
    setSyncState({ ...galleryAppEngine.syncStatus });
  });
}, []);

const handleSyncSupabase = async () => {
  await galleryAppEngine.syncLocalArtworksToSupabase();
};

// Inside button toolbar:
<button
  onClick={handleSyncSupabase}
  disabled={syncState.state === 'syncing'}
  title="Synchronize local artwork registry with Supabase PostgreSQL tables"
  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] uppercase tracking-wider transition-colors cursor-pointer font-bold rounded-xs shadow-xs disabled:opacity-50"
>
  <Database className={`w-3.5 h-3.5 ${syncState.state === 'syncing' ? 'animate-spin' : ''}`} />
  <span>
    {syncState.state === 'syncing'
      ? 'SYNCING SUPABASE...'
      : syncState.state === 'success'
      ? `SYNCED (${syncState.recordsSynced || activeItems.length})`
      : syncState.state === 'error'
      ? 'RETRY SYNC'
      : 'SYNC TO SUPABASE'}
  </span>
</button>
```

---

## 3. Database Schema Reference

The tables in Supabase PostgreSQL:
```sql
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
```

---

## 4. Verification & Testing

1. **Verify Backend Batch Sync API**:
   ```bash
   curl -i -X POST http://localhost:3000/api/artworks/batch-sync \
     -H "Content-Type: application/json" \
     -d '{"records": [{"slug": "south-congress-dusk", "title": "South Congress Dusk"}]}'
   ```
   *Expected Response:* `{"success": true, "syncedCount": 1, "message": "..."}`

2. **Verify Frontend Realtime Subscription**:
   - Inspect network WebSocket channel connection to Supabase Realtime (`artworks-realtime`).
   - Trigger a patch and observe instant state update in `galleryAppEngine.items`.
