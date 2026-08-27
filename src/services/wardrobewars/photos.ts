import { existsSync, mkdirSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { wwConfig } from "./config";

/**
 * Entry-photo blob storage.
 *
 * Photos are laid out exactly the way the retail CDN did it —
 * `<YYYY-MM-DD>/<psnid>-<HH-MM-SS>.dds` — so the 2012 archive under
 * `dh.production/WardrobeWars/Images` can be dropped in as-is, and so anything
 * this service writes could be published back to that same CDN prefix later
 * without a rename.
 */

const photoRoot = resolve(wwConfig.photoRoot);
const prizeTileRoot = resolve(wwConfig.prizeTileDir);

export function ensurePhotoDirs(): void {
  mkdirSync(photoRoot, { recursive: true });
  mkdirSync(prizeTileRoot, { recursive: true });
}

/** PSN online IDs are 3-16 of `[A-Za-z0-9_-]`; never trust the client's copy. */
export function sanitisePsnId(raw: string): string {
  const cleaned = (raw ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16);
  return cleaned || "Unknown";
}

/**
 * Resolve a client-supplied relative path inside a root directory, refusing
 * anything that escapes it. Returns null rather than throwing so callers can
 * answer 404 without distinguishing "missing" from "malicious".
 */
export function safeJoin(root: string, relative: string): string | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(relative);
    } catch {
      return relative;
    }
  })();
  if (decoded.includes("\0")) return null;

  const full = resolve(root, normalize(decoded).replace(/^([/\\])+/, ""));
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

/** Absolute path of an entry photo, or null if the path escapes the root. */
export function photoPathFor(relative: string): string | null {
  return safeJoin(photoRoot, relative);
}

/** Absolute path of a prize tile, or null if the path escapes the root. */
export function prizeTilePathFor(relative: string): string | null {
  return safeJoin(prizeTileRoot, relative);
}

/**
 * Read a stored blob, or null when it is missing or unreadable.
 *
 * Typed as `Uint8Array<ArrayBuffer>` because the result is handed straight to
 * `Response`, whose `BodyInit` will not accept a possibly-shared buffer.
 */
export async function readBlob(
  absolute: string,
): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return null;
    return new Uint8Array(await readFile(absolute));
  } catch {
    return null;
  }
}

/**
 * Pick a file extension from the magic bytes.
 *
 * The client uploads whatever `Screenshot.Create()` produced, and the retail
 * archive is DDS, but the part is nominally named `shot.jpg` — so sniff rather
 * than trust either the name or the declared content type.
 */
export function extensionFor(data: Uint8Array): string {
  if (data.length >= 4) {
    if (data[0] === 0x44 && data[1] === 0x44 && data[2] === 0x53 && data[3] === 0x20) {
      return "dds"; // "DDS "
    }
    if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
      return "png";
    }
  }
  return "dds";
}

/** Content type to serve a stored blob with, by extension. */
export function contentTypeFor(path: string): string {
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  return "image/vnd-ms.dds";
}

/**
 * Write a submitted photo and return its path relative to the photo root.
 *
 * The `HH-MM-SS` stamp is taken in the contest timezone so the filename agrees
 * with the day folder it lands in. A same-second collision (the same player
 * entering twice within one second) gets a numeric suffix rather than silently
 * overwriting the earlier entry.
 */
export async function storePhoto(
  psnid: string,
  dayKey: string,
  data: Uint8Array,
): Promise<string> {
  const safeId = sanitisePsnId(psnid);
  const stamp = new Intl.DateTimeFormat("en-GB", {
    timeZone: wwConfig.timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(/:/g, "-");

  const extension = extensionFor(data);
  let relative = `${dayKey}/${safeId}-${stamp}.${extension}`;
  let absolute = photoPathFor(relative);
  if (!absolute) throw new Error("refused to write outside the photo root");

  let attempt = 1;
  while (existsSync(absolute)) {
    relative = `${dayKey}/${safeId}-${stamp}-${attempt}.${extension}`;
    absolute = photoPathFor(relative);
    if (!absolute) throw new Error("refused to write outside the photo root");
    attempt++;
  }

  mkdirSync(dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
  return relative;
}

export interface SeedPhoto {
  /** Path relative to the photo root, once copied in. */
  relative: string;
  /** PSN ID recovered from the retail `<psnid>-<HH-MM-SS>.dds` filename. */
  psnid: string;
  /** `YYYY-MM-DD` folder name it was filed under. */
  dayKey: string;
  data: Uint8Array;
}

const DAY_DIR = /^\d{4}-\d{2}-\d{2}$/;
const ARCHIVE_NAME = /^(.+)-\d{2}-\d{2}-\d{2}\.(dds|jpg|jpeg|png)$/i;

/**
 * Walk an archive directory laid out as `<YYYY-MM-DD>/<psnid>-<HH-MM-SS>.dds`
 * and yield everything it holds. Used to import the 258 real 2012 entries so a
 * fresh install does not open with eight empty podiums.
 */
export async function collectSeedPhotos(seedDir: string): Promise<SeedPhoto[]> {
  const out: SeedPhoto[] = [];
  let days: string[];
  try {
    days = await readdir(seedDir);
  } catch {
    return out;
  }

  for (const day of days.sort()) {
    if (!DAY_DIR.test(day)) continue;
    let files: string[];
    try {
      files = await readdir(join(seedDir, day));
    } catch {
      continue;
    }
    for (const name of files.sort()) {
      const match = ARCHIVE_NAME.exec(name);
      if (!match) continue;
      const data = await readBlob(join(seedDir, day, name));
      if (!data || data.length === 0) continue;
      out.push({
        relative: `${day}/${name}`,
        psnid: sanitisePsnId(match[1]),
        dayKey: day,
        data,
      });
    }
  }
  return out;
}

/** Copy a seed photo into the blob root, leaving the archive untouched. */
export async function writeSeedPhoto(photo: SeedPhoto): Promise<void> {
  const absolute = photoPathFor(photo.relative);
  if (!absolute) return;
  if (existsSync(absolute)) return;
  mkdirSync(dirname(absolute), { recursive: true });
  await writeFile(absolute, photo.data);
}

const PRIZE_TILE_NAME = /^[0-9A-Fa-f]{8}(-[0-9A-Fa-f]{8}){3}\.dds$/;

/**
 * Import the retail prize tiles that sit in `<archive>/prizes/`.
 *
 * These are the real 340x352 DXT1 thumbnails the big screens showed for each
 * prize object, named by GUID. Copying them in means an install pointed at the
 * CDN archive gets authentic artwork for the prizes that have it, and the
 * generated stand-in only for those that never did.
 *
 * Returns how many tiles were newly written.
 */
export async function importPrizeTiles(seedDir: string): Promise<number> {
  const source = join(seedDir, "prizes");
  let files: string[];
  try {
    files = await readdir(source);
  } catch {
    return 0;
  }

  mkdirSync(prizeTileRoot, { recursive: true });
  let written = 0;
  for (const name of files) {
    if (!PRIZE_TILE_NAME.test(name)) continue;
    const target = prizeTilePathFor(name);
    if (!target || existsSync(target)) continue;
    const data = await readBlob(join(source, name));
    if (!data || data.length === 0) continue;
    await writeFile(target, data);
    written++;
  }
  return written;
}
