import { log } from "@main";
import type { Context, Hono } from "hono";
import { apiXml } from "@common/xml";
import { getAllUsers } from "../store";

export function leaderboardRoutes(app: Hono) {
  const handle = async (c: Context) => {
    const rawPath = c.req.path.replace(/^\/leaderboard\/?/, "");
    const parts = rawPath.split("/").filter(Boolean);
    const period = parts[2] || "allTime";
    const allUsers = await getAllUsers();

    const rows: { player: string; value: number }[] = [];
    for (const [player, u] of Object.entries(allUsers)) {
      let best = Infinity;
      for (const k of Object.keys(u.times ?? {})) {
        const t = u.times[k]?.time;
        if (typeof t === "number" && t > 0 && t < best) {
          best = t;
        }
      }
      if (best < Infinity) {
        rows.push({ player, value: best / 1000 });
      }
    }
    rows.sort((a, b) => a.value - b.value);

    log.info(`[GDO] leaderboard rows=${rows.length}`);

    return apiXml(c, {
      destinations: {
        leaderBoard: {
          game: "RC Rally",
          type: period,
          field: "time",
          sort: "ascending",
          scores: {
            score: rows.map((r) => ({
              player: r.player,
              value: r.value.toFixed(3),
              date: "2026-01-01 00:00:00",
            })),
          },
        },
      },
    });
  };

  app.get("/leaderboard/*", handle);
}
