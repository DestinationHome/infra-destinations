import { log } from "@main";
import type { Context } from "hono";
import { wwConfig } from "../config";
import { parseClientBody } from "../form";
import { periodKeys } from "../periods";
import {
  existingVote,
  hasEntriesOnDay,
  latestDayWithEntries,
  pickEntry,
} from "../store";
import { csv, formatScore, identityFrom } from "./common";

/**
 * `POST /WardrobeWars/podium.php` — what a podium (or the kiosk) should display.
 *
 * Called with `id` 1-8 for the eight podiums around the stage, or `id=10` for
 * the kiosk's browse view. `previous` is the entry that slot is currently
 * showing, so it can be skipped. `limitLocal=1` is the kiosk's "My Photos"
 * option.
 *
 * Response: `<imagePath>,<psnid>,<score>,<entryId>,<voteType>`
 *   - `0`  the contest has no entries to show
 *   - `-1` this player has no entries of their own (My Photos only)
 *
 * `<imagePath>` is appended to `<serverURL>/WardrobeWars/Images/`, and
 * `<voteType>` is 0 when this player has not rated the entry yet, otherwise the
 * 1-10 rating they gave it — which is what lights the "voted" stamp.
 *
 * This call is made with `secure=false`, so it carries no bracelet and the
 * viewer is identified by the posted PSN ID alone. That is only used to decide
 * whether to show the "already voted" stamp; the vote itself is authenticated.
 */
export async function podiumHandler(c: Context) {
  const body = await parseClientBody(c);
  const identity = identityFrom(body);
  const podiumId = body.int("id", 0);
  const previous = body.int("previous", 0);
  const limitLocal = body.str("limitlocal") === "1";

  const today = periodKeys().day;

  // "My Photos" is scoped to the player's own entries for today, and has its
  // own distinct empty response so the kiosk can say something more useful
  // than "no entries".
  if (limitLocal) {
    if (!(await hasEntriesOnDay(identity.psnid, today))) {
      return csv(c, -1);
    }
    const mine = await pickEntry({
      dayKey: today,
      excludeId: previous,
      psnid: identity.psnid,
    });
    if (!mine) return csv(c, -1);
    const voted = await existingVote(mine.id, identity.psnid);
    return csv(
      c,
      mine.imagePath,
      mine.psnid,
      formatScore(mine.score),
      mine.id,
      voted ?? 0,
    );
  }

  // Today's contest first. If nobody has entered yet the stage would be eight
  // blank plinths, so optionally showcase the most recent day that does have
  // entries — voting still works, and winners are still decided per real day.
  let dayKey = today;
  let entry = await pickEntry({ dayKey, excludeId: previous });
  if (!entry && wwConfig.showcaseWhenEmpty) {
    const fallback = await latestDayWithEntries();
    if (fallback && fallback !== today) {
      dayKey = fallback;
      entry = await pickEntry({ dayKey, excludeId: previous });
    }
  }

  if (!entry) {
    log.debug(`[WW] podium ${podiumId} has nothing to show (day ${today})`);
    return csv(c, 0);
  }

  const voted = await existingVote(entry.id, identity.psnid);
  return csv(
    c,
    entry.imagePath,
    entry.psnid,
    formatScore(entry.score),
    entry.id,
    voted ?? 0,
  );
}
