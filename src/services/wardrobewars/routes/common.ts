import type { Context } from "hono";
import type { ClientBody } from "../form";
import { sanitisePsnId } from "../photos";

/**
 * Shared response helpers.
 *
 * Every Wardrobe Wars endpoint except `screen.php` answers with a bare
 * comma-separated line, which the client feeds straight into `Split(s, ",")`.
 * There is no envelope, no JSON and — importantly — no trailing newline: the
 * bracelet from `verify.php` is echoed back on later requests verbatim, so a
 * stray `\n` would travel with it.
 */
export function csv(c: Context, ...parts: (string | number)[]) {
  return c.text(parts.join(","), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

/** One-decimal score, the precision the client renders with `%.1f`. */
export function formatScore(score: number): string {
  return (Number.isFinite(score) ? score : 0).toFixed(1);
}

export interface Identity {
  psnid: string;
  territory: string;
  region: string;
  language: string;
}

/**
 * The player fields every request carries.
 *
 * Names are read case-insensitively because the game is not consistent about
 * them: the minigame object sends `region`, the scene photo script sends
 * `Region`.
 */
export function identityFrom(body: ClientBody): Identity {
  return {
    psnid: sanitisePsnId(body.str("psnid")),
    territory: body.str("territory"),
    region: body.str("region"),
    language: body.str("language"),
  };
}
