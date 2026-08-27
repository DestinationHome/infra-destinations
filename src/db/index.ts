import Database from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const dbPath =
  process.env.DATABASE_URL?.replace("file:", "") || "data/destinations.db";
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

// Initialize publisher-agnostic Destinations tables
sqlite.run(`
  CREATE TABLE IF NOT EXISTS destinations_user_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    publisher_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    objectives TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS user_quests_pub_user_idx
    ON destinations_user_quests(publisher_id, username);
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS destinations_user_scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    space_id TEXT NOT NULL,
    spent_duration INTEGER NOT NULL DEFAULT 0,
    times_entered INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS user_scenes_user_space_idx
    ON destinations_user_scenes(username, space_id);
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS destinations_user_game (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    publisher_id INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    username TEXT NOT NULL,
    data TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS user_game_pub_game_user_idx
    ON destinations_user_game(publisher_id, game_id, username);
`);

// Wardrobe Wars (VEEMEE "Fashion Battle") tables
sqlite.run(`
  CREATE TABLE IF NOT EXISTS wardrobewars_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    psnid TEXT NOT NULL,
    territory TEXT,
    region TEXT,
    language TEXT,
    image_path TEXT NOT NULL,
    day_key TEXT NOT NULL,
    week_key TEXT NOT NULL,
    month_key TEXT NOT NULL,
    vote_count INTEGER NOT NULL DEFAULT 0,
    vote_total INTEGER NOT NULL DEFAULT 0,
    score REAL NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ww_entries_day_idx
    ON wardrobewars_entries(day_key);
  CREATE INDEX IF NOT EXISTS ww_entries_psnid_day_idx
    ON wardrobewars_entries(psnid, day_key);
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS wardrobewars_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    psnid TEXT NOT NULL,
    rating INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ww_votes_entry_psnid_idx
    ON wardrobewars_votes(entry_id, psnid);
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS wardrobewars_sessions (
    bracelet TEXT PRIMARY KEY,
    psnid TEXT NOT NULL,
    territory TEXT,
    region TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS wardrobewars_uploads (
    token TEXT PRIMARY KEY,
    psnid TEXT NOT NULL,
    territory TEXT,
    region TEXT,
    language TEXT,
    sha1 TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    consumed INTEGER NOT NULL DEFAULT 0
  );
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS wardrobewars_winners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_type INTEGER NOT NULL,
    period_key TEXT NOT NULL,
    entry_id INTEGER,
    psnid TEXT NOT NULL,
    score REAL NOT NULL,
    decided_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ww_winners_type_key_idx
    ON wardrobewars_winners(period_type, period_key);
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS wardrobewars_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    psnid TEXT NOT NULL,
    reward_type INTEGER NOT NULL,
    period_key TEXT NOT NULL,
    object_id TEXT NOT NULL,
    granted_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ww_rewards_psnid_type_period_idx
    ON wardrobewars_rewards(psnid, reward_type, period_key);
`);

export const db = drizzle(sqlite, { schema });
export * from "./schema";
