/**
 * Extract purchase date candidates from receipt text (US formats).
 * Ambiguous values are preserved for review — never silently reinterpreted.
 */

export type DateCandidate = {
  isoDate: string | null;
  sourceText: string;
  ambiguous: boolean;
  confidence: number;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1990 || year > 2100) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function expandYear(y: number): number {
  if (y >= 100) return y;
  return y >= 70 ? 1900 + y : 2000 + y;
}

export function extractDateCandidates(text: string): DateCandidate[] {
  const candidates: DateCandidate[] = [];
  const seen = new Set<string>();

  const push = (c: DateCandidate) => {
    const key = `${c.isoDate ?? "null"}|${c.sourceText}|${c.ambiguous}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(c);
  };

  // 2026-07-29 / 2026/07/29
  for (const m of text.matchAll(/\b((?:19|20)\d{2})[/-](\d{1,2})[/-](\d{1,2})\b/g)) {
    const iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
    push({
      isoDate: iso,
      sourceText: m[0],
      ambiguous: false,
      confidence: iso ? 0.95 : 0.2,
    });
  }

  // 07/29/2026, 7/29/26, 07-29-2026
  for (const m of text.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = expandYear(Number(m[3]));
    // Prefer US MDY; flag ambiguity when both parts are <= 12
    const ambiguous = a <= 12 && b <= 12 && a !== b;
    const iso = toIso(year, a, b);
    push({
      isoDate: iso,
      sourceText: m[0],
      ambiguous,
      confidence: iso ? (ambiguous ? 0.65 : 0.9) : 0.2,
    });
  }

  // Jul 29, 2026 / July 29 2026
  for (const m of text.matchAll(
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+((?:19|20)\d{2}|\d{2})\b/g,
  )) {
    const month = MONTHS[m[1].toLowerCase()];
    if (!month) continue;
    const iso = toIso(expandYear(Number(m[3])), month, Number(m[2]));
    push({
      isoDate: iso,
      sourceText: m[0],
      ambiguous: false,
      confidence: iso ? 0.92 : 0.2,
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

export function extractPurchaseTime(text: string): { value: string | null; sourceText: string | null; confidence: number } {
  const m = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(AM|PM)?\b/i);
  if (!m) return { value: null, sourceText: null, confidence: 0 };
  let hour = Number(m[1]);
  const minute = m[2];
  const second = m[3] ?? "00";
  const ampm = m[4]?.toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return {
    value: `${pad(hour)}:${minute}:${second}`,
    sourceText: m[0],
    confidence: 0.8,
  };
}
