// QUALITY tier — TIP-011 meaningful compute latency (informational).
// The old `computeMs` wrapped only resolve() (<0.1 ms → clamped to 0.000). It now
// folds in the FFT/onset/AGC feature extraction, so the readout is non-zero on a
// real audio frame. resolveMs stays exposed to show the safety core is ~free.
import { describe, it, expect } from 'vitest';
import type { AudioFeatures, VehicleState } from '@nhipsang/schema';
import { createFeatureExtractor } from '@sim/audio/featureExtractor';
import { createLocalLoop } from '@sim/engine/localLoop';

const SR = 44100;

function vehicle(over: Partial<VehicleState> = {}): VehicleState {
  return { gear: 'P', speedKmh: 0, seatbeltWarn: false, adasWarn: false, hvacTempC: 22, ...over };
}

function heavyFrame(n: number): Float32Array {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    a[i] = 0.6 * Math.sin((2 * Math.PI * 440 * i) / SR) + 0.3 * Math.sin((2 * Math.PI * 90 * i) / SR);
  }
  return a;
}

describe('TIP-011 compute latency — feature extraction is included', () => {
  it('computeMs folds in the FFT/onset/AGC time (non-zero on a real frame)', () => {
    const ext = createFeatureExtractor();
    const pcm = heavyFrame(4096);

    // accumulate several extractions for a stable, comfortably-positive reading
    let featureMs = 0;
    let feats: AudioFeatures = ext.process(pcm, SR);
    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      feats = ext.process(pcm, SR);
      featureMs += performance.now() - t0;
    }
    expect(featureMs).toBeGreaterThan(0);

    const loop = createLocalLoop();
    const r = loop.step(feats, vehicle(), 1, false, featureMs);

    expect(r.featureMs).toBe(featureMs);
    expect(r.computeMs).toBe(featureMs + r.resolveMs); // computeMs = featureMs + resolveMs
    expect(r.computeMs).toBeGreaterThan(0);
    expect(r.computeMs).toBeGreaterThanOrEqual(r.resolveMs);
  });

  it('idle (no audio frame) → computeMs is just the resolve core (featureMs 0)', () => {
    const loop = createLocalLoop();
    const r = loop.step(
      { bands: { bass: 0, mid: 0, high: 0 }, beat: { onset: false, strength: 0, tMs: 0 } },
      vehicle(),
      0,
    );
    expect(r.featureMs).toBe(0);
    expect(r.computeMs).toBe(r.resolveMs);
  });
});
