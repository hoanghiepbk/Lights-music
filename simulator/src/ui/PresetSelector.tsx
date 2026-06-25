import type * as React from 'react';

const PRESETS: { id: number; name: string }[] = [
  { id: 0, name: 'calm' },
  { id: 1, name: 'energetic' },
  { id: 2, name: 'warm' },
];

export function PresetSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (id: number) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow">Mood preset</span>
      <div className="seg self-start">
        {PRESETS.map((p) => (
          <button key={p.id} data-active={value === p.id} onClick={() => onChange(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
