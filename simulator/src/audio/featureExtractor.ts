// Pure, deterministic DSP feature extractor: PCM frame → AudioFeatures.
// No Date.now()/random (tMs derived from frame count) so it is node-testable.
import type { AudioFeatures } from '@nhipsang/schema';
import { magnitudeSpectrum } from './fft';

export interface FeatureExtractorOptions {
  agcDecay?: number; // running-peak decay per frame (AGC)
  attack?: number; // smoothing coef when level rises (fast)
  release?: number; // smoothing coef when level falls (slow)
  fluxK?: number; // adaptive onset threshold = mean + k·std
  refractoryMs?: number; // min gap between onsets
  fluxWindow?: number; // frames of flux history for the adaptive threshold
  warmupFrames?: number; // ignore onsets during startup transient
  relativeFloor?: number; // cross-band AGC floor (see note below)
}

export interface FeatureExtractor {
  process(pcm: Float32Array, sampleRate: number): AudioFeatures;
}

interface Band {
  lo: number;
  hi: number;
}

// bass 20–250 Hz · mid 250–4000 Hz · high 4000–16000 Hz
const BANDS: readonly Band[] = [
  { lo: 20, hi: 250 },
  { lo: 250, hi: 4000 },
  { lo: 4000, hi: 16000 },
];

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function createFeatureExtractor(options: FeatureExtractorOptions = {}): FeatureExtractor {
  const agcDecay = options.agcDecay ?? 0.999;
  const attack = options.attack ?? 0.6;
  const release = options.release ?? 0.08;
  const fluxK = options.fluxK ?? 1.5;
  const refractoryMs = options.refractoryMs ?? 60;
  const fluxWindow = options.fluxWindow ?? 43;
  const warmupFrames = options.warmupFrames ?? 3;
  const relativeFloor = options.relativeFloor ?? 0.1;

  // persistent state (per band: bass/mid/high)
  const runningPeak = [0, 0, 0];
  const level = [0, 0, 0];
  let prevEnergy = 0;
  let prevMag: Float32Array | null = null;
  let runningFluxPeak = 0;
  let runningSpecPeak = 0;
  const fluxBuf = new Float32Array(fluxWindow);
  let fluxWrite = 0;
  let fluxFilled = 0;
  let frameCount = 0;
  let lastOnsetTms = -Infinity;

  function process(pcm: Float32Array, sampleRate: number): AudioFeatures {
    const n = pcm.length;
    const tMs = frameCount * ((n / sampleRate) * 1000);
    const mag = magnitudeSpectrum(pcm);
    const half = mag.length;
    const binHz = sampleRate / n;

    // --- 3-band raw energy (sum of magnitudes in each Hz range) ---
    const raw = [0, 0, 0];
    for (let b = 0; b < 3; b++) {
      const band = BANDS[b]!;
      const loBin = Math.max(1, Math.ceil(band.lo / binHz));
      const hiBin = Math.min(half - 1, Math.floor(band.hi / binHz));
      let s = 0;
      for (let i = loBin; i <= hiBin; i++) s += mag[i]!;
      raw[b] = s;
    }

    // --- AGC: per-band running peak, plus a cross-band global reference ---
    // NOTE (deviation, see completion report): the Blueprint's literal per-band
    // formula self-normalises every band to full scale, so a silent band lit only
    // by spectral leakage would also read ~255 and frequency discrimination is
    // lost. We keep the per-band running peak but floor it at `globalMax*floor`,
    // so quiet bands stay dark relative to the loudest band while a globally quiet
    // (but real) signal is still boosted into a usable range.
    for (let b = 0; b < 3; b++) {
      runningPeak[b] = Math.max(runningPeak[b]! * agcDecay, raw[b]!);
    }
    const globalMax = Math.max(runningPeak[0]!, runningPeak[1]!, runningPeak[2]!);

    // --- normalize + attack/release smoothing → level 0..255 per band ---
    const bands = [0, 0, 0];
    for (let b = 0; b < 3; b++) {
      const effPeak = Math.max(runningPeak[b]!, globalMax * relativeFloor);
      const target = effPeak > 0 ? clamp((raw[b]! / effPeak) * 255, 0, 255) : 0;
      const cur = level[b]!;
      const coef = target > cur ? attack : release;
      const next = cur + coef * (target - cur);
      level[b] = next;
      bands[b] = next;
    }

    // --- energy flux (kick/beat) ---
    let energy = 0;
    for (let i = 0; i < half; i++) energy += mag[i]!;
    const flux = Math.max(0, energy - prevEnergy);
    prevEnergy = energy;

    // adaptive threshold from the PRIOR flux window (mean + k·std)
    let mean = 0;
    for (let i = 0; i < fluxFilled; i++) mean += fluxBuf[i]!;
    mean = fluxFilled > 0 ? mean / fluxFilled : 0;
    let variance = 0;
    for (let i = 0; i < fluxFilled; i++) {
      const d = fluxBuf[i]! - mean;
      variance += d * d;
    }
    const std = fluxFilled > 0 ? Math.sqrt(variance / fluxFilled) : 0;
    const threshold = mean + fluxK * std;

    // --- spectral flux (soft onset) → blended into strength ---
    let specFlux = 0;
    if (prevMag) {
      for (let i = 0; i < half; i++) specFlux += Math.max(0, mag[i]! - prevMag[i]!);
    }
    prevMag = mag;

    // --- onset decision (energy flux is the primary trigger) ---
    let onset = false;
    if (
      frameCount >= warmupFrames &&
      flux > 0 &&
      flux > threshold &&
      tMs - lastOnsetTms >= refractoryMs
    ) {
      onset = true;
      lastOnsetTms = tMs;
    }

    // push current flux into the ring buffer (after threshold computed)
    fluxBuf[fluxWrite] = flux;
    fluxWrite = (fluxWrite + 1) % fluxWindow;
    if (fluxFilled < fluxWindow) fluxFilled++;

    // --- strength: normalized blend of energy + spectral flux, 0..1 ---
    runningFluxPeak = Math.max(runningFluxPeak * agcDecay, flux);
    runningSpecPeak = Math.max(runningSpecPeak * agcDecay, specFlux);
    const eNorm = runningFluxPeak > 0 ? flux / runningFluxPeak : 0;
    const sNorm = runningSpecPeak > 0 ? specFlux / runningSpecPeak : 0;
    const strength = clamp(0.7 * eNorm + 0.3 * sNorm, 0, 1);

    frameCount++;

    return {
      bands: { bass: bands[0]!, mid: bands[1]!, high: bands[2]! },
      beat: { onset, strength, tMs },
    };
  }

  return { process };
}
