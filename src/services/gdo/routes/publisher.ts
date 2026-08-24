import { log } from "@main";
import type { Context, Hono } from "hono";
import { apiXml } from "@common/xml";
import { RCR_PUBLISHER_ID, RCR_PUBLISHER_TOKEN } from "../quests";

export function publisherRoutes(app: Hono) {
  const handle = (c: Context) => {
    log.info("[GDO] publisher/list requested");
    return apiXml(c, {
      root: {
        status: "success",
        publishers: {
          publisher: {
            "@_id": RCR_PUBLISHER_ID,
            name: "RC Rally",
            token: RCR_PUBLISHER_TOKEN,
          },
        },
      },
    });
  };

  app.get("/publisher/*", handle);
}
