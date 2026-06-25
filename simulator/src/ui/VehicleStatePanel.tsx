import type * as React from 'react';
import type { Gear } from '@nhipsang/schema';
import { vehicleStore } from '../state/vehicleStore';
import { useVehicleState } from '../state/useVehicleState';

const GEARS: Gear[] = ['P', 'R', 'N', 'D'];

function Row({ label, value, children }: { label: string; value?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {value !== undefined && <span className="telemetry text-sm text-[var(--text)]">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function VehicleStatePanel(): React.JSX.Element {
  const s = useVehicleState();

  return (
    <section className="panel flex flex-col gap-5 p-5">
      <span className="eyebrow">Vehicle state</span>

      <Row label="Gear">
        <div className="seg self-start">
          {GEARS.map((g) => (
            <button key={g} data-active={s.gear === g} onClick={() => vehicleStore.set({ gear: g })}>
              {g}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Speed" value={`${s.speedKmh} km/h`}>
        <input
          type="range"
          min={0}
          max={120}
          step={1}
          value={s.speedKmh}
          onChange={(e) => vehicleStore.set({ speedKmh: Number(e.target.value) })}
        />
      </Row>

      <Row label="Cabin temp" value={`${s.hvacTempC}°C`}>
        <input
          type="range"
          min={16}
          max={30}
          step={1}
          value={s.hvacTempC}
          onChange={(e) => vehicleStore.set({ hvacTempC: Number(e.target.value) })}
        />
      </Row>

      <div className="flex items-center justify-between">
        <span className="eyebrow">Seatbelt warning</span>
        <button
          className="toggle"
          data-on={s.seatbeltWarn}
          aria-pressed={s.seatbeltWarn}
          aria-label="Seatbelt warning"
          onClick={() => vehicleStore.set({ seatbeltWarn: !s.seatbeltWarn })}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="eyebrow">ADAS warning</span>
        <button
          className="toggle"
          data-on={s.adasWarn}
          aria-pressed={s.adasWarn}
          aria-label="ADAS warning"
          onClick={() => vehicleStore.set({ adasWarn: !s.adasWarn })}
        />
      </div>
    </section>
  );
}
