import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env/server";
import {
  buildCreateHouseholdRegistrationUrl,
  getCanonicalAppOrigin,
} from "@/lib/env/canonical-origin";
import { normalizeEmail } from "@/lib/env/server-schema";
import { coordinatorMessageForDelivery } from "@/lib/invitations/diagnostics";
import { deliverInvitation } from "@/lib/invitations/delivery";
import { shouldAllowDeliveryRetry } from "@/lib/invitations/retry-guard";
import type { InvitationDeliveryStatus } from "@/lib/invitations/types";
import {
  generateInviteToken,
  hashInviteToken,
  invitationExpiresAt,
} from "@/lib/tokens";
import type { Database } from "@/types/database";

type AuthedClient = SupabaseClient<Database>;

export type CreateHouseholdRegistrationResult = {
  invitationId: string;
  inviteUrl: string;
  invitedEmail: string;
  purpose: "create_household";
  expiresAt: string;
  deliveryStatus: InvitationDeliveryStatus;
  message: string;
  warning?: string;
  diagnostic?: string;
};

/**
 * Persist create_household registration invitation, then Auth invite.
 * Never associates the invite with the actor's current household.
 */
export async function createCreateHouseholdRegistrationOrchestrated(input: {
  supabase: AuthedClient;
  email: string;
}): Promise<CreateHouseholdRegistrationResult> {
  const env = getServerEnv();
  const canonicalOrigin = getCanonicalAppOrigin();
  const invitedEmail = normalizeEmail(input.email);
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = invitationExpiresAt(env.INVITATION_TTL_HOURS).toISOString();
  const inviteUrl = buildCreateHouseholdRegistrationUrl(token, canonicalOrigin);

  const { data: inviteId, error: createError } = await input.supabase.rpc(
    "create_registration_invitation",
    {
      p_email: invitedEmail,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
      p_purpose: "create_household",
      p_household_id: undefined,
      p_intended_roles: [],
    },
  );

  if (createError || !inviteId) {
    throw new Error(createError?.message ?? "Unable to create registration invitation.");
  }

  const { data: row, error: readError } = await input.supabase
    .from("registration_invitations")
    .select("id, invited_email, status, expires_at, purpose, household_id, intended_roles")
    .eq("id", inviteId)
    .eq("status", "pending")
    .maybeSingle();

  if (readError || !row) {
    throw new Error("Registration invitation was not visible after create.");
  }

  if (row.invited_email !== invitedEmail) {
    throw new Error("Invitation email normalization mismatch.");
  }

  if (row.purpose !== "create_household") {
    throw new Error("Invitation purpose mismatch.");
  }

  if (row.household_id != null) {
    throw new Error("create_household invitation must not have a household_id.");
  }

  if ((row.intended_roles ?? []).length > 0) {
    throw new Error("create_household invitation must not include household roles.");
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("Invitation expiration is not in the future.");
  }

  const delivery = await deliverInvitation({
    toEmail: invitedEmail,
    inviteUrl,
    householdName: "Independent household",
  });

  const errorCategory =
    delivery.result.outcome === "failed" ? delivery.result.category : null;

  await input.supabase.rpc("record_registration_invitation_delivery", {
    p_invitation_id: String(inviteId),
    p_delivery_status: delivery.deliveryStatus,
    p_error_category: errorCategory ?? undefined,
  });

  const copy = coordinatorMessageForDelivery({
    deliveryStatus: delivery.deliveryStatus,
    diagnostic:
      delivery.result.outcome === "failed"
        ? delivery.result.diagnostic
        : undefined,
  });

  return {
    invitationId: String(inviteId),
    inviteUrl,
    invitedEmail,
    purpose: "create_household",
    expiresAt: row.expires_at,
    deliveryStatus: delivery.deliveryStatus,
    message: copy.message,
    warning: copy.warning,
    diagnostic:
      delivery.result.outcome === "failed"
        ? delivery.result.diagnostic
        : undefined,
  };
}

export async function retryCreateHouseholdRegistrationDelivery(input: {
  supabase: AuthedClient;
  invitationId: string;
  inviteUrl?: string;
}): Promise<{
  deliveryStatus: string;
  message: string;
  warning?: string;
  inviteUrl?: string;
}> {
  const { data: row, error } = await input.supabase
    .from("registration_invitations")
    .select(
      "id, invited_email, status, expires_at, delivery_status, delivery_attempted_at, purpose",
    )
    .eq("id", input.invitationId)
    .maybeSingle();

  if (error || !row || row.status !== "pending" || row.purpose !== "create_household") {
    throw new Error("Pending registration invitation not found.");
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("Invitation expired.");
  }

  const guard = shouldAllowDeliveryRetry({
    deliveryStatus: row.delivery_status ?? "not_attempted",
    deliveryAttemptedAt: row.delivery_attempted_at,
  });
  if (!guard.allowed) {
    throw new Error(guard.reason ?? "Delivery retry not allowed.");
  }

  // Without the plaintext token, redirect to signup preserving create-household onboarding.
  const redirectTo =
    input.inviteUrl ??
    `${getCanonicalAppOrigin()}/signup?next=${encodeURIComponent("/onboarding#create-household")}`;

  const delivery = await deliverInvitation({
    toEmail: row.invited_email,
    inviteUrl: redirectTo,
    householdName: "Independent household",
  });

  const errorCategory =
    delivery.result.outcome === "failed" ? delivery.result.category : null;

  await input.supabase.rpc("record_registration_invitation_delivery", {
    p_invitation_id: input.invitationId,
    p_delivery_status: delivery.deliveryStatus,
    p_error_category: errorCategory ?? undefined,
  });

  const copy = coordinatorMessageForDelivery({
    deliveryStatus: delivery.deliveryStatus,
    diagnostic:
      delivery.result.outcome === "failed"
        ? delivery.result.diagnostic
        : undefined,
  });

  return {
    deliveryStatus: delivery.deliveryStatus,
    message: copy.message,
    warning: copy.warning,
    inviteUrl: input.inviteUrl,
  };
}
