export interface UserQuestProgress {
  objectives: Record<string, number>;
}

export interface UserSceneStats {
  spentDuration: number;
  timesEntered: number;
}

export interface UserGameRecord {
  times?: Record<string, { time: number; splits?: number[] }>;
  parts?: Record<string, number>;
  loadouts?: Record<string, string>;
  [key: string]: unknown;
}
