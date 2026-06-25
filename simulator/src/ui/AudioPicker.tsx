import type * as React from 'react';
import { useRef, useState } from 'react';
import type { AudioFeatures } from '@nhipsang/schema';
import { createAudioEngine, type AudioEngine } from '../audio';
import { createWebAudioSource } from '../audio/webAudioSource';

// Picks a track (file or URL) → WebAudioSource → AudioEngine, streaming features
// up to the app. A fresh <audio> element per play keeps Web Audio's one-source-
// per-element rule happy across stop/replay.
export function AudioPicker({
  onFeatures,
  onPlayingChange,
  onAudioError,
}: {
  onFeatures: (f: AudioFeatures) => void;
  onPlayingChange: (playing: boolean) => void;
  onAudioError: (faulted: boolean) => void;
}): React.JSX.Element {
  const [label, setLabel] = useState('No track loaded');
  const [urlText, setUrlText] = useState('');
  const [playing, setPlaying] = useState(false);

  const srcRef = useRef<string | null>(null);
  const isObjectUrlRef = useRef(false);
  const engineRef = useRef<AudioEngine | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stopEngine(): void {
    engineRef.current?.stop();
    engineRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
  }

  function stop(): void {
    stopEngine();
    setPlaying(false);
    onPlayingChange(false);
    onAudioError(false);
  }

  function setSource(url: string, name: string, isObject: boolean): void {
    stop();
    if (isObjectUrlRef.current && srcRef.current) URL.revokeObjectURL(srcRef.current);
    srcRef.current = url;
    isObjectUrlRef.current = isObject;
    setLabel(name);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0];
    if (!f) return;
    setSource(URL.createObjectURL(f), f.name, true);
  }

  async function play(): Promise<void> {
    if (!srcRef.current) return;
    stopEngine();
    const audio = new Audio(srcRef.current);
    audio.loop = true;
    if (!isObjectUrlRef.current) audio.crossOrigin = 'anonymous';
    audio.addEventListener('error', () => onAudioError(true)); // bad src → fault → failsafe (D-007)
    audioRef.current = audio;

    const source = createWebAudioSource(audio);
    const engine = createAudioEngine(source);
    engine.onFeatures(onFeatures);
    engineRef.current = engine;

    try {
      await audio.play();
      onAudioError(false);
      setPlaying(true);
      onPlayingChange(true);
    } catch {
      // autoplay/CORS blocked — surface a hint and raise a fault
      setLabel('Playback blocked — click Play again or check the URL/CORS');
      stop();
      onAudioError(true);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Track</span>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-[var(--line)] bg-[#0b121b] px-3 py-2 text-xs text-[var(--text)] transition hover:border-[var(--teal)]">
            Choose file
            <input type="file" accept="audio/*" className="hidden" onChange={onFile} />
          </label>
          <input
            type="url"
            inputMode="url"
            placeholder="…or paste an audio URL"
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            className="w-56 rounded-lg border border-[var(--line)] bg-[#0b121b] px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-[var(--teal)]"
          />
          <button
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
            onClick={() => urlText && setSource(urlText, urlText, false)}
          >
            Load
          </button>
        </div>
        <span className="telemetry max-w-[22rem] truncate text-[10.5px] text-[var(--muted)]">{label}</span>
      </div>

      <button
        onClick={() => (playing ? stop() : void play())}
        className="rounded-lg px-5 py-2.5 text-sm font-medium transition"
        style={{
          background: playing ? 'transparent' : 'var(--teal)',
          color: playing ? 'var(--text)' : 'var(--void)',
          border: `1px solid ${playing ? 'var(--line)' : 'var(--teal)'}`,
        }}
      >
        {playing ? 'Stop' : 'Play'}
      </button>
    </div>
  );
}
