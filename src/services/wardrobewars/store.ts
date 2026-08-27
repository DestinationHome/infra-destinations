import {
  db,
  wardrobeWarsEntries,
  wardrobeWarsRewards,
  wardrobeWarsSessions,
  wardrobeWarsUploads,
  wardrobeWarsVotes,
  wardrobeWarsWinners,
} from "@db";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { wwConfig } from "./config";
import type { RewardType } from "./prizes";

export type Entry = typeof wardrobeWarsEntries.$inferSelect;
export type Session = typeof wardrobeWarsSessions.$inferSelect;
export type Upload = typeof wardrobeWarsUploads.$inferSelect;
export type Winner = typeof wardrobeWarsWinners.$inferSelect;

/* ------------------------------------------------------------------ *
 * Sessions ("bracelets")
 * ------------------------------------------------------------------ */

/**
 * Issue a bracelet for a player.
 *
 * The PSN ticket that `verify.php` receives cannot be validated here — the
 * signing keys are Sony's and identity on Destination Home is SSFW's job — so
 * the bracelet binds to the PSN ID the client posted alongside it. It is a
 * session handle, not a proof of identity.
 */
export async function createSession(
  psnid: string,
  territory: string,
  region: string,
): Promise<string> {
  const bracelet = crypto.randomUUID().replace(/-/g, "");
  const now = Date.now();
  await db.insert(wardrobeWarsSessions).values({
    bracelet,
    psnid,
    territory,
    region,
    createdAt: now,
    expiresAt: now + wwConfig.braceletTtlSeconds * 1000,
  });
  return bracelet;
}

/** Look up an unexpired bracelet. */
export async function resolveSession(
  bracelet: string,
): Promise<Session | undefined> {
  if (!bracelet) return undefined;
  return db
    .select()
    .from(wardrobeWarsSessions)
    .where(
      and(
        eq(wardrobeWarsSessions.bracelet, bracelet),
        gt(wardrobeWarsSessions.expiresAt, Date.now()),
      ),
    )
    .get();
}

/** Drop expired bracelets and unconsumed upload tokens. */
export async function pruneExpired(): Promise<void> {
  const now = Date.now();
  await db
    .delete(wardrobeWarsSessions)
    .where(sql`${wardrobeWarsSessions.expiresAt} < ${now}`);
  await db
    .delete(wardrobeWarsUploads)
    .where(sql`${wardrobeWarsUploads.expiresAt} < ${now}`);
}

/* ------------------------------------------------------------------ *
 * Two-step photo upload tokens
 * ------------------------------------------------------------------ */

export async function createUploadToken(input: {
  psnid: string;
  territory: string;
  region: string;
  language: string;
  sha1: string;
}): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "");
  const now = Date.now();
  await db.insert(wardrobeWarsUploads).values({
    token,
    psnid: input.psnid,
    territory: input.territory,
    region: input.region,
    language: input.language,
    sha1: input.sha1,
    createdAt: now,
    expiresAt: now + wwConfig.uploadTokenTtlSeconds * 1000,
  });
  return token;
}

/**
 * Claim an upload token, marking it consumed.
 *
 * The conditional update is the whole point: it makes the token single-use even
 * if the client retries part two, so one photo booth visit can never produce
 * two contest entries.
 */
export async function consumeUploadToken(
  token: string,
): Promise<Upload | undefined> {
  if (!token) return undefined;
  const claimed = await db
    .update(wardrobeWarsUploads)
    .set({ consumed: 1 })
    .where(
      and(
        eq(wardrobeWarsUploads.token, token),
        eq(wardrobeWarsUploads.consumed, 0),
        gt(wardrobeWarsUploads.expiresAt, Date.now()),
      ),
    )
    .returning()
    .get();
  return claimed;
}

/* ------------------------------------------------------------------ *
 * Entries
 * ------------------------------------------------------------------ */

export async function createEntry(input: {
  psnid: string;
  territory: string;
  region: string;
  language: string;
  imagePath: string;
  dayKey: string;
  weekKey: string;
  monthKey: string;
  archived?: boolean;
  createdAt?: number;
}): Promise<Entry> {
  const row = await db
    .insert(wardrobeWarsEntries)
    .values({
      psnid: input.psnid,
      territory: input.territory,
      region: input.region,
      language: input.language,
      imagePath: input.imagePath,
      dayKey: input.dayKey,
      weekKey: input.weekKey,
      monthKey: input.monthKey,
      archived: input.archived ? 1 : 0,
      createdAt: input.createdAt ?? Date.now(),
    })
    .returning()
    .get();
  return row;
}

export async function getEntry(id: number): Promise<Entry | undefined> {
  if (!Number.isFinite(id) || id <= 0) return undefined;
  return db
    .select()
    .from(wardrobeWarsEntries)
    .where(eq(wardrobeWarsEntries.id, id))
    .get();
}

export async function countEntries(): Promise<number> {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(wardrobeWarsEntries)
    .get();
  return row?.n ?? 0;
}

/** The most recent contest day that actually has visible entries. */
export async function latestDayWithEntries(): Promise<string | undefined> {
  const row = await db
    .select({ dayKey: wardrobeWarsEntries.dayKey })
    .from(wardrobeWarsEntries)
    .where(eq(wardrobeWarsEntries.hidden, 0))
    .orderBy(desc(wardrobeWarsEntries.dayKey))
    .limit(1)
    .get();
  return row?.dayKey;
}

/**
 * Pick an entry for a podium or the kiosk.
 *
 * Selection is random rather than sequential so eight podiums polling
 * independently show a spread of entries without any shared cursor, which is
 * how the retail podiums behaved. `excludeId` is the client's `previous` field
 * and stops a podium redrawing the same entry twice in a row.
 */
export async function pickEntry(options: {
  dayKey: string;
  excludeId?: number;
  psnid?: string;
}): Promise<Entry | undefined> {
  const filters = [
    eq(wardrobeWarsEntries.dayKey, options.dayKey),
    eq(wardrobeWarsEntries.hidden, 0),
  ];
  if (options.psnid) {
    filters.push(eq(wardrobeWarsEntries.psnid, options.psnid));
  }
  if (options.excludeId && options.excludeId > 0) {
    filters.push(ne(wardrobeWarsEntries.id, options.excludeId));
  }

  const picked = await db
    .select()
    .from(wardrobeWarsEntries)
    .where(and(...filters))
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .get();
  if (picked) return picked;

  // Only one entry matched and it was the one we excluded — show it again
  // rather than telling the podium the contest is empty.
  if (options.excludeId && options.excludeId > 0) {
    return db
      .select()
      .from(wardrobeWarsEntries)
      .where(
        and(
          eq(wardrobeWarsEntries.dayKey, options.dayKey),
          eq(wardrobeWarsEntries.hidden, 0),
          ...(options.psnid ? [eq(wardrobeWarsEntries.psnid, options.psnid)] : []),
        ),
      )
      .orderBy(sql`RANDOM()`)
      .limit(1)
      .get();
  }
  return undefined;
}

/** Does this player have any entry at all on this contest day? */
export async function hasEntriesOnDay(
  psnid: string,
  dayKey: string,
): Promise<boolean> {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(wardrobeWarsEntries)
    .where(
      and(
        eq(wardrobeWarsEntries.psnid, psnid),
        eq(wardrobeWarsEntries.dayKey, dayKey),
      ),
    )
    .get();
  return (row?.n ?? 0) > 0;
}

/* ------------------------------------------------------------------ *
 * Votes
 * ------------------------------------------------------------------ */

/** The rating this player already gave an entry, if any. */
export async function existingVote(
  entryId: number,
  psnid: string,
): Promise<number | undefined> {
  const row = await db
    .select({ rating: wardrobeWarsVotes.rating })
    .from(wardrobeWarsVotes)
    .where(
      and(
        eq(wardrobeWarsVotes.entryId, entryId),
        eq(wardrobeWarsVotes.psnid, psnid),
      ),
    )
    .get();
  return row?.rating;
}

export interface VoteResult {
  accepted: boolean;
  score: number;
  voteCount: number;
}

/**
 * Record a 1-10 rating.
 *
 * The unique index on `(entry_id, psnid)` is what enforces the game's "you can
 * only rate each entry once" rule; `onConflictDoNothing` turns a repeat vote
 * into a clean rejection instead of an error. Aggregates are recomputed from
 * the vote rows rather than incremented, so they can never drift.
 */
export async function castVote(
  entryId: number,
  psnid: string,
  rating: number,
): Promise<VoteResult> {
  const clamped = Math.max(1, Math.min(10, Math.round(rating)));

  const inserted = await db
    .insert(wardrobeWarsVotes)
    .values({ entryId, psnid, rating: clamped, createdAt: Date.now() })
    .onConflictDoNothing()
    .returning()
    .get();

  const totals = await recomputeEntryScore(entryId);
  return {
    accepted: Boolean(inserted),
    score: totals.score,
    voteCount: totals.voteCount,
  };
}

/** Recalculate an entry's cached vote aggregates from its vote rows. */
export async function recomputeEntryScore(
  entryId: number,
): Promise<{ score: number; voteCount: number }> {
  const totals = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${wardrobeWarsVotes.rating}), 0)`,
    })
    .from(wardrobeWarsVotes)
    .where(eq(wardrobeWarsVotes.entryId, entryId))
    .get();

  const voteCount = totals?.count ?? 0;
  const voteTotal = totals?.total ?? 0;
  const score = voteCount > 0 ? voteTotal / voteCount : 0;

  await db
    .update(wardrobeWarsEntries)
    .set({ voteCount, voteTotal, score })
    .where(eq(wardrobeWarsEntries.id, entryId));

  return { score, voteCount };
}

/* ------------------------------------------------------------------ *
 * Winners
 * ------------------------------------------------------------------ */

export async function getStoredWinner(
  periodType: number,
  periodKey: string,
): Promise<Winner | undefined> {
  return db
    .select()
    .from(wardrobeWarsWinners)
    .where(
      and(
        eq(wardrobeWarsWinners.periodType, periodType),
        eq(wardrobeWarsWinners.periodKey, periodKey),
      ),
    )
    .get();
}

export async function storeWinner(input: {
  periodType: number;
  periodKey: string;
  entryId: number | null;
  psnid: string;
  score: number;
}): Promise<Winner | undefined> {
  await db
    .insert(wardrobeWarsWinners)
    .values({ ...input, decidedAt: Date.now() })
    .onConflictDoNothing();
  return getStoredWinner(input.periodType, input.periodKey);
}

/**
 * Highest-scoring visible entry in a contest period.
 *
 * `column` selects which period key to group on, so the same query serves the
 * daily, weekly and monthly contests.
 */
export async function topEntryForPeriod(
  column: "day" | "week" | "month",
  periodKey: string,
  restrictToPsnIds?: string[],
): Promise<Entry | undefined> {
  const keyColumn =
    column === "day"
      ? wardrobeWarsEntries.dayKey
      : column === "week"
        ? wardrobeWarsEntries.weekKey
        : wardrobeWarsEntries.monthKey;

  const filters = [
    eq(keyColumn, periodKey),
    eq(wardrobeWarsEntries.hidden, 0),
    sql`${wardrobeWarsEntries.voteCount} >= ${wwConfig.minVotesToWin}`,
  ];

  if (restrictToPsnIds) {
    if (restrictToPsnIds.length === 0) return undefined;
    filters.push(
      sql`${wardrobeWarsEntries.psnid} IN (${sql.join(
        restrictToPsnIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
  }

  return db
    .select()
    .from(wardrobeWarsEntries)
    .where(and(...filters))
    .orderBy(
      desc(wardrobeWarsEntries.score),
      desc(wardrobeWarsEntries.voteCount),
      wardrobeWarsEntries.createdAt,
    )
    .limit(1)
    .get();
}

/**
 * The PSN IDs that won a lower-tier contest whose winning entry falls inside a
 * higher-tier period.
 *
 * This is how the game's escalation works: daily winners are the only entrants
 * eligible for that week's prize, and weekly winners the only ones eligible for
 * the month's. Matching on the *entry's* period key rather than the winner
 * row's key keeps a week that straddles two months in the right month.
 */
export async function winnerPsnIdsWithin(
  fromPeriodType: number,
  column: "week" | "month",
  periodKey: string,
): Promise<string[]> {
  const entryColumn =
    column === "week" ? wardrobeWarsEntries.weekKey : wardrobeWarsEntries.monthKey;

  const rows = await db
    .select({ psnid: wardrobeWarsWinners.psnid })
    .from(wardrobeWarsWinners)
    .innerJoin(
      wardrobeWarsEntries,
      eq(wardrobeWarsWinners.entryId, wardrobeWarsEntries.id),
    )
    .where(
      and(
        eq(wardrobeWarsWinners.periodType, fromPeriodType),
        eq(entryColumn, periodKey),
      ),
    )
    .all();

  return [...new Set(rows.map((r) => r.psnid))];
}

/**
 * Every contest day that has an entry inside `weekKey` (or week inside
 * `monthKey`), oldest first.
 *
 * Winners are decided lazily, the first time somebody asks about a closed
 * period. A day nobody was around to ask about is therefore a day nobody won,
 * which quietly drops that day's champion out of the week above. This is what
 * lets the ladder go back and settle those days first.
 */
export async function entryPeriodKeysWithin(
  column: "day" | "week",
  parentColumn: "week" | "month",
  parentKey: string,
): Promise<string[]> {
  const keyColumn =
    column === "day" ? wardrobeWarsEntries.dayKey : wardrobeWarsEntries.weekKey;
  const parentKeyColumn =
    parentColumn === "week"
      ? wardrobeWarsEntries.weekKey
      : wardrobeWarsEntries.monthKey;

  const rows = await db
    .selectDistinct({ key: keyColumn })
    .from(wardrobeWarsEntries)
    .where(eq(parentKeyColumn, parentKey))
    .all();

  return rows.map((r) => r.key).sort();
}

/**
 * The contest periods a player has actually competed in, oldest first.
 *
 * Only these can hold a prize for them, so a returning player can be paid out
 * without walking the whole contest history — which, with the 2012 archive
 * loaded, stretches back to 2013.
 */
export async function entryPeriodKeysForPlayer(psnid: string): Promise<{
  days: string[];
  weeks: string[];
  months: string[];
}> {
  const rows = await db
    .selectDistinct({
      day: wardrobeWarsEntries.dayKey,
      week: wardrobeWarsEntries.weekKey,
      month: wardrobeWarsEntries.monthKey,
    })
    .from(wardrobeWarsEntries)
    .where(eq(wardrobeWarsEntries.psnid, psnid))
    .all();

  const unique = (values: string[]) => [...new Set(values)].sort();
  return {
    days: unique(rows.map((r) => r.day)),
    weeks: unique(rows.map((r) => r.week)),
    months: unique(rows.map((r) => r.month)),
  };
}

/* ------------------------------------------------------------------ *
 * Rewards
 * ------------------------------------------------------------------ */

/**
 * Grant a prize once per player per period.
 *
 * Returns the object id when this call is the one that granted it, and
 * undefined when the player already had it — so a client that re-queries
 * rewards on every space entry is not handed the same ticket repeatedly.
 */
export async function grantRewardOnce(input: {
  psnid: string;
  rewardType: RewardType;
  periodKey: string;
  objectId: string;
}): Promise<string | undefined> {
  const inserted = await db
    .insert(wardrobeWarsRewards)
    .values({ ...input, grantedAt: Date.now() })
    .onConflictDoNothing()
    .returning()
    .get();
  return inserted ? input.objectId : undefined;
}
