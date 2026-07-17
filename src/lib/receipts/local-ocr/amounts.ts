import { parseCurrencyAmountToCents } from "../currency";
import { normalizeOcrLine } from "./normalize";

export type LabeledAmount = {
  label: string;
  cents: number;
  sourceText: string;
  confidence: number;
  kind: "subtotal" | "tax" | "tip" | "discount" | "total" | "other";
};

const TOTAL_LABELS = [
  "GRAND TOTAL",
  "AMOUNT DUE",
  "BALANCE DUE",
  "SALE TOTAL",
  "TOTAL DUE",
  "TOTAL",
];

const EXCLUDE_FROM_TOTAL = [
  "SUBTOTAL",
  "SUB TOTAL",
  "TAX",
  "SAVINGS",
  "CHANGE",
  "CASH",
  "TENDERED",
  "TIP",
  "GRATUITY",
  "DISCOUNT",
];

const SUBTOTAL_LABELS = ["SUBTOTAL", "SUB TOTAL", "SUB-TOTAL"];
const TAX_LABELS = ["TAX", "SALES TAX", "VAT"];
const TIP_LABELS = ["TIP", "GRATUITY", "TIPS"];
const DISCOUNT_LABELS = ["DISCOUNT", "SAVINGS", "COUPON", "YOU SAVED"];

function lineAmount(text: string): number | null {
  const matches = [...text.matchAll(/-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+\.\d{2}/g)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1][0];
  return parseCurrencyAmountToCents(last);
}

function classifyLabel(upper: string): LabeledAmount["kind"] | null {
  if (SUBTOTAL_LABELS.some((l) => upper.includes(l))) return "subtotal";
  if (TIP_LABELS.some((l) => upper.includes(l))) return "tip";
  if (DISCOUNT_LABELS.some((l) => upper.includes(l))) return "discount";
  if (TAX_LABELS.some((l) => upper.includes(l)) && !upper.includes("TAX ID")) return "tax";
  if (TOTAL_LABELS.some((l) => upper.includes(l))) {
    if (EXCLUDE_FROM_TOTAL.some((ex) => upper.includes(ex) && !TOTAL_LABELS.some((t) => upper.includes(t) && t.length >= ex.length))) {
      // still allow TOTAL if explicitly labeled TOTAL and not only an exclude word
    }
    const isExcludedOnly = EXCLUDE_FROM_TOTAL.some((ex) => {
      if (!upper.includes(ex)) return false;
      // TOTAL contains "TOTAL" but SUBTOTAL also contains TOTAL — exclude subtotal-like
      if (ex === "SUBTOTAL" || ex === "SUB TOTAL") return upper.includes(ex);
      if (ex === "TAX" && TOTAL_LABELS.some((t) => upper.includes(t))) return false;
      if (["CHANGE", "CASH", "TENDERED", "SAVINGS"].includes(ex)) return upper.includes(ex);
      if (ex === "TIP" || ex === "GRATUITY") return upper.includes(ex) && !upper.includes("TOTAL");
      if (ex === "DISCOUNT") return upper.includes(ex) && !TOTAL_LABELS.some((t) => upper === t);
      return false;
    });
    if (isExcludedOnly) return null;
    // Prefer not selecting SUBTOTAL as total
    if (/\bSUB\s*-?\s*TOTAL\b/.test(upper) || upper.includes("SUBTOTAL") || upper.includes("SUB TOTAL")) {
      return "subtotal";
    }
    if (TOTAL_LABELS.some((l) => upper.includes(l))) return "total";
  }
  return null;
}

export function extractLabeledAmounts(lines: string[]): LabeledAmount[] {
  const out: LabeledAmount[] = [];
  for (const raw of lines) {
    const text = normalizeOcrLine(raw);
    if (!text) continue;
    const upper = text.toUpperCase();
    const kind = classifyLabel(upper);
    if (!kind) continue;
    const cents = lineAmount(text);
    if (cents === null) continue;
    let confidence = 0.75;
    if (kind === "total") {
      if (upper.includes("GRAND TOTAL") || upper.includes("AMOUNT DUE")) confidence = 0.95;
      else if (upper.match(/\bTOTAL\b/) && !upper.includes("SUB")) confidence = 0.9;
    }
    out.push({ label: text, cents, sourceText: text, confidence, kind });
  }
  return out;
}

export function selectTotalCandidates(amounts: LabeledAmount[]): {
  selected: LabeledAmount | null;
  alternatives: LabeledAmount[];
} {
  const totals = amounts
    .filter((a) => a.kind === "total")
    .sort((a, b) => b.confidence - a.confidence || b.cents - a.cents);
  const selected = totals[0] ?? null;
  return {
    selected,
    alternatives: totals.slice(1),
  };
}

export function pickFirstOfKind(
  amounts: LabeledAmount[],
  kind: LabeledAmount["kind"],
): LabeledAmount | null {
  return amounts.find((a) => a.kind === kind) ?? null;
}
