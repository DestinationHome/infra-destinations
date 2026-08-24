import type { Hono } from "hono";
import type { Service } from "../service";
import { gameRoutes } from "./routes/game";
import { groupRoutes } from "./routes/group";
import { leaderboardRoutes } from "./routes/leaderboard";
import { publisherRoutes } from "./routes/publisher";
import { spaceRoutes } from "./routes/space";
import { syncRoutes } from "./routes/sync";

export class GdoService implements Service {
  name = "GdoService";
  description =
    "Sony Destinations GDO platform — publisher/quest/event/sync endpoints";

  registerRoutes(app: Hono): void {
    publisherRoutes(app);
    gameRoutes(app);
    spaceRoutes(app);
    groupRoutes(app);
    syncRoutes(app);
    leaderboardRoutes(app);
  }
}
