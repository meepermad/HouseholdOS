import { z } from "zod";
import { EXTERNAL_PAYMENT_METHODS } from "@/lib/payments/types";

const uuid = z.string().uuid();

export const submitPaymentSchema = z.object({
  householdId: uuid,
  recipientMembershipId: uuid,
  totalAmountCents: z.coerce.number().int().positive().max(1_000_000_000),
  externalMethod: z.enum(EXTERNAL_PAYMENT_METHODS),
  allocationsJson: z.string().min(2),
  idempotencyKey: z.string().min(8).max(128),
  claimedPaidAt: z.string().optional().nullable(),
  publicNote: z.string().max(500).optional().nullable(),
  privateNote: z.string().max(500).optional().nullable(),
  externalReference: z.string().max(120).optional().nullable(),
  acknowledgeExternal: z.union([z.literal(true), z.literal("true"), z.literal("on")]),
});

export const paymentIdSchema = z.object({
  householdId: uuid,
  paymentId: uuid,
});

export const rejectPaymentSchema = paymentIdSchema.extend({
  reason: z.string().trim().min(1).max(500),
});

export const reversePaymentSchema = paymentIdSchema.extend({
  reason: z.string().trim().min(1).max(500),
});

export const createWaiverSchema = z.object({
  householdId: uuid,
  obligationId: uuid,
  amountCents: z.coerce.number().int().positive().max(1_000_000_000),
  reason: z.string().trim().min(1).max(500),
});

export const reverseWaiverSchema = z.object({
  householdId: uuid,
  waiverId: uuid,
  reason: z.string().trim().min(1).max(500),
});

export const openDisputeSchema = z
  .object({
    householdId: uuid,
    disputeType: z.enum([
      "expense_allocation",
      "obligation_amount",
      "payment_not_received",
      "incorrect_payment_amount",
      "duplicate_payment",
      "incorrect_payment_allocation",
      "other",
    ]),
    reason: z.string().trim().min(1).max(1000),
    expenseId: uuid.optional().nullable(),
    obligationId: uuid.optional().nullable(),
    paymentId: uuid.optional().nullable(),
  })
  .refine(
    (v) =>
      [v.expenseId, v.obligationId, v.paymentId].filter(Boolean).length === 1,
    { message: "Dispute must reference exactly one subject." },
  );

export const resolveDisputeSchema = z.object({
  householdId: uuid,
  disputeId: uuid,
  resolutionType: z.enum([
    "expense_amendment",
    "expense_void",
    "payment_rejection",
    "payment_reversal",
    "waiver",
    "no_change",
  ]),
  resolutionNote: z.string().trim().min(1).max(1000),
});

export const withdrawDisputeSchema = z.object({
  householdId: uuid,
  disputeId: uuid,
});
