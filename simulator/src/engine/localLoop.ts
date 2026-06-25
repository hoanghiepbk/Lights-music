// Local glue loop (TIP-005 §A) — NO React, testable in node.
// Gathers source requests → resolver → LightingCommand, and reports which
// source won plus how long the compute took. Keeps the resolver (and its
// FlashLimiter state) internal so beat-rate limiting works across frames.
import {
  arbitrate,
  createLightingResolver,
  hvacRequest,
  musicRequest,
  safetyRequest,
  themeRequest,
} from '../core';
import type {
  AudioFeatures,
  LightingCommand,
  LightingRequest,
  LightingSource,
  VehicleState,
} from '@nhipsang/schema';

export type WinnerSource = LightingSource | 'failsafe';

export interface StepResult {
  command: LightingCommand;
  winnerSource: WinnerSource;
  // Pipeline compute (measured) = feature extraction + resolve. featureMs is the
  // FFT/onset/AGC cost of the latest audio frame (passed in by the caller, 0 when
  // idle); resolveMs is arbiter+policy+resolve (the safety core — typically tiny).
  computeMs: number;
  featureMs: number;
  resolveMs: number;
}

export interface LocalLoop {
  step(
    features: AudioFeatures,
    state: VehicleState,
    presetId: number,
    fault?: boolean,
    featureMs?: number,
  ): StepResult;
}

// HVAC is a transient climate overlay: PRIORITY_ORDER ranks hvac ABOVE music,
// so a permanently-on hvac request would mask the music-reactive output. We
// surface it only briefly after the driver changes the cabin temperature.
// (Flagged for Chủ thầu — see completion report.)
export const HVAC_OVERLAY_MS = 2500;

// Music/HVAC contribute only when there is audio / a recent temp change; theme
// is the always-on baseline (D-006), so idle (no audio, no warn, no fault) →
// winner='theme', not failsafe. Failsafe now comes from a fault (D-007).
function hasAudioSignal(f: AudioFeatures): boolean {
  return f.bands.bass > 0 || f.bands.mid > 0 || f.bands.high > 0 || f.beat.onset;
}

export function createLocalLoop(): LocalLoop {
  const resolver = createLightingResolver();
  let lastTempC: number | null = null;
  let lastTempChangeMs = Number.NEGATIVE_INFINITY;

  return {
    step(features, state, presetId, fault = false, featureMs = 0): StepResult {
      const tMs = features.beat.tMs;

      // Track temperature edges to drive the transient HVAC overlay.
      if (lastTempC === null) {
        lastTempC = state.hvacTempC; // first frame = baseline, no overlay
      } else if (state.hvacTempC !== lastTempC) {
        lastTempC = state.hvacTempC;
        lastTempChangeMs = tMs;
      }

      const audioActive = hasAudioSignal(features);
      // `tMs >= lastTempChangeMs` guards against the audio clock restarting on
      // replay (which would otherwise re-trigger the overlay with a stale edge).
      const hvacActive = tMs >= lastTempChangeMs && tMs - lastTempChangeMs < HVAC_OVERLAY_MS;

      const requests: (LightingRequest | null)[] = [
        safetyRequest(state),
        hvacActive ? hvacRequest(state) : null,
        audioActive ? musicRequest(features, presetId) : null,
        themeRequest(presetId), // D-006: theme is the always-on baseline
      ];

      // Mirror the resolver's own first step so winnerSource is exact.
      const winner = arbitrate(requests);

      const start = performance.now();
      const command = resolver.resolve({ requests, state, features, fault });
      const resolveMs = performance.now() - start;

      return {
        command,
        // D-007: a fault overrides everything → failsafe.
        winnerSource: fault ? 'failsafe' : winner ? winner.source : 'failsafe',
        computeMs: featureMs + resolveMs,
        featureMs,
        resolveMs,
      };
    },
  };
}
