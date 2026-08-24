import { log } from "@main";
import type { Context, Hono } from "hono";
import { apiXml } from "@common/xml";
import { compressObjectives, compressParts } from "../bitcompressor";
import { RCR_PUBLISHER_ID } from "../quests";
import { getUserGameData, getUserObjectives } from "../store";

export function parseUserGameUrl(rawPath: string) {
  const parts = rawPath
    .replace(/^\/user\/game\/?/, "")
    .split("/")
    .filter(Boolean);

  let pubId = Number(RCR_PUBLISHER_ID); // default 12
  let gameId = "7"; // default 7
  let username = "user";

  if (parts.includes("publisher")) {
    const pIdx = parts.indexOf("publisher");
    if (pIdx !== -1 && parts[pIdx + 1] && !Number.isNaN(Number(parts[pIdx + 1]))) {
      pubId = Number(parts[pIdx + 1]);
    }
  }
  if (parts.includes("game")) {
    const gIdx = parts.indexOf("game");
    if (gIdx !== -1 && parts[gIdx + 1]) {
      gameId = parts[gIdx + 1];
    }
  }
  if (parts.includes("user")) {
    const uIdx = parts.indexOf("user");
    if (uIdx !== -1 && parts[uIdx + 1]) {
      username = parts[uIdx + 1];
    }
  }

  // Positional fallback if no explicit keywords:
  if (username === "user") {
    // Find the username string (non-numeric, not a keyword, not a locale like en-GR)
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (
        p &&
        Number.isNaN(Number(p)) &&
        p !== "publisher" &&
        p !== "game" &&
        p !== "user" &&
        !p.includes("-") &&
        !p.includes("_") // unless it's a username like tony_greek
      ) {
        username = p;
        break;
      }
      if (p && p.includes("_") && !p.startsWith("heavywater")) {
        username = p;
        break;
      }
    }

    const numericParts = parts.filter((p) => !Number.isNaN(Number(p)));
    if (numericParts.length >= 2) {
      if (numericParts.includes("12")) {
        pubId = 12;
        gameId = numericParts.find((p) => p !== "12") || "7";
      } else {
        pubId = Number(numericParts[0]);
        gameId = numericParts[1] || "7";
      }
    } else if (numericParts.length === 1) {
      gameId = numericParts[0];
      pubId = Number(RCR_PUBLISHER_ID);
    }
  }

  return { pubId, gameId, username };
}

export function gameRoutes(app: Hono) {
  const handle = async (c: Context) => {
    const { pubId, gameId, username: user } = parseUserGameUrl(c.req.path);

    const [gameRecord, objectives] = await Promise.all([
      getUserGameData(pubId, gameId, user),
      getUserObjectives(pubId, user),
    ]);

    const times = gameRecord.times || {};
    const t1 = times["1"]?.time ?? -1;
    const t2 = times["2"]?.time ?? -1;
    const t3 = times["3"]?.time ?? -1;

    const partsCompressed = compressParts(gameRecord.parts);
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
