/**
 * GATE-BITES DEMO — run by hand for the video. NOT in `pnpm test`, NOT in CI.
 *   pnpm test:demo:violation   (expected to FAIL — that is the point)
 *
 * Raw (un-gated) source output VIOLATES the invariants → RED (these assertions
 * fail on purpose). The real pipeline routes the same data through applyPolicy()
 * + FlashLimiter → GREEN. The gate is exactly what turns red into green; the
 * Critical tier is what blocks a merge if that gate is ever removed.
 *
 * Each failing assertion below names the INV it proves the gate protects.
 */
import { describe, it, expect } from 'vitest';
import type { RGB } from '@nhipsang/schema';
import { isRestrictedHue, FLASH_MAX_HZ_PARKED } from '@sim/core';

// A driver-zone colour as a naive/raw source might emit it while driving.
const RAW_DRIVER_RED: RGB = { r: 255, g: 0, b: 0 };

describe('gate-bites — intentional INV violations on RAW (un-gated) output', () => {
  it('INV-1 is VIOLATED on raw output: saturated red persists in a driver zone', () => {
    // Real pipeline: applyPolicy() recolours this to the safe amber → INV-1 holds.
    // Skipping the gate, the red leaks through → this MUST fail.
    expect(isRestrictedHue(RAW_DRIVER_RED)).toBe(false);
  });

  it(`INV-2 is VIOLATED on raw output: parked flash exceeds ${FLASH_MAX_HZ_PARKED} Hz`, () => {
    // Raw = every onset becomes a beat (no FlashLimiter). 10 onsets in 1 s.
    // Real pipeline: FlashLimiter caps to ≤ FLASH_MAX_HZ_PARKED. Skipping it → fail.
    const onsetTimesMs = Array.from({ length: 10 }, (_, i) => i * 100);
    const rawBeatsPerSecond = onsetTimesMs.length;
    expect(rawBeatsPerSecond).toBeLessThanOrEqual(FLASH_MAX_HZ_PARKED);
  });
});
