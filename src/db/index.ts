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

export const db = drizzle(sqlite, { schema });
export * from "./schema";
