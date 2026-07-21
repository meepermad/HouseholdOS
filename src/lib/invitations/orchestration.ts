import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env/server";
import { normalizeEmail } from "@/lib/env/server-schema";
import { coordinatorMessageForDelivery } from "@/lib/invitations/diagnostics";
import {
  deliverInvitation,
} from "@/lib/invitations/delivery";
import { shouldAllowDeliveryRetry } from "@/lib/invitations/retry-guard";
import type { HouseholdInvitationCreateResult } from "@/lib/invitations/types";

import {
  generateInviteToken,
  hashInviteToken,
  invitationExpiresAt,
} from "@/lib/tokens";
import type { Database } from "@/types/database";
import type { HouseholdResponsibility } from "@/types/database";

type AuthedClient = SupabaseClient<Database>;

export type CreateInvitationOrchestrationInput = {
  supabase: AuthedClient;
  householdId: string;
  email: string;
  intendedRoles: HouseholdResponsibility[];
  message?: string;
};

/**
 * Required order:
 * 1. Persist pending household invitation (RPC commits independently)
 * 2. Confirm row is visible
 * 3. Call Auth Admin invite (outside the DB write)
 * 4. Record delivery outcome
 * 5. Return copyable HouseholdOS join link even if email failed
 */
export async function createHouseholdInvitationOrchestrated(
  input: CreateInvitationOrchestrationInput,
): Promise<HouseholdInvitationCreateResult> {
  const env = getServerEnv();
  const invitedEmail = normalizeEmail(input.email);
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = invitationExpiresAt(env.INVITATION_TTL_HOURS).toISOString();
  const inviteUrl = `${env.APP_URL}/join/${token}`;

  const { data: inviteId, error: createError } = await input.supabase.rpc(
    "create_household_invitation",
    {
      p_household_id: input.householdId,
      p_email: invitedEmail,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
      p_intended_roles: input.intendedRoles,
      p_message: input.message || undefined,
    },
  );

  if (createError || !inviteId) {
    throw new Error(createError?.message ?? "Unable to create invitation.");
  }

  // Confirm committed + visible to Auth hook (same DB).
  const { data: row, error: readError } = await input.supabase
    .from("household_invitations")
    .select("id, invited_email, status, expires_at, intended_roles, household_id")
    .eq("id", inviteId)
    .eq("status", "pending")
    .maybeSingle();

  if (readError || !row) {
    throw new Error("Invitation was not visible after create.");
  }

  if (row.invited_email !== invitedEmail) {
    throw new Error("Invitation email normalization mismatch.");
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("Invitation expiration is not in the future.");
  }

  const { data: household } = await input.supabase
    .from("households")
    .select("name")
    .eq("id", input.householdId)
    .maybeSingle();

  const householdName = household?.name ?? "Household";

  // Auth invite ONLY after the pending row is committed and confirmed.
  const delivery = await deliverInvitation({
    toEmail: invitedEmail,
    inviteUrl,
    householdName,
    householdId: input.householdId,
    message: input.message,
  });

  const errorCategory =
    delivery.result.outcome === "failed" ? delivery.result.category : null;

  // Delivery metadata is best-effort; never revoke the app invitation on email failure.
  await input.supabase.rpc("record_invitation_delivery", {
    p_household_id: input.householdId,
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
    householdId: input.householdId,
    householdName,
    intendedRoles: row.intended_roles ?? input.intendedRoles,
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

export type RetryInvitationDeliveryInput = {
  supabase: AuthedClient;
  householdId: string;
  invitationId: string;
  /** Join URL including raw token — only available when coordinator just created/replaced. */
  inviteUrl?: string;
};

export async function retryInvitationDeliveryOrchestrated(
  input: RetryInvitationDeliveryInput,
): Promise<{
  deliveryStatus: string;
  message: string;
  warning?: string;
  inviteUrl?: string;
}> {
  const env = getServerEnv();
  const { data: row, error } = await input.supabase
    .from("household_invitations")
    .select(
      "id, invited_email, status, expires_at, delivery_status, delivery_attempted_at, household_id",
    )
    .eq("id", input.invitationId)
    .eq("household_id", input.householdId)
    .maybeSingle();

  if (error || !row || row.status !== "pending") {
    throw new Error("Pending invitation not found.");
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

  const { data: household } = await input.supabase
    .from("households")
    .select("name")
    .eq("id", input.householdId)
    .maybeSingle();
  const householdName = household?.name ?? "Household";
  const redirectTo = input.inviteUrl ?? `${env.APP_URL}/join/paste`;

  const delivery = await deliverInvitation({
    toEmail: row.invited_email,
    inviteUrl: redirectTo,
    householdName,
    householdId: input.householdId,
  });

  const errorCategory =
    delivery.result.outcome === "failed" ? delivery.result.category : null;

  await input.supabase.rpc("record_invitation_delivery", {
    p_household_id: input.householdId,
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
