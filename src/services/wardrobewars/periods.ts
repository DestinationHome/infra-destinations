import { wwConfig } from "./config";

/**
 * Contest period maths.
 *
 * The 2012 official rules define the contest calendar precisely:
 *   - a day runs 00:00-23:59 Pacific
 *   - a week runs Monday to Sunday
 *   - a month runs from the 1st to the last day
 *
 * All three keys are derived from the wall-clock date in `wwConfig.timezone`,
 * so DST shifts land on the right day.
 */

export interface PeriodKeys {
  /** `YYYY-MM-DD` of the contest day. */
  day: string;
  /** `YYYY-MM-DD` of the Monday that starts the contest week. */
  week: string;
  /** `YYYY-MM` of the contest month. */
  month: string;
}

export const PERIOD_DAILY = 1;
export const PERIOD_WEEKLY = 2;
export const PERIOD_MONTHLY = 3;

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let fmt = dateFormatters.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(timezone, fmt);
  }
  return fmt;
}

/** Wall-clock calendar date in the contest timezone. */
export function zonedDate(
  at: Date = new Date(),
  timezone: string = wwConfig.timezone,
): { year: number; month: number; day: number } {
  const parts = formatterFor(timezone).formatToParts(at);
  const get = (type: string) =>
    Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * All three period keys for a moment in time.
 *
 * The week key is computed off a UTC-noon anchor of the local calendar date, so
 * the Monday lookup can never be dragged across a boundary by a DST offset.
 */
export function periodKeys(
  at: Date = new Date(),
  timezone: string = wwConfig.timezone,
): PeriodKeys {
  const { year, month, day } = zonedDate(at, timezone);
  const dayKey = `${year}-${pad2(month)}-${pad2(day)}`;

  const anchor = Date.UTC(year, month - 1, day, 12, 0, 0);
  const weekday = new Date(anchor).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (weekday + 6) % 7;
  const monday = new Date(anchor - daysSinceMonday * 86_400_000);
  const weekKey = `${monday.getUTCFullYear()}-${pad2(
    monday.getUTCMonth() + 1,
  )}-${pad2(monday.getUTCDate())}`;

  return {
    day: dayKey,
    week: weekKey,
    month: `${year}-${pad2(month)}`,
  };
}

/**
 * Period keys for a calendar date that is already known, e.g. the `YYYY-MM-DD`
 * folder name of an archived photo. Skips the timezone conversion entirely —
 * the date is the answer, so re-deriving it could only shift it by a day.
 */
export function periodKeysFromDayKey(dayKey: string): PeriodKeys {
  const [year, month, day] = dayKey
    .split("-")
    .map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { day: dayKey, week: dayKey, month: dayKey.slice(0, 7) };
  }

  const anchor = Date.UTC(year, month - 1, day, 12, 0, 0);
  const weekday = new Date(anchor).getUTCDay();
  const monday = new Date(anchor - ((weekday + 6) % 7) * 86_400_000);

  return {
    day: dayKey,
    week: `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-${pad2(
      monday.getUTCDate(),
    )}`,
    month: `${year}-${pad2(month)}`,
  };
}

/** The period keys for `days` days before `at`. */
export function periodKeysDaysAgo(
  days: number,
  at: Date = new Date(),
): PeriodKeys {
  const { year, month, day } = zonedDate(at);
  const anchor = Date.UTC(year, month - 1, day, 12, 0, 0);
  return periodKeys(new Date(anchor - days * 86_400_000));
}

/** Previous day / week / month keys — the most recently *closed* periods. */
export function previousPeriodKeys(at: Date = new Date()): PeriodKeys {
  const current = periodKeys(at);
  const { year, month, day } = zonedDate(at);
  const anchor = Date.UTC(year, month - 1, day, 12, 0, 0);

  const yesterday = periodKeys(new Date(anchor - 86_400_000));
  const lastWeekAnchor = Date.parse(`${current.week}T12:00:00Z`) - 86_400_000;
  const lastWeek = periodKeys(new Date(lastWeekAnchor));
  const lastMonth = periodKeys(new Date(Date.UTC(year, month - 1, 1, 12) - 86_400_000));

  return { day: yesterday.day, week: lastWeek.week, month: lastMonth.month };
}

/** Midpoint timestamp of a `YYYY-MM-DD` day key, for display purposes. */
export function dayKeyToTimestamp(dayKey: string): number {
  const parsed = Date.parse(`${dayKey}T12:00:00Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
}

/** How many whole weeks have elapsed since the Unix epoch Monday (1970-01-05). */
export function weekIndex(weekKey: string): number {
  const EPOCH_MONDAY = Date.UTC(1970, 0, 5, 12);
  const parsed = Date.parse(`${weekKey}T12:00:00Z`);
  if (!Number.isFinite(parsed)) return 0;
  return Math.floor((parsed - EPOCH_MONDAY) / (7 * 86_400_000));
}

/** How many whole days have elapsed since the Unix epoch. */
export function dayIndex(dayKey: string): number {
  const parsed = Date.parse(`${dayKey}T12:00:00Z`);
  if (!Number.isFinite(parsed)) return 0;
  return Math.floor(parsed / 86_400_000);
}

/** How many whole months have elapsed since January 1970. */
export function monthIndex(monthKey: string): number {
  const [y, m] = monthKey.split("-").map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 0;
  return (y - 1970) * 12 + (m - 1);
}
