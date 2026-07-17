import type { FieldConfidence, ParsedDuration } from "./types";
import { stripHtml } from "./sanitize-html";

/**
 * Parse ISO-8601 durations (PT1H30M) and common human forms ("1 hr 30 min").
 * Returns minutes; null when unparseable.
 */
export function parseDuration(raw: unknown): ParsedDuration {
  const text = stripHtml(raw);
  if (!text) {
    return {
      raw: null,
      minutes: null,
      confidence: { level: "missing", reason: "No duration provided" },
    };
  }

  const iso = tryParseIso8601(text);
  if (iso != null) {
    return {
      raw: text,
      minutes: iso,
      confidence: confident("Parsed ISO-8601 duration"),
    };
  }

  const human = tryParseHuman(text);
  if (human != null) {
    return {
      raw: text,
      minutes: human,
      confidence: confident("Parsed human duration"),
    };
  }

  // Plain integer minutes
  const plain = text.match(/^(\d{1,4})\s*(?:m|min|mins|minutes?)?$/i);
  if (plain) {
    return {
      raw: text,
      minutes: Number(plain[1]),
      confidence: { level: "needs_review", reason: "Assumed minutes" },
    };
  }

  return {
    raw: text,
    minutes: null,
    confidence: {
      level: "needs_review",
      reason: "Could not parse duration",
    },
  };
}

export function durationConflictWarning(
  prep: number | null,
  cook: number | null,
  total: number | null,
): boolean {
  if (prep == null || cook == null || total == null) return false;
  return prep + cook !== total;
}

function tryParseIso8601(text: string): number | null {
  // Full form: PnYnMnDTnHnMnS — recipes usually use time part only
  const m = text.trim().match(
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i,
  );
  if (!m) return null;
  const years = Number(m[1] ?? 0);
  const months = Number(m[2] ?? 0);
  const weeks = Number(m[3] ?? 0);
  const days = Number(m[4] ?? 0);
  const hours = Number(m[5] ?? 0);
  const minutes = Number(m[6] ?? 0);
  const seconds = Number(m[7] ?? 0);
  if (
    years === 0 &&
    months === 0 &&
    weeks === 0 &&
    days === 0 &&
    hours === 0 &&
    minutes === 0 &&
    seconds === 0 &&
    !/T|\d/.test(text)
  ) {
    return null;
  }
  const total =
    years * 525600 +
    months * 43200 +
    weeks * 10080 +
    days * 1440 +
    hours * 60 +
    minutes +
    Math.round(seconds / 60);
  return Number.isFinite(total) ? total : null;
}

function tryParseHuman(text: string): number | null {
  const lower = text.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  let total = 0;
  let matched = false;

  const patterns: Array<[RegExp, number]> = [
    [/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/g, 60],
    [/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/g, 1],
    [/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/g, 1 / 60],
    [/(\d+(?:\.\d+)?)\s*(?:days?|d)\b/g, 1440],
  ];

  for (const [re, factor] of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      total += Number(m[1]) * factor;
      matched = true;
    }
  }

  // "1:30" as h:mm when under 24h
  const colon = lower.match(/^(\d{1,2}):([0-5]\d)$/);
  if (colon) {
    return Number(colon[1]) * 60 + Number(colon[2]);
  }

  if (!matched) return null;
  return Math.round(total);
}

function confident(reason: string): FieldConfidence {
  return { level: "confident", reason };
}
