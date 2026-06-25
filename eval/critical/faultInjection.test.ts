// CRITICAL tier — systematic fault injection for INV-5 (D-007 failsafe-on-fault).
// Each fault class is injected and the system MUST collapse to failSafe(); then
// recovery is asserted (fault clears → music/theme return).
import { describe, it, expect } from 'vitest';
import type { AudioFeatures, VehicleState } from '@nhipsang/schema';
import { createLocalLoop } from '@sim/engine/localLoop';
import { failSafe } from '@sim/core';
import type { StatefulTransport } from '@sim/transport/supabaseTransport';

function vehicle(over: Partial<VehicleState> = {}): VehicleState {
  return { gear: 'P', speedKmh: 0, seatbeltWarn: false, adasWarn: false, hvacTempC: 22, ...over };
}

function features(over: Partial<{ bass: number; mid: number; high: number; tMs: number }> = {}): AudioFeatures {
  const o = { bass: 0, mid: 0, high: 0, tMs: 0, ...over };
  return { bands: { bass: o.bass, mid: o.mid, high: o.high }, beat: { onset: false, strength: 0, tMs: o.tMs } };
}

// Mirror the App's fault aggregation so the same rule is under test.
function aggregateFault(audioError: boolean, transport: StatefulTransport): boolean {
  return audioError || transport.status() === 'error';
}

const OK_TRANSPORT: StatefulTransport = { send() {}, status: () => 'connected', close() {} };
const ERROR_TRANSPORT: StatefulTransport = { send() {}, status: () => 'error', close() {} };

const MUSIC = features({ bass: 200, mid: 180, high: 120 });

describe('INV-5 fault injection', () => {
  it('audio loss mid-music → failsafe (command === failSafe())', () => {
    const loop = createLocalLoop();
    expect(loop.step(MUSIC, vehicle(), 1).winnerSource).toBe('music'); // music playing
    const r = loop.step(MUSIC, vehicle(), 1, aggregateFault(true, OK_TRANSPORT)); // audio error
    expect(r.winnerSource).toBe('failsafe');
    expect(r.command).toEqual(failSafe());
  });

  it("transport 'error' → failsafe", () => {
    const loop = createLocalLoop();
    const fault = aggregateFault(false, ERROR_TRANSPORT);
    expect(fault).toBe(true);
    expect(loop.step(MUSIC, vehicle(), 1, fault).winnerSource).toBe('failsafe');
  });

  it('ECU disconnect (modeled fault flag) → failsafe', () => {
    const loop = createLocalLoop();
    expect(loop.step(MUSIC, vehicle(), 1, true).winnerSource).toBe('failsafe');
  });

  it('recovery: fault clears → leaves failsafe (music back, idle → theme)', () => {
    const loop = createLocalLoop();
    expect(loop.step(MUSIC, vehicle(), 1, true).winnerSource).toBe('failsafe');
    // fault cleared, audio still present → music returns
    expect(loop.step(MUSIC, vehicle(), 1, aggregateFault(false, OK_TRANSPORT)).winnerSource).toBe('music');
    // and idle (no audio, no fault) settles on the theme baseline, not failsafe
    expect(loop.step(features(), vehicle(), 1, false).winnerSource).toBe('theme');
  });
});
