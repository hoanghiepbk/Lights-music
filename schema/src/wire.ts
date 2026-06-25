// Wire schema thật (Blueprint §7) — command CẤP CAO gửi xuống, KHÔNG per-LED.

// Output của Arbiter (sau khi Policy Gate áp cap) → đi qua transport.
export interface LightingCommand {
  presetId: number; // u8
  bandLevels: [number, number, number]; // bass/mid/high 0..255
  beat: boolean;
  zoneMask: number; // u8 bitmask theo thứ tự ZONES
  priority: number; // u8 = index trong PRIORITY_ORDER
  brightnessCap: number; // 0..255, do Policy Gate áp
}

// Đặc tả wire thật để bảo vệ trước câu vặn "không mock phần khó":
//   MHU → gateway : SOME-IP / Automotive Ethernet, LightingCommand serialized, 20–50 Hz
//   gateway → BCM : CAN-FD, ID 0x3A0, cycle 20ms (byte layout dưới đây)
// Serialize impl ở TIP-006 — đây CHỈ là đặc tả.
export const CANFD_LIGHTING = {
  id: 0x3a0,
  cycleMs: 20,
  layout: 'byte0=presetId · byte1-3=bandLevels · byte4=flags(beat<<0|zoneMask<<1) · byte5=brightnessCap',
} as const;
