/**
 * Vercel serverless entry — the "documented hybrid" deployment.
 *
 * Static SPA assets (HTML/JS/CSS/images) are built by `vite build` and served
 * from Vercel's edge CDN. Every /api/* request is routed here (see vercel.json)
 * and handled by the same Express app that powers `npm run dev` / `npm start`,
 * so local, Node-host, and serverless behavior stay identical.
 *
 * Stateless by design: PostgreSQL (via pg Pool) and Supabase hold all state;
 * the file-based auth session store degrades to per-instance /tmp caching
 * (see server.ts VERCEL handling), while Supabase Auth remains the primary
 * identity path.
 *
 * The `nodejs` runtime matches the pg + sharp + cloudinary dependency set.
 * maxDuration covers slow Supabase/Resend cold calls on the free tier.
 */
// Note: file extension required — Vercel's ESM resolver cannot resolve
// directory imports, and tsx/node ESM need the explicit .ts via allowImportingTsExtensions.
import app from "../server.ts";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default app;
