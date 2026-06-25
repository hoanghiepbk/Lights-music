import { describe, it, expect } from 'vitest';
import type { AudioFeatures, VehicleState } from '@nhipsang/schema';
import { createLocalLoop } from '@sim/engine/localLoop';

function vehicle(over: Partial<VehicleState> = {}): VehicleState {
  return { gear: 'P', speedKmh: 0, seatbeltWarn: false, adasWarn: false, hvacTempC: 22, ...over };
}

function features(
  over: Partial<{ bass: number; mid: number; high: number; onset: boolean; strength: number; tMs: number }> = {},
): AudioFeatures {
  const o = { bass: 0, mid: 0, high: 0, onset: false, strength: 0, tMs: 0, ...over };
  return {
    bands: { bass: o.bass, mid: o.mid, high: o.high },
    beat: { onset: o.onset, strength: o.strength, tMs: o.tMs },
  };
}

function zoneBrightness(zones: { zone: string; brightness: number }[], zone: string): number {
  const z = zones.find((zc) => zc.zone === zone);
  if (!z) throw new Error(`zone ${zone} missing`);
  return z.brightness;
}

describe('localLoop — integration', () => {
  it('music-only (parked): bands → lit zones, winner=music', () => {
    const loop = createLocalLoop();
    const r = loop.step(features({ bass: 200, mid: 180, high: 120 }), vehicle(), 1);
    expect(r.winnerSource).toBe('music');
    expect(r.command.zones.some((z) => z.brightness > 0)).toBe(true);
  });

  it('safety override: seatbelt warn wins and is not brightness-capped at speed', () => {
    const loop = createLocalLoop();
    const r = loop.step(
      features({ bass: 200, mid: 200, high: 200, onset: true, tMs: 100 }),
      vehicle({ seatbeltWarn: true, gear: 'D', speedKmh: 100 }),
      1,
    );
    expect(r.winnerSource).toBe('safety');
    // safety is exempt → driver-visible zone keeps full telltale brightness
    expect(zoneBrightness(r.command.zones, 'dashboard')).toBeGreaterThan(0.35);
  });

  it('driving cap: gear D + speed 60 → dashboard ≤ 0.35 and no beat', () => {
    const loop = createLocalLoop();
    const r = loop.step(
      features({ bass: 255, mid: 255, high: 255, onset: true, tMs: 200 }),
      vehicle({ gear: 'D', speedKmh: 60 }),
      1,
    );
    expect(r.winnerSource).toBe('music');
    expect(zoneBrightness(r.command.zones, 'dashboard')).toBeLessThanOrEqual(0.35);
    expect(r.command.beat).toBe(false);
  });

  it('D-006 theme baseline: idle (silence, no warn, no fault) → winner=theme', () => {
    const loop = createLocalLoop();
    const r = loop.step(features(), vehicle(), 1);
    expect(r.winnerSource).toBe('theme');
    expect(r.command.zones.some((z) => z.brightness > 0)).toBe(true);
  });

  it('D-007 failsafe-on-fault: fault flag → winner=failsafe regardless of audio', () => {
    const loop = createLocalLoop();
    const r = loop.step(features({ bass: 200, mid: 180, high: 120 }), vehicle(), 1, true);
    expect(r.winnerSource).toBe('failsafe');
    expect(r.command.beat).toBe(false);
  });

  it('computeMs is a finite, non-negative number', () => {
    const loop = createLocalLoop();
    const r = loop.step(features({ bass: 100 }), vehicle(), 0);
    expect(Number.isFinite(r.computeMs)).toBe(true);
    expect(r.computeMs).toBeGreaterThanOrEqual(0);
  });
});
