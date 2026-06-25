import type * as React from 'react';
import { DRIVER_VISIBLE_ZONES, type ZoneId } from '@nhipsang/schema';
import { driving, SAFE_AMBER } from '../core';
import { useVehicleState } from '../state/useVehicleState';
import type { StepResult, WinnerSource } from '../engine/localLoop';
import type { TransportStatus } from '../transport/supabaseTransport';
import { THROTTLE_HZ } from '../transport/supabaseTransport';

// Frame budget for the high-level wire (20 Hz CAN-FD, Blueprint §7). The pipeline
// compute below is MEASURED end-of-extraction → command (FFT/onset/AGC + pattern +
// arbiter + policy); transport publishes throttled high-level params (≤25 Hz) but
// ECU render stays a simulated target — no end-to-end claim.
const FRAME_BUDGET_MS = 50;

const SOURCE_COLOR: Record<WinnerSource, string> = {
  safety: 'var(--red)',
  hvac: 'var(--teal)',
  music: 'var(--teal)',
  theme: 'var(--muted)',
  failsafe: 'var(--red)',
};

const STATUS_COLOR: Record<TransportStatus, string> = {
  connected: 'var(--teal)',
  disconnected: 'var(--muted)',
  error: 'var(--red)',
};

function Pip({ label, on, color }: { label: string; on: boolean; color?: string }): React.JSX.Element {
  return (
    <span className="pip" data-on={on} style={color ? ({ ['--c']: color } as React.CSSProperties) : undefined}>
      <span className="dot" />
      {label}
    </span>
  );
}

export function TracePanel({
  trace,
  transportStatus,
}: {
  trace: StepResult | null;
  transportStatus: TransportStatus;
}): React.JSX.Element {
  const state = useVehicleState();
  const winner: WinnerSource = trace?.winnerSource ?? 'failsafe';
  const command = trace?.command ?? null;

  const isAmbient = winner === 'music' || winner === 'hvac' || winner === 'theme';
  const drv = driving(state);
  const capActive = isAmbient && state.speedKmh > 5;
  const flashGated = isAmbient && drv;
  const safetyExempt = winner === 'safety';
  const faulted = winner === 'failsafe'; // theme is baseline (D-006) → failsafe ⟺ fault (D-007)

  // INV-1 recolour: driver-visible zones that came out as the safe amber.
  const recoloured: ZoneId[] = command
    ? DRIVER_VISIBLE_ZONES.filter((z) => {
        const zc = command.zones.find((c) => c.zone === z);
        return !!zc && zc.rgb.r === SAFE_AMBER.r && zc.rgb.g === SAFE_AMBER.g && zc.rgb.b === SAFE_AMBER.b;
      })
    : [];

  const computeMs = trace?.computeMs ?? 0;
  const resolveMs = trace?.resolveMs ?? 0;
  const pct = Math.min(100, (computeMs / FRAME_BUDGET_MS) * 100);

  return (
    <section className="panel flex flex-col gap-5 p-5">
      <span className="eyebrow">Trace · observability</span>

      {/* latency — honest about measured vs target */}
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between">
          <span className="eyebrow">Pipeline compute</span>
          <span className="telemetry text-2xl text-[var(--teal)]">{computeMs.toFixed(3)} ms</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--line)]">
          <div className="h-full rounded-full bg-[var(--teal)]" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="telemetry text-[10.5px] text-[var(--muted)]">resolve (safety core)</span>
          <span className="telemetry text-[10.5px] text-[var(--muted)]">{resolveMs.toFixed(3)} ms</span>
        </div>
        <p className="telemetry text-[10.5px] leading-relaxed text-[var(--muted)]">
          measured: FFT/onset/AGC + pattern + arbiter + policy. budget: FFT/onset ≤15 ms (§3.3); transport ≤
          {THROTTLE_HZ} Hz; ECU render = target (sim) — not an end-to-end number.
        </p>
      </div>

      {/* arbiter + transport */}
      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Arbiter winner</span>
          <span className="telemetry text-sm" style={{ color: SOURCE_COLOR[winner] }}>
            {winner.toUpperCase()}
            <span className="text-[var(--muted)]"> · pri {command ? command.priority : '—'}</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="eyebrow">Transport</span>
          <span className="telemetry text-sm" style={{ color: STATUS_COLOR[transportStatus] }}>
            {transportStatus.toUpperCase()}
          </span>
        </div>
      </div>

      {/* policy gate state */}
      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
        <span className="eyebrow">Policy gate</span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Pip label="driving" on={drv} color="var(--amber)" />
          <Pip label="brightness cap" on={capActive} color="var(--amber)" />
          <Pip label="flash gated" on={flashGated} color="var(--amber)" />
          <Pip label="safety exempt" on={safetyExempt} color="var(--red)" />
          <Pip
            label={`INV-1 recolour${recoloured.length ? ` ·${recoloured.length}` : ''}`}
            on={recoloured.length > 0}
            color="var(--amber)"
          />
          <Pip label="fault → failsafe" on={faulted} color="var(--red)" />
        </div>
      </div>
    </section>
  );
}
