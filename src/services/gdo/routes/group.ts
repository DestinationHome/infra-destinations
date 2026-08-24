import { apiXml } from "@common/xml";
import { log } from "@main";
import type { Context, Hono } from "hono";
import { RCR_ALL_QUESTS } from "../quests";

export function groupRoutes(app: Hono) {
  const handle = (c: Context) => {
    const rawPath = c.req.path.replace(/^\/user\/group\/?/, "");
    const parts = rawPath.split("/").filter(Boolean);
    const groupIdStr = parts[0] || "1";
    const groupId = parseInt(groupIdStr, 10) || 1;
    const locale = parts[1] || "en-US";
    const user = parts[2] || "user";

    const questName = RCR_ALL_QUESTS[groupId - 1] || `Quest_${groupId}`;

    log.info(
      `[GDO] user/group path=${c.req.path} groupId=${groupId} locale=${locale} user=${user}`,
    );

    return apiXml(c, {
      root: {
        status: "success",
        group: {
          "@_id": groupId,
          attributes: {
            id: groupId,
          },
          name: questName,
          description: questName,
          quest: {
            "@_id": groupId,
            attributes: {
              id: groupId,
            },
          },
          initial: true,
          tasks: {
            task: [
              {
                "@_id": 1,
                attributes: {
                  id: 1,
                },
                name: questName,
                description: questName,
                space: "destinations_indie",
                conditions: {
                  client: "",
                  server: "",
                },
                effects: "",
              },
              {
                "@_id": 1,
                attributes: {
                  id: 1,
                },
                name: questName,
                description: questName,
                space: "heavywater_rcrally_game",
                conditions: {
                  client: "",
                  server: "",
                },
                effects: "",
              },
            ],
          },
          exitBlocks: {
            exitBlock: {
              "@_id": 1,
              attributes: {
                id: 1,
              },
              name: "Exit 1",
              description: "Exit 1",
              exitLogic: "1",
              end: true,
              next: 0,
              position: 0,
              effects: "",
            },
          },
        },
      },
    });
  };

  app.get("/user/group/*", handle);
}
