// Wire schema thật (Blueprint §7) — command CẤP CAO gửi xuống, KHÔNG per-LED.
import type { ZoneColor } from './lighting';

// Output của Arbiter (sau khi Policy Gate áp cap) → đi qua transport.
export interface LightingCommand {
  presetId: number; // u8
  zones: ZoneColor[]; // 6 zone đã qua Policy Gate (per-zone resolved color, KHÔNG per-LED)
  bandLevels: [number, number, number]; // bass/mid/high 0..255 (cho ECU animate)
  beat: boolean;
  zoneMask: number; // u8 bitmask theo thứ tự ZONES
  priority: number; // u8 = index trong PRIORITY_ORDER
  brightnessCap: number; // 0..255, do Policy Gate áp (master; per-zone đã cap trong zones)
}

// Đặc tả wire thật để bảo vệ trước câu vặn "không mock phần khó":
//   MHU → gateway : SOME-IP / Automotive Ethernet, LightingCommand serialized, 20–50 Hz
//   gateway → BCM : CAN-FD, ID 0x3A0, cycle 20ms (byte layout dưới đây)
// Command nay mang per-zone color (vẫn high-level — 6 zone, ECU render PWM cục bộ),
// nên payload thật gồm 6×(RGB+brightness) đóng gói cạnh các flag dưới đây.
// Serialize impl (kể cả byte packing 6 zone) ở TIP-006 — đây CHỈ là đặc tả.
export const CANFD_LIGHTING = {
  id: 0x3a0,
  cycleMs: 20,
  layout: 'byte0=presetId · byte1-3=bandLevels · byte4=flags(beat<<0|zoneMask<<1) · byte5=brightnessCap · byte6+=zones[6]×(RGB+brightness)',
} as const;
