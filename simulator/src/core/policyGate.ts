import {
  DRIVER_VISIBLE_ZONES,
  PRIORITY_ORDER,
  ZONES,
  type LightingCommand,
  type LightingRequest,
  type LightingSource,
  type RGB,
  type VehicleState,
  type ZoneColor,
} from '@nhipsang/schema';

// Policy Gate (TIP-004 §F) — encodes INV-1/2/3 for AMBIENT sources plus the
// INV-5 failsafe. Safety telltales are EXEMPT (a valid warning function) and
// pass through untouched. All thresholds are named so TIP-007 can re-assert.

// "driving" gate (INV-1 trigger): not in Park, or moving faster than the crawl
// threshold. INV-3's brightness cap uses the stricter speed test below.
export const DRIVING_SPEED_THRESHOLD_KMH = 5;

// INV-3: driver-visible zones capped to this brightness once above the speed test.
export const BRIGHTNESS_CAP_DRIVING = 0.35;

// INV-1: a hue is "restricted" for driver-visible ambient zones when it reads as
// a SATURATED red or SATURATED blue (reserved for warnings / instrumentation).
// A channel ≥ DOMINANT while the other two are ≤ SUPPRESSED = saturated/pure.
export const RESTRICTED_HUE_DOMINANT = 140;
export const RESTRICTED_HUE_SUPPRESSED = 90;

// INV-1 recolour target: a safe amber that is NOT itself a restricted hue.
export const SAFE_AMBER: RGB = { r: 255, g: 176, b: 0 };

// INV-5 failsafe look: dim neutral, no flash.
export const FAILSAFE_BRIGHTNESS = 0.15;
export const FAILSAFE_NEUTRAL_RGB: RGB = { r: 40, g: 40, b: 45 };

export function driving(state: VehicleState): boolean {
  return state.gear !== 'P' || state.speedKmh > DRIVING_SPEED_THRESHOLD_KMH;
}

export function isRestrictedHue(rgb: RGB): boolean {
  const redDominant =
    rgb.r >= RESTRICTED_HUE_DOMINANT &&
    rgb.g <= RESTRICTED_HUE_SUPPRESSED &&
    rgb.b <= RESTRICTED_HUE_SUPPRESSED;
  const blueDominant =
    rgb.b >= RESTRICTED_HUE_DOMINANT &&
    rgb.r <= RESTRICTED_HUE_SUPPRESSED &&
    rgb.g <= RESTRICTED_HUE_SUPPRESSED;
  return redDominant || blueDominant;
}

export interface PolicyResult {
  zones: ZoneColor[];
  beatAllowed: boolean;
  presetId: number;
  source: LightingSource;
}

const DRIVER_VISIBLE = new Set<string>(DRIVER_VISIBLE_ZONES);

export function applyPolicy(req: LightingRequest, state: VehicleState): PolicyResult {
  // Safety telltale: EXEMPT from INV-1/2/3 — pass colour/brightness/flash through.
  if (req.source === 'safety') {
    return {
      zones: req.zones.map(cloneZone),
      beatAllowed: true,
      presetId: req.presetId,
      source: req.source,
    };
  }

  const isDriving = driving(state);
  const capBrightness = state.speedKmh > DRIVING_SPEED_THRESHOLD_KMH;

  const zones = req.zones.map((zc): ZoneColor => {
    const out = cloneZone(zc);
    if (DRIVER_VISIBLE.has(zc.zone)) {
      // INV-1: recolour saturated red/blue → safe amber while driving (keep brightness).
      if (isDriving && isRestrictedHue(out.rgb)) {
        out.rgb = { ...SAFE_AMBER };
      }
      // INV-3: cap brightness once above the speed threshold.
      if (capBrightness && out.brightness > BRIGHTNESS_CAP_DRIVING) {
        out.brightness = BRIGHTNESS_CAP_DRIVING;
      }
    }
    return out;
  });

  return {
    zones,
    // INV-2 (driving rule): no beat-flash while driving — breathing/steady only.
    beatAllowed: !isDriving,
    presetId: req.presetId,
    source: req.source,
  };
}

// INV-5: safe static state for "no valid request / fault".
export function failSafe(): LightingCommand {
  const zones: ZoneColor[] = ZONES.map(
    (zone): ZoneColor => ({
      zone,
      rgb: { ...FAILSAFE_NEUTRAL_RGB },
      brightness: FAILSAFE_BRIGHTNESS,
    }),
  );
  const zoneMask = (1 << ZONES.length) - 1; // every zone lit (brightness > 0)
  return {
    presetId: 0,
    zones,
    bandLevels: [0, 0, 0],
    beat: false,
    zoneMask,
    priority: PRIORITY_ORDER.length - 1, // lowest priority
    brightnessCap: 255,
  };
}

function cloneZone(zc: ZoneColor): ZoneColor {
  return { zone: zc.zone, rgb: { ...zc.rgb }, brightness: zc.brightness };
}
