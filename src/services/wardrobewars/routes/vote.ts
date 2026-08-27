import { log } from "@main";
import type { Context } from "hono";
import { parseClientBody } from "../form";
import { castVote, existingVote, getEntry, resolveSession } from "../store";
import { csv, formatScore, identityFrom } from "./common";

/**
 * `POST /WardrobeWars/podium_vote.php` — cast a 1-10 rating.
 *
 * Response: `1,<newScore>` accepted · `2` rejected.
 *
 * The client treats `1` as "thank you for voting" and locks the entry for this
 * player; `2` surfaces the rejection message. Anything else leaves the legend
 * spinning on "Processing...", so both branches must always answer.
 *
 * This is one of the three calls made over HTTPS with a bracelet, so unlike the
 * read-only endpoints the voter really is authenticated here — which is what
 * stops one player stuffing the ballot under someone else's PSN ID.
 */
export async function voteHandler(c: Context) {
  const body = await parseClientBody(c);
  const identity = identityFrom(body);
  const entryId = body.int("entrant_id", 0);
  const rating = body.int("vote", 0);

  const session = await resolveSession(body.str("bracelet"));
  if (!session) {
    log.warn(`[WW] vote rejected: no valid bracelet (psnid ${identity.psnid})`);
    return csv(c, 2);
  }

  // Trust the bracelet over the posted PSN ID.
  const voter = session.psnid;

  if (rating < 1 || rating > 10) {
    log.warn(`[WW] vote rejected: rating ${rating} out of range`);
    return csv(c, 2);
  }

  const entry = await getEntry(entryId);
  if (!entry || entry.hidden === 1) {
    log.warn(`[WW] vote rejected: entry ${entryId} not votable`);
    return csv(c, 2);
  }

  if (await existingVote(entry.id, voter)) {
    // "You have already voted for this entry."
    return csv(c, 2);
  }

  const result = await castVote(entry.id, voter, rating);
  if (!result.accepted) {
    // Lost a race with the player's own duplicate submission.
    return csv(c, 2);
  }

  log.info(
    `[WW] ${voter} rated entry ${entry.id} (${entry.psnid}) ${rating} → ${formatScore(result.score)} over ${result.voteCount}`,
  );
  return csv(c, 1, formatScore(result.score));
}
