/**
 * Roommate-facing receipt errors. Developer codes stay in logs.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SHARE_NEEDS_PERSON =
  "Choose at least one person to share this with.";

export function isMembershipUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseMembershipIdList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type ReceiptReadFailureCopy = {
  title: string;
  explanation: string;
  nextStep: string;
  actions: Array<{ kind: "enter_manually" | "try_again"; label: string }>;
};

function looksLikeDevCode(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^[A-Z][A-Z0-9_]{3,}$/.test(t)) return true;
  return /OCR_WORKER|WORKER_TIMEOUT|SQLSTATE|ECONN|jwt|rpc|violates/i.test(t);
}

/**
 * Explain why automatic reading failed and what the member can do next.
 * Never returns OCR_WORKER_TIMEOUT or other raw worker/RPC codes.
 */
export function describeReceiptReadFailure(input: {
  ocrOutcome?: string | null;
  lastError?: string | null;
  status?: string | null;
}): ReceiptReadFailureCopy {
  const raw = (input.lastError ?? "").trim();
  const outcome =
    input.ocrOutcome ?? (input.status === "failed" ? "failed" : null);
  const lower = raw.toLowerCase();

  let explanation = "We could not read this receipt automatically.";
  if (
    outcome === "timeout" ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("ocr_worker") ||
    lower.includes("worker_timeout")
  ) {
    explanation =
      "Reading timed out. The photo may be large, blurry, or hard to read.";
  } else if (
    outcome === "manual" ||
    lower.includes("not configured") ||
    lower.includes("device-side") ||
    lower.includes("on-device") ||
    lower.includes("disabled")
  ) {
    explanation =
      "Automatic reading was skipped. You can type the details yourself.";
  } else if (lower.includes("heic") || lower.includes("heif")) {
    explanation = "This iPhone photo format could not be read here.";
  } else if (
    !looksLikeDevCode(raw) &&
    (lower.includes("blur") ||
      lower.includes("unclear") ||
      lower.includes("could not read") ||
      lower.includes("decode"))
  ) {
    explanation = "We could not read the text in this photo clearly.";
  }

  return {
    title: "Could not read this receipt",
    explanation,
    nextStep:
      "Enter the merchant, total, and items below — or try a clearer photo.",
    actions: [
      { kind: "enter_manually", label: "Enter manually" },
      { kind: "try_again", label: "Try again" },
    ],
  };
}

export function mapReceiptRpcError(message: string): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("claim_conflict")) return "Someone else already claimed this item.";
  if (m.includes("claim_overclaim")) {
    return "That would claim more than is left on this item.";
  }
  if (m.includes("claim_finalized")) return "This receipt is already submitted.";
  if (m.includes("claim_not_open")) return "This receipt is not open for claiming.";
  if (m.includes("not authenticated") || m.includes("jwt")) {
    return "Your session expired. Sign in again, then you can add this receipt.";
  }
  if (m.includes("not authorized") || m.includes("not an active")) {
    return "You cannot change this receipt.";
  }
  if (m.includes("waiting_for_claims")) {
    return "Some roommates have not claimed yet. Finish now if you want to continue without them.";
  }
  if (
    m.includes("no valid household members") ||
    m.includes("empty_participants") ||
    (m.includes("invalid input syntax") && m.includes("uuid"))
  ) {
    return SHARE_NEEDS_PERSON;
  }
  if (m.includes("invalid input syntax") && m.includes("date")) {
    return "Enter a valid purchase date.";
  }
  if (
    m.includes("invalid input syntax") &&
    (m.includes("integer") || m.includes("numeric"))
  ) {
    return "Enter a valid dollar amount for the total or items.";
  }
  if (m.includes("ocr_worker") || m.includes("worker_timeout")) {
    return describeReceiptReadFailure({
      lastError: message,
      ocrOutcome: "timeout",
    }).explanation;
  }
  if (m.includes("invalid input")) {
    return "Some details could not be saved. Check who shares this receipt and try again.";
  }
  return "Could not update this receipt. Try again.";
}
