import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Invariant suite (INV-1..6) + fault injection land in TIP-007.
// `@sim/*` resolves to simulator/src/* so eval imports core/audio without
// brittle relative paths (mirrors tsconfig.base paths for typecheck).
export default defineConfig({
  resolve: {
    alias: {
      '@sim': fileURLToPath(new URL('../simulator/src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
