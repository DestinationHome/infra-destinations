import { beforeAll, describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ClientBody, parseClientBody } from "./form";
import {
  dayIndex,
  dayKeyToTimestamp,
  PERIOD_DAILY,
  PERIOD_MONTHLY,
  PERIOD_WEEKLY,
  monthIndex,
  periodKeys,
  periodKeysFromDayKey,
  previousPeriodKeys,
  weekIndex,
} from "./periods";
import {
  ALL_PRIZES,
  DAILY_PRIZES,
  MONTHLY_PRIZES,
  PARTICIPANT_PRIZES,
  prizeFor,
  REWARD_PARTICIPANT,
  WEEKLY_PRIZES,
} from "./prizes";
import { extensionFor, safeJoin, sanitisePsnId } from "./photos";
import { CONFIRMED_THEMES, THEMES, themeForWeek } from "./themes";

/**
 * These cover the parts of Wardrobe Wars that are pure functions of their
 * input: the contest calendar, the prize rotation, the PS3 body parser and the
 * DDS writer. Everything they assert is a behaviour the shipped client depends
 * on and cannot be changed without repacking the minigame object.
 */

describe("contest periods", () => {
  test("a week runs Monday to Sunday, per the official rules", () => {
    // 2026-08-24 is a Monday.
    expect(periodKeysFromDayKey("2026-08-24").week).toBe("2026-08-24");
    expect(periodKeysFromDayKey("2026-08-25").week).toBe("2026-08-24");
    expect(periodKeysFromDayKey("2026-08-30").week).toBe("2026-08-24"); // Sunday
    expect(periodKeysFromDayKey("2026-08-31").week).toBe("2026-08-31"); // next Monday
  });

  test("a week that straddles a month keeps the Monday it started on", () => {
    expect(periodKeysFromDayKey("2026-09-01")).toEqual({
      day: "2026-09-01",
      week: "2026-08-31",
      month: "2026-09",
    });
  });

  test("the contest day is measured in the contest timezone, not UTC", () => {
    // 05:00 UTC is still the previous evening in Los Angeles.
    expect(periodKeys(new Date("2026-08-25T05:00:00Z")).day).toBe("2026-08-24");
    expect(periodKeys(new Date("2026-08-25T19:00:00Z")).day).toBe("2026-08-25");
  });

  test("previous keys name the most recently closed periods", () => {
    expect(previousPeriodKeys(new Date("2026-08-25T19:00:00Z"))).toEqual({
      day: "2026-08-24",
      week: "2026-08-17",
      month: "2026-07",
    });
  });

  test("previous keys roll over a month boundary", () => {
    expect(previousPeriodKeys(new Date("2026-09-01T19:00:00Z"))).toEqual({
      day: "2026-08-31",
      week: "2026-08-24",
      month: "2026-08",
    });
  });

  test("period indices advance by one per period", () => {
    expect(dayIndex("2026-08-25") - dayIndex("2026-08-24")).toBe(1);
    expect(weekIndex("2026-08-24") - weekIndex("2026-08-17")).toBe(1);
    expect(monthIndex("2027-01") - monthIndex("2026-12")).toBe(1);
  });

  test("an unparseable key is inert rather than NaN", () => {
    expect(dayKeyToTimestamp("nonsense")).toBe(0);
    expect(dayIndex("")).toBe(0);
    expect(monthIndex("oops")).toBe(0);
  });
});

describe("prizes", () => {
  test("all 70 shipped prize objects are present and unique", () => {
    expect(ALL_PRIZES).toHaveLength(70);
    expect(new Set(ALL_PRIZES.map((p) => p.objectId)).size).toBe(70);
  });

  test("every object id is a real HCDB GUID", () => {
    for (const prize of ALL_PRIZES) {
      expect(prize.objectId).toMatch(/^[0-9A-F]{8}(-[0-9A-F]{8}){3}$/);
    }
  });

  test("each tier has a pool to rotate through", () => {
    expect(PARTICIPANT_PRIZES.length).toBeGreaterThan(0);
    expect(DAILY_PRIZES.length).toBeGreaterThan(0);
    expect(WEEKLY_PRIZES.length).toBeGreaterThan(0);
    expect(MONTHLY_PRIZES.length).toBeGreaterThan(0);
  });

  test("the rotation is deterministic and wraps cleanly", () => {
    const first = prizeFor(REWARD_PARTICIPANT, 0);
    expect(prizeFor(REWARD_PARTICIPANT, 0)).toEqual(first);
    expect(prizeFor(REWARD_PARTICIPANT, PARTICIPANT_PRIZES.length)).toEqual(first);
    expect(prizeFor(REWARD_PARTICIPANT, 1)).not.toEqual(first);
  });

  test("a negative rotation still resolves", () => {
    // dayIndex is always positive in practice, but the modulo must not produce
    // a negative array index if the clock is ever wrong.
    expect(prizeFor(REWARD_PARTICIPANT, -7)).toBeDefined();
  });
});

describe("themes", () => {
  test("a theme is stable within a week and changes between weeks", () => {
    expect(themeForWeek("2026-08-24")).toBe(themeForWeek("2026-08-24"));
    expect(themeForWeek("2026-08-24")).not.toBe(themeForWeek("2026-08-31"));
    expect(themeForWeek("2026-08-24").length).toBeGreaterThan(0);
  });

  test("the three themes read off real footage are preserved verbatim", () => {
    // These are the only evidence of what retail actually showed. Two live in
    // the rotation, Valentine's Day is pinned to 14 February.
    expect(CONFIRMED_THEMES).toEqual([
      "Black and White Attire",
      "1970s",
      "Valentine's Day",
    ]);
    expect(THEMES).toContain("Black and White Attire");
    expect(THEMES).toContain("1970s");
  });

  test("a holiday lands on the week that contains it, whatever weekday it falls on", () => {
    // A fixed rotation cannot do this, which is the whole reason pinning exists:
    // retail showed "Valentine's Day", so the theme has to track the calendar.
    // 14 Feb is a Saturday in 2026, a Sunday in 2027, a Monday in 2028.
    expect(themeForWeek(periodKeysFromDayKey("2026-02-14").week)).toBe("Valentine's Day");
    expect(themeForWeek(periodKeysFromDayKey("2027-02-14").week)).toBe("Valentine's Day");
    expect(themeForWeek(periodKeysFromDayKey("2028-02-14").week)).toBe("Valentine's Day");
  });

  test("the other pinned dates land too, including across a year boundary", () => {
    expect(themeForWeek(periodKeysFromDayKey("2027-10-31").week)).toBe("Halloween");
    expect(themeForWeek(periodKeysFromDayKey("2027-12-25").week)).toBe("Christmas");
    // 1 Jan 2027 sits in the week that starts 28 Dec 2026.
    expect(themeForWeek(periodKeysFromDayKey("2027-01-01").week)).toBe("New Year's Eve");
    expect(themeForWeek("2026-12-28")).toBe("New Year's Eve");
  });

  test("an ordinary week still comes from the rotation", () => {
    const theme = themeForWeek("2026-09-14");
    expect(THEMES).toContain(theme);
    expect(CONFIRMED_THEMES).not.toContain("");
  });
});

describe("client body parsing", () => {
  /** Hono's Context, reduced to the one thing the parser touches. */
  function ctx(body: Uint8Array | string, contentType: string) {
    const bytes =
      typeof body === "string" ? new TextEncoder().encode(body) : body;
    const raw = new Request("http://test.invalid/", {
      method: "POST",
      headers: { "content-type": contentType },
      body: bytes.slice(),
    });
    return { req: { raw } } as any;
  }

  function multipart(
    boundary: string,
    fields: Record<string, string>,
    file?: { name: string; filename: string; data: Uint8Array },
    eol = "\r\n",
  ): Uint8Array {
    const enc = new TextEncoder();
    const chunks: Uint8Array[] = [];
    for (const [k, v] of Object.entries(fields)) {
      chunks.push(
        enc.encode(
          `--${boundary}${eol}Content-Disposition: form-data; name="${k}"${eol}${eol}${v}${eol}`,
        ),
      );
    }
    if (file) {
      chunks.push(
        enc.encode(
          `--${boundary}${eol}Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"${eol}Content-Type: application/octet-stream${eol}${eol}`,
        ),
      );
      chunks.push(file.data);
      chunks.push(enc.encode(eol));
    }
    chunks.push(enc.encode(`--${boundary}--${eol}`));
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }

  test("reads a urlencoded body", async () => {
    const body: ClientBody = await parseClientBody(
      ctx(
        "territory=SCEA&region=1&psnid=JuliusJoker&vote=8",
        "application/x-www-form-urlencoded",
      ),
    );
    expect(body.str("psnid")).toBe("JuliusJoker");
    expect(body.int("vote")).toBe(8);
    expect(body.int("missing", -1)).toBe(-1);
  });

  test("field names are case-insensitive", async () => {
    // WW.CreatePostData sends `region`; WWScenePhoto sends `Region`.
    const body = await parseClientBody(
      ctx("Region=1&PSNID=Foo", "application/x-www-form-urlencoded"),
    );
    expect(body.str("region")).toBe("1");
    expect(body.str("psnid")).toBe("Foo");
  });

  test("a malformed percent escape does not lose the field", async () => {
    const body = await parseClientBody(
      ctx("psnid=100%", "application/x-www-form-urlencoded"),
    );
    expect(body.str("psnid")).toBe("100%");
  });

  test("reads a multipart body and preserves binary parts exactly", async () => {
    // Bytes that include CRLF and a delimiter prefix, to prove the split is
    // anchored on the boundary rather than scanning for newlines.
    const ticket = new Uint8Array([0x00, 0xff, 0x0d, 0x0a, 0x2d, 0x2d, 0x7f]);
    const body = await parseClientBody(
      ctx(
        multipart("BOUND123", { psnid: "JuliusJoker" }, {
          name: "file",
          filename: "ticket.bin",
          data: ticket,
        }),
        "multipart/form-data; boundary=BOUND123",
      ),
    );
    expect(body.str("psnid")).toBe("JuliusJoker");
    expect(body.file("file")?.filename).toBe("ticket.bin");
    expect([...(body.file("file")?.data ?? [])]).toEqual([...ticket]);
  });

  test("finds an upload part whose name is unexpected", async () => {
    const data = new Uint8Array([1, 2, 3]);
    const body = await parseClientBody(
      ctx(
        multipart("B", {}, { name: "oddname", filename: "x.dds", data }),
        "multipart/form-data; boundary=B",
      ),
    );
    expect([...(body.file("thefile", "file")?.data ?? [])]).toEqual([1, 2, 3]);
  });

  test("an empty body yields no fields rather than throwing", async () => {
    const body = await parseClientBody(ctx("", "application/x-www-form-urlencoded"));
    expect(body.fieldNames()).toHaveLength(0);
    expect(body.file("file")).toBeUndefined();
  });
});

describe("photo storage safety", () => {
  test("PSN IDs are stripped to the characters Sony allows", () => {
    expect(sanitisePsnId("JuliusJoker")).toBe("JuliusJoker");
    expect(sanitisePsnId("../../etc/passwd")).toBe("etcpasswd");
    expect(sanitisePsnId("")).toBe("Unknown");
    expect(sanitisePsnId("a".repeat(40))).toHaveLength(16);
  });

  test("paths that escape their root are refused", () => {
    const root = process.platform === "win32" ? "C:\\ww\\photos" : "/ww/photos";
    expect(safeJoin(root, "2026-08-25/x.dds")).not.toBeNull();
    expect(safeJoin(root, "../../secrets.db")).toBeNull();
    expect(safeJoin(root, "%2e%2e%2f%2e%2e%2fsecrets.db")).toBeNull();
    expect(safeJoin(root, "a\0b")).toBeNull();
  });

  test("the stored extension comes from the magic bytes, not the part name", () => {
    // The client names the part shot.jpg but uploads whatever Screenshot
    // produced, which retail archives show to be DDS.
    expect(extensionFor(new Uint8Array([0x44, 0x44, 0x53, 0x20]))).toBe("dds");
    expect(extensionFor(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(extensionFor(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
    expect(extensionFor(new Uint8Array([0, 0]))).toBe("dds");
  });
});


/**
 * The winner ladder, which is the one part of the contest that cannot be
 * observed by playing: a period only has a winner once it has closed.
 *
 * `@db` reads DATABASE_URL when it is first imported and creates the schema
 * there, so the modules that reach the database are imported dynamically,
 * after the environment has been pointed at a scratch file. Nothing else in
 * this file imports `@db`, so nothing has fixed the path before this runs.
 */
describe("the winner ladder", () => {
  let store: typeof import("./store");
  let winners: typeof import("./winners");

  // A Tuesday. The open contest week is 2026-09-14 and the open month is
  // 2026-09, so everything seeded before those is a closed period.
  const NOW = new Date("2026-09-15T20:00:00Z");

  beforeAll(async () => {
    const file = join(tmpdir(), `ww-ladder-${process.pid}-${Date.now()}.db`);
    process.env.DATABASE_URL = `file:${file}`;
    store = await import("./store");
    winners = await import("./winners");
  });

  /** One entry carrying one vote, which clears the eligibility threshold. */
  async function entrant(psnid: string, dayKey: string, rating: number) {
    const { week, month } = periodKeysFromDayKey(dayKey);
    const entry = await store.createEntry({
      psnid,
      territory: "SCEA",
      region: "1",
      language: "en-US",
      imagePath: `${dayKey}/${psnid}.jpg`,
      dayKey,
      weekKey: week,
      monthKey: month,
    });
    await store.castVote(entry.id, `voter-of-${psnid}`, rating);
    return entry;
  }

  test("a day nobody was there to settle still counts toward the week", async () => {
    await entrant("LadderMon", "2026-09-07", 9);
    const tue = await entrant("LadderTue", "2026-09-08", 10);
    const wed = await entrant("LadderWed", "2026-09-09", 8);

    // Only Wednesday was ever asked about while it was recent — the other two
    // days went by with nobody in the space to trigger a decision.
    await store.storeWinner({
      periodType: PERIOD_DAILY,
      periodKey: "2026-09-09",
      entryId: wed.id,
      psnid: "LadderWed",
      score: 8,
    });

    const decided = await winners.resolveWeeklyWinner("2026-09-07", NOW);

    // The eligibility pool is built from *stored* daily winners, so without
    // the backfill this handed the week to LadderWed on 8.0 — the only settled
    // day — while LadderTue's 10.0 was never in the running.
    expect(decided?.winner.psnid).toBe("LadderTue");
    expect(decided?.winner.score).toBe(10);
    expect(decided?.winner.entryId).toBe(tue.id);
  });

  test("judging a week settles every day inside it", async () => {
    await entrant("SettleMon", "2026-08-31", 7);
    await entrant("SettleTue", "2026-09-01", 9);
    await entrant("SettleWed", "2026-09-02", 6);

    await winners.resolveWeeklyWinner("2026-08-31", NOW);

    // Each day's champion is on record, so each can still be paid.
    expect((await store.getStoredWinner(PERIOD_DAILY, "2026-08-31"))?.psnid).toBe("SettleMon");
    expect((await store.getStoredWinner(PERIOD_DAILY, "2026-09-01"))?.psnid).toBe("SettleTue");
    expect((await store.getStoredWinner(PERIOD_DAILY, "2026-09-02"))?.psnid).toBe("SettleWed");
  });

  test("a settled period is never re-judged, so late votes cannot rewrite it", async () => {
    const early = await entrant("EarlyBird", "2026-08-24", 7);
    const late = await entrant("LateSurge", "2026-08-25", 6);

    expect((await winners.resolveWeeklyWinner("2026-08-24", NOW))?.winner.psnid).toBe("EarlyBird");

    // Votes keep arriving for the runner-up after the week has closed, taking
    // their average well past the winner's.
    for (const voter of ["late1", "late2", "late3"]) {
      await store.castVote(late.id, voter, 10);
    }
    expect((await store.getEntry(late.id))?.score).toBeGreaterThan(7);

    const again = await winners.resolveWeeklyWinner("2026-08-24", NOW);
    expect(again?.winner.psnid).toBe("EarlyBird");
    expect(again?.winner.entryId).toBe(early.id);
  });

  test("the monthly contest promotes from the weekly rung, settling it first", async () => {
    await entrant("JulyQuiet", "2026-07-07", 6); // week 2026-07-06
    await entrant("JulyStrong", "2026-07-14", 9); // week 2026-07-13
    await entrant("JulyLoudest", "2026-07-15", 10); // week 2026-07-13

    const decided = await winners.resolveMonthlyWinner("2026-07", NOW);
    expect(decided?.winner.psnid).toBe("JulyLoudest");

    // Both rungs below were settled on the way down.
    expect((await store.getStoredWinner(PERIOD_WEEKLY, "2026-07-06"))?.psnid).toBe("JulyQuiet");
    expect((await store.getStoredWinner(PERIOD_WEEKLY, "2026-07-13"))?.psnid).toBe("JulyLoudest");
    expect((await store.getStoredWinner(PERIOD_DAILY, "2026-07-14"))?.psnid).toBe("JulyStrong");
  });

  test("a win keeps until it is claimed, however long the player stays away", async () => {
    // Sole entrant in their day, week and month, four months before NOW.
    await entrant("OldChamp", "2026-05-11", 9);

    const owed = await winners.collectWinnings("OldChamp", NOW);
    expect(owed).toHaveLength(3); // daily, weekly and monthly
    expect(new Set(owed).size).toBe(3); // three different prize objects
    expect((await store.getStoredWinner(PERIOD_MONTHLY, "2026-05"))?.psnid).toBe("OldChamp");

    // Asking again pays nothing: grants are recorded per player per period,
    // and the client asks on every NotifyAuthenticated.
    expect(await winners.collectWinnings("OldChamp", NOW)).toEqual([]);
  });

  test("an open period has no winner yet", async () => {
    await entrant("StillGoing", "2026-09-15", 10);
    expect(await winners.resolveDailyWinner("2026-09-15", NOW)).toBeUndefined();
    expect(await winners.resolveWeeklyWinner("2026-09-14", NOW)).toBeUndefined();
    expect(await winners.collectWinnings("StillGoing", NOW)).toEqual([]);
  });
});
