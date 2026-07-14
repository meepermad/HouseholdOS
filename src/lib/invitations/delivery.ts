/**
 * Invitation delivery seam.
 *
 * Phase foundation creates copyable invite URLs only.
 * Future: send email / SMS without changing create_household_invitation.
 */

export type InvitationDeliveryPayload = {
  toEmail: string;
  inviteUrl: string;
  householdName: string;
  message?: string | null;
};

export async function deliverInvitation(
  payload: InvitationDeliveryPayload,
): Promise<{ delivered: false; channel: "none" }> {
  // Intentionally no-op in this phase.
  void payload;
  return { delivered: false, channel: "none" };
}
