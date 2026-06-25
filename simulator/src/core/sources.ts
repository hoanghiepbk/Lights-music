import { ZONES, type LightingRequest, type RGB, type VehicleState, type ZoneColor, type ZoneId } from '@nhipsang/schema';
import { getPreset } from './presets';

// Non-music lighting sources (TIP-004 §D). Each emits a LightingRequest the
// Arbiter ranks against music/theme. Pure & deterministic.

// Preset ids reserved for non-pattern sources (kept distinct from mood presets).
export const SAFETY_PRESET_ID = 240;
export const HVAC_PRESET_ID = 241;

// Safety telltale colours — LEGAL warning hues. Safety is EXEMPT from the
// ambient hue/brightness/flash restrictions (it IS a valid warning function).
const SAFETY_ADAS_RGB: RGB = { r: 255, g: 0, b: 0 }; // ADAS = red
const SAFETY_SEATBELT_RGB: RGB = { r: 255, g: 176, b: 0 }; // seatbelt = amber
export const SAFETY_FLASH_HZ = 2; // telltale blink rate
const SAFETY_BRIGHTNESS = 1.0;

// HVAC ambient endpoints + the temperature range they map across.
const HVAC_COOL_RGB: RGB = { r: 80, g: 150, b: 220 };
const HVAC_WARM_RGB: RGB = { r: 240, g: 140, b: 40 };
export const HVAC_TEMP_MIN_C = 16;
export const HVAC_TEMP_MAX_C = 30;
const HVAC_BRIGHTNESS = 0.5;

const THEME_BRIGHTNESS = 0.45; // static ambient level

// safety: warning telltale, or null when nothing is wrong.
export function safetyRequest(state: VehicleState): LightingRequest | null {
  if (!state.seatbeltWarn && !state.adasWarn) return null;
  // ADAS outranks seatbelt for colour (more critical).
  const rgb = state.adasWarn ? SAFETY_ADAS_RGB : SAFETY_SEATBELT_RGB;
  return {
    source: 'safety',
    presetId: SAFETY_PRESET_ID,
    zones: allZones(rgb, SAFETY_BRIGHTNESS),
    flashHz: SAFETY_FLASH_HZ,
  };
}

// hvac: colour follows cabin temperature (cool ↔ warm), no flash.
export function hvacRequest(state: VehicleState): LightingRequest {
  const t = clamp01((state.hvacTempC - HVAC_TEMP_MIN_C) / (HVAC_TEMP_MAX_C - HVAC_TEMP_MIN_C));
  const rgb = lerpRgb(HVAC_COOL_RGB, HVAC_WARM_RGB, t);
  return {
    source: 'hvac',
    presetId: HVAC_PRESET_ID,
    zones: allZones(rgb, HVAC_BRIGHTNESS),
    flashHz: 0,
  };
}

// theme: static ambient wash from the preset's mid colour (no audio), no flash.
export function themeRequest(presetId: number): LightingRequest {
  const preset = getPreset(presetId);
  return {
    source: 'theme',
    presetId: preset.id,
    zones: allZones(preset.palette.mid, THEME_BRIGHTNESS),
    flashHz: 0,
  };
}

function allZones(rgb: RGB, brightness: number): ZoneColor[] {
  return ZONES.map((zone: ZoneId): ZoneColor => ({ zone, rgb: { ...rgb }, brightness }));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
