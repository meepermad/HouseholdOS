export const INVITATION_DELIVERY_STATUSES = [
  "not_attempted",
  "sent",
  "existing_account",
  "failed",
] as const;

export type InvitationDeliveryStatus =
  (typeof INVITATION_DELIVERY_STATUSES)[number];

export const INVITATION_DELIVERY_ERROR_CATEGORIES = [
  "hook_rejection",
  "signup_disabled",
  "email_provider_disabled",
  "delivery_failed",
  "rate_limited",
  "unknown",
] as const;

export type InvitationDeliveryErrorCategory =
  (typeof INVITATION_DELIVERY_ERROR_CATEGORIES)[number];

export type AuthInviteAttemptResult =
  | {
      outcome: "sent";
    }
  | {
      outcome: "existing_account";
    }
  | {
      outcome: "failed";
      category: InvitationDeliveryErrorCategory;
      diagnostic: string;
    };

export type HouseholdInvitationCreateResult = {
  invitationId: string;
  inviteUrl: string;
  invitedEmail: string;
  householdId: string;
  householdName: string;
  intendedRoles: string[];
  expiresAt: string;
  deliveryStatus: InvitationDeliveryStatus;
  message: string;
  warning?: string;
  diagnostic?: string;
};
