import { ZONES, type AudioFeatures, type LightingRequest, type ZoneColor, type ZoneId } from '@nhipsang/schema';
import { getPreset } from './presets';

// Gain applied to onset strength when deriving the music flash rate. The audio
// pipeline (TIP-003) exposes onset *strength* (0..1), not BPM, so we modulate
// the preset's base rate by energy as a tempo proxy. Policy Gate + FlashLimiter
// cap the result downstream. Named so TIP-007 can re-assert it.
export const FLASH_HZ_STRENGTH_GAIN = 1.0;

// music source (TIP-004 §C): map each band → colour/brightness per zone using
// the active preset. Pure & deterministic — no time, no randomness.
export function musicRequest(features: AudioFeatures, presetId: number): LightingRequest {
  const preset = getPreset(presetId);
  const zones: ZoneColor[] = ZONES.map((zone: ZoneId): ZoneColor => {
    const band = preset.zoneBand[zone];
    const level = features.bands[band] / 255; // 0..1 perceptual (D-003)
    const rgb = preset.palette[band];
    return { zone, rgb: { ...rgb }, brightness: clamp01(level) };
  });
  // base rate modulated by onset strength (energy proxy for tempo)
  const flashHz = preset.baseFlashHz * (1 + features.beat.strength * FLASH_HZ_STRENGTH_GAIN);
  return { source: 'music', presetId: preset.id, zones, flashHz };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
