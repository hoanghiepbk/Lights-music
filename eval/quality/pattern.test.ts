// QUALITY tier — TIP-011 pattern colour variety (informational).
// Asserts the music pattern produces visible hue variety (per zone + per spectrum)
// and that the 3 presets render differently — WITHOUT weakening INV-1 (driver
// zones must never carry a restricted hue while driving).
import { describe, it, expect } from 'vitest';
import { DRIVER_VISIBLE_ZONES, type AudioFeatures, type RGB, type VehicleState } from '@nhipsang/schema';
import { musicRequest, applyPolicy, isRestrictedHue } from '@sim/core';

function vehicle(over: Partial<VehicleState> = {}): VehicleState {
  return { gear: 'P', speedKmh: 0, seatbeltWarn: false, adasWarn: false, hvacTempC: 22, ...over };
}

function features(
  over: Partial<{ bass: number; mid: number; high: number; onset: boolean; strength: number; tMs: number }> = {},
): AudioFeatures {
  const o = { bass: 0, mid: 0, high: 0, onset: false, strength: 0, tMs: 0, ...over };
  return { bands: { bass: o.bass, mid: o.mid, high: o.high }, beat: { onset: o.onset, strength: o.strength, tMs: o.tMs } };
}

function rgbKey(rgb: RGB): string {
  return `${rgb.r},${rgb.g},${rgb.b}`;
}

function zoneRgb(req: ReturnType<typeof musicRequest>, zone: string): RGB {
  const z = req.zones.find((c) => c.zone === zone);
  if (!z) throw new Error(`zone ${zone} missing`);
  return z.rgb;
}

describe('TIP-011 pattern — colour variety', () => {
  it('lights zones with more than one hue when all 3 bands are present', () => {
    const r = musicRequest(features({ bass: 255, mid: 255, high: 255 }), 1); // energetic
    const hues = new Set(r.zones.map((z) => rgbKey(z.rgb)));
    expect(hues.size).toBeGreaterThan(1);
  });

  it('a zone hue shifts with the spectrum (bass-heavy ≠ treble-heavy)', () => {
    const bassHeavy = zoneRgb(musicRequest(features({ bass: 255, mid: 20, high: 20 }), 1), 'dashboard');
    const trebleHeavy = zoneRgb(musicRequest(features({ bass: 20, mid: 20, high: 255 }), 1), 'dashboard');
    expect(bassHeavy).not.toEqual(trebleHeavy);
  });

  it('the 3 presets render different colours + flash rates for the same audio', () => {
    const f = features({ bass: 200, mid: 150, high: 100 });
    const calm = zoneRgb(musicRequest(f, 0), 'dashboard');
    const energetic = zoneRgb(musicRequest(f, 1), 'dashboard');
    const warm = zoneRgb(musicRequest(f, 2), 'dashboard');
    expect(calm).not.toEqual(energetic);
    expect(energetic).not.toEqual(warm);
    expect(calm).not.toEqual(warm);
    expect(musicRequest(f, 0).flashHz).not.toBe(musicRequest(f, 1).flashHz);
  });
});

describe('TIP-011 pattern — safety unchanged (INV-1 backstop)', () => {
  it('energetic preset leaves NO restricted hue in driver zones while driving', () => {
    const drivingState = vehicle({ gear: 'D', speedKmh: 60 });
    for (const spec of [{ bass: 255 }, { mid: 255 }, { high: 255 }, { bass: 255, mid: 255, high: 255 }]) {
      const out = applyPolicy(musicRequest(features(spec), 1), drivingState);
      for (const z of out.zones) {
        if (DRIVER_VISIBLE_ZONES.includes(z.zone)) {
          expect(isRestrictedHue(z.rgb)).toBe(false);
        }
      }
    }
  });
});
