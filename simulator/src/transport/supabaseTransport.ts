// LightingTransport impl (TIP-006 §A) — publishes HIGH-LEVEL params over a
// Supabase Broadcast channel for distributed rendering (Blueprint §2: send
// 6-zone params, NOT per-LED; the ECU interpolates locally).
//
// Browser-isolated like webAudioSource: `createClient` and env are touched ONLY
// inside the factory, so importing this module in node does NOT throw.
import { createClient } from '@supabase/supabase-js';
import type { LightingCommand, LightingTransport } from '@nhipsang/schema';

export const LIGHTING_CHANNEL = 'nhipsang-lighting';
export const THROTTLE_HZ = 25;
export const THROTTLE_MIN_MS = 1000 / THROTTLE_HZ; // 40ms → ≤25 msgs/s on the bus

export type TransportStatus = 'connected' | 'disconnected' | 'error';

export interface StatefulTransport extends LightingTransport {
  status(): TransportStatus;
  close(): void;
}

export interface MockTransport extends StatefulTransport {
  sent: LightingCommand[];
}

export interface SupabaseTransportOptions {
  url?: string;
  key?: string;
}

export interface ThrottleOptions {
  minIntervalMs?: number;
  now?: () => number;
}

// Records every command (no throttle) — readable in tests, status 'connected'.
export function createMockTransport(): MockTransport {
  const sent: LightingCommand[] = [];
  return {
    send(cmd) {
      sent.push(cmd);
    },
    status: () => 'connected',
    close() {},
    sent,
  };
}

// Min-interval gate, deterministic on the injected clock (default perf.now).
function createRateGate(minIntervalMs: number, now: () => number): () => boolean {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const t = now();
    if (t - last >= minIntervalMs) {
      last = t;
      return true;
    }
    return false;
  };
}

// Wraps any transport so it forwards at most ~THROTTLE_HZ. Drops the surplus
// frames (distributed rendering tolerates it). `now` is injectable for tests.
export function createThrottledTransport(
  inner: LightingTransport,
  opts: ThrottleOptions = {},
): LightingTransport {
  const gate = createRateGate(opts.minIntervalMs ?? THROTTLE_MIN_MS, opts.now ?? (() => performance.now()));
  return {
    send(cmd) {
      if (gate()) inner.send(cmd);
    },
  };
}

export function createSupabaseTransport(opts: SupabaseTransportOptions = {}): StatefulTransport {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const url = opts.url ?? env?.VITE_SUPABASE_URL;
  const key = opts.key ?? env?.VITE_SUPABASE_ANON_KEY;

  // No credentials → a disconnected mock sink. Local dev / tests stay alive and
  // the app simply does not publish while 'disconnected'.
  if (!url || !key) {
    const mock = createMockTransport();
    return { send: mock.send, status: () => 'disconnected', close: mock.close };
  }

  const client = createClient(url, key);
  let status: TransportStatus = 'disconnected';
  const channel = client.channel(LIGHTING_CHANNEL);
  channel.subscribe((s: string) => {
    status = s === 'SUBSCRIBED' ? 'connected' : s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' ? 'error' : 'disconnected';
  });

  const gate = createRateGate(THROTTLE_MIN_MS, () => performance.now());
  return {
    send(cmd) {
      if (status === 'connected' && gate()) {
        void channel.send({ type: 'broadcast', event: 'lighting', payload: cmd });
      }
    },
    status: () => status,
    close() {
      void client.removeChannel(channel);
    },
  };
}
