// HAL boundary (Blueprint §6) — 3 interface SWAPPABLE. Chỉ interface, KHÔNG impl.
import type { LightingCommand } from './wire';
import type { VehicleState } from './vehicle';

export interface AudioSource {
  // mock: Web Audio (TIP-003) | real: post-proc effect dưới HAL
  onFrame(cb: (pcm: Float32Array, sampleRate: number) => void): void;
  stop(): void;
}

export interface LightingTransport {
  // mock: Supabase Broadcast (TIP-006) | real: SOME-IP / CAN-FD
  send(cmd: LightingCommand): void;
}

export interface VehicleStateSource {
  // mock: panel UI (TIP-005) | real: vehicle signals
  get(): VehicleState;
  subscribe(cb: (s: VehicleState) => void): () => void;
}
