/**
 * Select what OCR artifacts to retain for review/audit vs discard.
 * Do not broadly persist every intermediate OCR artifact indefinitely.
 */

export type OcrRetentionSelection = {
  keepFullText: boolean;
  keepBlocks: boolean;
  keepLines: boolean;
  keepWords: boolean;
  keepBoundingBoxes: boolean;
  keepProcessedDerivative: boolean;
  keepRawEnginePayload: boolean;
  reason: string;
};

export type RetentionPolicy = {
  /** Keep structured fields + source hashes for duplicates/audit. */
  auditMode: "standard" | "minimal" | "diagnostic";
  retainProcessedImagesDays: number;
};

export function selectOcrRetention(
  policy: RetentionPolicy = {
    auditMode: "standard",
    retainProcessedImagesDays: 7,
  },
): OcrRetentionSelection {
  if (policy.auditMode === "minimal") {
    return {
      keepFullText: false,
      keepBlocks: false,
      keepLines: false,
      keepWords: false,
      keepBoundingBoxes: false,
      keepProcessedDerivative: false,
      keepRawEnginePayload: false,
      reason: "Minimal retention — corrected fields and content hash only.",
    };
  }
  if (policy.auditMode === "diagnostic") {
    return {
      keepFullText: true,
      keepBlocks: true,
      keepLines: true,
      keepWords: true,
      keepBoundingBoxes: true,
      keepProcessedDerivative: true,
      keepRawEnginePayload: true,
      reason: "Diagnostic retention for troubleshooting.",
    };
  }
  return {
    keepFullText: true,
    keepBlocks: false,
    keepLines: true,
    keepWords: false,
    keepBoundingBoxes: true,
    keepProcessedDerivative: policy.retainProcessedImagesDays > 0,
    keepRawEnginePayload: false,
    reason:
      "Standard retention for review, auditability, and duplicate detection.",
  };
}

export function redactOcrForPersistence(
  fullText: string,
  selection: OcrRetentionSelection,
): { fullText: string | null } {
  if (!selection.keepFullText) return { fullText: null };
  return { fullText };
}
