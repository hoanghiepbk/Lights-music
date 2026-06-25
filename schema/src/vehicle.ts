// Vehicle state — mock via panel UI (TIP-005) | real vehicle signals later.

export type Gear = 'P' | 'R' | 'N' | 'D';

export interface VehicleState {
  gear: Gear;
  speedKmh: number;
  seatbeltWarn: boolean;
  adasWarn: boolean;
  hvacTempC: number;
}
