/** Project raw OCR confidence into a bounded 0–1 display value. */

export function projectOcrConfidence(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (!Number.isFinite(raw)) return null;
  if (raw < 0) return 0;
  if (raw > 1 && raw <= 100) return Math.min(1, raw / 100);
  if (raw > 1) return 1;
  return raw;
}

export function confidenceLabel(confidence: number | null): string {
  if (confidence === null) return "Could not determine";
  if (confidence >= 0.85) return "Looks clear";
  if (confidence >= 0.55) return "Please check";
  return "Could not determine";
}
