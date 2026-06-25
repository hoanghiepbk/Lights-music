// Flash rate limiter (TIP-004 §G, INV-2 parked rate). Stateful but fully
// deterministic — gated on the caller-supplied tMs, never on wall-clock.
// Caps beats to ≤ maxHz (default 3 Hz when parked). Named for TIP-007.
export const FLASH_MAX_HZ_PARKED = 3;

export interface FlashLimiter {
  allow(beat: boolean, tMs: number): boolean;
}

export function createFlashLimiter(maxHz: number = FLASH_MAX_HZ_PARKED): FlashLimiter {
  const minIntervalMs = 1000 / maxHz;
  let lastBeatMs = Number.NEGATIVE_INFINITY;
  return {
    allow(beat: boolean, tMs: number): boolean {
      if (!beat) return false;
      // The audio clock (tMs) restarts at ~0 whenever a fresh source is created
      // (e.g. Stop → Play). If it jumps backwards, treat it as a new timeline so
      // beats aren't blocked until the stale timestamp is caught up to.
      if (tMs < lastBeatMs) lastBeatMs = Number.NEGATIVE_INFINITY;
      if (tMs - lastBeatMs >= minIntervalMs) {
        lastBeatMs = tMs;
        return true;
      }
      return false;
    },
  };
}
