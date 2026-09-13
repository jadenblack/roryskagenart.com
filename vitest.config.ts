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
  },
});
