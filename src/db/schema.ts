import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Player Quest & Objective progress per publisher.
 */
export const destinationsUserQuests = sqliteTable(
  "destinations_user_quests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publisherId: integer("publisher_id").notNull(),
    username: text("username").notNull(),
    objectives: text("objectives", { mode: "json" }).$type<
      Record<string, number>
    >(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("user_quests_pub_user_idx").on(
      table.publisherId,
      table.username,
    ),
  ],
);

/**
 * Player scene stats (times entered, duration spent) for CDM stats tracking.
 */
export const destinationsUserScenes = sqliteTable(
  "destinations_user_scenes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    spaceId: text("space_id").notNull(),
    spentDuration: integer("spent_duration").notNull().default(0),
    timesEntered: integer("times_entered").notNull().default(1),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("user_scenes_user_space_idx").on(
      table.username,
      table.spaceId,
    ),
  ],
);

/**
 * Arbitrary publisher game data (times, splits, loadouts, parts) per user.
 */
export const destinationsUserGame = sqliteTable(
  "destinations_user_game",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publisherId: integer("publisher_id").notNull(),
    gameId: text("game_id").notNull(),
    username: text("username").notNull(),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("user_game_pub_game_user_idx").on(
      table.publisherId,
      table.gameId,
      table.username,
    ),
  ],
);
