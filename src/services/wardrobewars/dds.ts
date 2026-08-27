/**
 * A tiny DXT1 DDS writer, used to generate reward tiles.
 *
 * `WWScreen:RenderReward` concatenates `<tex>` into a URL unconditionally, so a
 * reward without a loadable texture is not a cosmetic problem — it is a Lua
 * error that takes the whole minigame VM down. Rather than ship game art in the
 * repo, the service synthesises a plain DXT1 panel in the Wardrobe Wars palette
 * whenever no hand-made tile has been dropped into `WW_REWARD_TILE_DIR`.
 *
 * The prize's real name and description still come from the client's own
 * `ObjectRetrieveMetaData` lookup and are drawn over this panel, so the tile is
 * only ever a backdrop.
 */

const DDSD_CAPS = 0x1;
const DDSD_HEIGHT = 0x2;
const DDSD_WIDTH = 0x4;
const DDSD_PIXELFORMAT = 0x1000;
const DDSD_LINEARSIZE = 0x80000;
const DDPF_FOURCC = 0x4;
const DDSCAPS_TEXTURE = 0x1000;

/** Pack 8-bit RGB into the RGB565 word DXT1 stores endpoints in. */
function rgb565(r: number, g: number, b: number): number {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

/**
 * Build an opaque DXT1 texture whose colour is constant across each block row,
 * producing a smooth vertical gradient between two endpoint colours.
 *
 * Every block is emitted as `color0 == color1` with all-zero indices, which is
 * the canonical way to encode a flat block and needs no endpoint fitting.
 */
export function buildGradientDds(
  width: number,
  height: number,
  top: [number, number, number],
  bottom: [number, number, number],
): Uint8Array<ArrayBuffer> {
  const blocksX = Math.max(1, Math.ceil(width / 4));
  const blocksY = Math.max(1, Math.ceil(height / 4));
  const dataSize = blocksX * blocksY * 8;

  const buffer = new Uint8Array(128 + dataSize);
  const view = new DataView(buffer.buffer);

  view.setUint32(0, 0x20534444, true); // "DDS "
  view.setUint32(4, 124, true); // header size
  view.setUint32(
    8,
    DDSD_CAPS | DDSD_HEIGHT | DDSD_WIDTH | DDSD_PIXELFORMAT | DDSD_LINEARSIZE,
    true,
  );
  view.setUint32(12, height, true);
  view.setUint32(16, width, true);
  view.setUint32(20, dataSize, true); // linear size for a compressed surface
  view.setUint32(24, 0, true); // depth
  view.setUint32(28, 0, true); // mipmap count

  // Pixel format block at offset 76.
  view.setUint32(76, 32, true); // DDS_PIXELFORMAT size
  view.setUint32(80, DDPF_FOURCC, true);
  view.setUint32(84, 0x31545844, true); // "DXT1"

  view.setUint32(108, DDSCAPS_TEXTURE, true);

  let offset = 128;
  for (let by = 0; by < blocksY; by++) {
    const t = blocksY === 1 ? 0 : by / (blocksY - 1);
    const colour = rgb565(
      Math.round(top[0] + (bottom[0] - top[0]) * t),
      Math.round(top[1] + (bottom[1] - top[1]) * t),
      Math.round(top[2] + (bottom[2] - top[2]) * t),
    );
    for (let bx = 0; bx < blocksX; bx++) {
      view.setUint16(offset, colour, true); // color0
      view.setUint16(offset + 2, colour, true); // color1
      view.setUint32(offset + 4, 0, true); // every texel selects color0
      offset += 8;
    }
  }

  return buffer;
}

/**
 * The stand-in prize tile: the Wardrobe Wars blue-grey (`WWScreen.BlueGrey`,
 * 0.298/0.369/0.451) fading into the near-black the game uses behind podiums.
 *
 * Sized 340x352 to match the thirteen surviving retail tiles, so a prize with
 * no artwork sits on screen at the same scale as one that has it.
 */
let cachedDefaultTile: Uint8Array<ArrayBuffer> | undefined;

export function defaultPrizeTile(): Uint8Array<ArrayBuffer> {
  if (!cachedDefaultTile) {
    cachedDefaultTile = buildGradientDds(340, 352, [76, 94, 115], [18, 23, 26]);
  }
  return cachedDefaultTile;
}
