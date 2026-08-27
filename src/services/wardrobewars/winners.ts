import {
  dayIndex,
  monthIndex,
  PERIOD_DAILY,
  PERIOD_MONTHLY,
  PERIOD_WEEKLY,
  periodKeys,
  previousPeriodKeys,
  weekIndex,
} from "./periods";
import {
  prizeFor,
  REWARD_DAILY_WIN,
  REWARD_MONTHLY_WIN,
  REWARD_WEEKLY_WIN,
  type RewardType,
} from "./prizes";
import {
  type Entry,
  entryPeriodKeysForPlayer,
  entryPeriodKeysWithin,
  getEntry,
  grantRewardOnce,
  getStoredWinner,
  storeWinner,
  topEntryForPeriod,
  type Winner,
  winnerPsnIdsWithin,
} from "./store";

/**
 * Contest results.
 *
 * The 2012 rules describe an escalating ladder: the highest-rated entry each
 * day wins that day, daily winners are the only entrants for the week, and
 * weekly winners the only entrants for the month.
 *
 * Results are *snapshotted* the first time a closed period is asked about. That
 * matters because entries stay votable after their day ends, so recomputing
 * from live scores would let a late vote silently rewrite who won last Tuesday.
 */

export interface DecidedWinner {
  winner: Winner;
  entry?: Entry;
}

/** Decide (or recall) the winner of a closed contest day. */
export async function resolveDailyWinner(
  dayKey: string,
  now: Date = new Date(),
): Promise<DecidedWinner | undefined> {
  return resolvePeriod(PERIOD_DAILY, "day", dayKey, now, () =>
    topEntryForPeriod("day", dayKey),
  );
}

/** Decide (or recall) the winner of a closed contest week. */
export async function resolveWeeklyWinner(
  weekKey: string,
  now: Date = new Date(),
): Promise<DecidedWinner | undefined> {
  await settleDaysIn(weekKey, now);
  return resolvePeriod(PERIOD_WEEKLY, "week", weekKey, now, async () => {
    // Only that week's daily winners are eligible for the weekly prize.
    const eligible = await winnerPsnIdsWithin(PERIOD_DAILY, "week", weekKey);
    const fromDailyWinners = await topEntryForPeriod("week", weekKey, eligible);
    // Before any daily winner has been decided there is nobody to promote, so
    // fall back to the week's best entry outright rather than skipping a week.
    return fromDailyWinners ?? (await topEntryForPeriod("week", weekKey));
  });
}

/** Decide (or recall) the winner of a closed contest month. */
export async function resolveMonthlyWinner(
  monthKey: string,
  now: Date = new Date(),
): Promise<DecidedWinner | undefined> {
  await settleWeeksIn(monthKey, now);
  return resolvePeriod(PERIOD_MONTHLY, "month", monthKey, now, async () => {
    const weeklyWinners = await winnerPsnIdsWithin(
      PERIOD_WEEKLY,
      "month",
      monthKey,
    );
    const fromWeeklyWinners = await topEntryForPeriod(
      "month",
      monthKey,
      weeklyWinners,
    );
    if (fromWeeklyWinners) return fromWeeklyWinners;

    const dailyWinners = await winnerPsnIdsWithin(
      PERIOD_DAILY,
      "month",
      monthKey,
    );
    const fromDailyWinners = await topEntryForPeriod(
      "month",
      monthKey,
      dailyWinners,
    );
    return fromDailyWinners ?? (await topEntryForPeriod("month", monthKey));
  });
}

/**
 * Settle every closed day inside a week before that week is judged.
 *
 * Results are decided lazily, so a day that nobody asked about while it was
 * recent stays undecided forever — and the weekly eligibility pool is built
 * from *stored* daily winners, so that day's champion silently drops out of
 * the week. On a quiet server that is most days, and it hands the week to
 * whoever happened to be playing when somebody looked.
 *
 * This runs even when the week is already decided: the week keeps the answer
 * it was given (a settled period is never re-judged, or a late vote could
 * rewrite it), but the players who won those days still get settled, and so
 * still get paid.
 *
 * resolveDailyWinner is a no-op for a day that is already decided or still
 * open, so repeat calls cost one indexed lookup each.
 */
async function settleDaysIn(weekKey: string, now: Date): Promise<void> {
  for (const day of await entryPeriodKeysWithin("day", "week", weekKey)) {
    await resolveDailyWinner(day, now);
  }
}

/** The same, one rung up: settle a month's weeks (and their days) first. */
async function settleWeeksIn(monthKey: string, now: Date): Promise<void> {
  for (const week of await entryPeriodKeysWithin("week", "month", monthKey)) {
    await resolveWeeklyWinner(week, now);
  }
}

async function resolvePeriod(
  periodType: number,
  column: "day" | "week" | "month",
  periodKey: string,
  now: Date,
  pickTop: () => Promise<Entry | undefined>,
): Promise<DecidedWinner | undefined> {
  const stored = await getStoredWinner(periodType, periodKey);
  if (stored) {
    const entry = stored.entryId ? await getEntry(stored.entryId) : undefined;
    return { winner: stored, entry };
  }

  // An open period has no winner yet — the contest is still running.
  const current = periodKeys(now);
  const currentKey =
    column === "day" ? current.day : column === "week" ? current.week : current.month;
  if (periodKey >= currentKey) return undefined;

  const top = await pickTop();
  if (!top) return undefined;

  const winner = await storeWinner({
    periodType,
    periodKey,
    entryId: top.id,
    psnid: top.psnid,
    score: top.score,
  });
  if (!winner) return undefined;
  return { winner, entry: top };
}

export interface LatestWinners {
  daily?: DecidedWinner;
  weekly?: DecidedWinner;
  monthly?: DecidedWinner;
}

/**
 * The three winners the big screens advertise: yesterday's, last week's and
 * last month's. Calling this is also what lazily decides those periods, so the
 * screens and the reward endpoint stay in step without a scheduler.
 */
export async function latestWinners(
  now: Date = new Date(),
): Promise<LatestWinners> {
  const previous = previousPeriodKeys(now);
  return {
    daily: await resolveDailyWinner(previous.day, now),
    weekly: await resolveWeeklyWinner(previous.week, now),
    monthly: await resolveMonthlyWinner(previous.month, now),
  };
}


/**
 * Prizes this player has won and has not yet collected.
 *
 * Every closed period the player competed in is settled first, then paid out,
 * so a win keeps until it is claimed instead of expiring. The 2012 rules told
 * players to "return to the mall the next day", but taken literally that bins
 * most prizes here: a period is only settled when somebody happens to be
 * standing in the space, so the day a player won may not be decided until well
 * after their one-day window shut.
 *
 * Bounded by the player's own history rather than the contest's — with the
 * 2012 archive loaded the entries table reaches back to 2013, and none of it
 * can owe a living player anything.
 *
 * Grants are recorded per player per period, so asking repeatedly (the client
 * asks on every NotifyAuthenticated) pays out at most once.
 */
export async function collectWinnings(
  psnid: string,
  now: Date = new Date(),
  onlyType?: RewardType,
): Promise<string[]> {
  const periods = await entryPeriodKeysForPlayer(psnid);
  const out: string[] = [];

  const claim = async (
    decided: DecidedWinner | undefined,
    type: RewardType,
    periodKey: string,
    rotation: number,
  ) => {
    if (decided?.winner.psnid !== psnid) return;
    if (onlyType !== undefined && onlyType !== type) return;
    const prize = prizeFor(type, rotation);
    if (!prize) return;
    const objectId = await grantRewardOnce({
      psnid,
      rewardType: type,
      periodKey,
      objectId: prize.objectId,
    });
    if (objectId) out.push(objectId);
  };

  for (const day of periods.days) {
    const decided = await resolveDailyWinner(day, now);
    await claim(decided, REWARD_DAILY_WIN, day, dayIndex(day));
  }
  for (const week of periods.weeks) {
    const decided = await resolveWeeklyWinner(week, now);
    await claim(decided, REWARD_WEEKLY_WIN, week, weekIndex(week));
  }
  for (const month of periods.months) {
    const decided = await resolveMonthlyWinner(month, now);
    await claim(decided, REWARD_MONTHLY_WIN, month, monthIndex(month));
  }

  return out;
}
