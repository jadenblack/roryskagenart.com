/**
 * Phase 2, the crawler-visible half — prerender one HTML file per published artwork, plus
 * `sitemap.xml`, into `dist/` after `vite build`.
 *
 * WHY THIS EXISTS
 * The gallery is a hash-routed SPA, so a crawler that fetches any URL gets the same shell with the
 * same `<title>` and the same app-icon `og:image`. Per-artwork `<title>`, description, canonical
 * and `og:image` therefore cannot be produced in the browser — the tags have to be *in the HTML the
 * server returns*. Roadmap Phase 2 offers two ways to do that (build-time prerender, or edge SSR);
 * this is the build-time prerender, chosen for having no runtime and no cold path.
 *
 * WHY THE ANON KEY, AND WHY THAT IS NOT A LEAK
 * The `artworks` RLS policy is `USING (trashed = false AND draft = false)`, so an anon read
 * *physically cannot* return a draft. That makes the anon key the right credential here: this
 * script cannot publish an unpublished mural even if `selectIndexable` were wrong. The service-role
 * key would remove that second gate for no benefit. The build therefore needs no secret — only the
 * public URL and the public anon key.
 *
 * FAIL LOUDLY ON ZERO
 * An empty `sitemap.xml` that ships silently is precisely the failure this phase exists to prevent:
 * the build goes green, the deploy succeeds, and nothing is indexable. Zero rows, or zero indexable
 * rows, aborts the build.
 *
 * Usage:
 *   npx tsx scripts/prerender-seo.ts                      # real Supabase read
 *   npx tsx scripts/prerender-seo.ts --offline rows.json  # no network (see --offline below)
 *   npx tsx scripts/prerender-seo.ts --dist dist          # default
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {
  artworkMeta,
  buildSitemap,
  injectMeta,
  resolveOrigin,
  selectIndexable,
  type ArtworkSeoRow,
} from './lib/seoPlan';

// `.env.local` is loaded first and wins, matching Vite's own precedence in local development.
// On Vercel there is no file and the platform's env vars are already in `process.env`.
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

/** Storage bucket holding every artwork rendition (AGENTS.md §2). */
const MEDIA_BUCKET = 'artwork-images';

interface Args {
  dist: string;
  /** Path to a JSON fixture: `{ artworks: ArtworkSeoRow[], heroes?: Record<string, string> }`. */
  offline?: string;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { dist: 'dist' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dist') args.dist = argv[++i];
    else if (argv[i] === '--offline') args.offline = argv[++i];
  }
  return args;
}

function requireEnv(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  throw new Error(
    `Missing required env var (tried: ${names.join(', ')}). ` +
      'The prerender needs the Supabase URL and the public anon key — see AGENTS.md §3.'
  );
}

async function restGet<T>(baseUrl: string, anonKey: string, query: string): Promise<T[]> {
  const url = `${baseUrl}/rest/v1/${query}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
  } catch (err) {
    throw new Error(
      `Could not reach Supabase at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!response.ok) {
    throw new Error(`Supabase read failed (${response.status}) for ${query}: ${await response.text()}`);
  }
  return (await response.json()) as T[];
}

/**
 * Absolute URL of each artwork's `hero` rendition, keyed by slug.
 *
 * First-wins per slug, matching `scripts/generate-asset-registry.ts` — an artwork with several
 * media rows resolves to the same image here as it does in the gallery, so the social card and the
 * catalog cannot disagree.
 */
function buildHeroMap(
  baseUrl: string,
  rows: Array<{ artwork_slug: string | null; renditions: unknown }>
): Map<string, string> {
  const heroes = new Map<string, string>();
  for (const row of rows) {
    const slug = row.artwork_slug;
    if (!slug || heroes.has(slug)) continue;
    const renditions = row.renditions as Record<string, { path?: string }> | null;
    const heroPath = renditions?.hero?.path;
    if (!heroPath) continue;
    heroes.set(slug, `${baseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${heroPath}`);
  }
  return heroes;
}

async function loadArtworks(
  args: Args
): Promise<{ artworks: ArtworkSeoRow[]; heroes: Map<string, string>; origin: string; source: string }> {
  const origin = resolveOrigin(process.env.SITE_URL, process.env.APP_URL);
  if (origin.rejected) {
    console.warn(
      `  ⚠️  refusing loopback origin "${origin.rejected}" from SITE_URL/APP_URL — a canonical must ` +
        `never point at localhost. Using ${origin.origin} instead.`
    );
  }
  const resolvedOrigin = origin.origin;

  if (args.offline) {
    // Offline mode exists so the exclusion rule and the writer can be exercised without a network
    // — it is a test seam, not a second data path.
    const file = path.resolve(args.offline);
    if (!fs.existsSync(file)) throw new Error(`--offline fixture not found: ${file}`);
    const fixture = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      artworks: ArtworkSeoRow[];
      heroes?: Record<string, string>;
    };
    return {
      artworks: fixture.artworks ?? [],
      heroes: new Map(Object.entries(fixture.heroes ?? {})),
      origin: resolvedOrigin,
      source: `offline fixture ${file}`,
    };
  }

  const baseUrl = requireEnv('NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL', 'VRCL_SUPA_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_VRCL_SUPA_SUPABASE_ANON_KEY', 'VRCL_SUPA_SUPABASE_ANON_KEY');

  // RLS already excludes drafts and trashed rows; `selectIndexable` is the second, testable gate.
  // `description` is deliberately absent from the select: `artworks` has no such column (see
  // data/archive/schema_introspection.md) and PostgREST rejects a select that names one. The field
  // stays optional on `ArtworkSeoRow` so a fixture or a future column flows through unchanged.
  const artworks = await restGet<ArtworkSeoRow>(
    baseUrl,
    anonKey,
    'artworks?select=slug,title,year,medium,narrative,draft,trashed&order=slug.asc'
  );
  const media = await restGet<{ artwork_slug: string | null; renditions: unknown }>(
    baseUrl,
    anonKey,
    'media_assets?select=artwork_slug,renditions&artwork_slug=not.is.null'
  );

  return { artworks, heroes: buildHeroMap(baseUrl, media), origin: resolvedOrigin, source: `Supabase ${baseUrl}` };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const distDir = path.resolve(args.dist);
  const shellPath = path.join(distDir, 'index.html');

  console.log('='.repeat(72));
  console.log('Prerender SEO — per-artwork HTML + sitemap.xml');
  console.log('='.repeat(72));

  if (!fs.existsSync(shellPath)) {
    throw new Error(`${shellPath} not found — run \`vite build\` first.`);
  }

  const { artworks, heroes, origin, source } = await loadArtworks(args);
  console.log(`  source          : ${source}`);
  console.log(`  origin          : ${origin}`);
  console.log(`  artworks read   : ${artworks.length}`);
  if (artworks.length === 0) {
    throw new Error(
      'Zero artworks returned. Refusing to write an empty sitemap — check the Supabase env vars ' +
        '(NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL / NEXT_PUBLIC_VRCL_SUPA_SUPABASE_ANON_KEY) and the ' +
        'RLS policy on public.artworks.'
    );
  }

  const indexable = selectIndexable(artworks);
  if (indexable.length === 0) {
    throw new Error(
      `All ${artworks.length} artworks were excluded as draft/trashed/blank-slug. That is almost ` +
        'certainly wrong — refusing to ship a sitemap with no entries.'
    );
  }

  const shell = fs.readFileSync(shellPath, 'utf8');

  // `vite build` empties dist, but a second run without a rebuild must not leave the page of an
  // artwork that has since been trashed sitting in dist.
  const artworkRoot = path.join(distDir, 'artwork');
  fs.rmSync(artworkRoot, { recursive: true, force: true });

  let withHero = 0;
  for (const artwork of indexable) {
    const heroUrl = heroes.get(artwork.slug) ?? null;
    if (heroUrl) withHero += 1;
    const meta = artworkMeta(artwork, { origin, heroUrl });

    // The directory name is the *decoded* slug, so a percent-encoded request resolves to it after
    // Vercel decodes the path — see src/lib/artworkRoute.ts on the em-dash slug.
    const outDir = path.join(artworkRoot, artwork.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), injectMeta(shell, meta), 'utf8');
  }

  const sitemapPath = path.join(distDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, buildSitemap(indexable, { origin }), 'utf8');

  console.log('');
  console.log('--- WROTE ---');
  console.log(`  dist/artwork/<slug>/index.html : ${indexable.length} files`);
  console.log(`  dist/sitemap.xml               : ${indexable.length} <loc> entries`);
  console.log(`  hero image resolved            : ${withHero}/${indexable.length} (rest use the app icon)`);
  console.log(`  excluded (draft/trashed/blank) : ${artworks.length - indexable.length}`);
  console.log('');
}

main().catch((err) => {
  console.error('prerender-seo failed:', err?.stack ?? err?.message ?? err);
  process.exit(1);
});
