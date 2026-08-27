import { log } from "@main";
import type { Context } from "hono";
import { wwConfig } from "../config";
import { parseClientBody } from "../form";
import { createSession, pruneExpired } from "../store";
import { csv, identityFrom } from "./common";

/**
 * `POST /WardrobeWars/verify.php` — the gate everything else waits behind.
 *
 * `WWGame:ProcessAuthentication` requires field 1 to be exactly `1`; anything
 * else and `authenticated` stays false forever, which leaves the kiosk
 * un-targetable, the podiums silent and the big screens on the placeholder
 * crest. This is the single endpoint whose absence made the minigame look
 * completely dead.
 *
 * Response: `1,<bracelet>,<podiumRefresh>,<screenDisplay>,<kioskScore>,<podiumScore>`
 *
 * The body is `multipart/form-data` carrying the player's PSN ticket as a
 * `file` part. We cannot verify that ticket — the keys are Sony's — so it is
 * logged for size and the session binds to the posted PSN ID instead. Identity
 * proper is SSFW's job; this is a game session handle.
 */
export async function verifyHandler(c: Context) {
  const body = await parseClientBody(c);
  const identity = identityFrom(body);
  const ticket = body.file("file", "ticket", "thefile");

  if (!identity.psnid || identity.psnid === "Unknown") {
    log.warn(
      `[WW] verify.php without a usable psnid (fields: ${body.fieldNames().join(", ") || "none"})`,
    );
    return csv(c, 0);
  }

  await pruneExpired();
  const bracelet = await createSession(
    identity.psnid,
    identity.territory,
    identity.region,
  );

  log.info(
    `[WW] verify ${identity.psnid} region=${identity.region || "?"} ticket=${ticket?.data.length ?? 0}B`,
  );

  return csv(
    c,
    1,
    bracelet,
    wwConfig.podiumRefreshSeconds,
    wwConfig.screenDisplaySeconds,
    wwConfig.kioskScoreRefreshSeconds,
    wwConfig.podiumScoreRefreshSeconds,
  );
}
