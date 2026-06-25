import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Gate-bites demo ONLY — intentionally-FAILING assertions for the video.
// Excluded from `pnpm test` and CI; run via `pnpm test:demo:violation`.
export default defineConfig({
  resolve: {
    alias: {
      '@sim': fileURLToPath(new URL('../simulator/src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['demo/**/*.demo.test.ts'],
  },
});
