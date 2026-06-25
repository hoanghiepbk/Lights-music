// ESP32 WS2812B renderer → TIP-008.
// Receives high-level params (preset / band levels / beat / zone mask) via the
// bridge node (Supabase Broadcast → serial) and renders PWM animation locally.
// The ECU never receives a per-LED colour stream.

void setup() {
  // TIP-008: init FastLED strips (6 zones), serial link to bridge node.
}

void loop() {
  // TIP-008: read params, render local animation, apply Policy Gate caps.
}
