import { type RGB, type ZoneId } from '@nhipsang/schema';

// Mood presets (TIP-004 §B, refined TIP-011). Each preset maps the 3 audio bands
// to a colour palette + a desired base flash rate. The pattern engine BLENDS the
// 3 band palettes by live energy (per zone), so a zone's HUE shifts with the
// spectrum — not just its brightness.
//
// SAFETY NOTE: no preset puts a SATURATED red/blue into a driver-visible zone by
// default (every palette colour keeps a mid channel > RESTRICTED_HUE_SUPPRESSED).
// The Policy Gate (isRestrictedHue) stays a backstop, not a crutch.

export type Band = 'bass' | 'mid' | 'high';

export interface MoodPreset {
  id: number;
  name: 'calm' | 'energetic' | 'warm';
  palette: Record<Band, RGB>; // colour contributed per band (blended by live energy)
  baseFlashHz: number; // desired flash rate before policy/limiter
}

// Per-zone band emphasis [bass, mid, high] — the SPATIAL identity, shared across
// presets (the mood lives in the palette). Front doors ride the bass, dash/console
// the mid, rear doors the high; the small cross weights let neighbouring bands
// bleed in so the blend varies smoothly instead of snapping between 3 colours.
export const ZONE_BAND_WEIGHT: Record<ZoneId, readonly [number, number, number]> = {
  dashboard: [0.2, 0.9, 0.5],
  door_front_left: [0.95, 0.4, 0.15],
  door_front_right: [0.95, 0.4, 0.15],
  door_rear_left: [0.2, 0.45, 0.95],
  door_rear_right: [0.2, 0.45, 0.95],
  center_console: [0.5, 0.9, 0.3],
};

export const PRESETS: Record<number, MoodPreset> = {
  // calm — cool, low-saturation, slow. Blues → teal → pale cyan.
  0: {
    id: 0,
    name: 'calm',
    palette: {
      bass: { r: 70, g: 120, b: 175 },
      mid: { r: 60, g: 160, b: 160 },
      high: { r: 150, g: 205, b: 220 },
    },
    baseFlashHz: 0.8,
  },
  // energetic — saturated, high-contrast across the spectrum (warm→green→cold),
  // fast beat. Vivid but never a restricted hue in a driver zone.
  1: {
    id: 1,
    name: 'energetic',
    palette: {
      bass: { r: 255, g: 125, b: 15 }, // vivid orange
      mid: { r: 35, g: 205, b: 110 }, // vivid green
      high: { r: 150, g: 75, b: 235 }, // vivid violet
    },
    baseFlashHz: 3.0,
  },
  // warm — amber/gold, cosy. Deep orange → amber → warm gold.
  2: {
    id: 2,
    name: 'warm',
    palette: {
      bass: { r: 235, g: 105, b: 25 },
      mid: { r: 245, g: 160, b: 55 },
      high: { r: 255, g: 205, b: 120 },
    },
    baseFlashHz: 1.5,
  },
};

export const DEFAULT_PRESET_ID = 0;

// Resolve a preset id → preset, falling back to `calm` for unknown ids
// (deterministic, never throws — the wire carries an arbitrary u8).
export function getPreset(presetId: number): MoodPreset {
  return PRESETS[presetId] ?? PRESETS[DEFAULT_PRESET_ID]!;
}
