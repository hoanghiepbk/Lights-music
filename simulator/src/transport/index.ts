// LightingTransport impl: Supabase Broadcast publisher (high-level params only) → TIP-006.
export {
  createSupabaseTransport,
  createMockTransport,
  createThrottledTransport,
  LIGHTING_CHANNEL,
  THROTTLE_HZ,
  THROTTLE_MIN_MS,
  type TransportStatus,
  type StatefulTransport,
  type MockTransport,
} from './supabaseTransport';
