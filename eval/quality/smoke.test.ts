import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION } from '@nhipsang/schema';

// Scaffold smoke test: proves the workspace link to @nhipsang/schema resolves.
describe('scaffold smoke', () => {
  it('schema package resolves and exposes version', () => {
    expect(SCHEMA_VERSION).toBe('0.2.0');
  });
});
