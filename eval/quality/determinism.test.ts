// QUALITY tier — determinism of the resolver pipeline (informational).
import { describe, it, expect } from 'vitest';
import { ZONES, type AudioFeatures, type LightingRequest, type RGB, type ZoneColor, type VehicleState } from '@nhipsang/schema';
import { createLightingResolver } from '@sim/core';

const SAFE_TEAL: RGB = { r: 60, g: 130, b: 150 };

function vehicle(over: Partial<VehicleState> = {}): VehicleState {
  return { gear: 'P', speedKmh: 0, seatbeltWarn: false, adasWarn: false, hvacTempC: 22, ...over };
}

function features(over: Partial<{ onset: boolean; strength: number; tMs: number }> = {}): AudioFeatures {
  const o = { onset: false, strength: 0, tMs: 0, ...over };
  return { bands: { bass: 0, mid: 0, high: 0 }, beat: { onset: o.onset, strength: o.strength, tMs: o.tMs } };
}

function req(rgb: RGB): LightingRequest {
  const zones: ZoneColor[] = ZONES.map((zone): ZoneColor => ({ zone, rgb: { ...rgb }, brightness: 1 }));
  return { source: 'music', presetId: 0, zones, flashHz: 2 };
}

describe('Determinism', () => {
  it('identical context sequence → identical commands', () => {
    const seq = [
      { onset: true, strength: 1, tMs: 0 },
      { onset: false, strength: 0.2, tMs: 120 },
      { onset: true, strength: 0.8, tMs: 350 },
      { onset: true, strength: 0.5, tMs: 700 },
    ];
    const state = vehicle();
    const run = () => {
      const r = createLightingResolver();
      return seq.map((f) => r.resolve({ requests: [req(SAFE_TEAL)], state, features: features(f) }));
    };
    expect(run()).toEqual(run());
  });
});
