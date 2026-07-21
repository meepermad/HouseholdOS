/**
 * Invitation delivery after a committed household_invitations row exists.
 */

import "server-only";

import {
  sendAuthInvitation,
} from "@/lib/invitations/auth-invite";
import { shouldAllowDeliveryRetry } from "@/lib/invitations/retry-guard";
import type {
  AuthInviteAttemptResult,
  InvitationDeliveryStatus,
} from "@/lib/invitations/types";


export type InvitationDeliveryPayload = {
  toEmail: string;
  inviteUrl: string;
  householdName: string;
  householdId?: string;
  message?: string | null;
};

export type InvitationDeliveryOutcome = {
  delivered: boolean;
  channel: "supabase_auth_invite" | "none";
  result: AuthInviteAttemptResult;
  deliveryStatus: InvitationDeliveryStatus;
};

export async function deliverInvitation(
  payload: InvitationDeliveryPayload,
): Promise<InvitationDeliveryOutcome> {
  const result = await sendAuthInvitation({
    email: payload.toEmail,
    redirectTo: payload.inviteUrl,
    metadata: {
      household_name: payload.householdName.slice(0, 80),
    },
  });

  if (result.outcome === "sent") {
    return {
      delivered: true,
      channel: "supabase_auth_invite",
      result,
      deliveryStatus: "sent",
    };
  }

  if (result.outcome === "existing_account") {
    return {
      delivered: false,
      channel: "supabase_auth_invite",
      result,
      deliveryStatus: "existing_account",
    };
  }

  return {
    delivered: false,
    channel: "supabase_auth_invite",
    result,
    deliveryStatus: "failed",
  };
}

export { shouldAllowDeliveryRetry };
