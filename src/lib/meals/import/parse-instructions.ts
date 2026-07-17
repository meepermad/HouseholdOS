import type { FieldConfidence, ParsedInstructionStep } from "./types";
import { stripHtml } from "./sanitize-html";
import { parseDuration } from "./parse-duration";

type HowToLike = {
  "@type"?: string | string[];
  name?: unknown;
  text?: unknown;
  itemListElement?: unknown;
  position?: unknown;
  totalTime?: unknown;
  performTime?: unknown;
};

/**
 * Normalize recipeInstructions: string | string[] | HowToStep | HowToSection (nested).
 * Preserves section order; maps section names onto steps.
 */
export function parseInstructions(raw: unknown): ParsedInstructionStep[] {
  if (raw == null) return [];

  const steps: ParsedInstructionStep[] = [];
  let counter = 1;

  const pushStep = (
    text: string,
    section: string | null,
    durationMinutes: number | null = null,
  ) => {
    const instruction = stripHtml(text).trim();
    if (!instruction) return;
    steps.push({
      stepNumber: counter,
      instruction: instruction.slice(0, 4000),
      section,
      phase: inferPhase(section, instruction),
      durationMinutes,
      sortOrder: counter - 1,
      confidence: {
        level: instruction.length > 8 ? "confident" : "needs_review",
        reason: section ? `Section: ${section}` : "Instruction step",
      },
    });
    counter += 1;
  };

  const walk = (node: unknown, section: string | null) => {
    if (node == null) return;

    if (typeof node === "string" || typeof node === "number") {
      // Multi-line string → split on newlines / numbered lines
      const text = stripHtml(node);
      const lines = splitInstructionBlob(text);
      for (const line of lines) pushStep(line, section);
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) walk(item, section);
      return;
    }

    if (typeof node !== "object") return;
    const obj = node as HowToLike;
    const types = typeList(obj["@type"]);

    if (types.includes("HowToSection")) {
      const name = stripHtml(obj.name) || section;
      const children = obj.itemListElement ?? obj.text;
      walk(children, name || section);
      return;
    }

    if (
      types.includes("HowToStep") ||
      types.includes("HowToDirection") ||
      types.includes("HowToTip")
    ) {
      const text =
        stripHtml(obj.text) ||
        stripHtml(obj.name) ||
        "";
      const dur =
        parseDuration(obj.totalTime ?? obj.performTime).minutes ?? null;
      if (text) pushStep(text, section, dur);
      else if (obj.itemListElement) walk(obj.itemListElement, section);
      return;
    }

    // Generic object with text/name
    if (obj.text != null || obj.name != null) {
      const text = stripHtml(obj.text) || stripHtml(obj.name);
      if (text) pushStep(text, section);
      return;
    }

    if (obj.itemListElement != null) {
      walk(obj.itemListElement, section);
    }
  };

  walk(raw, null);
  return steps;
}

export function inferPhase(
  section: string | null,
  instruction: string,
): ParsedInstructionStep["phase"] {
  const hay = `${section ?? ""} ${instruction}`.toLowerCase();
  if (/\b(prep|prepare|preparation|mise|marinat|chop|dice|slice)\b/.test(hay)) {
    return "preparation";
  }
  if (/\b(finish|garnish|serve|plating|rest)\b/.test(hay)) {
    return "finishing";
  }
  if (/\b(cook|bake|roast|simmer|boil|fry|grill|saute|sauté)\b/.test(hay)) {
    return "cooking";
  }
  return section ? "other" : "cooking";
}

function splitInstructionBlob(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Numbered list: "1. Do x 2. Do y" or newlines
  if (/\n/.test(trimmed)) {
    return trimmed
      .split(/\n+/)
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean);
  }

  const numbered = trimmed.match(/(?:^|\s)\d+[.)]\s+/g);
  if (numbered && numbered.length >= 2) {
    return trimmed
      .split(/(?:^|\s)\d+[.)]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [trimmed];
}

function typeList(value: unknown): string[] {
  if (typeof value === "string") return [value.replace(/^schema:/i, "")];
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.replace(/^schema:/i, ""));
  }
  return [];
}

/** Aggregate confidence for a step list. */
export function instructionsConfidence(
  steps: readonly ParsedInstructionStep[],
): FieldConfidence {
  if (steps.length === 0) {
    return { level: "missing", reason: "No instructions found" };
  }
  const shaky = steps.filter((s) => s.confidence.level !== "confident").length;
  if (shaky === 0) {
    return { level: "confident", reason: `${steps.length} steps` };
  }
  return {
    level: "needs_review",
    reason: `${shaky} of ${steps.length} steps need review`,
  };
}
