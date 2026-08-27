import { log } from "@main";
import type { Context } from "hono";
import { parseClientBody } from "../form";
import { dayIndex, periodKeys } from "../periods";
import { prizeFor, REWARD_PARTICIPANT, type RewardType } from "../prizes";
import { grantRewardOnce, resolveSession } from "../store";
import { collectWinnings } from "../winners";
import { csv, identityFrom } from "./common";

/**
 * `POST /WardrobeWars/reward.php` — hand out prize tickets.
 *
 * Response: `1,<count>,<guid1>,<guid2>,...` · `0` when there is nothing to give.
 * Each GUID goes straight to `Rewards.AddTicket`, so every one must be a real
 * HCDB object or the client silently drops it.
 *
 * The client calls this two ways:
 *
 *   - **with `type=1`**, immediately after a photo is submitted — the
 *     participation prize, once per contest day.
 *   - **with no type at all**, on `NotifyAuthenticated` — "do I have anything
 *     owed?". This is how the official rules intended winners to collect:
 *     "return to the mall the next day ... your prize will be automatically
 *     downloaded to your wardrobe." A win keeps until it is claimed rather
 *     than expiring after a day — see `collectWinnings`.
 *
 * Grants are recorded per player per period, so re-entering the space does not
 * re-issue a prize the player already holds.
 */
export async function rewardHandler(c: Context) {
  const body = await parseClientBody(c);
  const identity = identityFrom(body);

  const session = await resolveSession(body.str("bracelet"));
  if (!session) {
    log.warn(`[WW] reward refused: no valid bracelet (psnid ${identity.psnid})`);
    return csv(c, 0);
  }
  const psnid = session.psnid;

  const now = new Date();
  const current = periodKeys(now);
  const requested = body.get("type");
  const granted: string[] = [];

  if (requested !== undefined && requested !== "") {
    const type = Number.parseInt(requested, 10) as RewardType;

    if (type === REWARD_PARTICIPANT) {
      const prize = prizeFor(REWARD_PARTICIPANT, dayIndex(current.day));
      if (prize) {
        const objectId = await grantRewardOnce({
          psnid,
          rewardType: REWARD_PARTICIPANT,
          periodKey: current.day,
          objectId: prize.objectId,
        });
        if (objectId) granted.push(objectId);
      }
    } else {
      // The shipped client never asks for a win prize by type, but honour it if
      // something does — only for a period this player actually won.
      const owed = await collectWinnings(psnid, now, type);
      granted.push(...owed);
    }
  } else {
    granted.push(...(await collectWinnings(psnid, now)));
  }

  if (granted.length === 0) return csv(c, 0);

  log.info(`[WW] granted ${granted.length} prize(s) to ${psnid}: ${granted.join(" ")}`);
  return csv(c, 1, granted.length, ...granted);
}
