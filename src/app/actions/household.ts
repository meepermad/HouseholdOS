"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { can, canChangeRoles, normalizeRoles } from "@/lib/permissions";
import { getServerEnv } from "@/lib/env/server";
import {
  AppError,
  logServerError,
  mapHouseholdCreateError,
  mapInvitationError,
  toPublicErrorMessage,
} from "@/lib/errors";
import {
  assertActiveMembership,
  clearCurrentHouseholdCookie,
  persistCurrentHousehold,
  requireUser,
} from "@/lib/household-context";
import {
  generateInviteToken,
  hashInviteToken,
  invitationExpiresAt,
} from "@/lib/tokens";
import { CURRENT_HOUSEHOLD_COOKIE } from "@/lib/navigation";
import {
  acceptInviteSchema,
  archiveHouseholdSchema,
  changeRolesSchema,
  createHouseholdSchema,
  inviteMemberSchema,
  leaveHouseholdSchema,
  removeMemberSchema,
  revokeInviteSchema,
  switchHouseholdSchema,
  updateHouseholdSchema,
  updateProfileSchema,
  updateSettingsSchema,
} from "@/lib/validations/household";
import type { ActionResult } from "@/app/actions/auth";
import type { HouseholdResponsibility } from "@/types/database";
import { randomUUID } from "node:crypto";

export async function createHouseholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createHouseholdSchema.safeParse({
      name: formData.get("name"),
      propertyNickname: formData.get("propertyNickname"),
      leaseStart: formData.get("leaseStart"),
      leaseEnd: formData.get("leaseEnd"),
      timezone: formData.get("timezone"),
      currency: formData.get("currency"),
      purchaseApprovalThresholdDollars: formData.get(
        "purchaseApprovalThresholdDollars",
      ),
      acknowledgeReimbursementPolicy: formData.get("acknowledgeReimbursementPolicy"),
      idempotencyKey: formData.get("idempotencyKey") || undefined,
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid household details.",
      };
    }

    const { supabase, user } = await requireUser();
    if (!user) return { ok: false, error: "You must sign in first." };

    const idempotencyKey = parsed.data.idempotencyKey ?? randomUUID();

    const { data, error } = await supabase.rpc(
      "create_household_for_current_user",
      {
        p_name: parsed.data.name,
        p_property_nickname: parsed.data.propertyNickname ?? undefined,
        p_lease_start: parsed.data.leaseStart ?? undefined,
        p_lease_end: parsed.data.leaseEnd ?? undefined,
        p_timezone: parsed.data.timezone,
        p_currency: parsed.data.currency,
        p_purchase_approval_threshold_cents:
          parsed.data.purchaseApprovalThresholdCents,
        p_acknowledge_reimbursement_policy: true,
        p_idempotency_key: idempotencyKey,
      },
    );

    const row = Array.isArray(data) ? data[0] : data;
    const householdId =
      row && typeof row === "object" && "household_id" in row
        ? String((row as { household_id: string }).household_id)
        : null;

    if (error || !householdId) {
      logServerError("create_household_action", error, {
        code: error?.code ?? null,
        userId: user.id,
      });
      return {
        ok: false,
        error: mapHouseholdCreateError(error?.message).publicMessage,
      };
    }

    const { cookieSet } = await persistCurrentHousehold(householdId);
    revalidatePath("/app");
    if (!cookieSet) {
      logServerError("create_household_cookie_fallback", null, {
        householdId,
        userId: user.id,
      });
      redirect("/app");
    }
    redirect(`/app/${householdId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function switchHouseholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = switchHouseholdSchema.safeParse({
      householdId: formData.get("householdId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid household." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { cookieSet } = await persistCurrentHousehold(parsed.data.householdId);
    revalidatePath("/app");
    if (!cookieSet) {
      redirect("/app");
    }
    redirect(`/app/${parsed.data.householdId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function updateProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = updateProfileSchema.safeParse({
      displayName: formData.get("displayName"),
      preferredTimezone: formData.get("preferredTimezone"),
      preferredLocale: formData.get("preferredLocale"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile." };
    }

    const { supabase, user } = await requireUser();
    if (!user) return { ok: false, error: "You must be signed in." };

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.displayName,
        preferred_timezone: parsed.data.preferredTimezone,
        preferred_locale: parsed.data.preferredLocale,
      })
      .eq("id", user.id);

    if (error) {
      return { ok: false, error: "Unable to update profile." };
    }

    const householdId = formData.get("householdId");
    if (typeof householdId === "string") {
      revalidatePath(`/app/${householdId}/settings/profile`);
    }
    return { ok: true, message: "Profile updated." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function updateHouseholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = updateHouseholdSchema.safeParse({
      householdId: formData.get("householdId"),
      name: formData.get("name"),
      propertyNickname: formData.get("propertyNickname") || "",
      leaseStart: formData.get("leaseStart") || "",
      leaseEnd: formData.get("leaseEnd") || "",
      timezone: formData.get("timezone"),
      currency: formData.get("currency"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "household.update")) {
      return { ok: false, error: "Not allowed to update this household." };
    }

    const { supabase } = await requireUser();
    const { data: before } = await supabase!
      .from("households")
      .select("name, property_nickname, lease_start, lease_end, timezone, currency")
      .eq("id", parsed.data.householdId)
      .single();

    const { error } = await supabase!
      .from("households")
      .update({
        name: parsed.data.name,
        property_nickname: parsed.data.propertyNickname || null,
        lease_start: parsed.data.leaseStart || null,
        lease_end: parsed.data.leaseEnd || null,
        timezone: parsed.data.timezone,
        currency: parsed.data.currency,
      })
      .eq("id", parsed.data.householdId);

    if (error) return { ok: false, error: "Unable to update household." };

    const { error: auditError } = await supabase!.rpc("write_audit_event", {
      p_household_id: parsed.data.householdId,
      p_entity_type: "household",
      p_entity_id: parsed.data.householdId,
      p_event_type: "household.updated",
      p_before_state: before,
      p_after_state: {
        name: parsed.data.name,
        property_nickname: parsed.data.propertyNickname || null,
        timezone: parsed.data.timezone,
        currency: parsed.data.currency,
      },
    });
    if (auditError) {
      return { ok: false, error: "Household updated but audit write failed. Contact a coordinator." };
    }

    revalidatePath(`/app/${parsed.data.householdId}/settings/household`);
    return { ok: true, message: "Household updated." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function updateSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = updateSettingsSchema.safeParse({
      householdId: formData.get("householdId"),
      purchaseApprovalThresholdCents: formData.get("purchaseApprovalThresholdCents"),
      approvalRule: formData.get("approvalRule"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "settings.update")) {
      return { ok: false, error: "Not allowed to update settings." };
    }

    const { supabase } = await requireUser();
    const { data: before } = await supabase!
      .from("household_settings")
      .select("purchase_approval_threshold_cents, approval_rule")
      .eq("household_id", parsed.data.householdId)
      .single();

    const { error } = await supabase!
      .from("household_settings")
      .update({
        purchase_approval_threshold_cents: parsed.data.purchaseApprovalThresholdCents,
        approval_rule: parsed.data.approvalRule,
      })
      .eq("household_id", parsed.data.householdId);

    if (error) return { ok: false, error: "Unable to update settings." };

    const { error: auditError } = await supabase!.rpc("write_audit_event", {
      p_household_id: parsed.data.householdId,
      p_entity_type: "settings",
      p_entity_id: parsed.data.householdId,
      p_event_type: "household.settings_updated",
      p_before_state: before,
      p_after_state: {
        purchase_approval_threshold_cents: parsed.data.purchaseApprovalThresholdCents,
        approval_rule: parsed.data.approvalRule,
      },
    });
    if (auditError) {
      return { ok: false, error: "Settings updated but audit write failed. Contact a coordinator." };
    }

    revalidatePath(`/app/${parsed.data.householdId}/settings/household`);
    return { ok: true, message: "Settings updated." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function inviteMemberAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const rolesRaw = formData.getAll("roles").map(String) as HouseholdResponsibility[];
    const parsed = inviteMemberSchema.safeParse({
      householdId: formData.get("householdId"),
      email: formData.get("email"),
      roles: rolesRaw.length ? rolesRaw : ["member"],
      message: formData.get("message") || "",
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invite." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "member.invite")) {
      return { ok: false, error: "Not allowed to invite members." };
    }

    const env = getServerEnv();
    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = invitationExpiresAt(env.INVITATION_TTL_HOURS).toISOString();
    const roles = normalizeRoles(parsed.data.roles);

    const { supabase } = await requireUser();
    const { error } = await supabase!.rpc("create_household_invitation", {
      p_household_id: parsed.data.householdId,
      p_email: parsed.data.email,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
      p_intended_roles: roles,
      p_message: parsed.data.message || undefined,
    });

    if (error) {
      return { ok: false, error: "Unable to create invitation." };
    }

    const inviteUrl = `${env.APP_URL}/join/${token}`;
    revalidatePath(`/app/${parsed.data.householdId}/settings/members`);
    return {
      ok: true,
      message: "Invitation created. Copy the link and share it in your group chat.",
      data: { inviteUrl },
    };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function acceptInviteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = acceptInviteSchema.safeParse({ token: formData.get("token") });
    if (!parsed.success) {
      return { ok: false, error: "Invalid invitation token." };
    }

    const { supabase, user } = await requireUser();
    if (!user) return { ok: false, error: "Sign in to accept this invitation." };

    const { data, error } = await supabase.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(parsed.data.token),
    });

    if (error || !data) {
      logServerError("accept_invite_action", error, {
        code: error?.code ?? null,
        userId: user.id,
      });
      return {
        ok: false,
        error: mapInvitationError(error?.message ?? "Invalid invitation")
          .publicMessage,
      };
    }

    const householdId = String(data);
    const { cookieSet } = await persistCurrentHousehold(householdId);
    revalidatePath("/app");
    if (!cookieSet) {
      logServerError("accept_invite_cookie_fallback", null, {
        householdId,
        userId: user.id,
      });
      redirect("/app");
    }
    redirect(`/app/${householdId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function declineInviteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = acceptInviteSchema.safeParse({ token: formData.get("token") });
    if (!parsed.success) {
      return { ok: false, error: "Invalid invitation token." };
    }

    const { supabase, user } = await requireUser();
    if (!user) return { ok: false, error: "Sign in to decline this invitation." };

    const { error } = await supabase.rpc("decline_household_invitation", {
      p_token_hash: hashInviteToken(parsed.data.token),
    });
    if (error) {
      return {
        ok: false,
        error: mapInvitationError(error.message).publicMessage,
      };
    }
    redirect("/onboarding");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function revokeInviteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = revokeInviteSchema.safeParse({
      householdId: formData.get("householdId"),
      invitationId: formData.get("invitationId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid invitation." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "invite.revoke")) {
      return { ok: false, error: "Not allowed to revoke invitations." };
    }

    const { supabase } = await requireUser();
    const { error } = await supabase!.rpc("revoke_household_invitation", {
      p_household_id: parsed.data.householdId,
      p_invitation_id: parsed.data.invitationId,
    });
    if (error) return { ok: false, error: "Unable to revoke invitation." };

    revalidatePath(`/app/${parsed.data.householdId}/settings/members`);
    return { ok: true, message: "Invitation revoked." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function changeRolesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const rolesRaw = formData.getAll("roles").map(String) as HouseholdResponsibility[];
    const parsed = changeRolesSchema.safeParse({
      householdId: formData.get("householdId"),
      membershipId: formData.get("membershipId"),
      roles: normalizeRoles(rolesRaw),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid role change." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (
      !canChangeRoles({
        actorRoles: ctx.roles,
        actorIsTarget: parsed.data.membershipId === ctx.membershipId,
        nextRoles: parsed.data.roles,
      })
    ) {
      return { ok: false, error: "Not allowed to change these roles." };
    }

    const { supabase } = await requireUser();
    const { error } = await supabase!.rpc("change_membership_roles", {
      p_household_id: parsed.data.householdId,
      p_membership_id: parsed.data.membershipId,
      p_roles: parsed.data.roles,
    });
    if (error) return { ok: false, error: "Unable to update roles." };

    revalidatePath(`/app/${parsed.data.householdId}/settings/members`);
    return { ok: true, message: "Roles updated." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function removeMemberAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = removeMemberSchema.safeParse({
      householdId: formData.get("householdId"),
      membershipId: formData.get("membershipId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid membership." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "member.remove")) {
      return { ok: false, error: "Not allowed to remove members." };
    }
    if (parsed.data.membershipId === ctx.membershipId) {
      return { ok: false, error: "Use leave household instead." };
    }

    const { supabase } = await requireUser();
    const { error } = await supabase!.rpc("remove_household_member", {
      p_household_id: parsed.data.householdId,
      p_membership_id: parsed.data.membershipId,
    });
    if (error) return { ok: false, error: "Unable to remove member." };

    revalidatePath(`/app/${parsed.data.householdId}/settings/members`);
    return { ok: true, message: "Member removed." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function leaveHouseholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = leaveHouseholdSchema.safeParse({
      householdId: formData.get("householdId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid household." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "member.leave")) {
      return { ok: false, error: "Unable to leave this household." };
    }

    const { supabase } = await requireUser();
    const { error } = await supabase!.rpc("leave_household", {
      p_household_id: parsed.data.householdId,
    });
    if (error) {
      return {
        ok: false,
        error:
          error.message.includes("coordinator")
            ? "Assign another household coordinator before leaving."
            : "Unable to leave household.",
      };
    }

    const cookieStore = await cookies();
    if (cookieStore.get(CURRENT_HOUSEHOLD_COOKIE)?.value === parsed.data.householdId) {
      await clearCurrentHouseholdCookie();
    }

    revalidatePath("/app");
    redirect("/onboarding");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function archiveHouseholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = archiveHouseholdSchema.safeParse({
      householdId: formData.get("householdId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid household." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "household.archive")) {
      return { ok: false, error: "Not allowed to archive this household." };
    }

    const { supabase } = await requireUser();
    const { error } = await supabase!.rpc("archive_household", {
      p_household_id: parsed.data.householdId,
    });
    if (error) return { ok: false, error: "Unable to archive household." };

    revalidatePath("/app");
    return { ok: true, message: "Household archived." };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.publicMessage };
    }
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function saveOnboardingDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return { ok: false, error: "You must be signed in." };

    const draft = {
      name: String(formData.get("name") ?? ""),
      propertyNickname: String(formData.get("propertyNickname") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
      currency: String(formData.get("currency") ?? ""),
    };

    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_status: "in_progress",
        onboarding_draft: draft,
      })
      .eq("id", user.id);

    if (error) return { ok: false, error: "Unable to save progress." };
    return { ok: true, message: "Progress saved." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}
