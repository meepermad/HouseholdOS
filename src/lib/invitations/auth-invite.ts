import "server-only";

import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { mapAuthInviteError } from "@/lib/invitations/diagnostics";
import type { AuthInviteAttemptResult } from "@/lib/invitations/types";

export type SendAuthInvitationInput = {
  email: string;
  redirectTo: string;
  /** Descriptive only — never used as authorization. */
  metadata?: Record<string, string>;
};

/**
 * Call Supabase Auth Admin invite AFTER the pending household invitation is committed.
 * Does not create or mutate household_invitations rows.
 */
export async function sendAuthInvitation(
  input: SendAuthInvitationInput,
): Promise<AuthInviteAttemptResult> {
  const admin = createPrivilegedClient();

  const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: input.redirectTo,
    data: {
      householdos_invite: "true",
      ...(input.metadata ?? {}),
    },
  });

  if (!error) {
    return { outcome: "sent" };
  }

  return mapAuthInviteError(error);
}

export { shouldAllowDeliveryRetry } from "@/lib/invitations/retry-guard";
