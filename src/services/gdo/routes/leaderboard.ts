import { log } from "@main";
import type { Context, Hono } from "hono";
import { apiXml } from "@common/xml";
import { RCR_PUBLISHER_ID } from "../quests";
import { getAllGameRecords } from "../store";

export function leaderboardRoutes(app: Hono) {
  const handle = async (c: Context) => {
    // /leaderboard/game/{gameId}/{period}/...
    const rawPath = c.req.path.replace(/^\/leaderboard\/?/, "");
    const parts = rawPath.split("/").filter(Boolean);
    const pubId = Number(RCR_PUBLISHER_ID);
    const gameId = parts[1] || "12";
    const period = parts[2] || "allTime";

    const records = await getAllGameRecords(pubId, gameId);

    const rows: { player: string; value: number }[] = [];
    for (const r of records) {
      let best = Infinity;
      for (const k of Object.keys(r.data.times ?? {})) {
        const t = r.data.times?.[k]?.time;
        if (typeof t === "number" && t > 0 && t < best) {
          best = t;
        }
      }
      if (best < Infinity) {
        rows.push({ player: r.username, value: best / 1000 });
      }
    }
    rows.sort((a, b) => a.value - b.value);

    log.info(`[GDO] leaderboard game=${gameId} rows=${rows.length}`);

    return apiXml(c, {
      destinations: {
        leaderBoard: {
          game: "RC Rally",
          type: period,
          field: "time",
          sort: "ascending",
          scores: {
            score: rows.map((row) => ({
              player: row.player,
              value: row.value.toFixed(3),
              date: "2026-01-01 00:00:00",
            })),
          },
        },
      },
    });
  };

  app.get("/leaderboard/*", handle);
}
