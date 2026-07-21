import type {
  AuthInviteAttemptResult,
  InvitationDeliveryErrorCategory,
} from "@/lib/invitations/types";

const DIAGNOSTICS = {
  signup_disabled:
    "Supabase Auth user creation is disabled. Enable new-user signup while keeping the HouseholdOS Before User Created hook active.",
  email_provider_disabled: "Supabase Email authentication is disabled.",
  hook_rejection:
    "The Auth registration hook did not find a matching pending invitation.",
  existing_account:
    "The household invitation was created. Send the join link to the existing user.",
  delivery_failed:
    "The household invitation was created, but the email could not be delivered.",
  rate_limited: "Invitation email was rate-limited. Try again later or share the join link.",
  unknown:
    "The household invitation was created, but the invitation email could not be sent. Copy and share the link manually.",
} as const;

export function diagnosticForCategory(
  category: InvitationDeliveryErrorCategory | "existing_account",
): string {
  if (category === "existing_account") return DIAGNOSTICS.existing_account;
  return DIAGNOSTICS[category] ?? DIAGNOSTICS.unknown;
}

/**
 * Map Auth Admin invite / signup errors to safe categories and coordinator-facing diagnostics.
 * Never returns raw provider URLs, keys, or stack traces.
 */
export function mapAuthInviteError(error: {
  message?: string | null;
  code?: string | null;
  status?: number | null;
} | null | undefined): Extract<AuthInviteAttemptResult, { outcome: "failed" | "existing_account" }> {
  const message = (error?.message ?? "").toLowerCase();
  const code = (error?.code ?? "").toLowerCase();

  if (
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("user already exists") ||
    message.includes("email_exists") ||
    code === "email_exists" ||
    code === "user_already_exists"
  ) {
    return { outcome: "existing_account" };
  }

  if (
    message.includes("signups not allowed") ||
    message.includes("signup is disabled") ||
    message.includes("signups disabled") ||
    message.includes("registration is disabled") ||
    code === "signup_disabled"
  ) {
    return {
      outcome: "failed",
      category: "signup_disabled",
      diagnostic: DIAGNOSTICS.signup_disabled,
    };
  }

  if (
    message.includes("email logins are disabled") ||
    message.includes("email provider is disabled") ||
    message.includes("email provider disabled") ||
    (message.includes("email") && message.includes("disabled"))
  ) {
    return {
      outcome: "failed",
      category: "email_provider_disabled",
      diagnostic: DIAGNOSTICS.email_provider_disabled,
    };
  }

  if (
    message.includes("registration is not available") ||
    (message.includes("hook") && message.includes("reject"))
  ) {
    return {
      outcome: "failed",
      category: "hook_rejection",
      diagnostic: DIAGNOSTICS.hook_rejection,
    };
  }

  if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    code === "over_email_send_rate_limit"
  ) {
    return {
      outcome: "failed",
      category: "rate_limited",
      diagnostic: DIAGNOSTICS.rate_limited,
    };
  }

  if (
    message.includes("error sending") ||
    message.includes("error inviting") ||
    message.includes("unable to send") ||
    message.includes("smtp") ||
    message.includes("mail")
  ) {
    return {
      outcome: "failed",
      category: "delivery_failed",
      diagnostic: DIAGNOSTICS.delivery_failed,
    };
  }

  return {
    outcome: "failed",
    category: "unknown",
    diagnostic: DIAGNOSTICS.unknown,
  };
}

export function coordinatorMessageForDelivery(result: {
  deliveryStatus: string;
  diagnostic?: string;
}): { message: string; warning?: string } {
  if (result.deliveryStatus === "sent") {
    return {
      message:
        "Invitation created and email sent. You can also copy the join link to share in your group chat.",
    };
  }
  if (result.deliveryStatus === "existing_account") {
    return {
      message:
        "This person may already have an account. Send them the household invitation link.",
      warning: diagnosticForCategory("existing_account"),
    };
  }
  return {
    message:
      "The household invitation was created, but the invitation email could not be sent. Copy and share the link manually.",
    warning: result.diagnostic ?? DIAGNOSTICS.unknown,
  };
}
