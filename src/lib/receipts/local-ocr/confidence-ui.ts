import { projectOcrConfidence } from "../confidence";
import type { UserConfidenceState } from "./types";

/** Map OCR confidence to user-facing states (no false precision). */
export function toUserConfidenceState(
  confidence: number | null | undefined,
): UserConfidenceState {
  const projected = projectOcrConfidence(confidence ?? null);
  if (projected === null) return "could_not_determine";
  if (projected >= 0.85) return "looks_clear";
  if (projected >= 0.55) return "please_check";
  return "could_not_determine";
}

export function userConfidenceLabel(state: UserConfidenceState): string {
  switch (state) {
    case "looks_clear":
      return "Looks clear";
    case "please_check":
      return "Please check";
    case "could_not_determine":
      return "Could not determine";
  }
}

export function isLowConfidence(state: UserConfidenceState): boolean {
  return state !== "looks_clear";
}
