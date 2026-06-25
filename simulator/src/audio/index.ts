// Audio engine: wires an AudioSource → FeatureExtractor → AudioFeatures stream.
import type { AudioSource, AudioFeatures } from '@nhipsang/schema';
import { createFeatureExtractor } from './featureExtractor';

export { createFeatureExtractor } from './featureExtractor';
export { magnitudeSpectrum } from './fft';
// NOTE: createWebAudioSource is browser-only; import it directly from
// './webAudioSource' where needed to keep this entry node-safe.

export interface AudioEngine {
  // featureMs = wall time of the FFT/onset/AGC extraction for this frame, so the
  // app can fold it into the pipeline-compute readout (TIP-011).
  onFeatures(cb: (features: AudioFeatures, featureMs: number) => void): void;
  stop(): void;
}

export function createAudioEngine(source: AudioSource): AudioEngine {
  const extractor = createFeatureExtractor();
  let featuresCb: ((features: AudioFeatures, featureMs: number) => void) | null = null;

  source.onFrame((pcm, sampleRate) => {
    const t0 = performance.now();
    const features = extractor.process(pcm, sampleRate);
    const featureMs = performance.now() - t0;
    if (featuresCb) featuresCb(features, featureMs);
  });

  return {
    onFeatures(cb) {
      featuresCb = cb;
    },
    stop() {
      source.stop();
    },
  };
}
