import { buildXml } from "@common/xml";
import { log } from "@main";
import type { Context } from "hono";
import { parseClientBody } from "../form";
import {
  dayIndex,
  dayKeyToTimestamp,
  monthIndex,
  periodKeys,
  previousPeriodKeys,
  weekIndex,
} from "../periods";
import {
  prizeFor,
  REWARD_DAILY_WIN,
  REWARD_MONTHLY_WIN,
  REWARD_PARTICIPANT,
  REWARD_WEEKLY_WIN,
  type RewardType,
} from "../prizes";
import { themeForWeek } from "../themes";
import { latestWinners } from "../winners";

/**
 * `POST /WardrobeWars/screen.php` — the two big screens flanking the stage.
 *
 * This is the only endpoint that answers XML rather than a comma-separated
 * line. `WWScreenManager:ProcessScreenInfo` walks it with the client's own Xml
 * reader, in this order: `Winners`, `Theme`, `Rewards`, `Screens`.
 *
 * Two details are load-bearing:
 *
 *   1. `<tex>` is mandatory on every Winner and Reward. `RenderWinner` and
 *      `RenderReward` concatenate it into a URL unconditionally, so a missing
 *      one is a Lua error that kills the whole minigame VM, not a blank image.
 *   2. `Display.index` must point at an entry that exists. The renderers index
 *      straight into the winner/reward tables and dereference the result, so a
 *      dangling index is likewise fatal. Slides are therefore only emitted for
 *      records actually present in this response.
 */
export async function screenHandler(c: Context) {
  // Parsed for symmetry and logging — the screens are a broadcast, identical
  // for everyone in the instance.
  await parseClientBody(c);

  const now = new Date();
  const current = periodKeys(now);
  const previous = previousPeriodKeys(now);
  const winners = await latestWinners(now);

  interface WinnerNode {
    name: string;
    type: number;
    score: string;
    date: number;
    tex: string;
  }
  const winnerNodes: WinnerNode[] = [];

  const pushWinner = (
    decided: (typeof winners)["daily"],
    type: number,
    periodKey: string,
  ) => {
    // No entry means no photo, and no photo means no `tex` — skip the slide
    // rather than hand the client a URL it cannot build.
    if (!decided?.entry) return;
    winnerNodes.push({
      name: decided.winner.psnid,
      type,
      score: decided.winner.score.toFixed(1),
      date: periodStartTimestamp(periodKey),
      tex: `Images/${decided.entry.imagePath}`,
    });
  };

  pushWinner(winners.daily, 1, previous.day);
  pushWinner(winners.weekly, 2, previous.week);
  pushWinner(winners.monthly, 3, previous.month);

  interface RewardNode {
    name: string;
    type: number;
    tex: string;
  }
  const rewardNodes: RewardNode[] = [];

  const pushReward = (type: RewardType, rotation: number) => {
    const prize = prizeFor(type, rotation);
    if (!prize) return;
    rewardNodes.push({
      // The client resolves this GUID through ObjectRetrieveMetaData and shows
      // the catalogue name, stripped of the shared "Wardrobe Wars - " prefix.
      name: prize.objectId,
      type,
      tex: `Images/prizes/${prize.objectId}.dds`,
    });
  };

  pushReward(REWARD_PARTICIPANT, dayIndex(current.day));
  pushReward(REWARD_DAILY_WIN, dayIndex(current.day));
  pushReward(REWARD_WEEKLY_WIN, weekIndex(current.week));
  pushReward(REWARD_MONTHLY_WIN, monthIndex(current.month));

  const SCREEN_WINNER = 1;
  const SCREEN_THEME = 2;
  const SCREEN_REWARD = 3;

  const themeSlide = { type: SCREEN_THEME, index: 1 };
  const winnerSlides = winnerNodes.map((_, i) => ({
    type: SCREEN_WINNER,
    index: i + 1,
  }));
  const rewardSlides = rewardNodes.map((_, i) => ({
    type: SCREEN_REWARD,
    index: i + 1,
  }));

  // Screen 1 advertises who won, screen 2 what there is to win; both open on
  // the theme so a player entering the space sees the brief immediately.
  const screen1 = [themeSlide, ...winnerSlides];
  const screen2 = [themeSlide, ...rewardSlides];

  const document = {
    Result: {
      Winners: { Winner: winnerNodes },
      Theme: themeForWeek(current.week),
      Rewards: { Reward: rewardNodes },
      Screens: {
        Screen: [
          { "@_id": 1, Display: screen1 },
          { "@_id": 2, Display: screen2 },
        ],
      },
    },
  };

  log.info(
    `[WW] screen.php winners=${winnerNodes.length} rewards=${rewardNodes.length} theme="${themeForWeek(current.week)}"`,
  );

  const xml = `<?xml version="1.0" encoding="utf-8"?>${buildXml(document)}`;
  return c.text(xml, 200, {
    "Content-Type": "text/xml; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

/**
 * POSIX timestamp for the start of a contest period, which is what the winner
 * screen renders as the date. Month keys are `YYYY-MM` and get pinned to the
 * first of the month; day and week keys are already full dates.
 */
function periodStartTimestamp(periodKey: string): number {
  return dayKeyToTimestamp(
    periodKey.length === 7 ? `${periodKey}-01` : periodKey,
  );
}
