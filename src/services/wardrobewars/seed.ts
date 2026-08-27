import { log } from "@main";
import { wwConfig } from "./config";
import { periodKeysFromDayKey } from "./periods";
import {
  collectSeedPhotos,
  ensurePhotoDirs,
  importPrizeTiles,
  writeSeedPhoto,
} from "./photos";
import { countEntries, createEntry } from "./store";

/**
 * Optional one-off import of an archive of past entries.
 *
 * Destination Home's CDN still carries the 258 real photos players submitted in
 * 2012, under `WardrobeWars/Images/<YYYY-MM-DD>/<psnid>-<HH-MM-SS>.dds`. Point
 * `WW_SEED_DIR` at that directory and a fresh install opens with the podiums
 * already populated instead of eight blank plinths.
 *
 * It only ever runs against an empty table, so restarting the service will not
 * duplicate anything, and it copies rather than moves — the archive is left
 * untouched.
 */
export async function seedArchiveIfEmpty(): Promise<void> {
  try {
    ensurePhotoDirs();
  } catch (error) {
    // An unwritable data volume breaks uploads, but the read-only half of the
    // game still works — say so loudly and carry on.
    log.error(
      `[WW] could not create the photo directories under ${wwConfig.photoRoot}: ${String(error)}`,
    );
    return;
  }

  if (!wwConfig.seedDir) return;

  // Prize artwork is independent of the entry import: it is a small fixed set,
  // so refresh it whenever it is missing rather than only on a virgin install.
  const tiles = await importPrizeTiles(wwConfig.seedDir);
  if (tiles > 0) log.info(`[WW] imported ${tiles} prize tiles`);

  const existing = await countEntries();
  if (existing > 0) {
    log.debug(`[WW] seed skipped: ${existing} entries already present`);
    return;
  }

  const photos = await collectSeedPhotos(wwConfig.seedDir);
  if (photos.length === 0) {
    log.warn(`[WW] seed directory held no usable photos: ${wwConfig.seedDir}`);
    return;
  }

  let imported = 0;
  for (const photo of photos) {
    try {
      await writeSeedPhoto(photo);
      const keys = periodKeysFromDayKey(photo.dayKey);
      await createEntry({
        psnid: photo.psnid,
        territory: "",
        region: "",
        language: "",
        imagePath: photo.relative,
        dayKey: keys.day,
        weekKey: keys.week,
        monthKey: keys.month,
        archived: true,
        // Dated to the contest day they were taken, not to import time.
        createdAt: Date.parse(`${photo.dayKey}T12:00:00Z`) || Date.now(),
      });
      imported++;
    } catch (error) {
      log.warn(`[WW] could not import ${photo.relative}: ${String(error)}`);
    }
  }

  log.info(`[WW] imported ${imported} archived entries from ${wwConfig.seedDir}`);
}
