"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildAuditRow } from "@/lib/audit";
import {
  can,
  canChangeRole,
  canRemoveMember,
  type HouseholdRole,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { generateInviteToken, hashInviteToken, slugifyHouseholdName } from "@/lib/tokens";
import {
  acceptInviteSchema,
  archiveHouseholdSchema,
  changeRoleSchema,
  createHouseholdSchema,
  inviteMemberSchema,
  leaveHouseholdSchema,
  removeMemberSchema,
  revokeInviteSchema,
  transferOwnershipSchema,
  updateHouseholdSchema,
  updateSettingsSchema,
} from "@/lib/validations/household";
import { getPublicEnv } from "@/lib/env";

export type ActionResult =
  | { ok: true; message?: string; data?: Record<string, string> }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null as null };
  }
  return { supabase, user };
}

async function requireMembership(householdId: string) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return { ok: false as const, error: "You must be signed in." };
  }

  const { data: membership, error } = await supabase
    .from("household_memberships")
    .select("*")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error || !membership) {
    return {
      ok: false as const,
      error: "You are not an active member of this household.",
    };
  }

  return {
    ok: true as const,
    supabase,
    user,
    membership: membership as {
      id: string;
      household_id: string;
      user_id: string;
      role: HouseholdRole;
      status: string;
    },
  };
}

export async function signUpAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!email || password.length < 8) {
    return { ok: false, error: "Valid email and password (8+ chars) required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email.split("@")[0] } },
  });

  if (error) return { ok: false, error: error.message };
  redirect("/households");
}

export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  redirect("/households");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createHouseholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createHouseholdSchema.safeParse({
    name: formData.get("name"),
    displayName: formData.get("displayName") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const slug = slugifyHouseholdName(parsed.data.name);
  const { data, error } = await supabase.rpc("create_household", {
    p_name: parsed.data.name,
    p_slug: slug,
    p_display_name: parsed.data.displayName ?? parsed.data.name,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/households");
  redirect(`/households/${data}`);
}

export async function updateHouseholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateHouseholdSchema.safeParse({
    householdId: formData.get("householdId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireMembership(parsed.data.householdId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!can(ctx.membership.role, "household.update")) {
    return { ok: false, error: "Not allowed to update this household." };
  }

  const { data: before } = await ctx.supabase
    .from("households")
    .select("name")
    .eq("id", parsed.data.householdId)
    .single();

  const { error } = await ctx.supabase
    .from("households")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.householdId);

  if (error) return { ok: false, error: error.message };

  await ctx.supabase.from("audit_events").insert(
    buildAuditRow({
      householdId: parsed.data.householdId,
      actorUserId: ctx.user.id,
      entityType: "household",
      entityId: parsed.data.householdId,
      action: "household.updated",
      beforeState: before ?? null,
      afterState: { name: parsed.data.name },
    }),
  );

  revalidatePath(`/households/${parsed.data.householdId}`);
  return { ok: true, message: "Household updated." };
}

export async function updateSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateSettingsSchema.safeParse({
    householdId: formData.get("householdId"),
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireMembership(parsed.data.householdId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!can(ctx.membership.role, "settings.update")) {
    return { ok: false, error: "Not allowed to update settings." };
  }

  const { data: before } = await ctx.supabase
    .from("household_settings")
    .select("timezone, currency, display_name")
    .eq("household_id", parsed.data.householdId)
    .single();

  const { error } = await ctx.supabase
    .from("household_settings")
    .update({
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      display_name: parsed.data.displayName,
    })
    .eq("household_id", parsed.data.householdId);

  if (error) return { ok: false, error: error.message };

  await ctx.supabase.from("audit_events").insert(
    buildAuditRow({
      householdId: parsed.data.householdId,
      actorUserId: ctx.user.id,
      entityType: "settings",
      entityId: parsed.data.householdId,
      action: "settings.updated",
      beforeState: before ?? null,
      afterState: {
        timezone: parsed.data.timezone,
        currency: parsed.data.currency,
        display_name: parsed.data.displayName,
      },
    }),
  );

  revalidatePath(`/households/${parsed.data.householdId}`);
  return { ok: true, message: "Settings updated." };
}

export async function inviteMemberAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = inviteMemberSchema.safeParse({
    householdId: formData.get("householdId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireMembership(parsed.data.householdId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!can(ctx.membership.role, "member.invite")) {
    return { ok: false, error: "Not allowed to invite members." };
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await ctx.supabase.rpc("create_household_invitation", {
    p_household_id: parsed.data.householdId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  });

  if (error) return { ok: false, error: error.message };

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const inviteUrl = `${appUrl}/invites/${token}`;

  revalidatePath(`/households/${parsed.data.householdId}`);
  return {
    ok: true,
    message: "Invitation created. Share the invite link (Phase 0: email delivery not wired).",
    data: { inviteUrl },
  };
}

export async function acceptInviteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = acceptInviteSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid token" };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "You must be signed in to accept an invite." };

  const { data, error } = await supabase.rpc("accept_household_invitation", {
    p_token_hash: hashInviteToken(parsed.data.token),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/households");
  redirect(`/households/${data}`);
}

export async function revokeInviteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = revokeInviteSchema.safeParse({
    householdId: formData.get("householdId"),
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireMembership(parsed.data.householdId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!can(ctx.membership.role, "invite.revoke")) {
    return { ok: false, error: "Not allowed to revoke invites." };
  }

  const { error } = await ctx.supabase
    .from("household_invitations")
    .update({ status: "revoked" })
    .eq("id", parsed.data.invitationId)
    .eq("household_id", parsed.data.householdId)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };

  await ctx.supabase.from("audit_events").insert(
    buildAuditRow({
      householdId: parsed.data.householdId,
      actorUserId: ctx.user.id,
      entityType: "invitation",
      entityId: parsed.data.invitationId,
      action: "invite.revoked",
    }),
  );

  revalidatePath(`/households/${parsed.data.householdId}`);
  return { ok: true, message: "Invitation revoked." };
}

export async function changeRoleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = changeRoleSchema.safeParse({
    householdId: formData.get("householdId"),
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireMembership(parsed.data.householdId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: target } = await ctx.supabase
    .from("household_memberships")
    .select("*")
    .eq("id", parsed.data.membershipId)
    .eq("household_id", parsed.data.householdId)
    .maybeSingle();

  if (!target) return { ok: false, error: "Membership not found." };

  if (parsed.data.role === "owner") {
    return { ok: false, error: "Use transfer ownership to assign owner." };
  }

  if (
    !canChangeRole({
      actorRole: ctx.membership.role,
      targetCurrentRole: target.role as HouseholdRole,
      targetNextRole: parsed.data.role,
      actorIsTarget: target.user_id === ctx.user.id,
    })
  ) {
    return { ok: false, error: "Not allowed to change this role." };
  }

  const { error } = await ctx.supabase
    .from("household_memberships")
    .update({ role: parsed.data.role })
    .eq("id", target.id);

  if (error) return { ok: false, error: error.message };

  await ctx.supabase.from("audit_events").insert(
    buildAuditRow({
      householdId: parsed.data.householdId,
      actorUserId: ctx.user.id,
      entityType: "membership",
      entityId: target.id,
      action: "member.role_changed",
      beforeState: { role: target.role },
      afterState: { role: parsed.data.role },
    }),
  );

  revalidatePath(`/households/${parsed.data.householdId}`);
  return { ok: true, message: "Role updated." };
}

export async function transferOwnershipAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = transferOwnershipSchema.safeParse({
    householdId: formData.get("householdId"),
    membershipId: formData.get("membershipId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireMembership(parsed.data.householdId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!can(ctx.membership.role, "member.transfer_ownership")) {
    return { ok: false, error: "Only the owner can transfer ownership." };
  }

  const { data: target } = await ctx.supabase
    .from("household_memberships")
    .select("*")
    .eq("id", parsed.data.membershipId)
    .eq("household_id", parsed.data.householdId)
    .eq("status", "active")
    .maybeSingle();

  if (!target || target.user_id === ctx.user.id) {
    return { ok: false, error: "Select another active member." };
  }

  // Promote new owner first (deferred owner check), then demote old owner to admin.
  const promote = await ctx.supabase
    .from("household_memberships")
    .update({ role: "owner" })
    .eq("id", target.id);
  if (promote.error) return { ok: false, error: promote.error.message };

  const demote = await ctx.supabase
    .from("household_memberships")
    .update({ role: "admin" })
    .eq("id", ctx.membership.id);
  if (demote.error) return { ok: false, error: demote.error.message };

  await ctx.supabase.from("audit_events").insert(
    buildAuditRow({
      householdId: parsed.data.householdId,
      actorUserId: ctx.user.id,
      entityType: "membership",
      entityId: target.id,
      action: "member.role_changed",
      beforeState: { role: target.role },
      afterState: { role: "owner" },
      metadata: { transfer: true, previousOwnerMembershipId: ctx.membership.id },
    }),
  );

  revalidatePath(`/households/${parsed.data.householdId}`);
  return { ok: true, message: "Ownership transferred." };
}

export async function removeMemberAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse({
    householdId: formData.get("householdId"),
    membershipId: formData.get("membershipId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireMembership(parsed.data.householdId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: target } = await ctx.supabase
    .from("household_memberships")
    .select("*")
    .eq("id", parsed.data.membershipId)
    .eq("household_id", parsed.data.householdId)
    .maybeSingle();

  if (!target) return { ok: false, error: "Membership not found." };

  if (
    !canRemoveMember({
      actorRole: ctx.membership.role,
      targetRole: target.role as HouseholdRole,
      actorIsTarget: target.user_id === ctx.user.id,
    })
  ) {
    return { ok: false, error: "Not allowed to remove this member." };
  }

  // Audit while actor still has membership; RLS denies insert after leave/remove.
  await ctx.supabase.from("audit_events").insert(
    buildAuditRow({
      householdId: parsed.data.householdId,
      actorUserId: ctx.user.id,
      entityType: "membership",
      entityId: target.id,
      action: "member.removed",
      beforeState: { status: target.status, role: target.role },
      afterState: { status: "removed" },
    }),
  );

  const { error } = await ctx.supabase
    .from("household_memberships")
    .update({ status: "removed", left_at: new Date().toISOString() })
    .eq("id", target.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/households/${parsed.data.householdId}`);
  return { ok: true, message: "Member removed." };
}

export async function leaveHouseholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = leaveHouseholdSchema.safeParse({
    householdId: formData.get("householdId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireMembership(parsed.data.householdId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!can(ctx.membership.role, "member.leave")) {
    return {
      ok: false,
      error: "Owners must transfer ownership before leaving.",
    };
  }

  await ctx.supabase.from("audit_events").insert(
    buildAuditRow({
      householdId: parsed.data.householdId,
      actorUserId: ctx.user.id,
      entityType: "membership",
      entityId: ctx.membership.id,
      action: "member.left",
      afterState: { status: "left" },
    }),
  );

  const { error } = await ctx.supabase
    .from("household_memberships")
    .update({ status: "left", left_at: new Date().toISOString() })
    .eq("id", ctx.membership.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/households");
  redirect("/households");
}

export async function archiveHouseholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = archiveHouseholdSchema.safeParse({
    householdId: formData.get("householdId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireMembership(parsed.data.householdId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!can(ctx.membership.role, "household.archive")) {
    return { ok: false, error: "Only the owner can archive a household." };
  }

  const { error } = await ctx.supabase
    .from("households")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", parsed.data.householdId);

  if (error) return { ok: false, error: error.message };

  await ctx.supabase.from("audit_events").insert(
    buildAuditRow({
      householdId: parsed.data.householdId,
      actorUserId: ctx.user.id,
      entityType: "household",
      entityId: parsed.data.householdId,
      action: "household.archived",
      afterState: { status: "archived" },
    }),
  );

  revalidatePath("/households");
  return { ok: true, message: "Household archived." };
}
