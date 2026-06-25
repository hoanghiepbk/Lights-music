import { describe, it, expect } from 'vitest';
import {
  ZONES,
  DRIVER_VISIBLE_ZONES,
  PRIORITY_ORDER,
  type VehicleState,
  type LightingCommand,
} from '@nhipsang/schema';

// Compile-time: wrong shapes here would fail `pnpm typecheck`.
const vehicle: VehicleState = {
  gear: 'P',
  speedKmh: 0,
  seatbeltWarn: false,
  adasWarn: false,
  hvacTempC: 22,
};

const command: LightingCommand = {
  presetId: 1,
  zones: [],
  bandLevels: [120, 80, 40],
  beat: true,
  zoneMask: 0b000001,
  priority: 0,
  brightnessCap: 255,
};

describe('schema contracts', () => {
  it('has exactly 6 zones', () => {
    expect(ZONES.length).toBe(6);
  });

  it('orders safety first in the arbiter priority', () => {
    expect(PRIORITY_ORDER[0]).toBe('safety');
  });

  it('keeps driver-visible zones a subset of all zones', () => {
    expect(DRIVER_VISIBLE_ZONES.every((z) => ZONES.includes(z))).toBe(true);
  });

  it('accepts a well-formed VehicleState and LightingCommand', () => {
    expect(vehicle.gear).toBe('P');
    expect(command.bandLevels).toHaveLength(3);
  });
});
