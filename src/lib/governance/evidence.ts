import {
  ATTACHMENT_MIME_TYPES,
  MAX_GOVERNANCE_ATTACHMENT_BYTES,
  type GovernanceAttachmentMime,
} from "./types";

export function isAllowedGovernanceMime(
  mime: string,
): mime is GovernanceAttachmentMime {
  return (ATTACHMENT_MIME_TYPES as readonly string[]).includes(mime);
}

export function validateGovernanceAttachment(params: {
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  householdId: string;
}): { ok: true } | { ok: false; error: string } {
  if (!isAllowedGovernanceMime(params.mimeType)) {
    return { ok: false, error: "Unsupported attachment type" };
  }
  if (
    !Number.isFinite(params.sizeBytes) ||
    params.sizeBytes <= 0 ||
    params.sizeBytes > MAX_GOVERNANCE_ATTACHMENT_BYTES
  ) {
    return { ok: false, error: "Attachment exceeds size limit" };
  }
  if (!params.storagePath.startsWith(`${params.householdId}/`)) {
    return { ok: false, error: "Storage path must be scoped to the household" };
  }
  return { ok: true };
}

/** Never put raw storage paths in notification payloads. */
export function redactGovernanceStoragePath(path: string): string {
  void path;
  return "[attachment]";
}
