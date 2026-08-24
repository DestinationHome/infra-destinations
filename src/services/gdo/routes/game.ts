import { log } from "@main";
import type { Context, Hono } from "hono";
import { apiXml } from "@common/xml";
import { compressObjectives, compressParts } from "../bitcompressor";
import { getUserData } from "../store";
import type { RcRallyUserData } from "../types";

function bestTimeMs(u: RcRallyUserData | undefined, track: string): number {
  if (!u?.times) return -1;
  for (const k of [track, `track${track}`, `Track${track}`]) {
    const t = u.times[k];
    if (t && t.time > 0) return t.time;
  }
  return -1;
}

export function gameRoutes(app: Hono) {
  const handle = async (c: Context) => {
    const rawPath = c.req.path.replace(/^\/user\/game\/?/, "");
    const parts = rawPath.split("/").filter(Boolean);
    const game = parts[1] || "7";
    const user = parts[3] || parts[parts.length - 1] || "user";

    const u = await getUserData(user);
    const t1 = bestTimeMs(u, "1");
    const t2 = bestTimeMs(u, "2");
    const t3 = bestTimeMs(u, "3");

    const partsCompressed = compressParts(u.parts);
    const objectivesCompressed = compressObjectives(u.objectives);

    log.info(
      `[GDO] user/game user=${user} tracks=[${t1}, ${t2}, ${t3}] parts=${partsCompressed} objectives=${objectivesCompressed}`,
    );

    return apiXml(c, {
      root: {
        status: "success",
        publisher_game: {
          publisher_id: 12,
          games: {
            game: {
              "@_id": game,
              name: user,
              first_played_timestamp: "",
              last_played_timestamp: "",
              last_played_duration: 0,
              games_played: 0,
              total_played_duration: 0,
              Track1_Times: t1,
              Track2_Times: t2,
              Track3_Times: t3,
              Loadout1: "AAAAAAAA",
              Loadout2: "AAAAAAAA",
              Loadout3: "AAAAAAAA",
              Parts: partsCompressed,
              Objectives: objectivesCompressed,
              Total_Time: 0,
            },
          },
        },
      },
    });
  };

  app.get("/user/game/*", handle);
}
