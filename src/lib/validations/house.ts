import { z } from "zod";
import {
  INVENTORY_CATEGORIES,
  PANTRY_CATEGORIES,
  SHOPPING_CATEGORIES,
  SUPPLY_CATEGORIES,
} from "@/lib/house/categories";
import { OWNERSHIP_MODES } from "@/lib/house/ownership";
import { parseQuantity, QUANTITY_UNITS } from "@/lib/house/quantity";
import { RESOURCE_VISIBILITIES } from "@/lib/house/visibility";
import { SHOPPING_PRIORITIES } from "@/lib/house/shopping";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

/** Decimal string with up to 3 places, matching numeric(12,3). Empty → null. */
const quantityString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || parseQuantity(value).ok, {
    message: "Quantity must be a decimal with at most 3 places",
  });

/** Required variant for inventory, which always has a quantity. */
const requiredQuantityString = z
  .string()
  .trim()
  .refine((value) => parseQuantity(value).ok, {
    message: "Quantity must be a decimal with at most 3 places",
  });

export const inventoryCategorySchema = z.enum(INVENTORY_CATEGORIES);
export const supplyCategorySchema = z.enum(SUPPLY_CATEGORIES);
export const pantryCategorySchema = z.enum(PANTRY_CATEGORIES);
export const shoppingCategorySchema = z.enum(SHOPPING_CATEGORIES);
export const quantityUnitSchema = z.enum(QUANTITY_UNITS);
export const ownershipModeSchema = z.enum(OWNERSHIP_MODES);
export const resourceVisibilitySchema = z.enum(RESOURCE_VISIBILITIES);
export const shoppingPrioritySchema = z.enum(SHOPPING_PRIORITIES);
export const inventoryConditionSchema = z.enum([
  "new",
  "good",
  "fair",
  "worn",
  "damaged",
  "repair_needed",
  "unknown",
]);
export const inventoryDisposalStatusSchema = z.enum([
  "disposed",
  "donated",
  "sold",
  "moved_out",
  "returned",
]);
export const supplyStockStateSchema = z.enum(["in_stock", "low", "out", "unknown"]);
export const restockPolicySchema = z.enum(["manual", "suggest", "automatic"]);
export const resourceLinkKindSchema = z.enum([
  "acquisition",
  "restock",
  "purchase_completion",
]);
export const resourceTypeSchema = z.enum([
  "inventory",
  "supply",
  "pantry",
  "shopping_item",
]);

const ownershipFields = {
  ownershipMode: ownershipModeSchema.default("household"),
  ownerMembershipId: uuid.optional().nullable(),
  sharedMembershipIds: z.array(uuid).max(20).default([]),
  visibility: resourceVisibilitySchema.optional().nullable(),
};

function requireOwnerForPersonalMode<
  T extends { ownershipMode: string; ownerMembershipId?: string | null },
>(value: T, ctx: z.RefinementCtx) {
  if (
    (value.ownershipMode === "personal" || value.ownershipMode === "temporary") &&
    !value.ownerMembershipId
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["ownerMembershipId"],
      message: "Personal or temporary ownership requires an owner",
    });
  }
}

export const createHouseholdLocationSchema = z.object({
  householdId: uuid,
  name: z.string().trim().min(1).max(200),
  parentId: uuid.optional().nullable(),
});

export const renameHouseholdLocationSchema = z.object({
  householdId: uuid,
  locationId: uuid,
  name: z.string().trim().min(1).max(200),
});

export const archiveHouseholdLocationSchema = z.object({
  householdId: uuid,
  locationId: uuid,
});

export const createInventoryItemSchema = z
  .object({
    householdId: uuid,
    name: z.string().trim().min(1).max(200),
    category: inventoryCategorySchema,
    description: optionalText(4000),
    quantity: requiredQuantityString.default("1"),
    quantityUnit: quantityUnitSchema.default("item"),
    locationId: uuid.optional().nullable(),
    condition: inventoryConditionSchema.default("unknown"),
    ...ownershipFields,
  })
  .superRefine(requireOwnerForPersonalMode);

export const changeInventoryConditionSchema = z.object({
  householdId: uuid,
  itemId: uuid,
  newCondition: inventoryConditionSchema,
  reason: optionalText(500),
  note: optionalText(2000),
});

export const disposeInventoryItemSchema = z.object({
  householdId: uuid,
  itemId: uuid,
  status: inventoryDisposalStatusSchema,
  disposition: optionalText(2000),
});

export const moveInventoryItemSchema = z.object({
  householdId: uuid,
  itemId: uuid,
  locationId: uuid.optional().nullable(),
});

export const createSupplyItemSchema = z
  .object({
    householdId: uuid,
    name: z.string().trim().min(1).max(200),
    category: supplyCategorySchema,
    stockState: supplyStockStateSchema.default("unknown"),
    quantity: quantityString,
    quantityUnit: quantityUnitSchema.default("item"),
    reorderThreshold: quantityString,
    targetQuantity: quantityString,
    locationId: uuid.optional().nullable(),
    responsibleMembershipId: uuid.optional().nullable(),
    responsibilityAreaId: uuid.optional().nullable(),
    restockPolicy: restockPolicySchema.default("suggest"),
    notes: optionalText(4000),
    ownershipMode: z.enum(["household", "personal", "temporary", "unknown"]).default("household"),
    ownerMembershipId: uuid.optional().nullable(),
  })
  .superRefine(requireOwnerForPersonalMode);

export const markSupplyLowSchema = z.object({
  householdId: uuid,
  itemId: uuid,
  note: optionalText(2000),
});

export const restockSupplyItemSchema = z.object({
  householdId: uuid,
  itemId: uuid,
  quantity: quantityString,
  stockState: supplyStockStateSchema.default("in_stock"),
  note: optionalText(2000),
});

export const createPantryItemSchema = z
  .object({
    householdId: uuid,
    name: z.string().trim().min(1).max(200),
    normalizedName: optionalText(200),
    category: pantryCategorySchema,
    quantity: quantityString,
    quantityUnit: quantityUnitSchema.default("item"),
    locationId: uuid.optional().nullable(),
    useSoonAt: date.optional().nullable(),
    useBy: date.optional().nullable(),
    bestBy: date.optional().nullable(),
    communalAvailable: z.boolean().default(true),
    remainingState: z
      .enum(["plenty", "about_half", "low", "finished", "unknown"])
      .optional()
      .nullable(),
    notes: optionalText(4000),
    ownershipMode: z.enum(["household", "personal", "temporary", "unknown"]).default("household"),
    ownerMembershipId: uuid.optional().nullable(),
    visibility: resourceVisibilitySchema.optional().nullable(),
  })
  .superRefine(requireOwnerForPersonalMode);

export const markPantryFinishedSchema = z.object({
  householdId: uuid,
  itemId: uuid,
  note: optionalText(2000),
});

export const discardPantryItemSchema = z.object({
  householdId: uuid,
  itemId: uuid,
  note: optionalText(2000),
});

export const createShoppingItemSchema = z
  .object({
    householdId: uuid,
    name: z.string().trim().min(1).max(200),
    listId: uuid.optional().nullable(),
    category: shoppingCategorySchema.default("other"),
    quantity: quantityString,
    quantityUnit: quantityUnitSchema.default("item"),
    priority: shoppingPrioritySchema.default("normal"),
    intendedOwnership: z
      .enum(["household", "personal", "temporary", "unknown"])
      .default("household"),
    intendedOwnerMembershipId: uuid.optional().nullable(),
    neededBy: date.optional().nullable(),
    estimatedCostCents: z.coerce.number().int().min(0).max(1_000_000_000).optional().nullable(),
    relatedSupplyId: uuid.optional().nullable(),
    relatedPantryId: uuid.optional().nullable(),
    relatedInventoryId: uuid.optional().nullable(),
    description: optionalText(2000),
  })
  .superRefine((value, ctx) => {
    if (
      (value.intendedOwnership === "personal" || value.intendedOwnership === "temporary") &&
      !value.intendedOwnerMembershipId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["intendedOwnerMembershipId"],
        message: "Personal or temporary requests require an intended owner",
      });
    }
  });

export const shoppingItemActionSchema = z.object({
  householdId: uuid,
  itemId: uuid,
});

export const assignShoppingItemSchema = shoppingItemActionSchema.extend({
  shopperMembershipId: uuid,
});

export const markShoppingItemPurchasedSchema = shoppingItemActionSchema.extend({
  purchasedQuantity: quantityString,
  updateRelatedStock: z.boolean().default(true),
  expenseItemId: uuid.optional().nullable(),
});

export const markShoppingItemUnavailableSchema = shoppingItemActionSchema.extend({
  note: optionalText(500),
});

export const cancelShoppingItemSchema = shoppingItemActionSchema;

export const createShoppingListSchema = z.object({
  householdId: uuid,
  name: z.string().trim().min(1).max(200),
  storeLabel: optionalText(200),
});

export const linkResourceToExpenseItemSchema = z.object({
  householdId: uuid,
  expenseItemId: uuid,
  resourceType: resourceTypeSchema,
  resourceId: uuid,
  linkKind: resourceLinkKindSchema,
});

export const unlinkResourceFromExpenseItemSchema = z.object({
  householdId: uuid,
  linkId: uuid,
});
