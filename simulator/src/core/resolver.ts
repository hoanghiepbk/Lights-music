import {
  PRIORITY_ORDER,
  ZONES,
  type AudioFeatures,
  type LightingCommand,
  type LightingRequest,
  type VehicleState,
} from '@nhipsang/schema';
import { arbitrate } from './arbiter';
import { applyPolicy, failSafe } from './policyGate';
import { createFlashLimiter, FLASH_MAX_HZ_PARKED } from './flashLimiter';

export interface ResolveContext {
  requests: ReadonlyArray<LightingRequest | null>;
  state: VehicleState;
  features: AudioFeatures;
  fault?: boolean; // D-007: an upstream fault forces the INV-5 failsafe
}

export interface LightingResolver {
  resolve(ctx: ResolveContext): LightingCommand;
}

// Pipeline (TIP-004 §H): arbitrate → policy → beat → pack LightingCommand.
// Holds a FlashLimiter so the parked beat-rate stays bounded across frames.
export function createLightingResolver(): LightingResolver {
  const flash = createFlashLimiter(FLASH_MAX_HZ_PARKED);

  return {
    resolve(ctx: ResolveContext): LightingCommand {
      // D-007: any upstream fault drops straight to the safe static state,
      // regardless of what the sources requested this frame.
      if (ctx.fault === true) return failSafe();

      const winner = arbitrate(ctx.requests);
      if (!winner) return failSafe(); // INV-5 (defensive: empty request set)

      const policy = applyPolicy(winner, ctx.state);

      let beat: boolean;
      if (winner.source === 'safety') {
        // safety telltale flashes on its own square-wave (exempt from limiter).
        beat = safetyBeat(ctx.features.beat.tMs, winner.flashHz);
      } else {
        // ambient: only when policy allows (parked) AND there is an onset,
        // then rate-limited to ≤ FLASH_MAX_HZ_PARKED.
        const rawBeat = policy.beatAllowed && ctx.features.beat.onset;
        beat = flash.allow(rawBeat, ctx.features.beat.tMs);
      }

      const bands = ctx.features.bands;
      const bandLevels: [number, number, number] = [
        Math.round(bands.bass),
        Math.round(bands.mid),
        Math.round(bands.high),
      ];

      let zoneMask = 0;
      for (const zc of policy.zones) {
        if (zc.brightness > 0) {
          const idx = ZONES.indexOf(zc.zone);
          if (idx >= 0) zoneMask |= 1 << idx;
        }
      }

      return {
        presetId: policy.presetId,
        zones: policy.zones,
        bandLevels,
        beat,
        zoneMask,
        priority: PRIORITY_ORDER.indexOf(policy.source),
        brightnessCap: 255,
      };
    },
  };
}

// Deterministic square-wave telltale: ON during the first half of each period.
function safetyBeat(tMs: number, hz: number): boolean {
  if (hz <= 0) return false; // steady-on (no blink)
  const periodMs = 1000 / hz;
  return tMs % periodMs < periodMs / 2;
}
