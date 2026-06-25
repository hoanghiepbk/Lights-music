export type ZoneId =
  | 'dashboard'
  | 'door_front_left'
  | 'door_front_right'
  | 'door_rear_left'
  | 'door_rear_right'
  | 'center_console';

export const ZONES: readonly ZoneId[] = [
  'dashboard',
  'door_front_left',
  'door_front_right',
  'door_rear_left',
  'door_rear_right',
  'center_console',
];

// Vùng tài xế nhìn thấy — dùng cho Policy Gate (màu cấm / brightness cap).
export const DRIVER_VISIBLE_ZONES: readonly ZoneId[] = [
  'dashboard',
  'door_front_left',
  'center_console',
];

export interface RGB {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}
