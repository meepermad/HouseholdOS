import { z } from "zod";
import { HOUSEHOLD_RESPONSIBILITIES } from "@/lib/permissions";

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length === 0 ? null : s;
}

/** Convert a dollars form field to integer cents (exact, no float drift). */
export function dollarsToCents(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return Number.NaN;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return Number.NaN;
  const [whole, frac = ""] = raw.split(".");
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(frac.padEnd(2, "0") || "0", 10);
  return cents;
}

export const createHouseholdSchema = z
  .object({
    name: z.string().trim().min(2, "Household name is required.").max(80),
    propertyNickname: z.preprocess(
      emptyToNull,
      z.string().trim().max(80).nullable(),
    ),
    leaseStart: z.preprocess(
      emptyToNull,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Lease start must be a valid date.")
        .nullable(),
    ),
    leaseEnd: z.preprocess(
      emptyToNull,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Lease end must be a valid date.")
        .nullable(),
    ),
    timezone: z.string().trim().min(1, "Timezone is required."),
    currency: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code.")),
    /** Dollar amount from the form; converted to cents. */
    purchaseApprovalThresholdDollars: z
      .string()
      .trim()
      .min(1, "Purchase approval threshold is required."),
    acknowledgeReimbursementPolicy: z.union([
      z.literal("on"),
      z.literal("true"),
      z.boolean(),
    ]),
    idempotencyKey: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    const ack =
      data.acknowledgeReimbursementPolicy === true ||
      data.acknowledgeReimbursementPolicy === "on" ||
      data.acknowledgeReimbursementPolicy === "true";
    if (!ack) {
      ctx.addIssue({
        code: "custom",
        path: ["acknowledgeReimbursementPolicy"],
        message: "You must acknowledge the reimbursement policy.",
      });
    }
    if (data.leaseStart && data.leaseEnd && data.leaseEnd < data.leaseStart) {
      ctx.addIssue({
        code: "custom",
        path: ["leaseEnd"],
        message: "Lease end must follow lease start.",
      });
    }
    const cents = dollarsToCents(data.purchaseApprovalThresholdDollars);
    if (!Number.isFinite(cents) || cents < 0 || cents > 10_000_000) {
      ctx.addIssue({
        code: "custom",
        path: ["purchaseApprovalThresholdDollars"],
        message: "Enter a valid dollar amount (up to 2 decimal places).",
      });
    }
  })
  .transform((data) => ({
    name: data.name,
    propertyNickname: data.propertyNickname,
    leaseStart: data.leaseStart,
    leaseEnd: data.leaseEnd,
    timezone: data.timezone,
    currency: data.currency,
    purchaseApprovalThresholdCents: dollarsToCents(
      data.purchaseApprovalThresholdDollars,
    ),
    acknowledgeReimbursementPolicy: true as const,
    idempotencyKey: data.idempotencyKey,
  }));

export const updateHouseholdSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  propertyNickname: z.string().trim().max(80).optional().or(z.literal("")),
  leaseStart: z.string().optional().or(z.literal("")),
  leaseEnd: z.string().optional().or(z.literal("")),
  timezone: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export const updateSettingsSchema = z.object({
  householdId: z.string().uuid(),
  purchaseApprovalThresholdCents: z.coerce.number().int().min(0).max(10_000_000),
  approvalRule: z.enum(["threshold", "always", "never"]),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  preferredTimezone: z.string().min(1),
  preferredLocale: z.string().min(2).max(16),
});

export const inviteMemberSchema = z.object({
  householdId: z.string().uuid(),
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  roles: z
    .array(z.enum(HOUSEHOLD_RESPONSIBILITIES))
    .min(1)
    .default(["member"]),
  message: z.string().trim().max(500).optional().or(z.literal("")),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(32).max(128),
});

export const revokeInviteSchema = z.object({
  householdId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

export const changeRolesSchema = z.object({
  householdId: z.string().uuid(),
  membershipId: z.string().uuid(),
  roles: z.array(z.enum(HOUSEHOLD_RESPONSIBILITIES)).min(1),
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

export const switchHouseholdSchema = z.object({
  householdId: z.string().uuid(),
});

export const authEmailPasswordSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
