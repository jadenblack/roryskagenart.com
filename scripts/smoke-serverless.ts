/**
 * Serverless smoke test — prove the Vercel entrypoint still boots and still serves every endpoint.
 *
 * WHY THIS EXISTS
 * Vercel runs the Express app as one serverless function built from `server.ts` (see `buildCommand`
 * in vercel.json). Nothing in `npm test` imports the app, so a route that is mounted wrongly — or
 * unmounted by a refactor — yields a 404 in production and nowhere else. This is the check that
 * stands in for "did the deployed function keep its routes?".
 *
 * WHAT WAS BROKEN
 * The previous version read `app._router.stack.filter((l) => l.route)`. A layer only carries
 * `.route` when it was registered with `app.get(...)`/`app.post(...)`; every router mounted with
 * `app.use('/api/x', router)` has **no** `.route` and was therefore invisible. The guard saw five
 * endpoints out of thirty-one, asserted a `POST /api/auth/login` route that does not exist, and
 * exited 0 unconditionally. A guard that cannot fail is decoration.
 *
 * WHAT IT CHECKS NOW
 *   1. The route table — walked *through* mounted routers — contains every endpoint the app must
 *      serve. Missing is a failure; extra is reported so a deliberate addition gets recorded here.
 *   2. A live in-process invocation of the endpoints that can be exercised without a database, so
 *      a mount is proven reachable rather than merely present in a data structure.
 *
 * Hermetic by design: no database and no network. Deliberately **no** request that could trigger a
 * real backup or a real email — `POST /api/inquiries` is asserted in the table but never invoked,
 * and `GET /api/cron/backup` is expected to refuse us.
 *
 * Usage: npm run smoke     (equivalently: npx tsx scripts/smoke-serverless.ts)
 * Exit:  0 = every expected endpoint present and reachable. 1 = something is missing or broken.
 */
process.env.VERCEL = '1';

const { default: app } = await import('../server.ts');

/* ------------------------------------------------------------------ *
 * Route table — walk mounted routers                                 *
 * ------------------------------------------------------------------ */

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  regexp?: { source: string };
  handle?: { stack?: Layer[] };
}

interface RouteEntry {
  method: string;
  path: string;
}

/**
 * Recover the path a router was mounted at from its compiled matcher.
 *
 * Express 4 compiles `app.use('/api/artworks', router)` to the source `^\/api\/artworks\/?(?=\/|$)`
 * and root-level middleware to `^\/?(?=\/|$)`. There is no stored path string on the layer, so the
 * matcher source is the only place the mount path survives.
 *
 * Returns `null` when the shape is not the one above — a future Express upgrade or a parameterised
 * mount. That is surfaced as a failure rather than silently treated as "no path", because a walk
 * that quietly loses mounts is exactly the bug this file exists to catch.
 */
function mountPath(layer: Layer): string | null {
  const source = layer.regexp?.source;
  if (!source) return null;

  const SUFFIX = '\\/?(?=\\/|$)';
  if (!source.startsWith('^') || !source.endsWith(SUFFIX)) return null;

  let middle = source.slice(1, source.length - SUFFIX.length);
  if (middle.startsWith('\\/')) middle = middle.slice(2);
  return middle.split('\\/').join('/');
}

function walk(router: { stack?: Layer[] }, prefix: string, out: RouteEntry[], unresolved: string[]): void {
  for (const layer of router.stack ?? []) {
    if (layer.route) {
      const path = prefix + (layer.route.path === '/' ? '' : layer.route.path);
      for (const method of Object.keys(layer.route.methods)) {
        out.push({ method: method.toUpperCase(), path: path || '/' });
      }
      continue;
    }

    const mount = mountPath(layer);
    if (mount === null) {
      unresolved.push(layer.name ?? '(unnamed layer)');
      continue;
    }

    // A mounted router is recursive; anything else is middleware (json parser, requireAuth, …).
    if (layer.handle?.stack) {
      walk(layer.handle, mount ? `${prefix}/${mount}` : prefix, out, unresolved);
    }
  }
}

const routes: RouteEntry[] = [];
const unresolved: string[] = [];
walk((app as unknown as { _router: { stack?: Layer[] } })._router, '', routes, unresolved);

const registered = routes.map((r) => `${r.method} ${r.path}`).sort();

/**
 * Every endpoint the deployed function must serve.
 *
 * Missing ⇒ failure. Extra ⇒ reported, because an endpoint that is not listed here is an endpoint
 * nobody is watching.
 */
const REQUIRED: readonly string[] = [
  'GET /api/health',
  'GET /api/database/status',
  'GET /api/email/status',
  'POST /api/email/send-test',
  'POST /api/email/webhook',

  'GET /api/artworks',
  'GET /api/artworks/:slug',
  'POST /api/artworks',
  'PATCH /api/artworks/:slug',
  'DELETE /api/artworks/:slug',

  'GET /api/pages',
  'GET /api/pages/:slug',
  'PUT /api/pages/:slug',

  'GET /api/taxonomies',
  'POST /api/taxonomies',
  'PATCH /api/taxonomies/:id',
  'DELETE /api/taxonomies/:id',

  'GET /api/settings',
  'PUT /api/settings',

  'GET /api/media',
  'POST /api/media/upload',

  'POST /api/inquiries',
  'GET /api/inquiries',
  'PATCH /api/inquiries/:id/status',

  'GET /api/admin/users',
  'POST /api/admin/users/invite',
  'POST /api/admin/users/:id/reinvite',
  'POST /api/admin/users/:id/reset-password',
  'PATCH /api/admin/users/:id',
  'DELETE /api/admin/users/:id',

  // Added in v2.13.0. The scheduled off-site backup is the project's only recovery path, so its
  // route going missing is the single highest-impact 404 this guard can catch.
  'GET /api/cron/backup',

  // Added in v3.2.0. The batched planning digest is the only route that mails the studio on a
  // schedule; if it quietly stops being mounted, public feedback stops reaching anyone and
  // nothing else in the suite would notice.
  'GET /api/cron/plan-digest',

  // Added in v3.1.0 — the studio feedback & planning board. Six endpoints, two doors:
  // `/feedback` is public and `/items` is editor+ (see server/routes/plan.ts). All six are
  // listed, not just the ones with interesting guards, because a route nobody lists is a route
  // nobody notices is missing.
  'GET /api/plan/history',
  'POST /api/plan/feedback',
  'GET /api/plan/items',
  'POST /api/plan/items',
  'PATCH /api/plan/items/:id',
  'DELETE /api/plan/items/:id',
  'GET /api/plan/releases',
  'POST /api/plan/releases',
  'PATCH /api/plan/releases/:id',
  'DELETE /api/plan/releases/:id',
];

const missing = REQUIRED.filter((route) => !registered.includes(route));
const extra = registered.filter((route) => !REQUIRED.includes(route));

console.log(`registered endpoints: ${registered.length}`);
console.log(`required endpoints:   ${REQUIRED.length}`);

if (missing.length > 0) {
  console.error('\nMISSING (the deployed function would 404):');
  for (const route of missing) console.error(`  ✗ ${route}`);
}

if (unresolved.length > 0) {
  console.error('\nUNRESOLVED LAYERS (mount path could not be recovered — the walk is not trustworthy):');
  for (const name of unresolved) console.error(`  ✗ ${name}`);
}

if (extra.length > 0) {
  console.log('\nNot in the required list — add it to REQUIRED if it is deliberate:');
  for (const route of extra) console.log(`  • ${route}`);
}

/* ------------------------------------------------------------------ *
 * Live probes — reachable, and correctly refusing us                  *
 * ------------------------------------------------------------------ */

interface Probe {
  method: string;
  path: string;
  /** Statuses that mean "mounted and behaving as designed". */
  expect: number[];
  /** Why the expectation is what it is — printed next to the result. */
  because: string;
  init?: RequestInit;
  /** Extra assertion on the parsed JSON body. Returns null when satisfied. */
  check?: (body: any) => string | null;
}

const PROBES: readonly Probe[] = [
  {
    method: 'GET',
    path: '/api/health',
    expect: [200],
    because: 'unauthenticated liveness check',
    check: (body) => (body?.status === 'ok' ? null : `body.status is ${JSON.stringify(body?.status)}`),
  },
  {
    method: 'GET',
    path: '/api/email/status',
    expect: [200],
    because: 'public health check; trimmed in v2.13.1 so it leaks no addresses',
  },
  {
    method: 'GET',
    path: '/api/database/status',
    expect: [401],
    because: 'requireAuth, and no token was sent',
  },
  {
    method: 'GET',
    path: '/api/admin/users',
    expect: [401],
    because: 'requireAuth is mounted on the router itself',
  },
  {
    method: 'GET',
    path: '/api/cron/backup',
    expect: [401, 503],
    because:
      '401 when CRON_SECRET is set, 503 when it is not. A 200 here would mean an unauthenticated ' +
      'caller could download the whole database — treat that as a failure.',
  },
  {
    method: 'GET',
    path: '/api/cron/plan-digest',
    expect: [401, 503],
    because:
      '401 when CRON_SECRET is set, 503 when it is not. A 200 here would mean an unauthenticated ' +
      'caller could trigger mail to the studio — treat that as a failure.',
  },
  {
    method: 'POST',
    path: '/api/email/webhook',
    expect: [401],
    because: 'forged Svix signature (or no secret configured) — the gate must not be open',
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': 'msg_smoke',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      },
      body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'smoke' } }),
    },
  },

  /* ---------------------------------------------------------------- *
   * v3.1.0 — the planning board                                      *
   * ---------------------------------------------------------------- *
   *
   * ⚠️ EVERY probe below is deliberately **database-free**. This file loads `.env`, so a
   * request that reached the INSERT would write a real row into the real board. Each probe is
   * stopped by a guard before any query runs, and the two public-door probes are the two ways
   * a submission is legitimately refused or dropped.
   */

  {
    method: 'GET',
    path: '/api/plan/history',
    expect: [401],
    because: 'requireAuth with no token — the release history is not anonymous',
  },
  {
    method: 'GET',
    path: '/api/plan/items',
    expect: [401],
    because: 'requireAuth is per-route on this router; an unauthenticated read must not reach the board',
  },
  {
    method: 'POST',
    path: '/api/plan/items',
    expect: [401],
    because: 'the staff door needs a session — source and author_id come from it, never the body',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'bug', title: 'smoke', source: 'studio' }),
    },
  },
  {
    method: 'PATCH',
    path: '/api/plan/items/00000000-0000-0000-0000-000000000000',
    expect: [401],
    because: 'requireAuth runs before the id is even looked at',
    init: {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    },
  },
  {
    method: 'DELETE',
    path: '/api/plan/items/00000000-0000-0000-0000-000000000000',
    expect: [401],
    because: 'requireAuth first, so a probe can never delete anything',
  },
  {
    method: 'GET',
    path: '/api/plan/releases',
    expect: [401],
    because: 'releases are studio-only — not readable by the public, and not by a viewer',
  },
  {
    method: 'POST',
    path: '/api/plan/releases',
    expect: [401],
    because: 'creating a release is an editor action; shipped_at is derived server-side, never sent',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 'v9.9.9', title: 'smoke' }),
    },
  },
  {
    method: 'PATCH',
    path: '/api/plan/releases/00000000-0000-0000-0000-000000000000',
    expect: [401],
    because: 'requireAuth runs before the release is read, so the ship transition is unreachable',
    init: {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'shipped' }),
    },
  },
  {
    method: 'DELETE',
    path: '/api/plan/releases/00000000-0000-0000-0000-000000000000',
    expect: [401],
    because: 'deleting a release ungroups its items (ON DELETE SET NULL) — a probe must not try',
  },
  {
    method: 'POST',
    path: '/api/plan/feedback',
    expect: [400],
    because:
      'the public door is mounted and validates: an empty body is refused by buildPlanItemInput ' +
      'before any query runs, so this proves reachability without writing a row',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    },
  },
  {
    method: 'POST',
    path: '/api/plan/feedback',
    expect: [201],
    because:
      'the honeypot: a filled `company_website` is answered with a plausible success and nothing ' +
      'is stored. A 400 here would mean the gate is gone and a bot would be told which field to skip',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'smoke', company_website: 'https://spam.example' }),
    },
    check: (body) => (body?.success === true ? null : `body.success is ${JSON.stringify(body?.success)}`),
  },
  {
    method: 'POST',
    path: '/api/plan/feedback',
    expect: [413],
    because:
      'the 64 KB scoped body parser is mounted BEFORE the global 50 MB one. If the parsers are ever ' +
      'reordered this becomes a 400 (the body was buffered and then rejected by the length cap), ' +
      'which is the regression this probe exists to catch',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'smoke', body: 'x'.repeat(70000) }),
    },
  },
];

const failures: string[] = [];
if (missing.length > 0) failures.push(...missing.map((r) => `missing route: ${r}`));
if (unresolved.length > 0) failures.push(...unresolved.map((n) => `unresolved layer: ${n}`));

const http = await import('node:http');
const server = http.createServer(app as any);

await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve());
});

const port = (server.address() as { port: number }).port;
const base = `http://127.0.0.1:${port}`;

console.log('\nlive probes:');
try {
  for (const probe of PROBES) {
    const res = await fetch(`${base}${probe.path}`, probe.init ?? { method: probe.method });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    const statusOk = probe.expect.includes(res.status);
    const checkProblem = statusOk && probe.check ? probe.check(body) : null;

    if (statusOk && !checkProblem) {
      console.log(`  ✓ ${probe.method} ${probe.path} -> ${res.status}`);
    } else {
      const detail = checkProblem ?? `expected ${probe.expect.join('|')}, got ${res.status}`;
      console.error(`  ✗ ${probe.method} ${probe.path} -> ${res.status}: ${detail}`);
      console.error(`      (${probe.because})`);
      failures.push(`${probe.method} ${probe.path}: ${detail}`);
    }
  }
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

/* ------------------------------------------------------------------ */

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} problem(s). The serverless entrypoint is not intact.`);
  process.exit(1);
}

console.log('\nPASS — every required endpoint is present and responds as designed.');
process.exit(0);
