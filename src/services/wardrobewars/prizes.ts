import data from "./prizes.json";

export interface Prize {
  /** HCDB object GUID, handed to `Rewards.AddTicket` on the client. */
  objectId: string;
  /** Catalogue name minus the shared `Wardrobe Wars - ` prefix. */
  name: string;
}

export const REWARD_PARTICIPANT = 1;
export const REWARD_DAILY_WIN = 2;
export const REWARD_WEEKLY_WIN = 3;
export const REWARD_MONTHLY_WIN = 4;

export type RewardType =
  | typeof REWARD_PARTICIPANT
  | typeof REWARD_DAILY_WIN
  | typeof REWARD_WEEKLY_WIN
  | typeof REWARD_MONTHLY_WIN;

export const PARTICIPANT_PRIZES: Prize[] = data.participant;
export const DAILY_PRIZES: Prize[] = data.daily;
export const WEEKLY_PRIZES: Prize[] = data.weekly;
export const MONTHLY_PRIZES: Prize[] = data.monthly;

const POOLS: Record<RewardType, Prize[]> = {
  [REWARD_PARTICIPANT]: PARTICIPANT_PRIZES,
  [REWARD_DAILY_WIN]: DAILY_PRIZES,
  [REWARD_WEEKLY_WIN]: WEEKLY_PRIZES,
  [REWARD_MONTHLY_WIN]: MONTHLY_PRIZES,
};

/** Step through a tier's pool; `rotation` is the day/week/month index. */
export function prizeFor(type: RewardType, rotation: number): Prize | undefined {
  const pool = POOLS[type];
  if (!pool || pool.length === 0) return undefined;
  const index = ((rotation % pool.length) + pool.length) % pool.length;
  return pool[index];
}

/** Every prize, for lookups by object id. */
export const ALL_PRIZES: Prize[] = [
  ...PARTICIPANT_PRIZES,
  ...DAILY_PRIZES,
  ...WEEKLY_PRIZES,
  ...MONTHLY_PRIZES,
];
