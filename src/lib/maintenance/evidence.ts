/**
 * Maintenance evidence validation (images + PDF).
 */

import {
  EVIDENCE_ALLOWED_MIME_TYPES,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_COUNT_PER_REQUEST,
  type EvidenceMimeType,
} from "./types";

const EXT_BY_MIME: Record<EvidenceMimeType, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
};

export type EvidenceValidationInput = {
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  existingCount: number;
};

export type EvidenceValidationResult =
  | { ok: true; mimeType: EvidenceMimeType; extension: string }
  | { ok: false; error: string };

export function validateMaintenanceEvidence(
  input: EvidenceValidationInput,
): EvidenceValidationResult {
  if (input.existingCount >= EVIDENCE_MAX_COUNT_PER_REQUEST) {
    return {
      ok: false,
      error: `At most ${EVIDENCE_MAX_COUNT_PER_REQUEST} evidence files are allowed per request`,
    };
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > EVIDENCE_MAX_BYTES) {
    return {
      ok: false,
      error: `File must be between 1 byte and ${EVIDENCE_MAX_BYTES} bytes`,
    };
  }
  const mime = input.mimeType.toLowerCase().trim() as EvidenceMimeType;
  if (!(EVIDENCE_ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    return {
      ok: false,
      error: "Only JPEG, PNG, WebP, and PDF evidence is allowed",
    };
  }
  const ext = (input.fileName.split(".").pop() ?? "").toLowerCase();
  const allowedExt = EXT_BY_MIME[mime];
  if (!allowedExt.includes(ext)) {
    return {
      ok: false,
      error: `File extension must match MIME type (${allowedExt.join(", ")})`,
    };
  }
  // Block executable-looking names
  if (/\.(exe|bat|cmd|sh|js|mjs|php|html)$/i.test(input.fileName)) {
    return { ok: false, error: "Executable uploads are not permitted" };
  }
  return { ok: true, mimeType: mime, extension: ext };
}

/** Notifications must never include raw storage paths. */
export function redactEvidencePathForNotification(path: string | null): null {
  void path;
  return null;
}
