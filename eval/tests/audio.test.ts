import { describe, it, expect } from 'vitest';
import type { AudioFeatures, AudioSource } from '@nhipsang/schema';
import { createFeatureExtractor } from '../../simulator/src/audio/featureExtractor';
import { createAudioEngine } from '../../simulator/src/audio';
import { createWebAudioSource } from '../../simulator/src/audio/webAudioSource';

const SR = 44100;
const N = 1024;

function sine(freq: number, sr: number, length: number, amp: number): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  }
  return buf;
}

function frameAt(buf: Float32Array, k: number, n: number): Float32Array {
  return buf.subarray(k * n, (k + 1) * n);
}

describe('FeatureExtractor — band response', () => {
  it('low-frequency tone lights bass, not high', () => {
    const ext = createFeatureExtractor();
    const sig = sine(100, SR, 30 * N, 0.8);
    let f: AudioFeatures = ext.process(frameAt(sig, 0, N), SR);
    for (let k = 1; k < 30; k++) f = ext.process(frameAt(sig, k, N), SR);
    expect(f.bands.bass).toBeGreaterThan(100);
    expect(f.bands.high).toBeLessThan(40);
  });

  it('high-frequency tone lights high, not bass', () => {
    const ext = createFeatureExtractor();
    const sig = sine(8000, SR, 30 * N, 0.8);
    let f: AudioFeatures = ext.process(frameAt(sig, 0, N), SR);
    for (let k = 1; k < 30; k++) f = ext.process(frameAt(sig, k, N), SR);
    expect(f.bands.high).toBeGreaterThan(100);
    expect(f.bands.bass).toBeLessThan(40);
  });
});

describe('FeatureExtractor — onset', () => {
  it('fires on a silence→impulse jump and stays quiet otherwise', () => {
    const ext = createFeatureExtractor();
    const silence = new Float32Array(N);
    const loud = sine(1000, SR, N, 1.0);

    const pre: boolean[] = [];
    for (let k = 0; k < 10; k++) pre.push(ext.process(silence, SR).beat.onset);
    const impulse = ext.process(loud, SR).beat.onset;
    const post: boolean[] = [];
    for (let k = 0; k < 5; k++) post.push(ext.process(silence, SR).beat.onset);

    expect(pre.every((o) => o === false)).toBe(true);
    expect(impulse).toBe(true);
    expect(post.every((o) => o === false)).toBe(true);
  });
});

describe('FeatureExtractor — determinism', () => {
  it('produces identical output for identical input', () => {
    const seq = [
      sine(100, SR, N, 0.5),
      sine(440, SR, N, 0.7),
      new Float32Array(N),
      sine(8000, SR, N, 0.9),
      sine(200, SR, N, 0.3),
    ];
    const a = createFeatureExtractor();
    const b = createFeatureExtractor();
    const ra = seq.map((fr) => a.process(fr, SR));
    const rb = seq.map((fr) => b.process(fr, SR));
    expect(rb).toEqual(ra);
  });
});

describe('FeatureExtractor — AGC', () => {
  it('keeps levels bounded in [0,255] and stays alive on tiny signals', () => {
    const ext = createFeatureExtractor();
    const out: AudioFeatures[] = [];
    const tiny = sine(100, SR, 20 * N, 1e-3);
    for (let k = 0; k < 20; k++) out.push(ext.process(frameAt(tiny, k, N), SR));
    const loud = sine(100, SR, 20 * N, 1.0);
    for (let k = 0; k < 20; k++) out.push(ext.process(frameAt(loud, k, N), SR));

    for (const f of out) {
      for (const v of [f.bands.bass, f.bands.mid, f.bands.high]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
    // tiny signal is not "dead": bass is boosted above 0 during the quiet phase
    expect(out[10]!.bands.bass).toBeGreaterThan(0);
  });
});

describe('FeatureExtractor — smoothing / release', () => {
  it('releases gradually after the signal stops (no hard drop to 0)', () => {
    const ext = createFeatureExtractor();
    const loud = sine(100, SR, 20 * N, 1.0);
    let peak = 0;
    for (let k = 0; k < 20; k++) peak = ext.process(frameAt(loud, k, N), SR).bands.bass;

    const silence = new Float32Array(N);
    const decay: number[] = [];
    for (let k = 0; k < 5; k++) decay.push(ext.process(silence, SR).bands.bass);

    expect(decay[0]!).toBeLessThan(peak);
    expect(decay[0]!).toBeGreaterThan(0);
    for (let i = 1; i < decay.length; i++) {
      expect(decay[i]!).toBeLessThan(decay[i - 1]!);
      expect(decay[i]!).toBeGreaterThan(0);
    }
  });
});

describe('audio engine + source', () => {
  it('createAudioEngine emits features from a source', () => {
    let emit: ((pcm: Float32Array, sampleRate: number) => void) | null = null;
    const fakeSource: AudioSource = {
      onFrame(cb) {
        emit = cb;
      },
      stop() {},
    };
    const engine = createAudioEngine(fakeSource);
    let got: AudioFeatures | null = null;
    engine.onFeatures((f) => {
      got = f;
    });

    emit!(sine(100, SR, N, 0.6), SR);
    expect(got).not.toBeNull();
    expect(got!.bands.bass).toBeGreaterThanOrEqual(0);
  });

  it('webAudioSource module imports without throwing in node', () => {
    expect(typeof createWebAudioSource).toBe('function');
  });
});
