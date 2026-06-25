import { describe, it, expect, vi } from 'vitest';
import type { LightingCommand } from '@nhipsang/schema';
import {
  createMockTransport,
  createThrottledTransport,
  createSupabaseTransport,
} from '@sim/transport/supabaseTransport';
import { createScenarioRunner } from '@sim/engine/scenarioRunner';
import { createVehicleStore } from '@sim/state/vehicleStore';

function cmd(presetId = 0): LightingCommand {
  return { presetId, zones: [], bandLevels: [0, 0, 0], beat: false, zoneMask: 0, priority: 3, brightnessCap: 255 };
}

describe('transport', () => {
  it('mockTransport records every command', () => {
    const t = createMockTransport();
    t.send(cmd(1));
    t.send(cmd(2));
    t.send(cmd(3));
    expect(t.sent.length).toBe(3);
    expect(t.status()).toBe('connected');
  });

  it('throttle: 100 sends across ~100ms (sim clock) → ≤ 3 messages (~25 Hz)', () => {
    const inner = createMockTransport();
    let t = 0;
    const throttled = createThrottledTransport(inner, { minIntervalMs: 40, now: () => t });
    for (let i = 0; i < 100; i++) {
      throttled.send(cmd());
      t += 1; // advance 1ms per call → 0..99ms window
    }
    expect(inner.sent.length).toBeLessThanOrEqual(3);
    expect(inner.sent.length).toBeGreaterThan(0);
  });

  it('createSupabaseTransport without env → disconnected mock, import-safe in node', () => {
    const t = createSupabaseTransport({}); // no url/key → never touches createClient
    expect(typeof createSupabaseTransport).toBe('function');
    expect(t.status()).toBe('disconnected');
    expect(() => t.send(cmd())).not.toThrow();
    t.close();
  });
});

describe('scenarioRunner — timeline', () => {
  it('drives vehicleStore P→D→seatbelt→P with captions', () => {
    vi.useFakeTimers();
    try {
      const store = createVehicleStore();
      const runner = createScenarioRunner(store);
      const captions: string[] = [];
      runner.start((c) => captions.push(c));
      expect(runner.isRunning()).toBe(true);

      vi.advanceTimersByTime(10_000);
      expect(store.get().gear).toBe('D');

      vi.advanceTimersByTime(3_000); // 13s
      expect(store.get().speedKmh).toBe(60);

      vi.advanceTimersByTime(7_000); // 20s
      expect(store.get().seatbeltWarn).toBe(true);

      vi.advanceTimersByTime(5_000); // 25s
      expect(store.get().gear).toBe('P');
      expect(store.get().seatbeltWarn).toBe(false);

      vi.advanceTimersByTime(5_000); // 30s — timeline ends
      expect(runner.isRunning()).toBe(false);
      expect(captions.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
