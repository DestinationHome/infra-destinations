import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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
    uniqueIndex("user_scenes_user_space_idx").on(table.username, table.spaceId),
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

/**
 * Wardrobe Wars — a submitted avatar photo entered into a daily contest.
 */
export const wardrobeWarsEntries = sqliteTable(
  "wardrobewars_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    psnid: text("psnid").notNull(),
    territory: text("territory"),
    region: text("region"),
    language: text("language"),
    /** Path under the photo blob root, e.g. `2026-08-25/JuliusJoker-14-23-59.dds`. */
    imagePath: text("image_path").notNull(),
    /** Contest period keys, in the contest timezone. */
    dayKey: text("day_key").notNull(),
    weekKey: text("week_key").notNull(),
    monthKey: text("month_key").notNull(),
    voteCount: integer("vote_count").notNull().default(0),
    voteTotal: integer("vote_total").notNull().default(0),
    score: real("score").notNull().default(0),
    /** 1 for entries imported from the 2012 CDN archive rather than submitted live. */
    archived: integer("archived").notNull().default(0),
    /** 1 to hide from podiums without deleting (moderation). */
    hidden: integer("hidden").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("ww_entries_day_idx").on(table.dayKey),
    index("ww_entries_psnid_day_idx").on(table.psnid, table.dayKey),
  ],
);

/**
 * Wardrobe Wars — one 1-10 rating per player per entry.
 */
export const wardrobeWarsVotes = sqliteTable(
  "wardrobewars_votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryId: integer("entry_id").notNull(),
    psnid: text("psnid").notNull(),
    rating: integer("rating").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("ww_votes_entry_psnid_idx").on(table.entryId, table.psnid)],
);

/**
 * Wardrobe Wars — a "bracelet" session handed out by verify.php.
 */
export const wardrobeWarsSessions = sqliteTable("wardrobewars_sessions", {
  bracelet: text("bracelet").primaryKey(),
  psnid: text("psnid").notNull(),
  territory: text("territory"),
  region: text("region"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

/**
 * Wardrobe Wars — a pending two-step photo upload, opened by photo-p1 and
 * consumed by photo-p2.
 */
export const wardrobeWarsUploads = sqliteTable("wardrobewars_uploads", {
  token: text("token").primaryKey(),
  psnid: text("psnid").notNull(),
  territory: text("territory"),
  region: text("region"),
  language: text("language"),
  /** Client-computed SHA-1 of the screenshot, as sent in `secureme`. */
  sha1: text("sha1"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  consumed: integer("consumed").notNull().default(0),
});

/**
 * Wardrobe Wars — the decided winner of a closed contest period. Snapshotted so
 * that late votes on old entries cannot rewrite history.
 */
export const wardrobeWarsWinners = sqliteTable(
  "wardrobewars_winners",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** 1 daily, 2 weekly, 3 monthly — matches WWScreenWinnerLookup. */
    periodType: integer("period_type").notNull(),
    periodKey: text("period_key").notNull(),
    entryId: integer("entry_id"),
    psnid: text("psnid").notNull(),
    score: real("score").notNull(),
    decidedAt: integer("decided_at").notNull(),
  },
  (table) => [
    uniqueIndex("ww_winners_type_key_idx").on(table.periodType, table.periodKey),
  ],
);

/**
 * Wardrobe Wars — a prize object already granted to a player, so each prize is
 * handed out at most once per player per contest period.
 */
export const wardrobeWarsRewards = sqliteTable(
  "wardrobewars_rewards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    psnid: text("psnid").notNull(),
    /** 1 participant, 2 daily win, 3 weekly win, 4 monthly win. */
    rewardType: integer("reward_type").notNull(),
    periodKey: text("period_key").notNull(),
    objectId: text("object_id").notNull(),
    grantedAt: integer("granted_at").notNull(),
  },
  (table) => [
    uniqueIndex("ww_rewards_psnid_type_period_idx").on(
      table.psnid,
      table.rewardType,
      table.periodKey,
    ),
  ],
);
