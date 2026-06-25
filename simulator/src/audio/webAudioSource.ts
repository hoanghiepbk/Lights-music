// Mock PCM source implementing the AudioSource HAL via Web Audio.
// IMPORTANT: all browser APIs (AudioContext, requestAnimationFrame, ...) are
// touched ONLY inside the factory / returned methods — importing this module in
// node does NOT throw (verified by an eval test).
import type { AudioSource } from '@nhipsang/schema';

export interface WebAudioSourceOptions {
  fftSize?: number;
}

export function createWebAudioSource(
  media: HTMLMediaElement,
  options: WebAudioSourceOptions = {},
): AudioSource {
  const ctx = new AudioContext();
  const sourceNode = ctx.createMediaElementSource(media);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = options.fftSize ?? 1024;
  sourceNode.connect(analyser);
  analyser.connect(ctx.destination);

  const buffer = new Float32Array(analyser.fftSize);
  let rafId = 0;
  let frameCb: ((pcm: Float32Array, sampleRate: number) => void) | null = null;

  const tick = (): void => {
    if (frameCb) {
      analyser.getFloatTimeDomainData(buffer);
      frameCb(buffer, ctx.sampleRate);
    }
    rafId = requestAnimationFrame(tick);
  };

  return {
    onFrame(cb) {
      frameCb = cb;
      if (rafId === 0) {
        rafId = requestAnimationFrame(tick);
      }
    },
    stop() {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      frameCb = null;
      sourceNode.disconnect();
      analyser.disconnect();
      void ctx.close();
    },
  };
}
