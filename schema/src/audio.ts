// Audio features produced by the Web Audio pipeline → TIP-003.

export interface BandLevels {
  bass: number; // 0..255, đã smoothing + AGC
  mid: number; // 0..255
  high: number; // 0..255
}

export interface BeatEvent {
  onset: boolean;
  strength: number; // 0..1
  tMs: number;
}

export interface AudioFeatures {
  bands: BandLevels;
  beat: BeatEvent;
}
