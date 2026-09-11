require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const supabase = createClient(
  process.env.VRCL_SUPA_SUPABASE_URL || 'https://orphcusijzkxpxkzapjp.supabase.co',
  process.env.VRCL_SUPA_SUPABASE_SERVICE_ROLE_KEY
);
const pool = new Pool({
  connectionString: (process.env.VRCL_SUPA_POSTGRES_PRISMA_URL || process.env.VRCL_SUPA_POSTGRES_URL || '').replace(/\?.*$/, ''),
  ssl: { rejectUnauthorized: false },
});

(async () => {
  // 1. Registry integrity
  const { rows } = await pool.query(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE renditions IS NOT NULL)::int with_renditions,
            count(*) FILTER (WHERE lqip IS NOT NULL)::int with_lqip,
            count(*) FILTER (WHERE artwork_slug IS NOT NULL)::int with_slug,
            count(*) FILTER (WHERE url LIKE '%supabase.co/storage%')::int supabase_urls
       FROM public.media_assets`
  );
  console.log('registry:', JSON.stringify(rows[0]));

  // 2. Public fetch of a few renditions through the CDN (anon, no key)
  const { rows: sample } = await pool.query(
    `SELECT public_id, renditions FROM public.media_assets
      WHERE renditions IS NOT NULL
      ORDER BY public_id LIMIT 3`
  );
  for (const row of sample) {
    const r = row.renditions;
    for (const name of ['thumb', 'hero', 'full']) {
      const res = await fetch(`https://orphcusijzkxpxkzapjp.supabase.co/storage/v1/object/public/artwork-images/${r[name].path}`);
      console.log(`${row.public_id}/${name}: HTTP ${res.status}, ${(r[name].bytes / 1024).toFixed(0)}KB declared`);
    }
  }

  // 3. Spot-check webp magic bytes on one download
  const res = await fetch(`https://orphcusijzkxpxkzapjp.supabase.co/storage/v1/object/public/artwork-images/${sample[0].renditions.thumb.path}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log('magic bytes (expect RIFF....WEBP):', buf.slice(0, 4).toString(), buf.slice(8, 12).toString(), `size=${(buf.length / 1024).toFixed(0)}KB`);

  // 4. Bucket object count (sample folder list)
  const { data: folders } = await supabase.storage.from('artwork-images').list('', { limit: 200 });
  console.log('bucket folders (assets):', folders?.length);

  await pool.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
