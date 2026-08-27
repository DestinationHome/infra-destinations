import { apiXml } from "@common/xml";
import { log } from "@main";
import type { Context, Hono } from "hono";
import { compressObjectives, compressParts } from "../bitcompressor";
import { RCR_PUBLISHER_ID } from "../quests";
import { getUserGameData, getUserObjectives } from "../store";
import { fetchUserRecord } from "../upstream";

export function parseUserGameUrl(rawPath: string) {
  const parts = rawPath
    .replace(/^\/user\/game\/?/, "")
    .split("/")
    .filter(Boolean);

  let pubId = Number(RCR_PUBLISHER_ID); // default 12
  let gameId = "7"; // default 7
  let username = "";

  const after = (key: string): string | undefined => {
    const i = parts.indexOf(key);
    return i === -1 ? undefined : parts[i + 1];
  };
  const kwPub = after("publisher");
  const kwGame = after("game");
  const kwUser = after("user");
  if (kwPub && !Number.isNaN(Number(kwPub))) pubId = Number(kwPub);
  if (kwGame) gameId = kwGame;
  if (kwUser) username = kwUser;

  if (!username && parts.length >= 4) {
    if (parts[0] && !Number.isNaN(Number(parts[0]))) pubId = Number(parts[0]);
    if (parts[1]) gameId = parts[1];
    username = parts[3] ?? "";
  }

  return { pubId, gameId, username: username || "user" };
}

export function gameRoutes(app: Hono) {
  const handle = async (c: Context) => {
    const { pubId, gameId, username: user } = parseUserGameUrl(c.req.path);

    const [remote, localGame, localObjectives] = await Promise.all([
      fetchUserRecord(user),
      getUserGameData(pubId, gameId, user),
      getUserObjectives(pubId, user),
    ]);

    const times = remote?.times ?? localGame.times ?? {};
    const parts = remote?.parts ?? localGame.parts;
    const objectives = remote?.objectives ?? localObjectives;
    const loadouts = remote?.loadouts ?? localGame.loadouts;

    const t1 = times["1"]?.time ?? -1;
    const t2 = times["2"]?.time ?? -1;
    const t3 = times["3"]?.time ?? -1;

    const partsCompressed = compressParts(parts);
    const objectivesCompressed = compressObjectives(objectives);

    log.info(
      `[GDO] user/game rawPath=${c.req.path} pub=${pubId} game=${gameId} user=${user} tracks=[${t1}, ${t2}, ${t3}] parts=${partsCompressed} objectives=${objectivesCompressed}`,
    );

    return apiXml(c, {
      root: {
        status: "success",
        publisher_game: {
          publisher_id: pubId,
          games: {
            game: {
              "@_id": gameId,
              name: user,
              first_played_timestamp: "",
              last_played_timestamp: "",
              last_played_duration: 0,
              games_played: 0,
              total_played_duration: 0,
              Track1_Times: t1,
              Track2_Times: t2,
              Track3_Times: t3,
              Loadout1: loadouts?.["1"] || "AAAAAAAA",
              Loadout2: loadouts?.["2"] || "AAAAAAAA",
              Loadout3: loadouts?.["3"] || "AAAAAAAA",
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
