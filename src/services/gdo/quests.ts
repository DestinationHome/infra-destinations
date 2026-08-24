// RC Rally publisher constants
export const RCR_PUBLISHER_ID = "12";
export const RCR_PUBLISHER_TOKEN = "325976d0-17a7-4d52-abf1-46df3a5f095c";

/** All 28 RC Rally quest names, ordered by GDO quest ID (index + 1). */
export const RCR_ALL_QUESTS = [
  "RedCupsOnly_T1",
  "BlueCupsOnly_T1",
  "YellowCupsOnly_T1",
  "GetAllCups_T1",
  "BeatPreviousTime_T1",
  "RedCupsOnly_T2",
  "BlueCupsOnly_T2",
  "YellowCupsOnly_T2",
  "GetAllCups_T2",
  "BeatPreviousTime_T2",
  "RedCupsOnly_T3",
  "BlueCupsOnly_T3",
  "YellowCupsOnly_T3",
  "GetAllCups_T3",
  "BeatPreviousTime_T3",
  "CompleteFirstRace",
  "ModFirstVehicle",
  "CompleteMultiplayerRace",
  "WinMultiplayerRace",
  "UnlockTrack2",
  "UnlockTrack3",
  "LapTime_T1",
  "LapTime_T2",
  "LapTime_T3",
  "NoCups_T1",
  "NoCups_T2",
  "NoCups_T3",
  "CompleteAllAdvancedObjectives",
] as const;
