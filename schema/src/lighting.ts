import type { ZoneId, RGB } from './zones';

// Nguồn yêu cầu đèn + thứ tự ưu tiên Arbiter (Blueprint §3.1).
export type LightingSource = 'safety' | 'hvac' | 'music' | 'theme';

export const PRIORITY_ORDER: readonly LightingSource[] = ['safety', 'hvac', 'music', 'theme'];

// Mỗi nguồn phát ra 1 LightingRequest; Arbiter chọn ra winner (TIP-004).
export interface ZoneColor {
  zone: ZoneId;
  rgb: RGB;
  brightness: number; // 0..1
}

export interface LightingRequest {
  source: LightingSource;
  presetId: number;
  zones: ZoneColor[];
  flashHz: number; // tần số nháy yêu cầu (Policy Gate sẽ cap)
}
