import { defineConfig } from 'vitest/config';

// Invariant suite (INV-1..6) + fault injection land in TIP-007.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
