import type { Context } from "hono";
import { parseClientBody } from "../form";
import { existingVote, getEntry } from "../store";
import { csv, formatScore, identityFrom } from "./common";

/**
 * `POST /WardrobeWars/podium_score.php` — poll one entry's live score.
 *
 * Response: `1,<score>,<voteType>`
 *
 * Podiums call this every ten seconds and the kiosk every five, so it is by far
 * the hottest endpoint in the space — a single indexed lookup plus the viewer's
 * own vote. It is what animates the score slider when somebody else rates the
 * entry you are standing in front of.
 *
 * A response whose first field is not `1` is simply ignored by the client, so
 * unknown entries are answered with `0` rather than an HTTP error.
 */
export async function scoreHandler(c: Context) {
  const body = await parseClientBody(c);
  const identity = identityFrom(body);
  const entryId = body.int("entrant_id", 0);

  const entry = await getEntry(entryId);
  if (!entry) return csv(c, 0);

  const voted = await existingVote(entry.id, identity.psnid);
  return csv(c, 1, formatScore(entry.score), voted ?? 0);
}
