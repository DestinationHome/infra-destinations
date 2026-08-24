import { apiXml } from "@common/xml";
import { log } from "@main";
import type { Context, Hono } from "hono";
import { RCR_PUBLISHER_ID } from "../quests";
import {
  getUserObjectives,
  saveUserGameData,
  saveUserObjectives,
  saveUserSceneStats,
} from "../store";

export function syncRoutes(app: Hono) {
  const handle = async (c: Context) => {
    // Path format: /user/sync/{region}/{username}/
    const rawPath = c.req.path.replace(/^\/user\/sync\/?/, "");
    const parts = rawPath.split("/").filter(Boolean);
    const user = parts[1] || parts[0] || "user";
    const pubId = Number(RCR_PUBLISHER_ID);

    if (c.req.method === "POST") {
      try {
        let syncJsonStr = "";
        const contentType = c.req.header("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
          const form = await c.req.formData();
          const syncVal = form.get("sync");
          if (typeof syncVal === "string") {
            syncJsonStr = syncVal;
          }
        } else {
          syncJsonStr = await c.req.text();
        }

        if (syncJsonStr?.trim().startsWith("{")) {
          const syncData = JSON.parse(syncJsonStr);
          log.info(`[GDO SYNC] Processing CDM sync payload for user: ${user}`);

          // 1. Process scene stats
          if (syncData.user) {
            const u = syncData.user;
            if (u.scenes && typeof u.scenes === "object") {
              for (const [spaceId, sData] of Object.entries(u.scenes)) {
                const s = sData as {
                  spent_duration?: number;
                  times_entered?: number;
                };
                await saveUserSceneStats(
                  user,
                  spaceId,
                  s.spent_duration ?? 0,
                  s.times_entered ?? 1,
                );
              }
            }
          }

          // 2. Process quest objectives
          if (syncData.quests && Array.isArray(syncData.quests)) {
            const existingObjectives = await getUserObjectives(pubId, user);
            for (const q of syncData.quests) {
              const _qPubId = Number(q.publisher_id || pubId);
              if (q.name || q.quest_name) {
                const key = String(q.name || q.quest_name);
                existingObjectives[key] = (existingObjectives[key] || 0) + 1;
              }
            }
            await saveUserObjectives(pubId, user, existingObjectives);
          }

          // 3. Process game telemetry
          if (syncData.game || syncData.games) {
            const games = syncData.games || [syncData.game];
            for (const g of games) {
              if (g && typeof g === "object") {
                const gId = String(g.game_id || g.id || "7");
                await saveUserGameData(pubId, gId, user, g);
              }
            }
          }
        }
      } catch (err) {
        log
          .withError(err)
          .warn(`[GDO SYNC] Error parsing sync payload for ${user}`);
      }
    }

    log.info(`[GDO] user/sync ${c.req.method} user=${user}`);
    return apiXml(c, { root: { status: "success" } });
  };

  app.get("/user/sync/*", handle);
  app.post("/user/sync/*", handle);
}
