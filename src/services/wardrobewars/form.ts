import type { Context } from "hono";

/**
 * Body parsing for the PlayStation Home client.
 *
 * `HttpPostData` on the PS3 hand-rolls both `application/x-www-form-urlencoded`
 * and `multipart/form-data`, and the exact bytes it emits are not documented.
 * This parser is therefore deliberately permissive:
 *
 *   - field names are matched case-insensitively, because the game is not
 *     internally consistent (`WW.CreatePostData` sends `region`, while
 *     `WWScenePhoto` sends `Region`)
 *   - the multipart boundary is taken from the Content-Type header when present
 *     and sniffed from the first body line otherwise
 *   - both CRLF and bare LF header terminators are accepted
 *   - a body that is not multipart is retried as urlencoded regardless of what
 *     the Content-Type header claimed
 *
 * Parsing is done over raw bytes so binary parts (the PSN ticket, the DDS
 * screenshot) survive intact.
 */

export interface ClientFile {
  field: string;
  filename: string;
  contentType: string;
  data: Uint8Array;
}

export class ClientBody {
  private readonly fieldMap: Map<string, string>;
  readonly files: ClientFile[];
  readonly raw: Uint8Array;

  constructor(
    fieldMap: Map<string, string>,
    files: ClientFile[],
    raw: Uint8Array,
  ) {
    this.fieldMap = fieldMap;
    this.files = files;
    this.raw = raw;
  }

  /** Case-insensitive field lookup. */
  get(name: string): string | undefined {
    return this.fieldMap.get(name.toLowerCase());
  }

  /** Case-insensitive field lookup with a fallback. */
  str(name: string, fallback = ""): string {
    return this.get(name) ?? fallback;
  }

  /** Integer field lookup; returns `fallback` when absent or unparseable. */
  int(name: string, fallback = 0): number {
    const raw = this.get(name);
    if (raw === undefined) return fallback;
    const n = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Every field name that was present, for logging. */
  fieldNames(): string[] {
    return [...this.fieldMap.keys()];
  }

  /**
   * The named upload part, or — since the client's part names vary between
   * endpoints (`file`, `thefile`) — the first uploaded part of any name.
   */
  file(...names: string[]): ClientFile | undefined {
    for (const name of names) {
      const lower = name.toLowerCase();
      const hit = this.files.find((f) => f.field === lower);
      if (hit) return hit;
    }
    return this.files[0];
  }
}

/** Read and parse a request body sent by the Home client. */
export async function parseClientBody(c: Context): Promise<ClientBody> {
  const raw = new Uint8Array(await c.req.arrayBuffer());
  const contentType = c.req.header("content-type") ?? "";

  const boundary = findBoundary(contentType, raw);
  if (boundary) {
    const parsed = parseMultipart(raw, boundary);
    // A boundary that matched nothing means the sniff was wrong — fall through.
    if (parsed.fields.size > 0 || parsed.files.length > 0) {
      return new ClientBody(parsed.fields, parsed.files, raw);
    }
  }

  return new ClientBody(parseUrlEncoded(decodeLatin1(raw)), [], raw);
}

function findBoundary(contentType: string, raw: Uint8Array): string | null {
  const declared = /boundary="?([^";,\s]+)"?/i.exec(contentType);
  if (declared?.[1]) return declared[1];

  // No usable header — if the body opens with a delimiter line, use that.
  if (raw.length > 4 && raw[0] === 0x2d && raw[1] === 0x2d) {
    let end = 2;
    while (end < raw.length && raw[end] !== 0x0d && raw[end] !== 0x0a) end++;
    if (end > 2 && end < 256) {
      return decodeLatin1(raw.subarray(2, end));
    }
  }
  return null;
}

function parseMultipart(
  raw: Uint8Array,
  boundary: string,
): { fields: Map<string, string>; files: ClientFile[] } {
  const fields = new Map<string, string>();
  const files: ClientFile[] = [];

  const delimiter = encodeAscii(`--${boundary}`);
  const positions: number[] = [];
  let cursor = indexOfBytes(raw, delimiter, 0);
  while (cursor !== -1) {
    positions.push(cursor);
    cursor = indexOfBytes(raw, delimiter, cursor + delimiter.length);
  }
  if (positions.length < 2) return { fields, files };

  for (let i = 0; i < positions.length - 1; i++) {
    let start = positions[i] + delimiter.length;
    // Skip the trailing "--" of a closing delimiter, then the EOL.
    if (raw[start] === 0x2d && raw[start + 1] === 0x2d) break;
    if (raw[start] === 0x0d) start++;
    if (raw[start] === 0x0a) start++;

    let end = positions[i + 1];
    // The delimiter is preceded by the EOL that terminates the part body.
    if (end > start && raw[end - 1] === 0x0a) end--;
    if (end > start && raw[end - 1] === 0x0d) end--;
    if (end <= start) continue;

    const part = raw.subarray(start, end);
    const split = findHeaderEnd(part);
    if (split === null) continue;

    const headerText = decodeLatin1(part.subarray(0, split.headerEnd));
    const body = part.subarray(split.bodyStart);

    const name = /name="?([^";\r\n]*)"?/i.exec(headerText)?.[1]?.trim() ?? "";
    const filename =
      /filename="?([^";\r\n]*)"?/i.exec(headerText)?.[1]?.trim() ?? "";
    const partType =
      /content-type:\s*([^\r\n;]+)/i.exec(headerText)?.[1]?.trim() ?? "";
    if (!name) continue;

    if (filename) {
      files.push({
        field: name.toLowerCase(),
        filename,
        contentType: partType,
        data: body,
      });
    } else {
      fields.set(name.toLowerCase(), decodeUtf8(body));
    }
  }

  return { fields, files };
}

function findHeaderEnd(
  part: Uint8Array,
): { headerEnd: number; bodyStart: number } | null {
  for (let i = 0; i + 1 < part.length; i++) {
    if (part[i] === 0x0a && part[i + 1] === 0x0a) {
      return { headerEnd: i, bodyStart: i + 2 };
    }
    if (
      i + 3 < part.length &&
      part[i] === 0x0d &&
      part[i + 1] === 0x0a &&
      part[i + 2] === 0x0d &&
      part[i + 3] === 0x0a
    ) {
      return { headerEnd: i, bodyStart: i + 4 };
    }
  }
  return null;
}

function parseUrlEncoded(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of text.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? "" : pair.slice(eq + 1);
    const key = decodeComponent(rawKey).trim().toLowerCase();
    if (!key) continue;
    out.set(key, decodeComponent(rawValue));
  }
  return out;
}

function decodeComponent(value: string): string {
  const plussed = value.replace(/\+/g, " ");
  try {
    return decodeURIComponent(plussed);
  } catch {
    // A stray '%' is not worth losing the whole field over.
    return plussed;
  }
}

function indexOfBytes(
  haystack: Uint8Array,
  needle: Uint8Array,
  from: number,
): number {
  if (needle.length === 0) return -1;
  const last = haystack.length - needle.length;
  outer: for (let i = Math.max(0, from); i <= last; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function encodeAscii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function decodeLatin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
}
