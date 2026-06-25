import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioFeatures, LightingCommand } from '@nhipsang/schema';
import { createLocalLoop, type StepResult } from './engine/localLoop';
import { createScenarioRunner, type ScenarioRunner } from './engine/scenarioRunner';
import { createSupabaseTransport, type StatefulTransport, type TransportStatus } from './transport/supabaseTransport';
import { vehicleStore } from './state/vehicleStore';
import { CabinView } from './ui/CabinView';
import { VehicleStatePanel } from './ui/VehicleStatePanel';
import { TracePanel } from './ui/TracePanel';
import { PresetSelector } from './ui/PresetSelector';
import { AudioPicker } from './ui/AudioPicker';
import { HelpOverlay } from './ui/HelpOverlay';

const ZERO_FEATURES: AudioFeatures = {
  bands: { bass: 0, mid: 0, high: 0 },
  beat: { onset: false, strength: 0, tMs: 0 },
};

export default function App() {
  const loopRef = useRef(createLocalLoop());
  const transportRef = useRef<StatefulTransport | null>(null);
  if (transportRef.current === null) transportRef.current = createSupabaseTransport();
  const runnerRef = useRef<ScenarioRunner | null>(null);
  if (runnerRef.current === null) runnerRef.current = createScenarioRunner(vehicleStore);

  const [presetId, setPresetId] = useState(0);
  const [command, setCommand] = useState<LightingCommand>(
    () => loopRef.current.step(ZERO_FEATURES, vehicleStore.get(), 0, false).command,
  );
  const [trace, setTrace] = useState<StepResult | null>(null);
  const [transportStatus, setTransportStatus] = useState<TransportStatus>(() => transportRef.current!.status());
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const presetRef = useRef(presetId);
  const playingRef = useRef(false);
  const audioErrorRef = useRef(false);
  const latestFeaturesRef = useRef<AudioFeatures | null>(null);
  const latestFeatureMsRef = useRef(0);
  const pendingOnsetRef = useRef(false);
  const idleClockRef = useRef(0);
  const statusRef = useRef<TransportStatus>(transportStatus);

  useEffect(() => {
    presetRef.current = presetId;
  }, [presetId]);

  // Single rAF loop: sample features (idle → synthetic, onset preserved) →
  // aggregate fault (audio error OR transport error, D-007) → step → publish the
  // throttled high-level command when the transport is connected.
  useEffect(() => {
    let raf = 0;
    const frame = (): void => {
      let feats: AudioFeatures;
      let featureMs: number;
      const latest = latestFeaturesRef.current;
      if (playingRef.current && latest) {
        feats = pendingOnsetRef.current ? { ...latest, beat: { ...latest.beat, onset: true } } : latest;
        pendingOnsetRef.current = false;
        featureMs = latestFeatureMsRef.current; // fold FFT/onset/AGC cost into computeMs
      } else {
        idleClockRef.current += 16;
        feats = {
          bands: { bass: 0, mid: 0, high: 0 },
          beat: { onset: false, strength: 0, tMs: idleClockRef.current },
        };
        featureMs = 0; // idle: no audio frame extracted this tick
      }

      const transport = transportRef.current!;
      const st = transport.status();
      if (st !== statusRef.current) {
        statusRef.current = st;
        setTransportStatus(st);
      }
      const fault = audioErrorRef.current || st === 'error';

      const r = loopRef.current.step(feats, vehicleStore.get(), presetRef.current, fault, featureMs);
      setCommand(r.command);
      setTrace(r);

      if (st === 'connected') transport.send(r.command); // throttled inside transport

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      transportRef.current?.close();
      runnerRef.current?.stop();
    };
  }, []);

  // reflect the scenario auto-stopping at the end of its timeline
  useEffect(() => {
    if (!scenarioRunning) return;
    const id = setInterval(() => {
      if (!runnerRef.current?.isRunning()) setScenarioRunning(false);
    }, 500);
    return () => clearInterval(id);
  }, [scenarioRunning]);

  const onFeatures = useCallback((f: AudioFeatures, featureMs: number) => {
    latestFeaturesRef.current = f;
    latestFeatureMsRef.current = featureMs;
    if (f.beat.onset) pendingOnsetRef.current = true;
  }, []);

  const onPlayingChange = useCallback((p: boolean) => {
    playingRef.current = p;
  }, []);

  const onAudioError = useCallback((faulted: boolean) => {
    audioErrorRef.current = faulted;
  }, []);

  const toggleScenario = useCallback(() => {
    const runner = runnerRef.current!;
    if (runner.isRunning()) {
      runner.stop();
      setScenarioRunning(false);
      setCaption(null);
    } else {
      runner.start((c) => setCaption(c));
      setScenarioRunning(true);
    }
  }, []);

  return (
    <div className="flex h-screen flex-col gap-4 p-4 lg:p-6">
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">NhipSang</h1>
          <span className="eyebrow">music-reactive cabin · local sim</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHelp(true)}
            title="Mở hướng dẫn: giải thích từng phần, kịch bản demo và cách test"
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--text)] transition hover:border-[var(--teal)] hover:text-[var(--teal)]"
          >
            ? Hướng dẫn
          </button>
          <span className="eyebrow">schema v0.2.0</span>
        </div>
      </header>

      {caption && (
        <div className="panel flex items-center gap-3 px-5 py-3">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--teal)]" />
          <span className="telemetry text-sm text-[var(--text)]">{caption}</span>
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <CabinView command={command} />
        <div className="flex min-h-0 flex-col gap-4 overflow-auto">
          <VehicleStatePanel />
          <TracePanel trace={trace} transportStatus={transportStatus} />
        </div>
      </main>

      <footer className="panel flex flex-wrap items-end justify-between gap-6 p-5">
        <AudioPicker onFeatures={onFeatures} onPlayingChange={onPlayingChange} onAudioError={onAudioError} />
        <PresetSelector value={presetId} onChange={setPresetId} />
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Demo · REQ-031</span>
          <button
            onClick={toggleScenario}
            title="Chạy demo tự động ~30s: Đỗ→Lái→tăng tốc→cảnh báo dây an toàn→Đỗ. Bấm Play nhạc trước để thấy cả sync nhạc."
            className="rounded-lg px-5 py-2.5 text-sm font-medium transition"
            style={{
              background: scenarioRunning ? 'transparent' : 'var(--amber)',
              color: scenarioRunning ? 'var(--text)' : 'var(--void)',
              border: `1px solid ${scenarioRunning ? 'var(--line)' : 'var(--amber)'}`,
            }}
          >
            {scenarioRunning ? 'Dừng kịch bản' : 'Chạy kịch bản'}
          </button>
        </div>
      </footer>
    </div>
  );
}
