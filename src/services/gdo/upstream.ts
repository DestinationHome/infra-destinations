import { log } from "@main";
import type { UserGameRecord } from "./types";

const BASE_URL = (
  process.env.HEAVYWATER_BASE_URL || "http://www.services.heavyh2o.net"
).replace(/\/+$/, "");
const TIMEOUT_MS = Number(process.env.HEAVYWATER_TIMEOUT_MS) || 3000;
const LIST_CACHE_MS = Number(process.env.HEAVYWATER_CACHE_MS) || 15_000;

export interface RemoteUserRecord extends UserGameRecord {
  times?: Record<string, { time: number; splits?: number[] }>;
  parts?: Record<string, number>;
  objectives?: Record<string, number>;
  loadouts?: Record<string, string>;
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      log.warn(`[upstream] ${path} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    log.withError(err).warn(`[upstream] ${path} unreachable`);
    return null;
  }
}

export async function fetchUserRecord(
  username: string,
): Promise<RemoteUserRecord | null> {
  return get<RemoteUserRecord>(
    `/internal/rcrally/users/${encodeURIComponent(username)}`,
  );
}

interface LeaderboardRow {
  username: string;
  data: UserGameRecord;
}

let listCache: { at: number; rows: LeaderboardRow[] } | null = null;

export async function fetchAllUserRecords(): Promise<LeaderboardRow[]> {
  const now = Date.now();
  if (listCache && now - listCache.at < LIST_CACHE_MS) {
    return listCache.rows;
  }

  const body = await get<{
    users: { username: string; times?: UserGameRecord["times"] }[];
  }>("/internal/rcrally/users");

  if (!body?.users) {
    return listCache?.rows ?? [];
  }

  const rows = body.users.map((u) => ({
    username: u.username,
    data: { times: u.times ?? {} } as UserGameRecord,
  }));
  listCache = { at: now, rows };
  return rows;
}
