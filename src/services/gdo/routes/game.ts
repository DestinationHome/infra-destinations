import { log } from "@main";
import type { Context, Hono } from "hono";
import { apiXml } from "@common/xml";
import { compressObjectives, compressParts } from "../bitcompressor";
import { RCR_PUBLISHER_ID } from "../quests";
import { getUserGameData, getUserObjectives } from "../store";

export function gameRoutes(app: Hono) {
  const handle = async (c: Context) => {
    // /user/game/publisher/{pubId}/game/{gameId}/user/{user}
    const rawPath = c.req.path.replace(/^\/user\/game\/?/, "");
    const parts = rawPath.split("/").filter(Boolean);
    const pubId = Number(parts[1] || RCR_PUBLISHER_ID);
    const game = parts[3] || "7";
    const user = parts[5] || parts[parts.length - 1] || "user";

    const [gameRecord, objectives] = await Promise.all([
      getUserGameData(pubId, game, user),
      getUserObjectives(pubId, user),
    ]);

    const times = gameRecord.times || {};
    const t1 = times["1"]?.time ?? -1;
    const t2 = times["2"]?.time ?? -1;
    const t3 = times["3"]?.time ?? -1;

    const partsCompressed = compressParts(gameRecord.parts);
    const objectivesCompressed = compressObjectives(objectives);

    log.info(
      `[GDO] user/game pub=${pubId} game=${game} user=${user} tracks=[${t1}, ${t2}, ${t3}]`,
    );

    return apiXml(c, {
      root: {
        status: "success",
        publisher_game: {
          publisher_id: pubId,
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
              Loadout1: (gameRecord.loadouts as any)?.["1"] || "AAAAAAAA",
              Loadout2: (gameRecord.loadouts as any)?.["2"] || "AAAAAAAA",
              Loadout3: (gameRecord.loadouts as any)?.["3"] || "AAAAAAAA",
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
