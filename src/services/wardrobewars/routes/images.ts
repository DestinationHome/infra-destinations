import { log } from "@main";
import type { Context } from "hono";
import { defaultPrizeTile } from "../dds";
import {
  contentTypeFor,
  photoPathFor,
  prizeTilePathFor,
  readBlob,
} from "../photos";

/**
 * `GET /WardrobeWars/Images/<path>` — every texture the game fetches by URL.
 *
 * Two kinds of file live under this one prefix, exactly as they did on the
 * retail CDN:
 *
 *   - `Images/<YYYY-MM-DD>/<psnid>-<HH-MM-SS>.dds` — a contest entry photo,
 *     named by `podium.php` and echoed as a winner's `<tex>`
 *   - `Images/prizes/<OBJECT-GUID>.dds` — the prize tile a `<Reward>` points at
 *
 * They are served from separate roots because they have nothing in common
 * operationally: entries are user uploads that grow without bound, prize tiles
 * are a small curated set. Thirteen originals survive on the CDN under
 * `WardrobeWars/Images/prizes/`, at 340x352 DXT1.
 *
 * Both are requested with `Resource.Request(url, "texture")`, so the response
 * has to be something the PS3 can decode — in practice DDS.
 *
 * Note the leading-slash quirk: the client builds these URLs as
 * `serverURL .. "/WardrobeWars/Images/" .. path` while `serverURL` already ends
 * in a slash, so requests arrive as `//WardrobeWars/...`. `service.ts`
 * registers both spellings.
 */
export async function imageHandler(c: Context) {
  const relative = relativeAfterImages(c.req.path);
  if (!relative) return c.body(null, 404);

  const prizeName = prizeTileName(relative);
  if (prizeName !== null) return servePrizeTile(c, prizeName);

  const absolute = photoPathFor(relative);
  if (!absolute) {
    log.warn(`[WW] refused image path outside the photo root: ${relative}`);
    return c.body(null, 404);
  }

  const data = await readBlob(absolute);
  if (!data) return c.body(null, 404);
  return sendBinary(c, data, contentTypeFor(absolute));
}

/**
 * A prize tile, falling back to a generated panel when no artwork has been
 * supplied for that object.
 *
 * The fallback is not cosmetic politeness: `WWScreen:RenderReward` builds the
 * texture URL unconditionally, so every advertised prize has to resolve to
 * something decodable or that slide renders broken.
 */
async function servePrizeTile(c: Context, name: string) {
  const absolute = prizeTilePathFor(name);
  if (absolute) {
    const data = await readBlob(absolute);
    if (data) return sendBinary(c, data, contentTypeFor(absolute));
  }
  return sendBinary(c, defaultPrizeTile(), "image/vnd-ms.dds");
}

/**
 * Serve raw bytes.
 *
 * Built as a plain `Response` rather than through `c.body`, whose `Data` type
 * does not admit a `Uint8Array`. A HEAD reply keeps the headers and drops the
 * payload.
 */
function sendBinary(
  c: Context,
  data: Uint8Array<ArrayBuffer>,
  contentType: string,
) {
  return new Response(c.req.method === "HEAD" ? null : data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=300",
    },
  });
}

/**
 * The part of the request path after `/WardrobeWars/Images/`, collapsing the
 * client's doubled leading slash and matching case-insensitively.
 */
function relativeAfterImages(path: string): string | null {
  const collapsed = path.replace(/^\/+/, "/");
  const marker = "/wardrobewars/images/";
  const index = collapsed.toLowerCase().indexOf(marker);
  if (index === -1) return null;
  const relative = collapsed.slice(index + marker.length);
  return relative.length > 0 ? relative : null;
}

/** The tile filename if this path addresses `prizes/`, otherwise null. */
function prizeTileName(relative: string): string | null {
  const lower = relative.toLowerCase();
  if (!lower.startsWith("prizes/")) return null;
  const name = relative.slice("prizes/".length);
  return name.length > 0 ? name : null;
}
