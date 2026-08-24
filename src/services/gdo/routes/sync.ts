import { log } from "@main";
import type { Context, Hono } from "hono";
import { apiXml } from "@common/xml";

export function syncRoutes(app: Hono) {
  const handle = async (c: Context) => {
    log.info(`[GDO] user/sync ${c.req.method} ${c.req.path}`);
    return apiXml(c, { root: { status: "success" } });
  };

  app.get("/user/sync/*", handle);
  app.post("/user/sync/*", handle);
}
