// CRITICAL tier — the 6 safety invariants (INV-1..6). MUST pass to merge.
// Every numeric assertion locks onto a NAMED constant imported from core, so the
// test fails if the source threshold ever drifts (no hard-coded magic numbers).
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
  DRIVING_SPEED_THRESHOLD_KMH,
  FLASH_MAX_HZ_PARKED,
  FAILSAFE_BRIGHTNESS,
  FAILSAFE_NEUTRAL_RGB,
} from '@sim/core';

const MOVING_KMH = DRIVING_SPEED_THRESHOLD_KMH + 1; // just over the crawl threshold

function vehicle(over: Partial<VehicleState> = {}): VehicleState {
  return { gear: 'P', speedKmh: 0, seatbeltWarn: false, adasWarn: false, hvacTempC: 22, ...over };
}

function features(
  over: Partial<{ bass: number; mid: number; high: number; onset: boolean; strength: number; tMs: number }> = {},
): AudioFeatures {
  const o = { bass: 0, mid: 0, high: 0, onset: false, strength: 0, tMs: 0, ...over };
  return { bands: { bass: o.bass, mid: o.mid, high: o.high }, beat: { onset: o.onset, strength: o.strength, tMs: o.tMs } };
}

const RED: RGB = { r: 255, g: 0, b: 0 };
const BLUE: RGB = { r: 0, g: 0, b: 255 };
const SAFE_TEAL: RGB = { r: 60, g: 130, b: 150 };

function req(source: LightingRequest['source'], rgb: RGB, brightness = 1.0): LightingRequest {
  const zones: ZoneColor[] = ZONES.map((zone): ZoneColor => ({ zone, rgb: { ...rgb }, brightness }));
  return { source, presetId: 0, zones, flashHz: 2 };
}

function zoneOf(zones: ZoneColor[], zone: string): ZoneColor {
  const z = zones.find((zc) => zc.zone === zone);
  if (!z) throw new Error(`zone ${zone} missing`);
  return z;
}

describe('INV-1 — driver-visible hue restriction (ambient)', () => {
  it('recolours saturated red in a driver zone while driving', () => {
    const out = applyPolicy(req('music', RED), vehicle({ gear: 'D', speedKmh: MOVING_KMH }));
    const dash = zoneOf(out.zones, 'dashboard');
    expect(isRestrictedHue(dash.rgb)).toBe(false);
    expect(dash.rgb).toEqual(SAFE_AMBER);
  });

  it('recolours saturated blue in a driver zone while driving', () => {
    const out = applyPolicy(req('music', BLUE), vehicle({ gear: 'D', speedKmh: MOVING_KMH }));
    expect(isRestrictedHue(zoneOf(out.zones, 'dashboard').rgb)).toBe(false);
  });

  it('exempt: safety keeps saturated red while driving', () => {
    const out = applyPolicy(req('safety', RED), vehicle({ gear: 'D', speedKmh: MOVING_KMH }));
    const dash = zoneOf(out.zones, 'dashboard');
    expect(dash.rgb).toEqual(RED);
    expect(isRestrictedHue(dash.rgb)).toBe(true);
  });
});

describe('INV-2 — flash policy', () => {
  it('2a: no beat flashes while driving, even on continuous onsets', () => {
    const r = createLightingResolver();
    const state = vehicle({ gear: 'D', speedKmh: MOVING_KMH });
    const beats: boolean[] = [];
    for (let i = 0; i < 20; i++) {
      beats.push(r.resolve({ requests: [req('music', SAFE_TEAL)], state, features: features({ onset: true, strength: 1, tMs: i * 50 }) }).beat);
    }
    expect(beats.every((b) => b === false)).toBe(true);
  });

  it(`2b: parked beats are rate-limited to ≤ ${FLASH_MAX_HZ_PARKED} per second`, () => {
    const r = createLightingResolver();
    const state = vehicle();
    let count = 0;
    for (let i = 0; i < 10; i++) {
      // onsets at 10 Hz across 1 s
      if (r.resolve({ requests: [req('music', SAFE_TEAL)], state, features: features({ onset: true, strength: 1, tMs: i * 100 }) }).beat) count++;
    }
    expect(count).toBeLessThanOrEqual(FLASH_MAX_HZ_PARKED);
    expect(count).toBeGreaterThan(0);
  });
});

describe('INV-3 — driver-zone brightness cap', () => {
  it('caps driver-zone brightness when moving', () => {
    const out = applyPolicy(req('music', SAFE_TEAL, 1.0), vehicle({ gear: 'D', speedKmh: MOVING_KMH }));
    expect(zoneOf(out.zones, 'dashboard').brightness).toBeLessThanOrEqual(BRIGHTNESS_CAP_DRIVING);
  });

  it('allows full brightness when parked', () => {
    const out = applyPolicy(req('music', SAFE_TEAL, 1.0), vehicle());
    expect(zoneOf(out.zones, 'dashboard').brightness).toBe(1.0);
  });

  it('exempt: safety brightness is not capped at speed', () => {
    const out = applyPolicy(req('safety', RED, 1.0), vehicle({ gear: 'D', speedKmh: MOVING_KMH }));
    expect(zoneOf(out.zones, 'dashboard').brightness).toBe(1.0);
  });
});

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

describe('INV-5 — failsafe on no valid request', () => {
  it('resolves empty requests to a dim, neutral, non-flashing state', () => {
    const r = createLightingResolver();
    const cmd = r.resolve({ requests: [], state: vehicle(), features: features() });
    expect(cmd.beat).toBe(false);
    expect(cmd.priority).toBe(PRIORITY_ORDER.length - 1);
    for (const z of cmd.zones) {
      expect(z.brightness).toBeLessThanOrEqual(FAILSAFE_BRIGHTNESS);
      expect(z.rgb).toEqual(FAILSAFE_NEUTRAL_RGB);
      expect(isRestrictedHue(z.rgb)).toBe(false);
    }
  });
});
