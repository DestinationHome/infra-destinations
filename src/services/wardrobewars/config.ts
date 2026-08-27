/**
 * Wardrobe Wars tunables.
 *
 * The client reads four of these back out of `verify.php` and uses them as its
 * own timers, so they are the server's only lever over client-side pacing.
 */
export const wwConfig = {
  /**
   * Seconds between full podium refreshes (`WWGame.RefreshTime`). The client
   * defaults to 180 if verify.php omits it.
   */
  podiumRefreshSeconds: envInt("WW_PODIUM_REFRESH", 180),

  /** Seconds each big-screen slide is shown (`WWScreen.DISPLAY_TIME`). */
  screenDisplaySeconds: envInt("WW_SCREEN_DISPLAY", 15),

  /** Seconds between kiosk score polls (`WWGame.RefreshScoreKiosk`). */
  kioskScoreRefreshSeconds: envInt("WW_KIOSK_SCORE_REFRESH", 5),

  /** Seconds between podium score polls (`WWGame.RefreshScorePodium`). */
  podiumScoreRefreshSeconds: envInt("WW_PODIUM_SCORE_REFRESH", 10),

  /** How long a bracelet stays valid, in seconds. */
  braceletTtlSeconds: envInt("WW_BRACELET_TTL", 12 * 60 * 60),

  /** How long an unconsumed photo-p1 upload token stays valid, in seconds. */
  uploadTokenTtlSeconds: envInt("WW_UPLOAD_TOKEN_TTL", 5 * 60),

  /**
   * IANA timezone the contest day/week/month boundaries are measured in.
   * The 2012 official rules ran the contest on Pacific time.
   */
  timezone: process.env.WW_TIMEZONE || "America/Los_Angeles",

  /** Root directory for entry photos. Sits beside the SQLite file by default. */
  photoRoot: process.env.WW_PHOTO_ROOT || "data/wardrobewars/photos",

  /**
   * Directory of prize tiles, named `<OBJECT-GUID>.dds` — the same layout the
   * retail CDN used at `WardrobeWars/Images/prizes/`. Thirteen originals
   * survive there; anything missing falls back to a generated tile.
   */
  prizeTileDir: process.env.WW_PRIZE_TILE_DIR || "data/wardrobewars/prizes",

  /**
   * Optional directory of archive photos to import on first run — point it at
   * the CDN's `WardrobeWars/Images` tree to seed the podiums with the real 2012
   * entries. Unset means no seeding.
   */
  seedDir: process.env.WW_SEED_DIR || "",

  /** Largest accepted photo upload, in bytes. Retail entries are ~61 KB DDS. */
  maxPhotoBytes: envInt("WW_MAX_PHOTO_BYTES", 1024 * 1024),

  /**
   * When today's contest has no entries yet, fall back to the most recent day
   * that does, so the podiums are not blank. Voting still works; winners are
   * always decided per real contest day.
   */
  showcaseWhenEmpty: envBool("WW_SHOWCASE_WHEN_EMPTY", true),

  /** Minimum votes an entry needs before it can win a period. */
  minVotesToWin: envInt("WW_MIN_VOTES_TO_WIN", 1),

  /**
   * Reject a photo-p2 upload whose bytes do not hash to the SHA-1 the client
   * declared in photo-p1. Off by default: `Hash:Finalize()`'s exact encoding is
   * not documented, so a mismatch is logged rather than trusted.
   */
  strictPhotoHash: envBool("WW_STRICT_PHOTO_HASH", false),
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}
