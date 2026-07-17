import * as cheerio from "cheerio";

/**
 * Strip HTML tags and decode entities for text fields.
 * Never persist raw HTML from recipe pages.
 */
export function stripHtml(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "number" || typeof input === "boolean") {
    return String(input);
  }
  if (typeof input !== "string") {
    if (typeof input === "object" && input !== null) {
      // schema.org TextObject / NameObject
      const obj = input as Record<string, unknown>;
      if (typeof obj["@value"] === "string") return stripHtml(obj["@value"]);
      if (typeof obj.name === "string") return stripHtml(obj.name);
      if (typeof obj.text === "string") return stripHtml(obj.text);
      if (typeof obj.value === "string") return stripHtml(obj.value);
    }
    return "";
  }

  const raw = input.trim();
  if (!raw) return "";

  // Fast path: no angle brackets
  if (!/[<>]/.test(raw)) {
    return decodeBasicEntities(collapseWhitespace(raw));
  }

  try {
    const $ = cheerio.load(`<div id="__hos_strip">${raw}</div>`, {
      xml: false,
    });
    // Remove non-text noise
    $("script, style, noscript, iframe, svg, template").remove();
    const text = $("#__hos_strip").text();
    return decodeBasicEntities(collapseWhitespace(text));
  } catch {
    return decodeBasicEntities(
      collapseWhitespace(raw.replace(/<[^>]*>/g, " ")),
    );
  }
}

export function stripHtmlList(values: unknown): string[] {
  if (values == null) return [];
  const list = Array.isArray(values) ? values : [values];
  return list
    .map((v) => stripHtml(v))
    .map((s) => s.trim())
    .filter(Boolean);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => {
      const code = Number.parseInt(h, 16);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    });
}
