/**
 * Guards the boundary between runtime code and the shared script helpers.
 *
 * WHY THIS EXISTS
 * `server/lib/catalogDump.ts` builds the off-site backup, and it reads the table list, the ordering
 * and the manifest format from `scripts/lib/`. Those helpers are pure today — that is precisely why
 * they can be shared — but "pure" is an assertion that rots: one `import { Pool } from 'pg'` added
 * to `scripts/lib/restorePlan.ts` would pull a database driver into the Vercel serverless bundle,
 * and nothing in the existing suite would notice. This test makes the invariant explicit and fails
 * loud the moment it breaks.
 *
 * The alternative was to duplicate the table list and the manifest shape inside `server/` — which
 * is how two writers of one backup format drift apart. So the sharing is deliberate; this file is
 * what makes it safe.
 *
 * No network, no tokens: it reads source files.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

/** `scripts/lib/` modules that runtime (bundled) code is allowed to depend on. */
const SHARED_SCRIPT_MODULES = [
  'scripts/lib/backupManifest.ts',
  'scripts/lib/restorePlan.ts',
  'scripts/lib/pgTarget.ts',
  // Added in v3.1.0. `src/data/releaseLog.generated.ts` names its payload's type from here, and
  // that artifact is bundled into the serverless function through `server/routes/plan.ts`. The
  // import is type-only today, so nothing of this module reaches the bundle — but "type-only" is
  // exactly the kind of assertion that rots into a value import, so it is allow-listed and checked
  // rather than assumed.
  'scripts/lib/releaseLog.ts',
];

/** Runtime modules that reach into `scripts/lib/` — the ones this guard protects. */
const RUNTIME_MODULES = [
  'server/lib/catalogDump.ts',
  'server/lib/blobBackup.ts',
  'server/routes/cronBackup.ts',
  // Added in v3.1.0 — the release history. The chain is
  // `server/routes/plan.ts` → `src/data/releaseLog.generated.ts` → `scripts/lib/releaseLog.ts`
  // (type only), so both links are listed. A `ChangelogView` that fetched this over HTTP is what
  // keeps the ~220 KB artifact out of the *client* bundle; this guard is what keeps the parser's
  // dependencies out of the serverless one.
  'server/routes/plan.ts',
  'src/data/releaseLog.generated.ts',
];

/**
 * Anything here turns a pure helper into a bundle-time liability:
 * `pg` and `dotenv` would be pulled into every serverless invocation, and `fs` implies disk access
 * that does not exist in the runtime the cron job executes in.
 */
const FORBIDDEN_IMPORTS = [/from\s+['"]pg['"]/, /from\s+['"]fs['"]/, /from\s+['"]node:fs['"]/, /from\s+['"]dotenv['"]/, /from\s+['"]child_process['"]/, /require\(\s*['"](pg|fs|dotenv|child_process)['"]\s*\)/];

function source(relative: string): string {
  return readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('bundle safety', () => {
  it('the detector itself works — a guard that cannot fail is decoration', () => {
    const samples = [
      `import { Pool } from 'pg';`,
      `import fs from "fs";`,
      `import fs from 'node:fs';`,
      `import dotenv from 'dotenv';`,
      `const { execSync } = require("child_process");`,
    ];
    for (const sample of samples) {
      expect(
        FORBIDDEN_IMPORTS.some((pattern) => pattern.test(sample)),
        `no pattern matched: ${sample}`
      ).toBe(true);
    }
    // ...and it does not fire on the imports that are legitimately present today.
    expect(FORBIDDEN_IMPORTS.some((p) => p.test(`import { createHash } from 'crypto';`))).toBe(false);
  });

  it.each(SHARED_SCRIPT_MODULES)('%s stays free of runtime-only imports', (module) => {
    const code = source(module);
    for (const forbidden of FORBIDDEN_IMPORTS) {
      expect(code, `${module} must not import ${forbidden}`).not.toMatch(forbidden);
    }
  });

  it.each(RUNTIME_MODULES)('%s depends only on the allow-listed shared modules', (module) => {
    const code = source(module);
    const imported = [...code.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1]);

    for (const spec of imported) {
      const resolved = path.relative(ROOT, path.resolve(path.dirname(path.join(ROOT, module)), spec));
      if (!resolved.startsWith('scripts/')) continue;
      expect(
        SHARED_SCRIPT_MODULES,
        `${module} imports ${spec}, which resolves to ${resolved} — add it to SHARED_SCRIPT_MODULES only ` +
          `after confirming it is pure, or the serverless bundle will carry it.`
      ).toContain(resolved.replace(/\\/g, '/'));
    }
  });

  it('the off-site dump is written with private access', () => {
    // A public dump would put `profiles` emails and `inquiries` collector PII on the open internet.
    expect(source('server/routes/cronBackup.ts')).toMatch(/access:\s*'private'/);
  });

  it('every cron route fails closed when the secret is absent', () => {
    // The gate is shared (`server/lib/cronAuth.ts`) rather than copied per route — a secret
    // check written twice is a secret check that drifts, and the difference is usually the one
    // that fails open. So the refusal is asserted once against the gate, and each route is then
    // held to importing it rather than hand-rolling its own.
    const gate = source('server/lib/cronAuth.ts');
    expect(gate).toContain('CRON_SECRET');
    // Both refusals: no secret configured, and a secret that does not match.
    expect(gate).toMatch(/status:\s*503/);
    expect(gate).toMatch(/status:\s*401/);

    const cronRoutes = ['server/routes/cronBackup.ts', 'server/routes/cronPlanDigest.ts'];
    for (const route of cronRoutes) {
      expect(source(route), `${route} must gate on the shared secret`).toContain('cronAuthorized');
    }
  });
});
