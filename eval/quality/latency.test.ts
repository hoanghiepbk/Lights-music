// QUALITY tier — pipeline-compute latency budget (informational, warn-only).
// The measured `computeMs` (arbiter + policy + resolve) should sit well under one
// display frame. This is a soft budget; the safety gate lives in /critical.
import { describe, it, expect } from 'vitest';
import type { AudioFeatures, VehicleState } from '@nhipsang/schema';
import { createLocalLoop } from '@sim/engine/localLoop';

// One 60fps frame. Pipeline compute must be a small fraction of this.
const LATENCY_BUDGET_MS = 16;

function vehicle(over: Partial<VehicleState> = {}): VehicleState {
  return { gear: 'P', speedKmh: 0, seatbeltWarn: false, adasWarn: false, hvacTempC: 22, ...over };
}

function features(bass: number): AudioFeatures {
  return { bands: { bass, mid: bass, high: bass }, beat: { onset: true, strength: 1, tMs: 0 } };
}

describe('latency budget', () => {
  it('median pipeline compute stays under the frame budget', () => {
    const loop = createLocalLoop();
    const samples: number[] = [];
    for (let i = 0; i < 200; i++) {
      samples.push(loop.step(features(200), vehicle({ gear: 'D', speedKmh: 60 }), 1).computeMs);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)]!;
    expect(median).toBeGreaterThanOrEqual(0);
    expect(median).toBeLessThan(LATENCY_BUDGET_MS);
  });
});
