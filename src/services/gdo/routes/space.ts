import { log } from "@main";
import type { Context, Hono } from "hono";
import { apiXml } from "@common/xml";
import { RCR_ALL_QUESTS, RCR_PUBLISHER_ID } from "../quests";
import { getUserData } from "../store";

export function spaceRoutes(app: Hono) {
  const handle = async (c: Context) => {
    // Path: /user/space/{space}/{locale}/{username}
    const rawPath = c.req.path.replace(/^\/user\/space\/?/, "");
    const parts = rawPath.split("/").filter(Boolean);
    const space = parts[0] || "heavywater_rcrally_game";
    const locale = parts[1] || "en_US";
    const user = parts[2] || parts[parts.length - 1] || "user";

    const u = await getUserData(user);
    const objKeys = Object.keys(u.objectives || {});

    // All available quests for this publisher
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

    // Completed quests.
    // FIX: Previously `tasks: ""` (empty string) caused the QuestManager Lua
    // ProcessUserSpaceData() to find no completed task nodes, so all quests
    // appeared unstarted on every login despite being stored in the DB.
    // Each RC Rally quest has exactly one task (id=1); emitting a proper
    // <tasks><task id="1"><status>c</status></task></tasks> node restores
    // the task-completion state correctly.
    const completedQuests = objKeys.map((name, i) => {
      const idx = RCR_ALL_QUESTS.indexOf(name as (typeof RCR_ALL_QUESTS)[number]);
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
        publisher_id: Number(RCR_PUBLISHER_ID),
        tasks_completed: completedQuests.length,
        quests_started: 0,
        quests_completed: completedQuests.length,
        quests_failed: 0,
        quests_quit: 0,
        quests:
          completedQuests.length > 0 ? { quest: completedQuests } : "",
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
            "@_id": Number(RCR_PUBLISHER_ID),
            attributes: { id: Number(RCR_PUBLISHER_ID) },
            groups: "",
            quests: questsNode,
          },
        },
        documents: {
          user: {
            np_online_id: user,
            create_timestamp: "2020.01.01 00:00:00",
            locale,
            spent_duration: 0,
            scenes: {
              scene: {
                "@_id": space,
                attributes: { id: space },
                spent_duration: 0,
                times_entered: 0,
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
