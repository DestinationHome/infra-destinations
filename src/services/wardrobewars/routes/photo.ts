import { createHash } from "node:crypto";
import { log } from "@main";
import type { Context } from "hono";
import { wwConfig } from "../config";
import { type ClientFile, parseClientBody } from "../form";
import { periodKeys } from "../periods";
import { storePhoto } from "../photos";
import {
  consumeUploadToken,
  createEntry,
  createUploadToken,
  resolveSession,
} from "../store";
import { identityFrom } from "./common";

/**
 * Photo submission — the part of Wardrobe Wars that runs in the *scene*, not
 * the minigame object.
 *
 * `WWKiosk:enterProcessState` asks the scene for a screenshot over the listener
 * channel; `WWScenePhoto.lua` (attached to the scene as a `scriptType` game
 * object) captures it and uploads in two steps before broadcasting
 * `WWScenePhotoResponse` back. The kiosk blocks on that reply, so a broken
 * upload leaves the player stuck on "Processing..." — every path here answers.
 *
 * Splitting it in two is the client's design: part one declares the SHA-1 and
 * gets a token, part two sends the bytes under that token. The token is
 * single-use, which is what stops a retry becoming a duplicate entry.
 */

/** `POST /WardrobeWars/photo-p1.php` — open an upload, return its token. */
export async function photoPart1Handler(c: Context) {
  const body = await parseClientBody(c);
  const identity = identityFrom(body);

  const session = await resolveSession(body.str("bracelet"));
  if (!session) {
    log.warn(`[WW] photo-p1 refused: no valid bracelet (psnid ${identity.psnid})`);
    // An empty body is the client's own abort signal — it skips part two.
    return c.body(null, 200);
  }

  const token = await createUploadToken({
    psnid: session.psnid,
    territory: identity.territory,
    region: identity.region,
    language: identity.language,
    sha1: body.str("secureme"),
  });

  log.info(`[WW] photo-p1 ${session.psnid} token issued`);
  return c.text(token, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

/** `POST /WardrobeWars/photo-p2.php` — receive the bytes, create the entry. */
export async function photoPart2Handler(c: Context) {
  const body = await parseClientBody(c);
  const token = body.str("secureme");

  const upload = await consumeUploadToken(token);
  if (!upload) {
    log.warn("[WW] photo-p2 refused: unknown, expired or already-used token");
    return photoXml(c, 0);
  }

  const file = body.file("thefile", "file");
  const entryId = await acceptPhoto(
    upload.psnid,
    {
      territory: upload.territory ?? "",
      region: upload.region ?? "",
      language: upload.language ?? "",
    },
    file,
    upload.sha1 ?? "",
  );

  return photoXml(c, entryId ? 1 : 0, entryId);
}

/**
 * `POST /WardrobeWars/photo.php` — the single-request variant.
 *
 * `WWScenePhoto` only takes this path when its `fullsecure` flag is true, and
 * the shipped script hard-codes it false. Implemented anyway so a scene script
 * that flips the flag is not left uploading into a 404.
 */
export async function photoSingleHandler(c: Context) {
  const body = await parseClientBody(c);
  const identity = identityFrom(body);

  const session = await resolveSession(body.str("bracelet"));
  if (!session) {
    log.warn(`[WW] photo.php refused: no valid bracelet (psnid ${identity.psnid})`);
    return photoXml(c, 0);
  }

  const file = body.file("thefile", "file");
  const entryId = await acceptPhoto(session.psnid, identity, file, "");
  return photoXml(c, entryId ? 1 : 0, entryId);
}

async function acceptPhoto(
  psnid: string,
  identity: { territory: string; region: string; language: string },
  file: ClientFile | undefined,
  declaredSha1: string,
): Promise<number | null> {
  if (!file || file.data.length === 0) {
    log.warn(`[WW] photo upload from ${psnid} carried no file part`);
    return null;
  }
  if (file.data.length > wwConfig.maxPhotoBytes) {
    log.warn(
      `[WW] photo upload from ${psnid} rejected: ${file.data.length}B exceeds ${wwConfig.maxPhotoBytes}B`,
    );
    return null;
  }

  if (declaredSha1) {
    const actual = createHash("sha1").update(file.data).digest("hex");
    const declared = declaredSha1.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
    if (declared && declared !== actual) {
      // `Hash:Finalize()`'s encoding is undocumented, so a mismatch is far more
      // likely to be a formatting difference than a tampered upload. Log it and
      // let the photo through unless the operator has asked for strictness.
      log.warn(
        `[WW] photo hash mismatch for ${psnid}: declared ${declaredSha1} vs sha1 ${actual}`,
      );
      if (wwConfig.strictPhotoHash) return null;
    }
  }

  const keys = periodKeys();
  const imagePath = await storePhoto(psnid, keys.day, file.data);
  const entry = await createEntry({
    psnid,
    territory: identity.territory,
    region: identity.region,
    language: identity.language,
    imagePath,
    dayKey: keys.day,
    weekKey: keys.week,
    monthKey: keys.month,
  });

  log.info(
    `[WW] entry ${entry.id} from ${psnid} → ${imagePath} (${file.data.length}B)`,
  );
  return entry.id;
}

/**
 * Both upload endpoints are requested by the client as `"xml"`, so the reply
 * has to parse as a document even though the script discards the contents.
 */
function photoXml(c: Context, status: number, entryId?: number | null) {
  const id = entryId ? `<id>${entryId}</id>` : "";
  return c.text(
    `<?xml version="1.0" encoding="utf-8"?><Result><status>${status}</status>${id}</Result>`,
    200,
    { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  );
}
