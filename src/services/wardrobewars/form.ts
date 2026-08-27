import type { Context } from "hono";

export interface ClientFile {
  field: string;
  filename: string;
  contentType: string;
  data: Uint8Array;
}

export class ClientBody {
  private readonly fieldMap: Map<string, string>;
  readonly files: ClientFile[];

  constructor(fieldMap: Map<string, string>, files: ClientFile[]) {
    this.fieldMap = fieldMap;
    this.files = files;
  }

  /** Case-insensitive field lookup. */
  get(name: string): string | undefined {
    return this.fieldMap.get(name.toLowerCase());
  }

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
  const fields = new Map<string, string>();
  const files: ClientFile[] = [];

  let form: FormData;
  try {
    form = await c.req.raw.formData();
  } catch {
    return new ClientBody(fields, files);
  }

  for (const [key, value] of form.entries()) {
    const name = key.toLowerCase();
    if (typeof value === "string") {
      if (!fields.has(name)) fields.set(name, value);
      continue;
    }
    // The configured libs narrow the non-string branch to `never`, so name the
    // type the runtime actually hands back.
    const part = value as unknown as File;
    files.push({
      field: name,
      filename: part.name,
      contentType: part.type,
      data: new Uint8Array(await part.arrayBuffer()),
    });
  }

  return new ClientBody(fields, files);
}
