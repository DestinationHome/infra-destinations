import { db, rcrallyUsers } from "@db";
import { eq } from "drizzle-orm";
import type { RcRallyUserData } from "./types";

export async function getUserData(username: string): Promise<RcRallyUserData> {
  const record = await db
    .select()
    .from(rcrallyUsers)
    .where(eq(rcrallyUsers.username, username))
    .get();

  if (record) {
    return {
      times: record.times ? (typeof record.times === "string" ? JSON.parse(record.times) : record.times) : {},
      parts: record.parts ? (typeof record.parts === "string" ? JSON.parse(record.parts) : record.parts) : {},
      objectives: record.objectives ? (typeof record.objectives === "string" ? JSON.parse(record.objectives) : record.objectives) : {},
    };
  }

  return {
    times: {},
    parts: {},
    objectives: {},
  };
}

export async function getAllUsers(): Promise<Record<string, RcRallyUserData>> {
  const records = await db.select().from(rcrallyUsers).all();
  const result: Record<string, RcRallyUserData> = {};

  for (const record of records) {
    result[record.username] = {
      times: record.times ? (typeof record.times === "string" ? JSON.parse(record.times) : record.times) : {},
      parts: record.parts ? (typeof record.parts === "string" ? JSON.parse(record.parts) : record.parts) : {},
      objectives: record.objectives ? (typeof record.objectives === "string" ? JSON.parse(record.objectives) : record.objectives) : {},
    };
  }

  return result;
}
