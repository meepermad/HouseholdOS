import { diagnosticForCategory } from "@/lib/invitations/diagnostics";

/** Safe retry guard: do not resend when already successfully sent recently. */
export function shouldAllowDeliveryRetry(input: {
  deliveryStatus: string;
  deliveryAttemptedAt: string | null;
  now?: Date;
  cooldownMs?: number;
}): { allowed: boolean; reason?: string } {
  const cooldownMs = input.cooldownMs ?? 60 * 60 * 1000;
  const now = input.now ?? new Date();

  if (input.deliveryStatus === "existing_account") {
    return {
      allowed: false,
      reason: diagnosticForCategory("existing_account"),
    };
  }

  if (input.deliveryStatus === "sent" && input.deliveryAttemptedAt) {
    const attempted = new Date(input.deliveryAttemptedAt).getTime();
    if (Number.isFinite(attempted) && now.getTime() - attempted < cooldownMs) {
      return {
        allowed: false,
        reason:
          "Invitation email was already sent. Share the join link, or create a replacement invitation for a new link.",
      };
    }
  }

  return { allowed: true };
}
