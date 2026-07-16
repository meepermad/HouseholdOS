import type {
  InventoryCondition,
  InventoryStatus,
  LeftoverRemainingState,
  OwnershipMode,
  PantryState,
  ResourceVisibility,
  ShoppingItemStatus,
  ShoppingPriority,
  SupplyStockState,
} from "./types";

export const OWNERSHIP_LABELS: Record<OwnershipMode, string> = {
  household: "Household",
  personal: "Personal",
  shared_selected: "Shared",
  temporary: "Temporary",
  unknown: "Unknown",
};

export const CONDITION_LABELS: Record<InventoryCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
  damaged: "Damaged",
  repair_needed: "Needs repair",
  unknown: "Unknown",
};

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  active: "Active",
  loaned: "Loaned",
  missing: "Missing",
  damaged: "Damaged",
  repair_needed: "Needs repair",
  disposed: "Disposed",
  donated: "Donated",
  sold: "Sold",
  moved_out: "Moved out",
  returned: "Returned",
};

export const SUPPLY_STOCK_LABELS: Record<SupplyStockState, string> = {
  in_stock: "In stock",
  low: "Low",
  out: "Out",
  unknown: "Unknown",
};

export const PANTRY_STATE_LABELS: Record<PantryState, string> = {
  available: "Available",
  low: "Low",
  use_soon: "Use soon",
  expired: "Past entered date",
  finished: "Finished",
  discarded: "Discarded",
  unknown: "Unknown",
};

export const LEFTOVER_REMAINING_LABELS: Record<LeftoverRemainingState, string> =
  {
    plenty: "Plenty remaining",
    about_half: "About half remaining",
    low: "Low",
    finished: "Finished",
    unknown: "Unknown",
  };

export const SHOPPING_STATUS_LABELS: Record<ShoppingItemStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  assigned: "Assigned",
  in_cart: "In cart",
  purchased: "Purchased",
  unavailable: "Unavailable",
  cancelled: "Cancelled",
};

export const SHOPPING_PRIORITY_LABELS: Record<ShoppingPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const VISIBILITY_LABELS: Record<ResourceVisibility, string> = {
  household: "Household",
  owner_only: "Private",
  selected_members: "Selected members",
};

export function inventoryStatusLabel(status: InventoryStatus): string {
  return INVENTORY_STATUS_LABELS[status];
}

export function supplyStockLabel(state: SupplyStockState): string {
  return SUPPLY_STOCK_LABELS[state];
}

export function pantryStateLabel(state: PantryState): string {
  return PANTRY_STATE_LABELS[state];
}

export function shoppingStatusLabel(status: ShoppingItemStatus): string {
  return SHOPPING_STATUS_LABELS[status];
}
