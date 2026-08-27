export const OBJECTIVE_BIT_INDEX: Record<string, number> = {
  RedCupsOnly_T1: 0,
  BlueCupsOnly_T1: 1,
  YellowCupsOnly_T1: 2,
  GetAllCups_T1: 3,
  BeatPreviousTime_T1: 4,
  RedCupsOnly_T2: 5,
  BlueCupsOnly_T2: 6,
  YellowCupsOnly_T2: 7,
  GetAllCups_T2: 8,
  BeatPreviousTime_T2: 9,
  RedCupsOnly_T3: 10,
  BlueCupsOnly_T3: 11,
  YellowCupsOnly_T3: 12,
  GetAllCups_T3: 13,
  BeatPreviousTime_T3: 14,
  CompleteFirstRace: 15,
  ModFirstVehicle: 16,
  CompleteMultiplayerRace: 17,
  WinMultiplayerRace: 18,
  UnlockTrack2: 19,
  UnlockTrack3: 20,
  LapTime_T1: 21,
  LapTime_T2: 22,
  LapTime_T3: 23,
  NoCups_T1: 24,
  NoCups_T2: 25,
  NoCups_T3: 26,
  CompleteAllAdvancedObjectives: 27,
};

export function compressObjectives(
  objectives: Record<string, number> | undefined,
): string {
  let bits = 0n;
  for (const [key, count] of Object.entries(objectives ?? {})) {
    if (count > 0 && OBJECTIVE_BIT_INDEX[key] !== undefined) {
      bits |= 1n << BigInt(OBJECTIVE_BIT_INDEX[key]);
    }
  }

  return bits === 0n ? "" : bits.toString();
}

export function compressParts(
  parts: Record<string, number> | undefined,
): string {
  let bits = 0n;
  for (const [name, id] of Object.entries(parts ?? {})) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) continue;

    if (name === "Decal" && numId <= 16) {
      bits |= 1n << BigInt(numId - 1);
    } else if (name === "Battery" && numId <= 6) {
      bits |= 1n << BigInt(numId + 15);
    } else if (name === "Motor" && numId <= 6) {
      bits |= 1n << BigInt(numId + 21);
    } else if (name === "Chassis" && numId <= 4) {
      bits |= 1n << BigInt(numId + 27);
    } else if (name === "Body" && numId <= 4) {
      bits |= 1n << BigInt(numId + 31);
    } else if (name === "Wheels" && numId <= 4) {
      bits |= 1n << BigInt(numId + 35);
    } else if (name === "Shocks" && numId <= 10) {
      bits |= 1n << BigInt(numId + 39);
    }
  }

  return bits === 0n ? "" : bits.toString();
}
