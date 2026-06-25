// Audio engine: wires an AudioSource → FeatureExtractor → AudioFeatures stream.
import type { AudioSource, AudioFeatures } from '@nhipsang/schema';
import { createFeatureExtractor } from './featureExtractor';

export { createFeatureExtractor } from './featureExtractor';
export { magnitudeSpectrum } from './fft';
// NOTE: createWebAudioSource is browser-only; import it directly from
// './webAudioSource' where needed to keep this entry node-safe.

export interface AudioEngine {
  onFeatures(cb: (features: AudioFeatures) => void): void;
  stop(): void;
}

export function createAudioEngine(source: AudioSource): AudioEngine {
  const extractor = createFeatureExtractor();
  let featuresCb: ((features: AudioFeatures) => void) | null = null;

  source.onFrame((pcm, sampleRate) => {
    const features = extractor.process(pcm, sampleRate);
    if (featuresCb) featuresCb(features);
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
