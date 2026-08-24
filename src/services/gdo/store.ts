import {
  db,
  destinationsUserGame,
  destinationsUserQuests,
  destinationsUserScenes,
} from "@db";
import { and, eq } from "drizzle-orm";
import type { UserGameRecord, UserSceneStats } from "./types";

/**
 * Get a user's completed objectives for a specific publisher.
 */
export async function getUserObjectives(
  publisherId: number,
  username: string,
): Promise<Record<string, number>> {
  const record = await db
    .select()
    .from(destinationsUserQuests)
    .where(
      and(
        eq(destinationsUserQuests.publisherId, publisherId),
        eq(destinationsUserQuests.username, username),
      ),
    )
    .get();

  if (!record?.objectives) return {};
  return typeof record.objectives === "string"
    ? JSON.parse(record.objectives)
    : record.objectives;
}

/**
 * Save/update a user's completed objectives for a specific publisher.
 */
export async function saveUserObjectives(
  publisherId: number,
  username: string,
  objectives: Record<string, number>,
): Promise<void> {
  const now = Date.now();
  await db
    .insert(destinationsUserQuests)
    .values({
      publisherId,
      username,
      objectives,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        destinationsUserQuests.publisherId,
        destinationsUserQuests.username,
      ],
      set: {
        objectives,
        updatedAt: now,
      },
    });
}

/**
 * Get scene stats (duration, visited times) for a user in a specific space.
 */
export async function getUserSceneStats(
  username: string,
  spaceId: string,
): Promise<UserSceneStats> {
  const record = await db
    .select()
    .from(destinationsUserScenes)
    .where(
      and(
        eq(destinationsUserScenes.username, username),
        eq(destinationsUserScenes.spaceId, spaceId),
      ),
    )
    .get();

  if (record) {
    return {
      spentDuration: record.spentDuration,
      timesEntered: record.timesEntered,
    };
  }

  return {
    spentDuration: 0,
    timesEntered: 1,
  };
}

/**
 * Record or update scene statistics.
 */
export async function saveUserSceneStats(
  username: string,
  spaceId: string,
  spentDuration: number,
  timesEntered: number,
): Promise<void> {
  const now = Date.now();
  await db
    .insert(destinationsUserScenes)
    .values({
      username,
      spaceId,
      spentDuration,
      timesEntered,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [destinationsUserScenes.username, destinationsUserScenes.spaceId],
      set: {
        spentDuration,
        timesEntered,
        updatedAt: now,
      },
    });
}

/**
 * Get user game telemetry (times, loadouts, parts) for a specific publisher & game.
 */
export async function getUserGameData(
  publisherId: number,
  gameId: string,
  username: string,
): Promise<UserGameRecord> {
  const record = await db
    .select()
    .from(destinationsUserGame)
    .where(
      and(
        eq(destinationsUserGame.publisherId, publisherId),
        eq(destinationsUserGame.gameId, gameId),
        eq(destinationsUserGame.username, username),
      ),
    )
    .get();

  if (!record?.data) return {};
  return typeof record.data === "string"
    ? JSON.parse(record.data)
    : (record.data as UserGameRecord);
}

/**
 * Save user game telemetry.
 */
export async function saveUserGameData(
  publisherId: number,
  gameId: string,
  username: string,
  data: UserGameRecord,
): Promise<void> {
  const now = Date.now();
  await db
    .insert(destinationsUserGame)
    .values({
      publisherId,
      gameId,
      username,
      data,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        destinationsUserGame.publisherId,
        destinationsUserGame.gameId,
        destinationsUserGame.username,
      ],
      set: {
        data,
        updatedAt: now,
      },
    });
}

/**
 * Get all game records for a publisher & game to construct leaderboards.
 */
export async function getAllGameRecords(
  publisherId: number,
  gameId: string,
): Promise<{ username: string; data: UserGameRecord }[]> {
  const rows = await db
    .select({
      username: destinationsUserGame.username,
      data: destinationsUserGame.data,
    })
    .from(destinationsUserGame)
    .where(
      and(
        eq(destinationsUserGame.publisherId, publisherId),
        eq(destinationsUserGame.gameId, gameId),
      ),
    )
    .all();

  return rows.map((r) => ({
    username: r.username,
    data:
      typeof r.data === "string"
        ? JSON.parse(r.data)
        : (r.data as UserGameRecord) || {},
  }));
}
