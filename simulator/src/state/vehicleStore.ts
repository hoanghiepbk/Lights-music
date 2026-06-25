// Mock VehicleStateSource (TIP-005 §B) — a tiny observable store, UI-backed.
// NO React here so it stays node-testable and usable as a HAL source.
import type { VehicleState, VehicleStateSource } from '@nhipsang/schema';

export interface VehicleStore extends VehicleStateSource {
  set(partial: Partial<VehicleState>): void;
}

export const DEFAULT_VEHICLE_STATE: VehicleState = {
  gear: 'P',
  speedKmh: 0,
  seatbeltWarn: false,
  adasWarn: false,
  hvacTempC: 22,
};

export function createVehicleStore(initial: VehicleState = DEFAULT_VEHICLE_STATE): VehicleStore {
  let state: VehicleState = { ...initial };
  const subscribers = new Set<(s: VehicleState) => void>();

  return {
    get() {
      return state;
    },
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    set(partial) {
      state = { ...state, ...partial };
      for (const cb of subscribers) cb(state);
    },
  };
}

// App-wide singleton: the panel writes, the loop reads, the UI subscribes.
export const vehicleStore = createVehicleStore();
