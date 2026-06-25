// Scenario runner (TIP-006 §D, REQ-031) — NO React, node-testable.
// Drives a deterministic ~30s vehicle-state timeline + captions for clean demo
// capture. It only moves vehicle state; Hiệp plays the track while recording.
import type { VehicleState } from '@nhipsang/schema';

export interface ScenarioStore {
  set(partial: Partial<VehicleState>): void;
}

export interface ScenarioRunner {
  start(onCaption?: (caption: string) => void): void;
  stop(): void;
  isRunning(): boolean;
}

interface ScenarioStep {
  atMs: number;
  set: Partial<VehicleState>;
  caption?: string;
  end?: boolean;
}

export const SCENARIO_STEPS: ScenarioStep[] = [
  {
    atMs: 0,
    set: { gear: 'P', speedKmh: 0, seatbeltWarn: false, adasWarn: false },
    caption: 'Đỗ xe — full effect, sync nhạc',
  },
  { atMs: 10_000, set: { gear: 'D' }, caption: 'Chuyển P→D — hiệu ứng tự dịu, hết nháy beat' },
  { atMs: 11_000, set: { speedKmh: 20 } },
  { atMs: 12_000, set: { speedKmh: 40 } },
  { atMs: 13_000, set: { speedKmh: 60 } },
  { atMs: 20_000, set: { seatbeltWarn: true }, caption: 'Cảnh báo an toàn — music nhường telltale' },
  { atMs: 25_000, set: { seatbeltWarn: false, gear: 'P', speedKmh: 0 }, caption: 'Trở lại đỗ' },
  { atMs: 30_000, set: {}, caption: 'Hết kịch bản', end: true },
];

export function createScenarioRunner(store: ScenarioStore): ScenarioRunner {
  let timers: ReturnType<typeof setTimeout>[] = [];
  let running = false;

  function stop(): void {
    for (const t of timers) clearTimeout(t);
    timers = [];
    running = false;
  }

  function start(onCaption?: (caption: string) => void): void {
    stop();
    running = true;
    for (const step of SCENARIO_STEPS) {
      const id = setTimeout(() => {
        store.set(step.set);
        if (step.caption && onCaption) onCaption(step.caption);
        if (step.end) running = false;
      }, step.atMs);
      timers.push(id);
    }
  }

  return { start, stop, isRunning: () => running };
}
