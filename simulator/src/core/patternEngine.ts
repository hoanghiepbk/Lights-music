import { ZONES, type AudioFeatures, type LightingRequest, type RGB, type ZoneColor, type ZoneId } from '@nhipsang/schema';
import { getPreset, ZONE_BAND_WEIGHT, type Band } from './presets';

// Gain applied to onset strength when deriving the music flash rate. The audio
// pipeline (TIP-003) exposes onset *strength* (0..1), not BPM, so we modulate
// the preset's base rate by energy as a tempo proxy. Policy Gate + FlashLimiter
// cap the result downstream. Named so TIP-007 can re-assert it.
export const FLASH_HZ_STRENGTH_GAIN = 1.0;

const BAND_ORDER: readonly Band[] = ['bass', 'mid', 'high'];

// music source (TIP-004 §C, refined TIP-011): each zone's colour is the
// energy-weighted BLEND of the 3 band palette colours — weighted by the live band
// level AND the zone's spatial emphasis (ZONE_BAND_WEIGHT). So the hue shifts with
// the spectrum (bass-heavy → warm, treble-heavy → cold) and differs across zones,
// instead of every zone showing one static colour. Brightness = the zone's
// weighted-average band level. Pure & deterministic — no time, no randomness.
export function musicRequest(features: AudioFeatures, presetId: number): LightingRequest {
  const preset = getPreset(presetId);
  // 0..1 perceptual band levels (D-003).
  const level = [features.bands.bass / 255, features.bands.mid / 255, features.bands.high / 255];

  const zones: ZoneColor[] = ZONES.map((zone: ZoneId): ZoneColor => {
    const w = ZONE_BAND_WEIGHT[zone];
    let er = 0;
    let eg = 0;
    let eb = 0;
    let energy = 0; // Σ weight·level  → the blend's total contribution
    let wsum = 0; // Σ weight        → normaliser for brightness
    for (let b = 0; b < 3; b++) {
      const contrib = w[b]! * level[b]!;
      const rgb = preset.palette[BAND_ORDER[b]!];
      er += contrib * rgb.r;
      eg += contrib * rgb.g;
      eb += contrib * rgb.b;
      energy += contrib;
      wsum += w[b]!;
    }
    const rgb: RGB =
      energy > 0
        ? { r: Math.round(er / energy), g: Math.round(eg / energy), b: Math.round(eb / energy) }
        : { ...preset.palette.mid }; // dark zone — colour irrelevant at brightness 0
    return { zone, rgb, brightness: clamp01(energy / wsum) };
  });

  // base rate modulated by onset strength (energy proxy for tempo)
  const flashHz = preset.baseFlashHz * (1 + features.beat.strength * FLASH_HZ_STRENGTH_GAIN);
  return { source: 'music', presetId: preset.id, zones, flashHz };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
