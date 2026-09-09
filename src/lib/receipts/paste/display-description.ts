import { splitUnescapedPipes } from "./normalize";

export type DescriptionSource =
  | "pasted"
  | "ocr"
  | "manually_edited"
  | "enrichment_suggestion";

/**
 * Authoritative user-facing name for a pasted line: text before the first
 * unescaped `|`. Never returns OCR/UPC/category fallbacks.
 */
export function displayDescriptionFromPastedSource(
  sourceText: string | null | undefined,
): string {
  const raw = String(sourceText ?? "").trim();
  if (!raw) return "";
  const parts = splitUnescapedPipes(raw);
  return (parts[0] ?? "").trim().slice(0, 200);
}

export function looksLikePastedSourceLine(text: string | null | undefined): boolean {
  const value = String(text ?? "").trim();
  if (!value.includes("|")) return false;
  const parts = splitUnescapedPipes(value);
  if (parts.length < 2) return false;
  return /\$?\d/.test(parts[1] ?? "");
}

/**
 * Resolve what the roommate should see. Manual edits outrank a later paste.
 * Pasted source text is never shown as the item name.
 */
export function resolvePastedDisplayDescription(input: {
  displayDescription?: string | null;
  correctedName?: string | null;
  sourceText?: string | null;
  ocrText?: string | null;
  descriptionEditedByUser?: boolean;
  descriptionSource?: DescriptionSource | string | null;
}): string {
  const source = (input.sourceText ?? input.ocrText ?? "").trim();
  const stored = (input.displayDescription ?? input.correctedName ?? "").trim();
  if (
    input.descriptionEditedByUser ||
    input.descriptionSource === "manually_edited"
  ) {
    if (stored && !looksLikePastedSourceLine(stored)) return stored.slice(0, 200);
  }
  if (stored && !looksLikePastedSourceLine(stored)) return stored.slice(0, 200);
  const fromSource = displayDescriptionFromPastedSource(source);
  if (fromSource) return fromSource;
  if (stored) return displayDescriptionFromPastedSource(stored) || stored.slice(0, 200);
  return "";
}

export function pastedLinePersistenceFields(item: {
  description: string;
  raw: string;
}): {
  displayDescription: string;
  sourceText: string;
  ocrText: string;
  name: string;
  descriptionSource: "pasted";
} {
  const displayDescription =
    item.description.trim().slice(0, 200) ||
    displayDescriptionFromPastedSource(item.raw);
  const sourceText = item.raw.trim();
  return {
    displayDescription,
    sourceText,
    ocrText: sourceText,
    name: displayDescription,
    descriptionSource: "pasted",
  };
}

export const EDITABLE_REPASTE_STATUSES = [
  "uploaded",
  "extracting",
  "needs_review",
  "claiming",
  "ready_for_review",
  "failed",
] as const;

export function isReceiptRepasteEditable(status: string | null | undefined): boolean {
  return EDITABLE_REPASTE_STATUSES.includes(
    status as (typeof EDITABLE_REPASTE_STATUSES)[number],
  );
}
