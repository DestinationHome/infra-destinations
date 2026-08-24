import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";

export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: false,
});

export const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  suppressEmptyNode: false,
  format: false,
});

/**
 * Serialize an object tree into XML text.
 */
export function buildXml(obj: unknown): string {
  return xmlBuilder.build(obj);
}

/**
 * Parse an XML string into a JS object tree.
 */
export function parseXml(xmlString: string): Record<string, unknown> {
  return xmlParser.parse(xmlString);
}

/**
 * Helper to serialize object to XML and return a Hono HTTP response with text/xml content-type.
 */
export function apiXml(c: Context, data: unknown, status: StatusCode = 200) {
  const xml = buildXml(data);
  return c.text(xml, status, {
    "Content-Type": "text/xml",
  });
}
