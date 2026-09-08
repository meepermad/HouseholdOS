/**
 * Safe text normalization for pasted HouseholdOS receipts.
 * Structural only: does not reinterpret money or invent missing fields.
 */

export type NormalizedReceiptPaste = {
  text: string;
  fenceStripped: boolean;
  blockquoteStripped: boolean;
};

const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const ZERO_WIDTH = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
const SMART_APOSTROPHE = /[\u2018\u2019\u201B\u2032]/g;
const SMART_QUOTES = /[\u201C\u201D\u201F\u2033]/g;
const UNICODE_HYPHEN = /[\u2010\u2011\u2012\u2043]/g;
const UNICODE_DOLLAR = /[\uFF04\uFE69]/g;
const UNICODE_PIPE = /[\u00A6\u2502\u2503\u2551\uFF5C\u2223]/g;
const FENCE_LINE = /^\s{0,3}(`{3,}|~{3,})[^\n]*$/;
const BLOCKQUOTE_PREFIX = /^\s{0,3}>\s?/;

function normalizeNewlines(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripFenceLines(lines: string[]): { lines: string[]; stripped: boolean } {
  const out: string[] = [];
  let stripped = false;
  for (const line of lines) {
    if (FENCE_LINE.test(line.trim())) {
      stripped = true;
      continue;
    }
    out.push(line);
  }
  return { lines: out, stripped };
}

function stripBlockquotes(lines: string[]): { lines: string[]; stripped: boolean } {
  let stripped = false;
  const next = lines.map((line) => {
    if (!BLOCKQUOTE_PREFIX.test(line)) return line;
    stripped = true;
    return line.replace(BLOCKQUOTE_PREFIX, "");
  });
  return { lines: next, stripped };
}

function normalizeLine(line: string): string {
  return line
    .replace(UNICODE_SPACES, " ")
    .replace(/\t/g, " ")
    .replace(/[ \t]+$/g, "");
}

/**
 * Unwrap a whole-line markdown decoration without touching interior punctuation.
 */
export function unwrapMarkdownLine(line: string): string {
  let text = line.trim();
  if (!text) return "";
  text = text.replace(/^\*{1,2}([^*]+)\*{1,2}$/u, "$1").trim();
  text = text.replace(/^_{1,2}([^_]+)_{1,2}$/u, "$1").trim();
  text = text.replace(/^#{1,6}\s+(.+)$/u, "$1").trim();
  text = text.replace(/^`([^`]+)`$/u, "$1").trim();
  return text;
}

/**
 * Normalize a paste so ChatGPT / Live Text / Lens copies can be parsed
 * without changing financial meaning or corrupting product names.
 */
export function normalizeReceiptPasteInput(rawText: string): NormalizedReceiptPaste {
  let text = normalizeNewlines(String(rawText ?? ""));
  text = text.normalize("NFKC");
  text = text.replace(ZERO_WIDTH, "");
  text = text.replace(SMART_APOSTROPHE, "'");
  text = text.replace(SMART_QUOTES, '"');
  text = text.replace(UNICODE_HYPHEN, "-");
  text = text.replace(UNICODE_DOLLAR, "$");
  text = text.replace(UNICODE_PIPE, "|");

  let lines = text.split("\n").map(normalizeLine);
  const fences = stripFenceLines(lines);
  lines = fences.lines;
  const quotes = stripBlockquotes(lines);
  lines = quotes.lines;

  text = lines.join("\n").trim();
  return {
    text,
    fenceStripped: fences.stripped,
    blockquoteStripped: quotes.stripped,
  };
}

export function splitUnescapedPipes(line: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && line[i + 1] === "|") {
      current += "|";
      i += 1;
      continue;
    }
    if (ch === "|") {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts;
}

export function replacePasteLine(
  raw: string,
  originalLine: string,
  nextLine: string,
): string {
  const newline = raw.includes("\r\n") ? "\r\n" : raw.includes("\r") ? "\r" : "\n";
  const lines = normalizeNewlines(raw).split("\n");
  const needle = originalLine.trim();
  const idx = lines.findIndex((line) => line.trim() === needle);
  if (idx < 0) return raw;
  lines[idx] = nextLine;
  return lines.join(newline);
}

export function findLineNumberInText(raw: string, originalLine: string): number | null {
  const lines = normalizeNewlines(raw).split("\n");
  const needle = originalLine.trim();
  const idx = lines.findIndex((line) => line.trim() === needle);
  return idx >= 0 ? idx + 1 : null;
}
