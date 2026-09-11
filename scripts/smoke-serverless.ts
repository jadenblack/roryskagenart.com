/**
 * Serverless smoke test: imports the app the same way api/index.ts will on
 * Vercel (VERCEL=1 so startServer()/listen never runs), then verifies the
 * route table and performs a real in-process invocation of /api/health.
 */
process.env.VERCEL = '1';

const { default: app } = await import('../server.ts');
const routes = (app as any)._router.stack
  .filter((l: any) => l.route)
  .flatMap((l: any) => {
    const paths = Object.keys(l.route.methods).map(
      (m) => `${m.toUpperCase()} ${l.route.path}`
    );
    return paths;
  });

console.log('registered route handlers:', routes.length);
console.log('GET /api/health present:', routes.includes('GET /api/health'));
console.log('GET /api/artworks present:', routes.includes('GET /api/artworks'));
console.log('POST /api/auth/login present:', routes.includes('POST /api/auth/login'));
console.log('POST /api/inquiries present:', routes.includes('POST /api/inquiries'));

// In-process invocation without a listener
const http = await import('node:http');
await new Promise<void>((resolve) => {
  const server = (app as any).listen(0, '127.0.0.1', async () => {
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = await res.json();
    console.log('invoked /api/health ->', res.status, JSON.stringify(body));
    server.close(() => resolve());
  });
});

process.exit(0);
