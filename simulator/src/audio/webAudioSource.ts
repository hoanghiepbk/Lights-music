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
  // Autoplay policy starts the context 'suspended'; resume it within the Play
  // user-gesture, otherwise getFloatTimeDomainData() returns all zeros (no
  // reaction) until a later page reload grants autoplay.
  void ctx.resume();

  const buffer = new Float32Array(analyser.fftSize);
  // Feed the extractor at the consecutive-window hop (~23 ms @44.1 kHz) instead
  // of every rAF (~16.7 ms). Sampling faster than one window overlaps frames and
  // makes the extractor's frame clock run ~1.4× real time, which smears onset
  // detection so flashes drift off the beat. Throttling aligns both.
  const frameIntervalMs = (analyser.fftSize / ctx.sampleRate) * 1000;
  let lastFrameMs = -Infinity;
  let rafId = 0;
  let frameCb: ((pcm: Float32Array, sampleRate: number) => void) | null = null;

  const tick = (nowMs: number): void => {
    if (frameCb && nowMs - lastFrameMs >= frameIntervalMs) {
      lastFrameMs = nowMs;
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
