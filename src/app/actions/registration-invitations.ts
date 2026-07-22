"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import {
  InvitationOriginConfigurationError,
  PRODUCTION_ORIGIN_MISCONFIG,
} from "@/lib/env/canonical-origin";
import { toPublicErrorMessage } from "@/lib/errors";
import { requireUser } from "@/lib/household-context";
import {
  createCreateHouseholdRegistrationOrchestrated,
  retryCreateHouseholdRegistrationDelivery,
} from "@/lib/invitations/create-household-orchestration";
import { hashInviteToken } from "@/lib/tokens";
import {
  inviteCreateHouseholdRegistrationSchema,
  registrationInvitationIdSchema,
} from "@/lib/validations/household";

const CREATE_HOUSEHOLD_ONBOARDING = "/onboarding?intent=create-household";

function mapRegistrationInviteError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email mismatch")) {
    return "This invitation is for a different email address. Sign in with the invited email.";
  }
  if (lower.includes("already consumed")) {
    return "This invitation has already been used.";
  }
  if (lower.includes("revoked")) {
    return "This invitation is no longer valid.";
  }
  if (lower.includes("expired")) {
    return "This invitation has expired.";
  }
  if (lower.includes("not found")) {
    return "This invitation link is invalid or no longer available.";
  }
  if (lower.includes("not allowed")) {
    return "Not allowed to manage registration invitations.";
  }
  return "Unable to process this registration invitation.";
}

export async function inviteCreateHouseholdRegistrationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = inviteCreateHouseholdRegistrationSchema.safeParse({
      email: formData.get("email"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
    }

    const { supabase, user } = await requireUser();
    if (!user) return { ok: false, error: "Sign in required." };

    const { data: allowed, error: authError } = await supabase.rpc(
      "can_issue_registration_invitations",
    );
    if (authError || allowed !== true) {
      return {
        ok: false,
        error: "Not allowed to invite someone to create an independent household.",
      };
    }

    const result = await createCreateHouseholdRegistrationOrchestrated({
      supabase,
      email: parsed.data.email,
    });

    revalidatePath("/onboarding");
    return {
      ok: true,
      message: result.message,
      warning: result.warning,
      data: {
        inviteUrl: result.inviteUrl,
        invitationId: result.invitationId,
        invitedEmail: result.invitedEmail,
        purpose: result.purpose,
        expiresAt: result.expiresAt,
        deliveryStatus: result.deliveryStatus,
        ...(result.diagnostic ? { diagnostic: result.diagnostic } : {}),
      },
    };
  } catch (error) {
    if (error instanceof InvitationOriginConfigurationError) {
      return { ok: false, error: PRODUCTION_ORIGIN_MISCONFIG };
    }
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function consumeCreateHouseholdRegistrationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const token = String(formData.get("token") ?? "").trim();
    if (token.length < 32) {
      return { ok: false, error: "Invalid invitation token." };
    }

    const { supabase, user } = await requireUser();
    if (!user) {
      return { ok: false, error: "Sign in to continue with this invitation." };
    }

    const { error } = await supabase.rpc("consume_registration_invitation", {
      p_token_hash: hashInviteToken(token),
    });

    if (error) {
      return { ok: false, error: mapRegistrationInviteError(error.message) };
    }

    redirect(CREATE_HOUSEHOLD_ONBOARDING);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function revokeCreateHouseholdRegistrationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = registrationInvitationIdSchema.safeParse({
      invitationId: formData.get("invitationId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid invitation." };
    }

    const { supabase, user } = await requireUser();
    if (!user) return { ok: false, error: "Sign in required." };

    const { error } = await supabase.rpc("revoke_registration_invitation", {
      p_invitation_id: parsed.data.invitationId,
    });
    if (error) {
      return { ok: false, error: mapRegistrationInviteError(error.message) };
    }

    return {
      ok: true,
      message: "Registration invitation revoked. It can no longer be used.",
      data: { invitationId: parsed.data.invitationId, status: "revoked" },
    };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function regenerateCreateHouseholdRegistrationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = registrationInvitationIdSchema.safeParse({
      invitationId: formData.get("invitationId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid invitation." };
    }

    const { supabase, user } = await requireUser();
    if (!user) return { ok: false, error: "Sign in required." };

    const { data: allowed } = await supabase.rpc("can_issue_registration_invitations");
    if (allowed !== true) {
      return { ok: false, error: "Not allowed to regenerate registration invitations." };
    }

    const { data: existing, error: loadError } = await supabase
      .from("registration_invitations")
      .select("id, invited_email, status, purpose")
      .eq("id", parsed.data.invitationId)
      .maybeSingle();

    if (loadError || !existing || existing.purpose !== "create_household") {
      return { ok: false, error: "Invitation not found." };
    }
    if (existing.status !== "pending") {
      return {
        ok: false,
        error: "Only pending invitations can be regenerated. Create a new invitation instead.",
      };
    }

    const result = await createCreateHouseholdRegistrationOrchestrated({
      supabase,
      email: existing.invited_email,
    });

    return {
      ok: true,
      message: "Replacement registration invitation created. The previous link is no longer valid.",
      warning: result.warning,
      data: {
        inviteUrl: result.inviteUrl,
        invitationId: result.invitationId,
        previousInvitationId: parsed.data.invitationId,
        invitedEmail: result.invitedEmail,
        purpose: result.purpose,
        expiresAt: result.expiresAt,
        deliveryStatus: result.deliveryStatus,
        ...(result.diagnostic ? { diagnostic: result.diagnostic } : {}),
      },
    };
  } catch (error) {
    if (error instanceof InvitationOriginConfigurationError) {
      return { ok: false, error: PRODUCTION_ORIGIN_MISCONFIG };
    }
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function retryCreateHouseholdRegistrationDeliveryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = registrationInvitationIdSchema.safeParse({
      invitationId: formData.get("invitationId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid invitation." };
    }

    const { supabase, user } = await requireUser();
    if (!user) return { ok: false, error: "Sign in required." };

    const result = await retryCreateHouseholdRegistrationDelivery({
      supabase,
      invitationId: parsed.data.invitationId,
    });

    return {
      ok: true,
      message: result.message,
      warning: result.warning,
      data: { deliveryStatus: result.deliveryStatus },
    };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}
