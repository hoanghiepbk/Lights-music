import type * as React from 'react';

const PRESETS: { id: number; name: string; hint: string }[] = [
  { id: 0, name: 'calm', hint: 'Lạnh, ít bão hòa, nhịp chậm (lam–teal–cyan)' },
  { id: 1, name: 'energetic', hint: 'Bão hòa cao, beat nhanh (cam–lục–tím)' },
  { id: 2, name: 'warm', hint: 'Tông ấm vàng–cam' },
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
          <button key={p.id} title={p.hint} data-active={value === p.id} onClick={() => onChange(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
