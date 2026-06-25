import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Default suite = Critical (safety gate) + Quality (informational). The
// gate-bites demo lives in eval/demo and is intentionally EXCLUDED here — run it
// via `pnpm test:demo:violation` (vitest.demo.config.ts). `@sim/*` → simulator/src.
export default defineConfig({
  resolve: {
    alias: {
      '@sim': fileURLToPath(new URL('../simulator/src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['critical/**/*.test.ts', 'quality/**/*.test.ts'],
  },
});
