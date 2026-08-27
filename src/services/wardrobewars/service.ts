import { log } from "@main";
import type { Handler, Hono } from "hono";
import type { Service } from "../service";
import { imageHandler } from "./routes/images";
import {
  photoPart1Handler,
  photoPart2Handler,
  photoSingleHandler,
} from "./routes/photo";
import { podiumHandler } from "./routes/podium";
import { rewardHandler } from "./routes/reward";
import { screenHandler } from "./routes/screen";
import { scoreHandler } from "./routes/score";
import { verifyHandler } from "./routes/verify";
import { voteHandler } from "./routes/vote";
import { seedArchiveIfEmpty } from "./seed";

/**
 * Wardrobe Wars — VEEMEE's avatar fashion contest, known internally as
 * "Fashion Battle", played at the kiosk in the SCEA Marketplace.
 *
 * The minigame object (`528F6F64-A3684D21-9DAA4666-1CEB41DA`) talks to
 * `ww-prod.destinations.scea.com` over plain HTTP and
 * `ww-prod-sec.destinations.scea.com` over HTTPS — both siblings of the
 * `destinations.scea.com` host this service already answers for. The endpoint
 * names are the retail PHP ones because they are hard-coded in the shipped Lua
 * and cannot be renamed without repacking the object.
 *
 * ## Registering both slash spellings
 *
 * The client builds some URLs as `serverURL .. "/WardrobeWars/..."` while
 * `serverURL` already ends in a slash, so those requests arrive with a doubled
 * leading slash. Hono treats `//WardrobeWars/x` and `/WardrobeWars/x` as
 * different routes, so every path is registered twice.
 */
export class WardrobeWarsService implements Service {
  name = "WardrobeWarsService";
  description =
    "Wardrobe Wars (VEEMEE Fashion Battle) — entries, voting, screens and prizes";

  registerRoutes(app: Hono): void {
    // Both spellings of every path; see the class doc comment.
    const post = (path: string, handler: Handler) => {
      app.post(`/WardrobeWars/${path}`, handler);
      app.post(`//WardrobeWars/${path}`, handler);
    };
    const getOrHead = (path: string, handler: Handler) => {
      app.on(["GET", "HEAD"], `/WardrobeWars/${path}`, handler);
      app.on(["GET", "HEAD"], `//WardrobeWars/${path}`, handler);
    };

    post("verify.php", verifyHandler);
    post("podium.php", podiumHandler);
    post("podium_vote.php", voteHandler);
    post("podium_score.php", scoreHandler);
    post("screen.php", screenHandler);
    post("reward.php", rewardHandler);
    post("photo-p1.php", photoPart1Handler);
    post("photo-p2.php", photoPart2Handler);
    post("photo.php", photoSingleHandler);

    // Entry photos and prize tiles both live under Images/, as on the CDN.
    getOrHead("Images/*", imageHandler);

    // Fire-and-forget: an unusable archive or an unwritable data volume must
    // not stop the service booting, and nothing else here depends on the
    // import having finished. Caught explicitly so a failure is a log line
    // rather than an unhandled rejection.
    seedArchiveIfEmpty().catch((error) => {
      log.warn(`[WW] archive seed failed: ${String(error)}`);
    });
  }
}
