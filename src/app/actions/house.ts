"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { can, type Capability } from "@/lib/permissions";
import { toPublicErrorMessage } from "@/lib/errors";
import {
  archiveHouseholdLocationSchema,
  cancelShoppingItemSchema,
  changeInventoryConditionSchema,
  createHouseholdLocationSchema,
  createInventoryItemSchema,
  createPantryItemSchema,
  createShoppingItemSchema,
  createSupplyItemSchema,
  discardPantryItemSchema,
  disposeInventoryItemSchema,
  linkResourceToExpenseItemSchema,
  markPantryFinishedSchema,
  markShoppingItemPurchasedSchema,
  markSupplyLowSchema,
  restockSupplyItemSchema,
  shoppingItemActionSchema,
} from "@/lib/validations/house";

// House-resource migrations intentionally precede generated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;
const str = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const optional = (value: FormDataEntryValue | null) => str(value) || null;
const bool = (value: FormDataEntryValue | null) => value === "true" || value === "on";
function jsonArray(formData: FormData, name: string): string[] {
  try {
    const parsed = JSON.parse(str(formData.get(name)));
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return formData.getAll(name).map(String);
  }
}

const path = (householdId: string, suffix = "") => `/app/${householdId}/house${suffix}`;

async function context(householdId: string, capability: Capability) {
  const ctx = await assertActiveMembership(householdId);
  if (!can(ctx.roles, capability)) {
    throw new Error("You are not allowed to perform this house resource action.");
  }
  const { createClient } = await import("@/lib/supabase/server");
  return { ctx, supabase: (await createClient()) as UntypedDb };
}

function invalidate(householdId: string) {
  revalidatePath(path(householdId));
  revalidatePath(path(householdId, "/inventory"));
  revalidatePath(path(householdId, "/supplies"));
  revalidatePath(path(householdId, "/pantry"));
  revalidatePath(path(householdId, "/shopping"));
  revalidatePath(`/app/${householdId}/settings/house-resources`);
  revalidatePath(`/app/${householdId}`);
}

async function rpcAction(args: {
  formData: FormData;
  schema: { safeParse: (value: unknown) => { success: boolean; data?: Record<string, unknown>; error?: { issues: Array<{ message: string }> } } };
  values: (formData: FormData) => Record<string, unknown>;
  capability: Capability;
  rpc: string;
  params: (data: Record<string, unknown>) => Record<string, unknown>;
  message: string;
  extraRevalidate?: (householdId: string) => void;
}): Promise<ActionResult> {
  try {
    const parsed = args.schema.safeParse(args.values(args.formData));
    if (!parsed.success || !parsed.data) {
      return { ok: false, error: parsed.error?.issues[0]?.message ?? "Invalid request." };
    }
    const householdId = parsed.data.householdId as string;
    const { supabase } = await context(householdId, args.capability);
    const { error } = await supabase.rpc(args.rpc, args.params(parsed.data));
    if (error) return { ok: false, error: error.message || "Unable to complete this action." };
    invalidate(householdId);
    args.extraRevalidate?.(householdId);
    return { ok: true, message: args.message };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function createHouseholdLocationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: createHouseholdLocationSchema,
    values: (f) => ({
      householdId: f.get("householdId"),
      name: f.get("name"),
      parentId: optional(f.get("parentId")),
    }),
    capability: "resource.create",
    rpc: "create_household_location",
    params: (d) => ({ p_household_id: d.householdId, p_name: d.name, p_parent_id: d.parentId }),
    message: "Location added.",
  });
}

export async function archiveHouseholdLocationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: archiveHouseholdLocationSchema,
    values: (f) => ({ householdId: f.get("householdId"), locationId: f.get("locationId") }),
    capability: "resource.manage_own",
    rpc: "archive_household_location",
    params: (d) => ({ p_location_id: d.locationId }),
    message: "Location archived.",
  });
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export async function createInventoryItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let target: string | null = null;
  try {
    const parsed = createInventoryItemSchema.safeParse({
      householdId: formData.get("householdId"),
      name: formData.get("name"),
      category: formData.get("category"),
      description: str(formData.get("description")),
      quantity: str(formData.get("quantity")) || "1",
      quantityUnit: formData.get("quantityUnit"),
      locationId: optional(formData.get("locationId")),
      condition: formData.get("condition"),
      ownershipMode: formData.get("ownershipMode"),
      ownerMembershipId: optional(formData.get("ownerMembershipId")),
      sharedMembershipIds: jsonArray(formData, "sharedMembershipIdsJson"),
      visibility: optional(formData.get("visibility")),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item." };
    const { supabase } = await context(parsed.data.householdId, "resource.create");
    const { data: itemId, error } = await supabase.rpc("create_inventory_item", {
      p_household_id: parsed.data.householdId,
      p_name: parsed.data.name,
      p_category: parsed.data.category,
      p_ownership_mode: parsed.data.ownershipMode,
      p_owner_membership_id: parsed.data.ownerMembershipId,
      p_visibility: parsed.data.visibility,
      p_quantity: parsed.data.quantity,
      p_quantity_unit: parsed.data.quantityUnit,
      p_location_id: parsed.data.locationId,
      p_condition: parsed.data.condition,
      p_description: parsed.data.description || null,
      p_shared_membership_ids: parsed.data.sharedMembershipIds,
    });
    if (error || !itemId) return { ok: false, error: error?.message ?? "Unable to add item." };
    invalidate(parsed.data.householdId);
    target = path(parsed.data.householdId, `/inventory/${itemId}`);
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
  redirect(target!);
}

export async function changeInventoryConditionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: changeInventoryConditionSchema,
    values: (f) => ({
      householdId: f.get("householdId"),
      itemId: f.get("itemId"),
      newCondition: f.get("newCondition"),
      reason: str(f.get("reason")),
      note: str(f.get("note")),
    }),
    capability: "resource.manage_own",
    rpc: "change_inventory_condition",
    params: (d) => ({
      p_item_id: d.itemId,
      p_new_condition: d.newCondition,
      p_reason: d.reason || null,
      p_note: d.note || null,
    }),
    message: "Condition updated.",
  });
}

export async function disposeInventoryItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: disposeInventoryItemSchema,
    values: (f) => ({
      householdId: f.get("householdId"),
      itemId: f.get("itemId"),
      status: f.get("status"),
      disposition: str(f.get("disposition")),
    }),
    capability: "resource.manage_own",
    rpc: "dispose_inventory_item",
    params: (d) => ({ p_item_id: d.itemId, p_status: d.status, p_disposition: d.disposition || null }),
    message: "Item updated.",
  });
}

// ---------------------------------------------------------------------------
// Supplies
// ---------------------------------------------------------------------------

export async function createSupplyItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: createSupplyItemSchema,
    values: (f) => ({
      householdId: f.get("householdId"),
      name: f.get("name"),
      category: f.get("category"),
      stockState: f.get("stockState"),
      quantity: optional(f.get("quantity")),
      quantityUnit: f.get("quantityUnit"),
      reorderThreshold: optional(f.get("reorderThreshold")),
      targetQuantity: optional(f.get("targetQuantity")),
      locationId: optional(f.get("locationId")),
      responsibleMembershipId: optional(f.get("responsibleMembershipId")),
      responsibilityAreaId: optional(f.get("responsibilityAreaId")),
      restockPolicy: f.get("restockPolicy"),
      notes: str(f.get("notes")),
      ownershipMode: f.get("ownershipMode") || "household",
      ownerMembershipId: optional(f.get("ownerMembershipId")),
    }),
    capability: "resource.create",
    rpc: "create_supply_item",
    params: (d) => ({
      p_household_id: d.householdId,
      p_name: d.name,
      p_category: d.category,
      p_ownership_mode: d.ownershipMode,
      p_owner_membership_id: d.ownerMembershipId,
      p_stock_state: d.stockState,
      p_quantity: d.quantity,
      p_quantity_unit: d.quantityUnit,
      p_reorder_threshold: d.reorderThreshold,
      p_target_quantity: d.targetQuantity,
      p_location_id: d.locationId,
      p_responsible_membership_id: d.responsibleMembershipId,
      p_responsibility_area_id: d.responsibilityAreaId,
      p_restock_policy: d.restockPolicy,
      p_notes: d.notes || null,
    }),
    message: "Supply added.",
  });
}

export async function markSupplyLowAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: markSupplyLowSchema,
    values: (f) => ({ householdId: f.get("householdId"), itemId: f.get("itemId"), note: str(f.get("note")) }),
    capability: "resource.update_stock",
    rpc: "mark_supply_low",
    params: (d) => ({ p_item_id: d.itemId, p_note: d.note || null }),
    message: "Marked low.",
  });
}

export async function restockSupplyItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: restockSupplyItemSchema,
    values: (f) => ({
      householdId: f.get("householdId"),
      itemId: f.get("itemId"),
      quantity: optional(f.get("quantity")),
      stockState: f.get("stockState") || "in_stock",
      note: str(f.get("note")),
    }),
    capability: "resource.update_stock",
    rpc: "restock_supply_item",
    params: (d) => ({ p_item_id: d.itemId, p_quantity: d.quantity, p_stock_state: d.stockState, p_note: d.note || null }),
    message: "Restocked.",
  });
}

// ---------------------------------------------------------------------------
// Pantry
// ---------------------------------------------------------------------------

export async function createPantryItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: createPantryItemSchema,
    values: (f) => ({
      householdId: f.get("householdId"),
      name: f.get("name"),
      normalizedName: str(f.get("normalizedName")),
      category: f.get("category"),
      quantity: optional(f.get("quantity")),
      quantityUnit: f.get("quantityUnit"),
      locationId: optional(f.get("locationId")),
      useSoonAt: optional(f.get("useSoonAt")),
      useBy: optional(f.get("useBy")),
      bestBy: optional(f.get("bestBy")),
      communalAvailable: bool(f.get("communalAvailable")),
      remainingState: optional(f.get("remainingState")),
      notes: str(f.get("notes")),
      ownershipMode: f.get("ownershipMode") || "household",
      ownerMembershipId: optional(f.get("ownerMembershipId")),
      visibility: optional(f.get("visibility")),
    }),
    capability: "resource.create",
    rpc: "create_pantry_item",
    params: (d) => ({
      p_household_id: d.householdId,
      p_name: d.name,
      p_category: d.category,
      p_ownership_mode: d.ownershipMode,
      p_owner_membership_id: d.ownerMembershipId,
      p_visibility: d.visibility,
      p_quantity: d.quantity,
      p_quantity_unit: d.quantityUnit,
      p_location_id: d.locationId,
      p_use_soon_at: d.useSoonAt,
      p_use_by: d.useBy,
      p_best_by: d.bestBy,
      p_communal_available: d.communalAvailable,
      p_remaining_state: d.remainingState,
      p_notes: d.notes || null,
      p_normalized_name: d.normalizedName || null,
    }),
    message: "Pantry item added.",
  });
}

export async function markPantryFinishedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: markPantryFinishedSchema,
    values: (f) => ({ householdId: f.get("householdId"), itemId: f.get("itemId"), note: str(f.get("note")) }),
    capability: "resource.update_stock",
    rpc: "mark_pantry_finished",
    params: (d) => ({ p_item_id: d.itemId, p_note: d.note || null }),
    message: "Marked finished.",
  });
}

export async function discardPantryItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: discardPantryItemSchema,
    values: (f) => ({ householdId: f.get("householdId"), itemId: f.get("itemId"), note: str(f.get("note")) }),
    capability: "resource.update_stock",
    rpc: "discard_pantry_item",
    params: (d) => ({ p_item_id: d.itemId, p_note: d.note || null }),
    message: "Discarded.",
  });
}

// ---------------------------------------------------------------------------
// Shopping
// ---------------------------------------------------------------------------

export async function createShoppingItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: createShoppingItemSchema,
    values: (f) => ({
      householdId: f.get("householdId"),
      name: f.get("name"),
      listId: optional(f.get("listId")),
      category: f.get("category") || "other",
      quantity: optional(f.get("quantity")),
      quantityUnit: f.get("quantityUnit") || "item",
      priority: f.get("priority") || "normal",
      intendedOwnership: f.get("intendedOwnership") || "household",
      intendedOwnerMembershipId: optional(f.get("intendedOwnerMembershipId")),
      neededBy: optional(f.get("neededBy")),
      estimatedCostCents: optional(f.get("estimatedCostCents")),
      relatedSupplyId: optional(f.get("relatedSupplyId")),
      relatedPantryId: optional(f.get("relatedPantryId")),
      relatedInventoryId: optional(f.get("relatedInventoryId")),
      description: str(f.get("description")),
    }),
    capability: "resource.shop",
    rpc: "create_shopping_item",
    params: (d) => ({
      p_household_id: d.householdId,
      p_name: d.name,
      p_list_id: d.listId,
      p_category: d.category,
      p_quantity: d.quantity,
      p_quantity_unit: d.quantityUnit,
      p_priority: d.priority,
      p_intended_ownership: d.intendedOwnership,
      p_intended_owner_membership_id: d.intendedOwnerMembershipId,
      p_needed_by: d.neededBy,
      p_estimated_cost_cents: d.estimatedCostCents,
      p_related_supply_id: d.relatedSupplyId,
      p_related_pantry_id: d.relatedPantryId,
      p_related_inventory_id: d.relatedInventoryId,
      p_description: d.description || null,
    }),
    message: "Added to shopping list.",
  });
}

export async function claimShoppingItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: shoppingItemActionSchema,
    values: (f) => ({ householdId: f.get("householdId"), itemId: f.get("itemId") }),
    capability: "resource.shop",
    rpc: "claim_shopping_item",
    params: (d) => ({ p_item_id: d.itemId }),
    message: "Claimed. You're on it.",
  });
}

export async function markShoppingItemPurchasedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: markShoppingItemPurchasedSchema,
    values: (f) => ({
      householdId: f.get("householdId"),
      itemId: f.get("itemId"),
      purchasedQuantity: optional(f.get("purchasedQuantity")),
      updateRelatedStock: f.has("updateRelatedStock") ? bool(f.get("updateRelatedStock")) : true,
      expenseItemId: optional(f.get("expenseItemId")),
    }),
    capability: "resource.shop",
    rpc: "mark_shopping_item_purchased",
    params: (d) => ({
      p_item_id: d.itemId,
      p_purchased_quantity: d.purchasedQuantity,
      p_update_related_stock: d.updateRelatedStock,
      p_expense_item_id: d.expenseItemId,
    }),
    message: "Marked purchased.",
  });
}

export async function cancelShoppingItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: cancelShoppingItemSchema,
    values: (f) => ({ householdId: f.get("householdId"), itemId: f.get("itemId") }),
    capability: "resource.shop",
    rpc: "cancel_shopping_item",
    params: (d) => ({ p_item_id: d.itemId }),
    message: "Cancelled.",
  });
}

// ---------------------------------------------------------------------------
// Expense linkage
// ---------------------------------------------------------------------------

export async function linkResourceToExpenseItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rpcAction({
    formData,
    schema: linkResourceToExpenseItemSchema,
    values: (f) => ({
      householdId: f.get("householdId"),
      expenseItemId: f.get("expenseItemId"),
      resourceType: f.get("resourceType"),
      resourceId: f.get("resourceId"),
      linkKind: f.get("linkKind"),
    }),
    capability: "resource.link_expense",
    rpc: "link_resource_to_expense_item",
    params: (d) => ({
      p_household_id: d.householdId,
      p_expense_item_id: d.expenseItemId,
      p_resource_type: d.resourceType,
      p_resource_id: d.resourceId,
      p_link_kind: d.linkKind,
    }),
    message: "Linked to expense.",
  });
}

/** Plain <form action> wrappers for pages that are not using useActionState. */
export async function changeInventoryConditionFormAction(formData: FormData) {
  await changeInventoryConditionAction(null, formData);
}

export async function disposeInventoryItemFormAction(formData: FormData) {
  await disposeInventoryItemAction(null, formData);
}

export async function markPantryFinishedFormAction(formData: FormData) {
  await markPantryFinishedAction(null, formData);
}

export async function discardPantryItemFormAction(formData: FormData) {
  await discardPantryItemAction(null, formData);
}

export async function createHouseholdLocationFormAction(formData: FormData) {
  await createHouseholdLocationAction(null, formData);
}
