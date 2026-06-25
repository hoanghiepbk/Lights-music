// React binding for the vehicle store (kept separate so vehicleStore.ts stays
// React-free and node-testable).
import { useSyncExternalStore } from 'react';
import type { VehicleState } from '@nhipsang/schema';
import { vehicleStore } from './vehicleStore';

export function useVehicleState(): VehicleState {
  return useSyncExternalStore(vehicleStore.subscribe, vehicleStore.get);
}
