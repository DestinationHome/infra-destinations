import Database from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const dbPath =
  process.env.DATABASE_URL?.replace("file:", "") || "data/destinations.db";
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

// Ensure the rcrally_users table exists (created by game-heavywater, but we
// create it here too so infra-destinations can run standalone if needed).
sqlite.run(`
  CREATE TABLE IF NOT EXISTS rcrally_users (
    username TEXT PRIMARY KEY,
    times TEXT,
    parts TEXT,
    objectives TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

export const db = drizzle(sqlite, { schema });
export * from "./schema";
