import { type RGB, type ZoneId } from '@nhipsang/schema';

// Mood presets (TIP-004 §B). Each preset maps the 3 audio bands to a colour
// palette + per-zone band assignment + a desired base flash rate.
//
// SAFETY NOTE: no preset puts a SATURATED red/blue into a driver-visible zone by
// default — we keep the Policy Gate (isRestrictedHue) as a backstop, not a
// crutch. Palettes lean amber / teal / warm-purple, reading as ambient rather
// than as a warning telltale.

export type Band = 'bass' | 'mid' | 'high';

export interface MoodPreset {
  id: number;
  name: 'calm' | 'energetic' | 'warm';
  palette: Record<Band, RGB>; // colour contributed per band
  zoneBand: Record<ZoneId, Band>; // which band drives each zone's brightness
  baseFlashHz: number; // desired flash rate before policy/limiter
}

// Shared zone→band mapping: front doors ride the bass, dash/console the mid,
// rear doors the high. Identical across presets — the mood lives in the palette.
const DEFAULT_ZONE_BAND: Record<ZoneId, Band> = {
  dashboard: 'mid',
  door_front_left: 'bass',
  door_front_right: 'bass',
  door_rear_left: 'high',
  door_rear_right: 'high',
  center_console: 'mid',
};

export const PRESETS: Record<number, MoodPreset> = {
  0: {
    id: 0,
    name: 'calm',
    palette: {
      bass: { r: 40, g: 90, b: 120 },
      mid: { r: 60, g: 130, b: 150 },
      high: { r: 110, g: 170, b: 190 },
    },
    zoneBand: DEFAULT_ZONE_BAND,
    baseFlashHz: 1.0,
  },
  1: {
    id: 1,
    name: 'energetic',
    palette: {
      bass: { r: 220, g: 140, b: 40 },
      mid: { r: 230, g: 170, b: 50 },
      high: { r: 200, g: 150, b: 210 },
    },
    zoneBand: DEFAULT_ZONE_BAND,
    baseFlashHz: 3.0,
  },
  2: {
    id: 2,
    name: 'warm',
    palette: {
      bass: { r: 230, g: 120, b: 30 },
      mid: { r: 240, g: 160, b: 60 },
      high: { r: 255, g: 200, b: 120 },
    },
    zoneBand: DEFAULT_ZONE_BAND,
    baseFlashHz: 1.5,
  },
};

export const DEFAULT_PRESET_ID = 0;

// Resolve a preset id → preset, falling back to `calm` for unknown ids
// (deterministic, never throws — the wire carries an arbitrary u8).
export function getPreset(presetId: number): MoodPreset {
  return PRESETS[presetId] ?? PRESETS[DEFAULT_PRESET_ID]!;
}
