import { z } from "zod";
import { HOUSEHOLD_ROLES } from "@/lib/permissions";

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(2).max(80),
  displayName: z.string().trim().min(2).max(80).optional(),
});

export const updateHouseholdSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
});

export const updateSettingsSchema = z.object({
  householdId: z.string().uuid(),
  timezone: z.string().min(1).max(64),
  currency: z.literal("USD"),
  displayName: z.string().trim().min(2).max(80),
});

export const inviteMemberSchema = z.object({
  householdId: z.string().uuid(),
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(HOUSEHOLD_ROLES).exclude(["owner"]),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(32).max(128),
});

export const revokeInviteSchema = z.object({
  householdId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

export const changeRoleSchema = z.object({
  householdId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: z.enum(HOUSEHOLD_ROLES),
});

export const removeMemberSchema = z.object({
  householdId: z.string().uuid(),
  membershipId: z.string().uuid(),
});

export const leaveHouseholdSchema = z.object({
  householdId: z.string().uuid(),
});

export const archiveHouseholdSchema = z.object({
  householdId: z.string().uuid(),
});

export const transferOwnershipSchema = z.object({
  householdId: z.string().uuid(),
  membershipId: z.string().uuid(),
});
