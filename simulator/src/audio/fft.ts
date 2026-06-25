// Pure radix-2 iterative FFT (Cooley–Tukey) for real input, with a Hann window.
// No Web Audio / DOM — safe to run in node (used by the deterministic extractor).
// Self-coded per REQ-019 (no heavy DSP lib).

const hannCache = new Map<number, Float32Array>();

function hann(n: number): Float32Array {
  const cached = hannCache.get(n);
  if (cached) return cached;
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  hannCache.set(n, w);
  return w;
}

function isPow2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

// In-place radix-2 FFT. re/im length must be a power of 2.
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;

  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }

  // butterflies
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wReStep = Math.cos(ang);
    const wImStep = Math.sin(ang);
    const half = len >> 1;
    for (let start = 0; start < n; start += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < half; k++) {
        const p = start + k;
        const q = p + half;
        const cRe = re[q]!;
        const cIm = im[q]!;
        const bRe = cRe * wRe - cIm * wIm;
        const bIm = cRe * wIm + cIm * wRe;
        const aRe = re[p]!;
        const aIm = im[p]!;
        re[p] = aRe + bRe;
        im[p] = aIm + bIm;
        re[q] = aRe - bRe;
        im[q] = aIm - bIm;
        const nextWRe = wRe * wReStep - wIm * wImStep;
        wIm = wRe * wImStep + wIm * wReStep;
        wRe = nextWRe;
      }
    }
  }
}

// Windowed magnitude spectrum (first half = n/2 bins) of a real frame.
// `frame.length` must be a power of 2.
export function magnitudeSpectrum(frame: Float32Array): Float32Array {
  const n = frame.length;
  if (!isPow2(n)) {
    throw new Error(`FFT frame size must be a power of 2, got ${n}`);
  }
  const win = hann(n);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    re[i] = frame[i]! * win[i]!;
  }
  fftInPlace(re, im);
  const half = n >> 1;
  const mag = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    const r = re[i]!;
    const m = im[i]!;
    mag[i] = Math.sqrt(r * r + m * m);
  }
  return mag;
}
