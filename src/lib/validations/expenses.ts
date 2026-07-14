import { z } from "zod";

export const expenseCategorySchema = z.enum([
  "groceries",
  "household",
  "utilities",
  "dining",
  "transport",
  "health",
  "other",
]);

export const itemAllocationModeSchema = z.enum([
  "personal",
  "equal_all",
  "equal_selected",
  "fixed_cents",
  "percentage",
  "weighted",
  "excluded",
]);

export const adjustmentTypeSchema = z.enum([
  "tax",
  "tip",
  "delivery_fee",
  "service_fee",
  "discount",
  "coupon",
  "store_credit",
  "other",
]);

export const adjustmentAllocationModeSchema = z.enum([
  "proportional",
  "equal_all",
  "equal_selected",
  "fixed_cents",
  "percentage",
  "weighted",
  "payer_absorbs",
  "assigned",
]);

export const createExpenseDraftSchema = z.object({
  householdId: z.string().uuid(),
  payerMembershipId: z.string().uuid(),
  merchant: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: expenseCategorySchema.optional().nullable(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  declaredTotalCents: z.coerce.number().int().min(0).max(100_000_000),
});

export const updateExpenseHeaderSchema = createExpenseDraftSchema.extend({
  expenseId: z.string().uuid(),
});

export const expenseIdSchema = z.object({
  householdId: z.string().uuid(),
  expenseId: z.string().uuid(),
});

export const participantSchema = z.object({
  membershipId: z.string().uuid(),
  fixedCents: z.coerce.number().int().optional(),
  percentBps: z.coerce.number().int().min(0).max(10_000).optional(),
  weight: z.coerce.number().int().min(1).optional(),
});

export const upsertExpenseItemSchema = z.object({
  householdId: z.string().uuid(),
  expenseId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(500),
  quantityLabel: z.string().trim().max(80).optional().or(z.literal("")),
  totalCents: z.coerce.number().int().min(0).max(100_000_000),
  displayOrder: z.coerce.number().int().min(0).default(0),
  allocationMode: itemAllocationModeSchema,
  personalMembershipId: z.string().uuid().optional().nullable(),
  excludeFromAdjustmentBasis: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .optional(),
  participants: z.array(participantSchema).default([]),
});

export const deleteExpenseItemSchema = z.object({
  householdId: z.string().uuid(),
  expenseId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const upsertExpenseAdjustmentSchema = z.object({
  householdId: z.string().uuid(),
  expenseId: z.string().uuid(),
  adjustmentId: z.string().uuid().optional(),
  adjustmentType: adjustmentTypeSchema,
  description: z.string().trim().min(1).max(500),
  amountCents: z.coerce.number().int().min(-100_000_000).max(100_000_000),
  allocationMode: adjustmentAllocationModeSchema,
  assignedMembershipId: z.string().uuid().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  participants: z.array(participantSchema).default([]),
});

export const deleteExpenseAdjustmentSchema = z.object({
  householdId: z.string().uuid(),
  expenseId: z.string().uuid(),
  adjustmentId: z.string().uuid(),
});

export const submitExpenseReviewSchema = expenseIdSchema;

export const confirmExpenseSchema = z.object({
  householdId: z.string().uuid(),
  expenseId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(128),
});

export const voidExpenseSchema = z.object({
  householdId: z.string().uuid(),
  expenseId: z.string().uuid(),
  reason: z.string().trim().min(1).max(2000),
});

export const amendExpenseSchema = z.object({
  householdId: z.string().uuid(),
  expenseId: z.string().uuid(),
  reason: z.string().trim().min(1).max(2000),
});

export const reorderExpenseItemsSchema = z.object({
  householdId: z.string().uuid(),
  expenseId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1),
});
