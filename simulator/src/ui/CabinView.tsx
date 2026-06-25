import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { LightingCommand, RGB, ZoneColor, ZoneId } from '@nhipsang/schema';

// Top-down VF8 silhouette. Each zone is a soft glow region driven by the
// resolved command (rgb × brightness); a ripple replays on every beat.
const CAR_PATH =
  'M150 14 C214 14 250 46 252 112 L254 356 C254 410 214 426 150 426 C86 426 46 410 46 356 L48 112 C50 46 86 14 150 14 Z';

interface ZoneGeo {
  id: ZoneId;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  lx: number;
  ly: number;
}

const ZONE_GEO: ZoneGeo[] = [
  { id: 'dashboard', label: 'DASH', x: 78, y: 38, w: 144, h: 30, rx: 12, lx: 150, ly: 56 },
  { id: 'door_front_left', label: 'FL', x: 44, y: 120, w: 42, h: 86, rx: 13, lx: 65, ly: 165 },
  { id: 'door_front_right', label: 'FR', x: 214, y: 120, w: 42, h: 86, rx: 13, lx: 235, ly: 165 },
  { id: 'door_rear_left', label: 'RL', x: 44, y: 224, w: 42, h: 86, rx: 13, lx: 65, ly: 269 },
  { id: 'door_rear_right', label: 'RR', x: 214, y: 224, w: 42, h: 86, rx: 13, lx: 235, ly: 269 },
  { id: 'center_console', label: 'CONSOLE', x: 130, y: 150, w: 40, h: 150, rx: 16, lx: 150, ly: 348 },
];

// faint seat hints, purely for orientation
const SEATS = [
  { x: 92, y: 126, w: 50, h: 66, rx: 15 },
  { x: 158, y: 126, w: 50, h: 66, rx: 15 },
  { x: 92, y: 230, w: 116, h: 66, rx: 18 },
];

const ZERO: RGB = { r: 0, g: 0, b: 0 };

export function CabinView({ command }: { command: LightingCommand }): React.JSX.Element {
  const byZone = new Map<ZoneId, ZoneColor>(command.zones.map((z) => [z.zone, z]));

  const prevBeat = useRef(false);
  const [pulseId, setPulseId] = useState(0);
  // Beat ring + whole-cabin flash. Toggle off to read the per-zone flashing
  // without the outer ring/blink on top.
  const [ringOn, setRingOn] = useState(true);
  useEffect(() => {
    if (command.beat && !prevBeat.current) setPulseId((n) => n + 1);
    prevBeat.current = command.beat;
  }, [command]);

  return (
    <div className="panel relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="eyebrow">Cabin · VF8</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRingOn((v) => !v)}
            title="Bật/tắt vòng + chớp cả cabin khi beat. Tắt để nhìn rõ đèn nháy từng zone bên trong."
            className="rounded border border-[var(--line)] px-2 py-1 text-[10.5px] transition hover:border-[var(--teal)]"
            style={{ color: ringOn ? 'var(--teal)' : 'var(--muted)' }}
          >
            Vòng beat: {ringOn ? 'BẬT' : 'TẮT'}
          </button>
          <span className="eyebrow">6 zones · top-down</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <svg viewBox="0 0 300 440" className="h-full w-auto max-h-[62vh]" role="img" aria-label="VF8 cabin lighting">
          {/* body */}
          <path d={CAR_PATH} fill="#0b1018" stroke="var(--line)" strokeWidth={1.4} />

          {/* zones */}
          {ZONE_GEO.map((g) => {
            const zc = byZone.get(g.id);
            const b = zc ? zc.brightness : 0;
            // Display gamma: lift mid brightness so lit zones read vivid, not washed
            // out (the level itself is unchanged — this is presentation only).
            const vb = Math.pow(b, 0.6);
            const rgb = zc ? zc.rgb : ZERO;
            const fill = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
            const glow =
              b > 0.02
                ? `drop-shadow(0 0 ${8 + vb * 36}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.92 * vb}))`
                : 'none';
            return (
              <rect
                key={g.id}
                x={g.x}
                y={g.y}
                width={g.w}
                height={g.h}
                rx={g.rx}
                style={{
                  fill,
                  // low "off" floor → big contrast between dark (off) and lit, so
                  // you can clearly tell whether a zone is on.
                  fillOpacity: 0.05 + vb * 0.95,
                  filter: glow,
                  stroke: 'var(--line)',
                  strokeWidth: 1,
                  transition: 'fill 90ms linear, fill-opacity 90ms linear, filter 90ms linear',
                }}
              />
            );
          })}

          {/* seats */}
          {SEATS.map((s, i) => (
            <rect
              key={i}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              rx={s.rx}
              fill="none"
              stroke="var(--line)"
              strokeWidth={1}
              opacity={0.5}
            />
          ))}

          {/* zone labels */}
          {ZONE_GEO.map((g) => (
            <text
              key={`${g.id}-l`}
              x={g.lx}
              y={g.ly}
              textAnchor="middle"
              className="telemetry"
              fontSize={9}
              letterSpacing="0.12em"
              fill="var(--muted)"
            >
              {g.label}
            </text>
          ))}

          {/* beat: a soft whole-cabin blink + an expanding ring — keyed remount
              replays both animations on every beat. Hidden when the ring is off. */}
          {ringOn && pulseId > 0 && (
            <g key={pulseId}>
              <path className="cabin-flash" d={CAR_PATH} fill="#eafcff" stroke="none" />
              <path className="cabin-pulse" d={CAR_PATH} fill="none" stroke="var(--teal)" strokeWidth={3} />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
