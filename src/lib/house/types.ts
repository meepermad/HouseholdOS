export type OwnershipMode =
  | "household"
  | "personal"
  | "shared_selected"
  | "temporary"
  | "unknown";

export type ResourceVisibility =
  | "household"
  | "owner_only"
  | "selected_members";

export type InventoryCondition =
  | "new"
  | "good"
  | "fair"
  | "worn"
  | "damaged"
  | "repair_needed"
  | "unknown";

export type InventoryStatus =
  | "active"
  | "loaned"
  | "missing"
  | "damaged"
  | "repair_needed"
  | "disposed"
  | "donated"
  | "sold"
  | "moved_out"
  | "returned";

export type SupplyStockState = "in_stock" | "low" | "out" | "unknown";

export type RestockPolicy = "manual" | "suggest" | "automatic";

export type PantryState =
  | "available"
  | "low"
  | "use_soon"
  | "expired"
  | "finished"
  | "discarded"
  | "unknown";

export type LeftoverRemainingState =
  | "plenty"
  | "about_half"
  | "low"
  | "finished"
  | "unknown";

export type QuantityUnit =
  | "item"
  | "pack"
  | "roll"
  | "bottle"
  | "box"
  | "bag"
  | "can"
  | "jar"
  | "ounce"
  | "pound"
  | "gram"
  | "kilogram"
  | "milliliter"
  | "liter"
  | "cup"
  | "tablespoon"
  | "teaspoon"
  | "serving"
  | "unknown";

export type StockEventType =
  | "created"
  | "counted"
  | "restocked"
  | "used"
  | "adjusted"
  | "finished"
  | "discarded"
  | "transferred"
  | "corrected";

export type ShoppingItemStatus =
  | "requested"
  | "approved"
  | "assigned"
  | "in_cart"
  | "purchased"
  | "unavailable"
  | "cancelled";

export type ShoppingPriority = "low" | "normal" | "high" | "urgent";

export type ResourceType =
  | "inventory"
  | "supply"
  | "pantry"
  | "shopping_item";

export type ResourceLinkKind =
  | "acquisition"
  | "restock"
  | "purchase_completion";

export type ResourceProjectionMode = "full" | "hidden";

/** Open shopping statuses that block duplicate active requests for the same supply. */
export const OPEN_SHOPPING_STATUSES: readonly ShoppingItemStatus[] = [
  "requested",
  "approved",
  "assigned",
  "in_cart",
] as const;

export const TERMINAL_SHOPPING_STATUSES: readonly ShoppingItemStatus[] = [
  "purchased",
  "unavailable",
  "cancelled",
] as const;

export const TERMINAL_INVENTORY_STATUSES: readonly InventoryStatus[] = [
  "disposed",
  "donated",
  "sold",
  "moved_out",
  "returned",
] as const;
