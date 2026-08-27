import { weekIndex } from "./periods";

/**
 * The dress-up theme shown on the big screens and above the photo booth.
 *
 * THREE of these are real. "Black and White Attire", "1970s" and "Valentine's
 * Day" were read off period video footage of the live 2012 game and are marked
 * CONFIRMED below. Do not reword them and do not let a tidy-up lose them —
 * they are the only surviving evidence of what retail actually showed. The
 * rest are stand-ins written to match their voice, because the real rota only
 * ever lived on Sony's server and was never archived.
 *
 * "Valentine's Day" is why this is not a plain rotation. A fixed cycle can
 * never land a holiday on the right week, so themes tied to a date are pinned
 * to that date and the rotation fills the weeks between.
 *
 * Per the 2012 rules the theme is *weekly* — "Dress your avatar according to
 * the weekly theme indicated on the screen" — even though the on-screen label
 * reads "Today's Theme". Retail may simply have contradicted its own rules. If
 * footage ever turns up showing two different themes inside one week, swap
 * `weekIndex` for `dayIndex` here and pin on the day instead; nothing else
 * needs to change, and no client update is involved either way.
 */

/** Read off real footage. Never reword these. */
export const CONFIRMED_THEMES = [
  "Black and White Attire",
  "1970s",
  "Valentine's Day",
];

interface PinnedTheme {
  /** Month, 1-12. */
  month: number;
  /** Day of the month. */
  day: number;
  theme: string;
}

/**
 * Themes tied to a calendar date. The contest period containing the date takes
 * the theme, overriding the rotation.
 *
 * Only Valentine's Day is evidenced. The others are the same idea applied to
 * the dates a US mall would obviously mark — plausible, not proven. Dates are
 * fixed, so a holiday that moves (US Thanksgiving) would need a rule rather
 * than a date; none is implemented.
 */
const PINNED_THEMES: PinnedTheme[] = [
  { month: 1, day: 1, theme: "New Year's Eve" },
  { month: 2, day: 14, theme: "Valentine's Day" }, // CONFIRMED retail
  { month: 3, day: 17, theme: "St Patrick's Day" },
  { month: 7, day: 4, theme: "Independence Day" },
  { month: 10, day: 31, theme: "Halloween" },
  { month: 12, day: 25, theme: "Christmas" },
];

/**
 * The weeks in between, one per contest week.
 *
 * The two confirmed entries set the register for the rest: a plain descriptive
 * prompt, title case, often naming a garment category or a decade.
 */
const DEFAULT_THEMES = [
  "Black and White Attire", // CONFIRMED retail
  "1970s", // CONFIRMED retail
  "1950s",
  "1960s",
  "1980s",
  "1990s",
  "Formal Attire",
  "Beach Attire",
  "Winter Attire",
  "Sports Attire",
  "Denim Attire",
  "Neon Attire",
  "Monochrome",
  "All That Glitters",
  "Uniforms",
  "Superheroes and Villains",
  "Rock Stars",
  "Sci-Fi Future",
  "Wild West",
  "Sleepwear",
  "Streetwear",
  "Back to School",
  "Explorers",
  "Dance Floor Ready",
];

/** Replace the rotation wholesale with `WW_THEMES`, pipe-separated. */
export const THEMES: string[] = (() => {
  const override = process.env.WW_THEMES;
  if (!override) return DEFAULT_THEMES;
  const parsed = override
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_THEMES;
})();

/** Set `WW_PINNED_THEMES=0` to run the rotation alone, holidays and all. */
const PINS_ENABLED = !["0", "false", "off"].includes(
  String(process.env.WW_PINNED_THEMES ?? "").toLowerCase(),
);

/**
 * The pinned theme for a contest week, if one of its seven days is a pinned
 * date. Anchored at noon UTC so a daylight-saving shift cannot move a day.
 */
function pinnedThemeForWeek(weekKey: string): string | undefined {
  const [year, month, day] = weekKey.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  for (let offset = 0; offset < 7; offset++) {
    const at = new Date(Date.UTC(year, month - 1, day + offset, 12));
    const hit = PINNED_THEMES.find(
      (p) => p.month === at.getUTCMonth() + 1 && p.day === at.getUTCDate(),
    );
    if (hit) return hit.theme;
  }
  return undefined;
}

/**
 * The theme for a contest week.
 *
 * Derived from the week key alone, so every client in the space renders the
 * same theme with no shared state and it survives a service restart. A pinned
 * week does not consume a rotation slot — the rotation simply skips that week,
 * which shifts which stand-ins come round each cycle.
 */
export function themeForWeek(weekKey: string): string {
  if (PINS_ENABLED) {
    const pinned = pinnedThemeForWeek(weekKey);
    if (pinned) return pinned;
  }
  if (THEMES.length === 0) return "";
  const index = ((weekIndex(weekKey) % THEMES.length) + THEMES.length) % THEMES.length;
  return THEMES[index] ?? "";
}
