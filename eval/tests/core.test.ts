import { describe, it, expect } from 'vitest';
import {
  ZONES,
  PRIORITY_ORDER,
  type AudioFeatures,
  type LightingRequest,
  type RGB,
  type VehicleState,
  type ZoneColor,
} from '@nhipsang/schema';
import {
  arbitrate,
  applyPolicy,
  isRestrictedHue,
  createLightingResolver,
  safetyRequest,
  hvacRequest,
  themeRequest,
  musicRequest,
  SAFE_AMBER,
  BRIGHTNESS_CAP_DRIVING,
} from '@sim/core';

// ---- helpers ---------------------------------------------------------------

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

const RED: RGB = { r: 255, g: 0, b: 0 };
const BLUE: RGB = { r: 0, g: 0, b: 255 };
const SAFE_TEAL: RGB = { r: 60, g: 130, b: 150 };

// Build a single-source request painting every zone the same colour/brightness.
function req(source: LightingRequest['source'], rgb: RGB, brightness = 1.0): LightingRequest {
  const zones: ZoneColor[] = ZONES.map((zone): ZoneColor => ({ zone, rgb: { ...rgb }, brightness }));
  return { source, presetId: 0, zones, flashHz: 2 };
}

function zoneOf(zones: ZoneColor[], zone: string): ZoneColor {
  const z = zones.find((zc) => zc.zone === zone);
  if (!z) throw new Error(`zone ${zone} missing`);
  return z;
}

// ---- INV-1: restricted-hue recolour ----------------------------------------

describe('INV-1 — driver-visible hue restriction (ambient)', () => {
  it('recolours saturated red in a driver zone while driving', () => {
    const out = applyPolicy(req('music', RED), vehicle({ gear: 'D', speedKmh: 30 }));
    const dash = zoneOf(out.zones, 'dashboard');
    expect(isRestrictedHue(dash.rgb)).toBe(false);
    expect(dash.rgb).toEqual(SAFE_AMBER);
  });

  it('recolours saturated blue in a driver zone while driving', () => {
    const out = applyPolicy(req('music', BLUE), vehicle({ gear: 'D', speedKmh: 30 }));
    expect(isRestrictedHue(zoneOf(out.zones, 'dashboard').rgb)).toBe(false);
  });

  it('exempt: safety keeps saturated red while driving', () => {
    const out = applyPolicy(req('safety', RED), vehicle({ gear: 'D', speedKmh: 30 }));
    const dash = zoneOf(out.zones, 'dashboard');
    expect(dash.rgb).toEqual(RED);
    expect(isRestrictedHue(dash.rgb)).toBe(true);
  });
});

// ---- INV-2: beat-flash policy + parked rate limit --------------------------

describe('INV-2 — flash policy', () => {
  it('2a: no beat flashes while driving, even on continuous onsets', () => {
    const r = createLightingResolver();
    const state = vehicle({ gear: 'D', speedKmh: 30 });
    const beats: boolean[] = [];
    for (let i = 0; i < 20; i++) {
      const cmd = r.resolve({
        requests: [req('music', SAFE_TEAL)],
        state,
        features: features({ onset: true, strength: 1, tMs: i * 50 }),
      });
      beats.push(cmd.beat);
    }
    expect(beats.every((b) => b === false)).toBe(true);
  });

  it('2b: parked beats are rate-limited to ≤ 3 per second', () => {
    const r = createLightingResolver();
    const state = vehicle(); // parked: gear P, speed 0
    let count = 0;
    for (let i = 0; i < 10; i++) {
      // onsets at 10 Hz across 1 s
      const cmd = r.resolve({
        requests: [req('music', SAFE_TEAL)],
        state,
        features: features({ onset: true, strength: 1, tMs: i * 100 }),
      });
      if (cmd.beat) count++;
    }
    expect(count).toBeLessThanOrEqual(3);
    expect(count).toBeGreaterThan(0);
  });
});

// ---- INV-3: brightness cap above the speed threshold -----------------------

describe('INV-3 — driver-zone brightness cap', () => {
  it('caps driver-zone brightness when moving', () => {
    const out = applyPolicy(req('music', SAFE_TEAL, 1.0), vehicle({ gear: 'D', speedKmh: 60 }));
    expect(zoneOf(out.zones, 'dashboard').brightness).toBeLessThanOrEqual(BRIGHTNESS_CAP_DRIVING);
  });

  it('allows full brightness when parked', () => {
    const out = applyPolicy(req('music', SAFE_TEAL, 1.0), vehicle()); // gear P, speed 0
    expect(zoneOf(out.zones, 'dashboard').brightness).toBe(1.0);
  });

  it('exempt: safety brightness is not capped at speed', () => {
    const out = applyPolicy(req('safety', RED, 1.0), vehicle({ gear: 'D', speedKmh: 60 }));
    expect(zoneOf(out.zones, 'dashboard').brightness).toBe(1.0);
  });
});

// ---- INV-4 / INV-6: arbiter priority ordering ------------------------------

describe('INV-4/INV-6 — arbiter honours PRIORITY_ORDER', () => {
  const theme = themeRequest(0);
  const music = musicRequest(features({ bass: 200 }), 0);
  const hvac = hvacRequest(vehicle({ hvacTempC: 28 }));
  const safety = safetyRequest(vehicle({ seatbeltWarn: true }))!;

  it('safety beats everything', () => {
    expect(arbitrate([theme, music, hvac, safety])!.source).toBe('safety');
  });
  it('hvac wins without safety', () => {
    expect(arbitrate([theme, music, hvac])!.source).toBe('hvac');
  });
  it('music wins over theme', () => {
    expect(arbitrate([theme, music])!.source).toBe('music');
  });
  it('theme wins alone', () => {
    expect(arbitrate([theme])!.source).toBe('theme');
  });
  it('returns null for no valid request', () => {
    expect(arbitrate([])).toBeNull();
    expect(arbitrate([null, null])).toBeNull();
  });
});

// ---- INV-5: failsafe --------------------------------------------------------

describe('INV-5 — failsafe on no valid request', () => {
  it('resolves empty requests to a dim, neutral, non-flashing state', () => {
    const r = createLightingResolver();
    const cmd = r.resolve({ requests: [], state: vehicle(), features: features() });
    expect(cmd.beat).toBe(false);
    expect(cmd.priority).toBe(PRIORITY_ORDER.length - 1); // lowest priority
    for (const z of cmd.zones) {
      expect(z.brightness).toBeLessThanOrEqual(0.2);
      expect(isRestrictedHue(z.rgb)).toBe(false);
    }
  });
});

// ---- Determinism ------------------------------------------------------------

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
      return seq.map((f) =>
        r.resolve({ requests: [req('music', SAFE_TEAL)], state, features: features(f) }),
      );
    };
    expect(run()).toEqual(run());
  });
});
