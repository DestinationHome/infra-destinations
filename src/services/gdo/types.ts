export interface RcRallyUserData {
  times: Record<string, { time: number; splits: number[] }>;
  parts: Record<string, number>;
  objectives: Record<string, number>;
}
