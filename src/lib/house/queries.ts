import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  InventoryCondition,
  InventoryStatus,
  OwnershipMode,
  PantryState,
  QuantityUnit,
  ResourceVisibility,
  ShoppingItemStatus,
  ShoppingPriority,
  SupplyStockState,
} from "@/lib/house/types";
import type {
  InventoryCategory,
  PantryCategory,
  ShoppingCategory,
  SupplyCategory,
} from "@/lib/house/categories";

// House-resource migrations intentionally precede generated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;
const db = (client: unknown): UntypedDb => client as UntypedDb;

function profileLabel(profile: unknown, fallback: string): string {
  const p = Array.isArray(profile) ? profile[0] : profile;
  const value = p as { display_name?: string | null; email?: string | null } | null;
  return value?.display_name || value?.email || fallback.slice(0, 8);
}

/** Membership id → display label, for attaching owner/responsible/assignee names without ambiguous multi-FK embeds. */
async function membershipLabelMap(
  supabase: UntypedDb,
  householdId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("household_memberships")
    .select("id,profiles(display_name,email)")
    .eq("household_id", householdId);
  const map = new Map<string, string>();
  for (const m of (data ?? []) as Array<Record<string, unknown>>) {
    map.set(m.id as string, profileLabel(m.profiles, m.id as string));
  }
  return map;
}

export type LocationView = {
  id: string;
  name: string;
  parentId: string | null;
  archivedAt: string | null;
};

export async function listLocations(
  householdId: string,
  includeArchived = false,
): Promise<LocationView[]> {
  let query = db(await createClient())
    .from("household_locations")
    .select("id,name,parent_id,archived_at")
    .eq("household_id", householdId)
    .order("name");
  if (!includeArchived) query = query.is("archived_at", null);
  const { data } = await query;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    parentId: (row.parent_id as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
  }));
}

async function locationNameMap(
  supabase: UntypedDb,
  householdId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("household_locations")
    .select("id,name")
    .eq("household_id", householdId);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    map.set(row.id as string, row.name as string);
  }
  return map;
}

export type InventoryItemView = {
  id: string;
  name: string;
  description: string | null;
  category: InventoryCategory;
  ownershipMode: OwnershipMode;
  ownerMembershipId: string | null;
  ownerLabel: string | null;
  visibility: ResourceVisibility;
  quantity: string | null;
  quantityUnit: QuantityUnit;
  quantityIsApproximate: boolean;
  locationId: string | null;
  locationName: string | null;
  condition: InventoryCondition;
  status: InventoryStatus;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePriceCents: number | null;
  warrantyExpiresAt: string | null;
  loanReturnAt: string | null;
  moveOutDisposition: string | null;
  createdByMembershipId: string;
  createdAt: string;
  updatedAt: string;
};

const INVENTORY_SELECT =
  "id,name,description,category,ownership_mode,owner_membership_id,visibility,quantity,quantity_unit," +
  "quantity_is_approximate,location_id,condition,status,brand,model,serial_number,purchase_date," +
  "purchase_price_cents,warranty_expires_at,loan_return_at,move_out_disposition,created_by_membership_id," +
  "created_at,updated_at";

function mapInventoryRow(
  row: Record<string, unknown>,
  labels: Map<string, string>,
  locations: Map<string, string>,
): InventoryItemView {
  const ownerId = (row.owner_membership_id as string | null) ?? null;
  const locationId = (row.location_id as string | null) ?? null;
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    category: row.category as InventoryCategory,
    ownershipMode: row.ownership_mode as OwnershipMode,
    ownerMembershipId: ownerId,
    ownerLabel: ownerId ? labels.get(ownerId) ?? null : null,
    visibility: row.visibility as ResourceVisibility,
    quantity: (row.quantity as string | null) ?? null,
    quantityUnit: row.quantity_unit as QuantityUnit,
    quantityIsApproximate: Boolean(row.quantity_is_approximate),
    locationId,
    locationName: locationId ? locations.get(locationId) ?? null : null,
    condition: row.condition as InventoryCondition,
    status: row.status as InventoryStatus,
    brand: (row.brand as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    serialNumber: (row.serial_number as string | null) ?? null,
    purchaseDate: (row.purchase_date as string | null) ?? null,
    purchasePriceCents: (row.purchase_price_cents as number | null) ?? null,
    warrantyExpiresAt: (row.warranty_expires_at as string | null) ?? null,
    loanReturnAt: (row.loan_return_at as string | null) ?? null,
    moveOutDisposition: (row.move_out_disposition as string | null) ?? null,
    createdByMembershipId: row.created_by_membership_id as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export type InventoryFilters = {
  category?: InventoryCategory;
  status?: InventoryStatus | InventoryStatus[];
  q?: string;
};

export async function listInventoryItems(
  householdId: string,
  filters: InventoryFilters = {},
  limit = 100,
  offset = 0,
): Promise<InventoryItemView[]> {
  const supabase = db(await createClient());
  let query = supabase
    .from("inventory_items")
    .select(INVENTORY_SELECT)
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) {
    query = Array.isArray(filters.status)
      ? query.in("status", filters.status)
      : query.eq("status", filters.status);
  }
  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  const { data } = await query;
  const [labels, locations] = await Promise.all([
    membershipLabelMap(supabase, householdId),
    locationNameMap(supabase, householdId),
  ]);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapInventoryRow(row, labels, locations),
  );
}

export type InventoryConditionEventView = {
  id: string;
  previousCondition: InventoryCondition;
  newCondition: InventoryCondition;
  changedByMembershipId: string;
  changedByLabel: string;
  reason: string | null;
  note: string | null;
  createdAt: string;
};

export async function getInventoryItem(
  householdId: string,
  itemId: string,
): Promise<{
  item: InventoryItemView;
  conditionEvents: InventoryConditionEventView[];
} | null> {
  const supabase = db(await createClient());
  const [{ data: row }, [labels, locations]] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(INVENTORY_SELECT)
      .eq("household_id", householdId)
      .eq("id", itemId)
      .maybeSingle(),
    Promise.all([
      membershipLabelMap(supabase, householdId),
      locationNameMap(supabase, householdId),
    ]),
  ]);
  if (!row) return null;
  const { data: eventRows } = await supabase
    .from("inventory_condition_events")
    .select(
      "id,previous_condition,new_condition,changed_by_membership_id,reason,note,created_at",
    )
    .eq("inventory_item_id", itemId)
    .order("created_at", { ascending: false });
  const conditionEvents = ((eventRows ?? []) as Array<Record<string, unknown>>).map(
    (e) => ({
      id: e.id as string,
      previousCondition: e.previous_condition as InventoryCondition,
      newCondition: e.new_condition as InventoryCondition,
      changedByMembershipId: e.changed_by_membership_id as string,
      changedByLabel:
        labels.get(e.changed_by_membership_id as string) ??
        (e.changed_by_membership_id as string).slice(0, 8),
      reason: (e.reason as string | null) ?? null,
      note: (e.note as string | null) ?? null,
      createdAt: e.created_at as string,
    }),
  );
  return {
    item: mapInventoryRow(row as Record<string, unknown>, labels, locations),
    conditionEvents,
  };
}

export type SupplyItemView = {
  id: string;
  name: string;
  category: SupplyCategory;
  ownershipMode: OwnershipMode;
  ownerMembershipId: string | null;
  ownerLabel: string | null;
  visibility: ResourceVisibility;
  quantity: string | null;
  quantityUnit: QuantityUnit;
  quantityIsApproximate: boolean;
  stockState: SupplyStockState;
  reorderThreshold: string | null;
  targetQuantity: string | null;
  locationId: string | null;
  locationName: string | null;
  responsibleMembershipId: string | null;
  responsibleLabel: string | null;
  preferredBrand: string | null;
  notes: string | null;
  lastPurchasedAt: string | null;
  lastRestockedAt: string | null;
  lastStockCheckAt: string | null;
  restockPolicy: "manual" | "suggest" | "automatic";
  active: boolean;
  createdAt: string;
};

const SUPPLY_SELECT =
  "id,name,category,ownership_mode,owner_membership_id,visibility,quantity,quantity_unit," +
  "quantity_is_approximate,stock_state,reorder_threshold,target_quantity,location_id," +
  "responsible_membership_id,preferred_brand,notes,last_purchased_at,last_restocked_at," +
  "last_stock_check_at,restock_policy,active,created_at";

function mapSupplyRow(
  row: Record<string, unknown>,
  labels: Map<string, string>,
  locations: Map<string, string>,
): SupplyItemView {
  const ownerId = (row.owner_membership_id as string | null) ?? null;
  const responsibleId = (row.responsible_membership_id as string | null) ?? null;
  const locationId = (row.location_id as string | null) ?? null;
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as SupplyCategory,
    ownershipMode: row.ownership_mode as OwnershipMode,
    ownerMembershipId: ownerId,
    ownerLabel: ownerId ? labels.get(ownerId) ?? null : null,
    visibility: row.visibility as ResourceVisibility,
    quantity: (row.quantity as string | null) ?? null,
    quantityUnit: row.quantity_unit as QuantityUnit,
    quantityIsApproximate: Boolean(row.quantity_is_approximate),
    stockState: row.stock_state as SupplyStockState,
    reorderThreshold: (row.reorder_threshold as string | null) ?? null,
    targetQuantity: (row.target_quantity as string | null) ?? null,
    locationId,
    locationName: locationId ? locations.get(locationId) ?? null : null,
    responsibleMembershipId: responsibleId,
    responsibleLabel: responsibleId ? labels.get(responsibleId) ?? null : null,
    preferredBrand: (row.preferred_brand as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    lastPurchasedAt: (row.last_purchased_at as string | null) ?? null,
    lastRestockedAt: (row.last_restocked_at as string | null) ?? null,
    lastStockCheckAt: (row.last_stock_check_at as string | null) ?? null,
    restockPolicy: row.restock_policy as "manual" | "suggest" | "automatic",
    active: Boolean(row.active),
    createdAt: row.created_at as string,
  };
}

export async function listSupplyItems(
  householdId: string,
  stockState?: SupplyStockState | SupplyStockState[],
): Promise<SupplyItemView[]> {
  const supabase = db(await createClient());
  let query = supabase
    .from("supply_items")
    .select(SUPPLY_SELECT)
    .eq("household_id", householdId)
    .eq("active", true)
    .order("name");
  if (stockState) {
    query = Array.isArray(stockState)
      ? query.in("stock_state", stockState)
      : query.eq("stock_state", stockState);
  }
  const { data } = await query;
  const [labels, locations] = await Promise.all([
    membershipLabelMap(supabase, householdId),
    locationNameMap(supabase, householdId),
  ]);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapSupplyRow(row, labels, locations),
  );
}

export async function getSupplyItem(
  householdId: string,
  itemId: string,
): Promise<{
  item: SupplyItemView;
  stockEvents: Array<{
    id: string;
    eventType: string;
    previousQuantity: string | null;
    newQuantity: string | null;
    previousStockState: string | null;
    newStockState: string | null;
    reason: string | null;
    note: string | null;
    recordedByLabel: string;
    createdAt: string;
  }>;
} | null> {
  const supabase = db(await createClient());
  const [{ data: row }, [labels, locations]] = await Promise.all([
    supabase
      .from("supply_items")
      .select(SUPPLY_SELECT)
      .eq("household_id", householdId)
      .eq("id", itemId)
      .maybeSingle(),
    Promise.all([
      membershipLabelMap(supabase, householdId),
      locationNameMap(supabase, householdId),
    ]),
  ]);
  if (!row) return null;
  const { data: eventRows } = await supabase
    .from("supply_stock_events")
    .select(
      "id,event_type,previous_quantity,new_quantity,previous_stock_state,new_stock_state,reason,note,recorded_by_membership_id,created_at",
    )
    .eq("supply_item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(50);
  const stockEvents = ((eventRows ?? []) as Array<Record<string, unknown>>).map((e) => ({
    id: e.id as string,
    eventType: e.event_type as string,
    previousQuantity: (e.previous_quantity as string | null) ?? null,
    newQuantity: (e.new_quantity as string | null) ?? null,
    previousStockState: (e.previous_stock_state as string | null) ?? null,
    newStockState: (e.new_stock_state as string | null) ?? null,
    reason: (e.reason as string | null) ?? null,
    note: (e.note as string | null) ?? null,
    recordedByLabel:
      labels.get(e.recorded_by_membership_id as string) ??
      (e.recorded_by_membership_id as string).slice(0, 8),
    createdAt: e.created_at as string,
  }));
  return {
    item: mapSupplyRow(row as Record<string, unknown>, labels, locations),
    stockEvents,
  };
}

export type PantryItemView = {
  id: string;
  name: string;
  category: PantryCategory;
  ownershipMode: OwnershipMode;
  ownerMembershipId: string | null;
  ownerLabel: string | null;
  visibility: ResourceVisibility;
  quantity: string | null;
  quantityUnit: QuantityUnit;
  locationId: string | null;
  locationName: string | null;
  purchasedAt: string | null;
  preparedAt: string | null;
  bestBy: string | null;
  useBy: string | null;
  openedAt: string | null;
  useSoonAt: string | null;
  state: PantryState;
  communalAvailable: boolean;
  remainingState: string | null;
  notes: string | null;
  createdAt: string;
};

const PANTRY_SELECT =
  "id,name,category,ownership_mode,owner_membership_id,visibility,quantity,quantity_unit," +
  "location_id,purchased_at,prepared_at,best_by,use_by,opened_at,use_soon_at,state," +
  "communal_available,remaining_state,notes,created_at";

function mapPantryRow(
  row: Record<string, unknown>,
  labels: Map<string, string>,
  locations: Map<string, string>,
): PantryItemView {
  const ownerId = (row.owner_membership_id as string | null) ?? null;
  const locationId = (row.location_id as string | null) ?? null;
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as PantryCategory,
    ownershipMode: row.ownership_mode as OwnershipMode,
    ownerMembershipId: ownerId,
    ownerLabel: ownerId ? labels.get(ownerId) ?? null : null,
    visibility: row.visibility as ResourceVisibility,
    quantity: (row.quantity as string | null) ?? null,
    quantityUnit: row.quantity_unit as QuantityUnit,
    locationId,
    locationName: locationId ? locations.get(locationId) ?? null : null,
    purchasedAt: (row.purchased_at as string | null) ?? null,
    preparedAt: (row.prepared_at as string | null) ?? null,
    bestBy: (row.best_by as string | null) ?? null,
    useBy: (row.use_by as string | null) ?? null,
    openedAt: (row.opened_at as string | null) ?? null,
    useSoonAt: (row.use_soon_at as string | null) ?? null,
    state: row.state as PantryState,
    communalAvailable: Boolean(row.communal_available),
    remainingState: (row.remaining_state as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function listPantryItems(
  householdId: string,
  state?: PantryState | PantryState[],
): Promise<PantryItemView[]> {
  const supabase = db(await createClient());
  let query = supabase
    .from("pantry_items")
    .select(PANTRY_SELECT)
    .eq("household_id", householdId)
    .order("use_soon_at", { ascending: true, nullsFirst: false })
    .order("name");
  if (state) {
    query = Array.isArray(state) ? query.in("state", state) : query.eq("state", state);
  } else {
    query = query.not("state", "in", "(finished,discarded)");
  }
  const { data } = await query;
  const [labels, locations] = await Promise.all([
    membershipLabelMap(supabase, householdId),
    locationNameMap(supabase, householdId),
  ]);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapPantryRow(row, labels, locations),
  );
}

export async function getPantryItem(
  householdId: string,
  itemId: string,
): Promise<{
  item: PantryItemView;
  stockEvents: Array<{
    id: string;
    eventType: string;
    previousQuantity: string | null;
    newQuantity: string | null;
    previousState: string | null;
    newState: string | null;
    note: string | null;
    recordedByLabel: string;
    createdAt: string;
  }>;
} | null> {
  const supabase = db(await createClient());
  const [{ data: row }, [labels, locations]] = await Promise.all([
    supabase
      .from("pantry_items")
      .select(PANTRY_SELECT)
      .eq("household_id", householdId)
      .eq("id", itemId)
      .maybeSingle(),
    Promise.all([
      membershipLabelMap(supabase, householdId),
      locationNameMap(supabase, householdId),
    ]),
  ]);
  if (!row) return null;
  const { data: eventRows } = await supabase
    .from("pantry_stock_events")
    .select(
      "id,event_type,previous_quantity,new_quantity,previous_state,new_state,note,recorded_by_membership_id,created_at",
    )
    .eq("pantry_item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(50);
  const stockEvents = ((eventRows ?? []) as Array<Record<string, unknown>>).map((e) => ({
    id: e.id as string,
    eventType: e.event_type as string,
    previousQuantity: (e.previous_quantity as string | null) ?? null,
    newQuantity: (e.new_quantity as string | null) ?? null,
    previousState: (e.previous_state as string | null) ?? null,
    newState: (e.new_state as string | null) ?? null,
    note: (e.note as string | null) ?? null,
    recordedByLabel:
      labels.get(e.recorded_by_membership_id as string) ??
      (e.recorded_by_membership_id as string).slice(0, 8),
    createdAt: e.created_at as string,
  }));
  return {
    item: mapPantryRow(row as Record<string, unknown>, labels, locations),
    stockEvents,
  };
}

export type ShoppingListMetaView = {
  id: string;
  name: string;
  isDefault: boolean;
  storeLabel: string | null;
  archivedAt: string | null;
};

export type ShoppingListItemView = {
  id: string;
  listId: string;
  name: string;
  description: string | null;
  category: ShoppingCategory;
  requestedByMembershipId: string;
  requestedByLabel: string;
  intendedOwnership: OwnershipMode;
  intendedOwnerMembershipId: string | null;
  quantity: string | null;
  quantityUnit: QuantityUnit;
  priority: ShoppingPriority;
  neededBy: string | null;
  assignedShopperMembershipId: string | null;
  assignedShopperLabel: string | null;
  status: ShoppingItemStatus;
  estimatedCostCents: number | null;
  approvalHint: boolean;
  relatedSupplyId: string | null;
  relatedPantryId: string | null;
  relatedInventoryId: string | null;
  purchaserMembershipId: string | null;
  purchaserLabel: string | null;
  purchasedQuantity: string | null;
  purchasedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

const SHOPPING_ITEM_SELECT =
  "id,list_id,name,description,category,requested_by_membership_id,intended_ownership," +
  "intended_owner_membership_id,quantity,quantity_unit,priority,needed_by," +
  "assigned_shopper_membership_id,status,estimated_cost_cents,approval_hint,related_supply_id," +
  "related_pantry_id,related_inventory_id,purchaser_membership_id,purchased_quantity,purchased_at," +
  "cancelled_at,created_at";

function mapShoppingItemRow(
  row: Record<string, unknown>,
  labels: Map<string, string>,
): ShoppingListItemView {
  const requestedBy = row.requested_by_membership_id as string;
  const shopperId = (row.assigned_shopper_membership_id as string | null) ?? null;
  const purchaserId = (row.purchaser_membership_id as string | null) ?? null;
  return {
    id: row.id as string,
    listId: row.list_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    category: row.category as ShoppingCategory,
    requestedByMembershipId: requestedBy,
    requestedByLabel: labels.get(requestedBy) ?? requestedBy.slice(0, 8),
    intendedOwnership: row.intended_ownership as OwnershipMode,
    intendedOwnerMembershipId: (row.intended_owner_membership_id as string | null) ?? null,
    quantity: (row.quantity as string | null) ?? null,
    quantityUnit: row.quantity_unit as QuantityUnit,
    priority: row.priority as ShoppingPriority,
    neededBy: (row.needed_by as string | null) ?? null,
    assignedShopperMembershipId: shopperId,
    assignedShopperLabel: shopperId ? labels.get(shopperId) ?? null : null,
    status: row.status as ShoppingItemStatus,
    estimatedCostCents: (row.estimated_cost_cents as number | null) ?? null,
    approvalHint: Boolean(row.approval_hint),
    relatedSupplyId: (row.related_supply_id as string | null) ?? null,
    relatedPantryId: (row.related_pantry_id as string | null) ?? null,
    relatedInventoryId: (row.related_inventory_id as string | null) ?? null,
    purchaserMembershipId: purchaserId,
    purchaserLabel: purchaserId ? labels.get(purchaserId) ?? null : null,
    purchasedQuantity: (row.purchased_quantity as string | null) ?? null,
    purchasedAt: (row.purchased_at as string | null) ?? null,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function listShoppingLists(
  householdId: string,
): Promise<ShoppingListMetaView[]> {
  const { data } = await db(await createClient())
    .from("shopping_lists")
    .select("id,name,is_default,store_label,archived_at")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("name");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    isDefault: Boolean(row.is_default),
    storeLabel: (row.store_label as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
  }));
}

/** Idempotent — creates the household's default list on first use. */
export async function ensureAndGetDefaultShoppingList(
  householdId: string,
): Promise<string> {
  const supabase = db(await createClient());
  const { data, error } = await supabase.rpc("ensure_default_shopping_list", {
    p_household_id: householdId,
  });
  if (error || !data) {
    throw new Error(error?.message ?? "Unable to load the default shopping list.");
  }
  return data as string;
}

export async function getShoppingListWithItems(
  householdId: string,
  listId: string,
): Promise<{
  list: ShoppingListMetaView;
  items: ShoppingListItemView[];
} | null> {
  const supabase = db(await createClient());
  const { data: listRow } = await supabase
    .from("shopping_lists")
    .select("id,name,is_default,store_label,archived_at")
    .eq("household_id", householdId)
    .eq("id", listId)
    .maybeSingle();
  if (!listRow) return null;
  const [{ data: itemRows }, labels] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select(SHOPPING_ITEM_SELECT)
      .eq("household_id", householdId)
      .eq("list_id", listId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true }),
    membershipLabelMap(supabase, householdId),
  ]);
  return {
    list: {
      id: listRow.id as string,
      name: listRow.name as string,
      isDefault: Boolean(listRow.is_default),
      storeLabel: (listRow.store_label as string | null) ?? null,
      archivedAt: (listRow.archived_at as string | null) ?? null,
    },
    items: ((itemRows ?? []) as Array<Record<string, unknown>>).map((row) =>
      mapShoppingItemRow(row, labels),
    ),
  };
}

export type HouseDashboard = {
  openShopping: { count: number; items: ShoppingListItemView[] };
  lowSupplies: { count: number; items: SupplyItemView[] };
  useSoonPantry: { count: number; items: PantryItemView[] };
  missingDamagedInventory: { count: number; items: InventoryItemView[] };
  recentRestocks: Array<{
    id: string;
    supplyItemId: string;
    supplyName: string;
    newQuantity: string | null;
    quantityUnit: QuantityUnit;
    createdAt: string;
  }>;
};

const OPEN_SHOPPING_STATUS_LIST = ["requested", "approved", "assigned", "in_cart"] as const;
const MISSING_DAMAGED_STATUS_LIST = ["missing", "damaged", "repair_needed"] as const;

export async function listHouseDashboard(householdId: string): Promise<HouseDashboard> {
  const supabase = db(await createClient());
  const [labels, locations] = await Promise.all([
    membershipLabelMap(supabase, householdId),
    locationNameMap(supabase, householdId),
  ]);

  const [
    { data: shoppingRows, count: shoppingCount },
    { data: supplyRows, count: supplyCount },
    { data: pantryRows, count: pantryCount },
    { data: inventoryRows, count: inventoryCount },
    { data: restockRows },
  ] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select(SHOPPING_ITEM_SELECT, { count: "exact" })
      .eq("household_id", householdId)
      .in("status", OPEN_SHOPPING_STATUS_LIST)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(6),
    supabase
      .from("supply_items")
      .select(SUPPLY_SELECT, { count: "exact" })
      .eq("household_id", householdId)
      .eq("active", true)
      .in("stock_state", ["low", "out"])
      .order("name")
      .limit(6),
    supabase
      .from("pantry_items")
      .select(PANTRY_SELECT, { count: "exact" })
      .eq("household_id", householdId)
      .eq("state", "use_soon")
      .order("use_soon_at", { ascending: true })
      .limit(6),
    supabase
      .from("inventory_items")
      .select(INVENTORY_SELECT, { count: "exact" })
      .eq("household_id", householdId)
      .in("status", MISSING_DAMAGED_STATUS_LIST)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("supply_stock_events")
      .select("id,supply_item_id,new_quantity,created_at,supply_items(name,quantity_unit)")
      .eq("household_id", householdId)
      .eq("event_type", "restocked")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    openShopping: {
      count: shoppingCount ?? 0,
      items: ((shoppingRows ?? []) as Array<Record<string, unknown>>).map((row) =>
        mapShoppingItemRow(row, labels),
      ),
    },
    lowSupplies: {
      count: supplyCount ?? 0,
      items: ((supplyRows ?? []) as Array<Record<string, unknown>>).map((row) =>
        mapSupplyRow(row, labels, locations),
      ),
    },
    useSoonPantry: {
      count: pantryCount ?? 0,
      items: ((pantryRows ?? []) as Array<Record<string, unknown>>).map((row) =>
        mapPantryRow(row, labels, locations),
      ),
    },
    missingDamagedInventory: {
      count: inventoryCount ?? 0,
      items: ((inventoryRows ?? []) as Array<Record<string, unknown>>).map((row) =>
        mapInventoryRow(row, labels, locations),
      ),
    },
    recentRestocks: ((restockRows ?? []) as Array<Record<string, unknown>>).map((row) => {
      const supply = Array.isArray(row.supply_items) ? row.supply_items[0] : row.supply_items;
      const supplyInfo = supply as { name?: string; quantity_unit?: QuantityUnit } | null;
      return {
        id: row.id as string,
        supplyItemId: row.supply_item_id as string,
        supplyName: supplyInfo?.name ?? "Supply item",
        newQuantity: (row.new_quantity as string | null) ?? null,
        quantityUnit: supplyInfo?.quantity_unit ?? "item",
        createdAt: row.created_at as string,
      };
    }),
  };
}
