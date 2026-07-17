import type { FieldConfidence, ParsedYield } from "./types";
import { stripHtml } from "./sanitize-html";

const SERVING_WORDS =
  /\b(servings?|serves?|portions?|people|persons?|pax)\b/i;
const PIECE_WORDS =
  /\b(cookies?|biscuits?|bars?|brownies?|muffins?|cupcakes?|loaves|loaf|slices?|pieces?|rolls?|buns?|bagels?|crackers?|candies|candy|balls?|patties|waffles?|pancakes?|doughnuts?|donuts?|scones?)\b/i;

/**
 * Parse recipeYield / servings. Always keep raw text.
 * Do not treat cookies/loaves/etc. as people servings.
 */
export function parseYield(raw: unknown): ParsedYield {
  const text = stripHtml(raw);
  if (!text) {
    return {
      raw: null,
      servings: null,
      yieldKind: "unknown",
      confidence: { level: "missing", reason: "No yield provided" },
    };
  }

  const pieceHit = PIECE_WORDS.test(text);
  const servingHit = SERVING_WORDS.test(text);

  const numbers = extractNumbers(text);
  const primary = numbers[0] ?? null;

  if (pieceHit && !servingHit) {
    return {
      raw: text,
      servings: null,
      yieldKind: "pieces",
      confidence: {
        level: "needs_review",
        reason: "Yield looks like pieces/baked goods, not people servings",
      },
    };
  }

  if (primary != null && (servingHit || looksLikePlainServings(text, primary))) {
    return {
      raw: text,
      servings: primary,
      yieldKind: "servings",
      confidence: servingHit
        ? confident("Parsed numeric servings")
        : {
            level: "needs_review",
            reason: "Assumed bare number is servings",
          },
    };
  }

  if (primary != null && pieceHit) {
    return {
      raw: text,
      servings: null,
      yieldKind: "pieces",
      confidence: {
        level: "needs_review",
        reason: "Numeric yield with piece units",
      },
    };
  }

  if (primary != null) {
    return {
      raw: text,
      servings: null,
      yieldKind: "other",
      confidence: {
        level: "needs_review",
        reason: "Ambiguous yield — kept raw text only",
      },
    };
  }

  return {
    raw: text,
    servings: null,
    yieldKind: "unknown",
    confidence: {
      level: "needs_review",
      reason: "Could not extract numeric yield",
    },
  };
}

function looksLikePlainServings(text: string, n: number): boolean {
  const cleaned = text.replace(/[^\d./\s-]/g, "").trim();
  // Entire string is essentially just the number (or range)
  return (
    cleaned.length > 0 &&
    Math.abs(cleaned.length - String(n).length) <= 4 &&
    !PIECE_WORDS.test(text)
  );
}

function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

function confident(reason: string): FieldConfidence {
  return { level: "confident", reason };
}
