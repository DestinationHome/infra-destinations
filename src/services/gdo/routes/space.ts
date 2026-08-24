import { apiXml } from "@common/xml";
import { log } from "@main";
import type { Context, Hono } from "hono";
import { RCR_ALL_QUESTS, RCR_PUBLISHER_ID } from "../quests";
import { getUserObjectives, getUserSceneStats } from "../store";

export function spaceRoutes(app: Hono) {
  const handle = async (c: Context) => {
    // Path format: /user/space/{space}/{locale}/{username}
    const rawPath = c.req.path.replace(/^\/user\/space\/?/, "");
    const parts = rawPath.split("/").filter(Boolean);
    const space = parts[0] || "heavywater_rcrally_game";
    const locale = parts[1] || "en_US";
    const user = parts[2] || parts[parts.length - 1] || "user";
    const publisherId = Number(RCR_PUBLISHER_ID);

    const [objectives, sceneStats] = await Promise.all([
      getUserObjectives(publisherId, user),
      getUserSceneStats(user, space),
    ]);

    const objKeys = Object.keys(objectives);

    // Full quest catalog for this space
    const questsNode = {
      quest: RCR_ALL_QUESTS.map((name, index) => ({
        "@_id": index + 1,
        attributes: { id: index + 1 },
        name,
        description: name,
        failure: "Failed",
        initial: 1,
        start: "2020.01.01 00:00:00",
        end: "2030.01.01 00:00:00",
        track: true,
        loyalty: false,
        start_conditions: { client: "", server: "" },
      })),
    };

    // Completed quests with restored task structure
    const completedQuests = objKeys.map((name, i) => {
      const idx = RCR_ALL_QUESTS.indexOf(
        name as (typeof RCR_ALL_QUESTS)[number],
      );
      const id = idx !== -1 ? idx + 1 : i + 1;
      return {
        "@_id": id,
        attributes: { id },
        status: "completed",
        shared: false,
        group: 1,
        tasks: {
          task: {
            "@_id": 1,
            attributes: { id: 1 },
            status: "c",
          },
        },
      };
    });

    const publisherQuestsNode = {
      publisher_quest: {
        np_online_id: user,
        publisher_id: publisherId,
        tasks_completed: completedQuests.length,
        quests_started: 0,
        quests_completed: completedQuests.length,
        quests_failed: 0,
        quests_quit: 0,
        quests: completedQuests.length > 0 ? { quest: completedQuests } : "",
      },
    };

    log.info(
      `[GDO] user/space space=${space} locale=${locale} user=${user} completed=${objKeys.length}`,
    );

    return apiXml(c, {
      root: {
        status: "success",
        publishers: {
          publisher: {
            "@_id": publisherId,
            attributes: { id: publisherId },
            groups: "",
            quests: questsNode,
          },
        },
        documents: {
          user: {
            np_online_id: user,
            create_timestamp: "2020.01.01 00:00:00",
            locale,
            spent_duration: sceneStats.spentDuration,
            scenes: {
              scene: {
                "@_id": space,
                attributes: { id: space },
                spent_duration: sceneStats.spentDuration,
                times_entered: sceneStats.timesEntered,
              },
            },
          },
          publisher_quests: publisherQuestsNode,
        },
      },
    });
  };

  app.get("/user/space/*", handle);
}
