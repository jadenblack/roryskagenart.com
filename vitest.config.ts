import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Zero-token test configuration: jsdom + React Testing Library, fully offline.
 * No network, no Supabase, no DB — every external dependency is mocked in
 * src/test/setup.ts or per-test via vi.mock. `npm test` is free to run.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Component/unit only. Playwright E2E (Phase 4) will use its own config.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    // 15s, up from vitest's 5s default.
    //
    // These are real-timer tests: `userEvent` drives genuine keystrokes and clicks with real
    // delays, and several tests in the admin views legitimately take 1–3s in isolation. Under a
    // loaded machine that cost is not stable — a full parallel run on 2026-09-14 showed an
    // `environment` phase of 252–297s against a nominal ~10s, i.e. roughly a 25× slowdown — and
    // the 5s default turned correct, non-hanging tests into intermittent failures
    // (`UsersAdminView > sends only the changed fields when saving an edit`, which passes
    // reliably in isolation).
    //
    // A bounded raise is the honest fix: it removes the load-induced flakiness without masking a
    // genuine hang, which is what an unbounded or very large timeout would do. Prefer fixing the
    // test's timing assumptions over raising this further — see
    // `ArtworkEditDialog.autosave.test.tsx` for the pattern (fire rapid input synchronously so
    // "rapid" is true by construction rather than by luck).
    testTimeout: 15000,
  },
});
