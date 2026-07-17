import type { QuantityUnit } from "@/lib/house/types";
import type { QuantityMode } from "../types";
import type { FieldConfidence, ParsedIngredient } from "./types";
import { stripHtml } from "./sanitize-html";

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const UNIT_ALIASES: Array<{ pattern: RegExp; unit: QuantityUnit }> = [
  { pattern: /^(tablespoons?|tbsps?|tbs|tb)$/i, unit: "tablespoon" },
  { pattern: /^(teaspoons?|tsps?|tsp|t)$/i, unit: "teaspoon" },
  { pattern: /^(cups?|c)$/i, unit: "cup" },
  { pattern: /^(ounces?|oz)$/i, unit: "ounce" },
  { pattern: /^(pounds?|lbs?|lb)$/i, unit: "pound" },
  { pattern: /^(grams?|grammes?|g)$/i, unit: "gram" },
  { pattern: /^(kilograms?|kgs?|kg)$/i, unit: "kilogram" },
  { pattern: /^(millilit(?:er|re)s?|mls?|ml)$/i, unit: "milliliter" },
  { pattern: /^(lit(?:er|re)s?|l)$/i, unit: "liter" },
  { pattern: /^(cans?)$/i, unit: "can" },
  { pattern: /^(jars?)$/i, unit: "jar" },
  { pattern: /^(boxes?|bx)$/i, unit: "box" },
  { pattern: /^(bags?)$/i, unit: "bag" },
  { pattern: /^(bottles?)$/i, unit: "bottle" },
  { pattern: /^(packs?|packages?|pkg)$/i, unit: "pack" },
  { pattern: /^(servings?)$/i, unit: "serving" },
  {
    pattern: /^(cloves?|stalks?|sprigs?|slices?|pieces?|heads?|bunches?|ears?|pinches?|dashes?|drops?|sticks?|whole)$/i,
    unit: "item",
  },
];

/**
 * Parse a single ingredient line conservatively.
 * Always retains originalText; never invents units when uncertain.
 */
export function parseIngredientLine(
  raw: unknown,
  sortOrder = 0,
  currentGroup: string | null = null,
): ParsedIngredient {
  const originalText = stripHtml(raw);
  const text = originalText.trim();

  if (!text) {
    return emptyIngredient(originalText, sortOrder, currentGroup, {
      level: "missing",
      reason: "Empty ingredient line",
    });
  }

  if (isSectionHeading(text)) {
    return {
      originalText,
      displayName: text.replace(/:\s*$/, "").trim(),
      quantity: null,
      quantityMax: null,
      unit: "unknown",
      quantityMode: "exact",
      preparationNote: null,
      ingredientGroup: text.replace(/:\s*$/, "").trim(),
      required: true,
      sortOrder,
      confidence: { level: "confident", reason: "Section heading" },
      isSectionHeading: true,
    };
  }

  let working = text;
  let required = true;
  let quantityMode: QuantityMode = "exact";
  const notes: string[] = [];

  // Optional markers
  if (
    /^\s*\(?\s*optional\s*\)?\s*/i.test(working) ||
    /\boptional\b/i.test(working)
  ) {
    required = false;
    quantityMode = "optional";
    working = working
      .replace(/^\s*\(?\s*optional\s*\)?\s*/i, "")
      .replace(/\(?\s*optional\s*\)?/gi, "")
      .trim();
  }

  // To taste / as needed
  if (/\bto taste\b/i.test(working)) {
    quantityMode = "to_taste";
    working = working.replace(/\b,??\s*to taste\b/gi, "").trim();
  } else if (/\bas needed\b/i.test(working)) {
    quantityMode = "as_needed";
    working = working.replace(/\b,??\s*as needed\b/gi, "").trim();
  } else if (/\bapproximately\b|\babout\b|\bapprox\.?\b|~/i.test(working)) {
    if (quantityMode === "exact") quantityMode = "approximate";
  }

  const qty = takeQuantity(working);
  working = qty.rest;

  let unit: QuantityUnit = "unknown";
  let unitConfidence: FieldConfidence = {
    level: "needs_review",
    reason: "No unit detected",
  };

  if (qty.quantity != null || qty.quantityMax != null) {
    const unitTake = takeUnit(working);
    if (unitTake.unit) {
      unit = unitTake.unit;
      working = unitTake.rest;
      unitConfidence = { level: "confident", reason: "Recognized unit" };
    } else {
      // Countable item without explicit unit
      unit = "item";
      unitConfidence = {
        level: "needs_review",
        reason: "Assumed item unit",
      };
    }
  }

  // Split name / preparation note on comma or " - "
  let displayName = working.trim();
  let preparationNote: string | null = null;

  const noteSplit = displayName.match(
    /^(.+?)(?:,\s+|\s+[–—-]\s+)(.+)$/,
  );
  if (noteSplit && noteSplit[1].trim().length >= 2) {
    displayName = noteSplit[1].trim();
    preparationNote = noteSplit[2].trim();
  }

  // Parenthetical note
  const paren = displayName.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (paren && !preparationNote) {
    displayName = paren[1].trim();
    preparationNote = paren[2].trim();
  }

  displayName = displayName.replace(/\s+/g, " ").trim();
  if (!displayName) {
    displayName = originalText;
    return {
      originalText,
      displayName,
      quantity: qty.quantity,
      quantityMax: qty.quantityMax,
      unit,
      quantityMode,
      preparationNote,
      ingredientGroup: currentGroup,
      required,
      sortOrder,
      confidence: {
        level: "needs_review",
        reason: "Could not separate ingredient name",
      },
    };
  }

  if (preparationNote) notes.push(preparationNote);

  const confidence = resolveIngredientConfidence({
    quantity: qty.quantity,
    unit,
    quantityMode,
    unitConfidence,
    displayName,
  });

  return {
    originalText,
    displayName: truncate(displayName, 200),
    quantity: qty.quantity,
    quantityMax: qty.quantityMax,
    unit,
    quantityMode,
    preparationNote: preparationNote ? truncate(preparationNote, 500) : null,
    ingredientGroup: currentGroup,
    required,
    sortOrder,
    confidence,
  };
}

/**
 * Parse a list of ingredient strings, tracking section headings as groups.
 */
export function parseIngredientLines(
  lines: readonly unknown[],
): ParsedIngredient[] {
  const out: ParsedIngredient[] = [];
  let group: string | null = null;
  let order = 0;

  for (const line of lines) {
    const parsed = parseIngredientLine(line, order, group);
    if (parsed.isSectionHeading) {
      group = parsed.displayName;
      // Skip emitting headings as ingredients; group applies to following lines
      continue;
    }
    out.push({ ...parsed, sortOrder: order, ingredientGroup: group });
    order += 1;
  }

  return out;
}

function emptyIngredient(
  originalText: string,
  sortOrder: number,
  group: string | null,
  confidence: FieldConfidence,
): ParsedIngredient {
  return {
    originalText,
    displayName: originalText || "Unknown",
    quantity: null,
    quantityMax: null,
    unit: "unknown",
    quantityMode: "exact",
    preparationNote: null,
    ingredientGroup: group,
    required: true,
    sortOrder,
    confidence,
  };
}

function isSectionHeading(text: string): boolean {
  if (text.length > 80) return false;
  if (/^\d/.test(text)) return false;
  // Ends with colon, short
  if (/:\s*$/.test(text) && text.length <= 60) return true;
  // For X: / For the sauce
  if (/^for\s+(the\s+)?[\w\s-]{1,40}:?\s*$/i.test(text)) return true;
  // ALL CAPS short heading without digits
  if (
    text === text.toUpperCase() &&
    /[A-Z]/.test(text) &&
    !/\d/.test(text) &&
    text.length <= 40 &&
    !/[.!]/.test(text)
  ) {
    return true;
  }
  return false;
}

function takeQuantity(text: string): {
  quantity: number | null;
  quantityMax: number | null;
  rest: string;
} {
  let rest = text.trim();

  // Leading unicode fraction alone or mixed: "1½", "1 ½", or "½"
  // Note: do not use \b after unicode fractions (they are non-word chars).
  const fracClass = Object.keys(UNICODE_FRACTIONS).join("");
  const leadingUnicode = rest.match(
    new RegExp(`^(\\d+)?\\s*([${fracClass}])(?=\\s|$|[a-zA-Z])`),
  );
  if (leadingUnicode) {
    const whole = leadingUnicode[1] ? Number(leadingUnicode[1]) : 0;
    const frac = UNICODE_FRACTIONS[leadingUnicode[2]] ?? 0;
    rest = rest.slice(leadingUnicode[0].length).trim();
    const value = round3(whole + frac);
    const range = takeRangeMax(rest);
    return { quantity: value, quantityMax: range.max, rest: range.rest };
  }

  // Mixed ASCII fraction: 1 1/2
  const mixed = rest.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\b/);
  if (mixed) {
    const value = round3(
      Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]),
    );
    rest = rest.slice(mixed[0].length).trim();
    const range = takeRangeMax(rest);
    return {
      quantity: value,
      quantityMax: range.max,
      rest: range.rest,
    };
  }

  // Simple fraction: 1/2
  const simpleFrac = rest.match(/^(\d+)\s*\/\s*(\d+)\b/);
  if (simpleFrac) {
    const denom = Number(simpleFrac[2]);
    if (denom !== 0) {
      const value = round3(Number(simpleFrac[1]) / denom);
      rest = rest.slice(simpleFrac[0].length).trim();
      const range = takeRangeMax(rest);
      return { quantity: value, quantityMax: range.max, rest: range.rest };
    }
  }

  // Decimal or integer, optionally ranged: 1-2, 1 – 2, 1 to 2
  const num = rest.match(/^(\d+(?:\.\d+)?)\b/);
  if (num) {
    const value = Number(num[1]);
    rest = rest.slice(num[0].length).trim();
    const range = takeRangeMax(rest);
    return {
      quantity: round3(value),
      quantityMax: range.max,
      rest: range.rest,
    };
  }

  return { quantity: null, quantityMax: null, rest };
}

function takeRangeMax(rest: string): { max: number | null; rest: string } {
  const m = rest.match(/^(?:-|–|—|to)\s*(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|½|⅓|¼|¾)\b/i);
  if (!m) return { max: null, rest };

  const max = parseLooseNumber(m[1]);
  const next = rest.slice(m[0].length).trim();

  // "1-2 cups" already consumed; also "1 to 2"
  if (max == null) return { max: null, rest };
  return { max: round3(max), rest: next };
}

function parseLooseNumber(token: string): number | null {
  const t = token.trim();
  if (UNICODE_FRACTIONS[t] != null) return UNICODE_FRACTIONS[t];
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function takeUnit(text: string): { unit: QuantityUnit | null; rest: string } {
  const m = text.match(/^([a-zA-Z]+)\b\.?/);
  if (!m) return { unit: null, rest: text };
  const token = m[1];
  for (const entry of UNIT_ALIASES) {
    if (entry.pattern.test(token)) {
      return {
        unit: entry.unit,
        rest: text.slice(m[0].length).trim(),
      };
    }
  }
  return { unit: null, rest: text };
}

function resolveIngredientConfidence(args: {
  quantity: number | null;
  unit: QuantityUnit;
  quantityMode: QuantityMode;
  unitConfidence: FieldConfidence;
  displayName: string;
}): FieldConfidence {
  if (
    args.quantityMode === "to_taste" ||
    args.quantityMode === "as_needed" ||
    args.quantityMode === "optional"
  ) {
    return { level: "confident", reason: `Mode ${args.quantityMode}` };
  }
  if (args.quantity != null && args.unitConfidence.level === "confident") {
    return { level: "confident", reason: "Quantity and unit parsed" };
  }
  if (args.displayName.length >= 2 && args.quantity == null) {
    return {
      level: "needs_review",
      reason: "Name only — quantity unclear",
    };
  }
  return {
    level: "needs_review",
    reason: args.unitConfidence.reason ?? "Ambiguous ingredient line",
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trim();
}
