import type {
  InventoryCondition,
  InventoryStatus,
  PantryState,
  ShoppingItemStatus,
  SupplyStockState,
} from "./types";
import { TERMINAL_INVENTORY_STATUSES } from "./types";

const CONDITION_TRANSITIONS: Record<
  InventoryCondition,
  readonly InventoryCondition[]
> = {
  new: ["good", "fair", "worn", "damaged", "repair_needed", "unknown"],
  good: ["fair", "worn", "damaged", "repair_needed", "unknown", "new"],
  fair: ["good", "worn", "damaged", "repair_needed", "unknown"],
  worn: ["fair", "damaged", "repair_needed", "unknown", "good"],
  damaged: ["repair_needed", "fair", "good", "unknown", "worn"],
  repair_needed: ["good", "fair", "damaged", "unknown", "worn"],
  unknown: ["new", "good", "fair", "worn", "damaged", "repair_needed"],
};

const STATUS_TRANSITIONS: Record<
  InventoryStatus,
  readonly InventoryStatus[]
> = {
  active: [
    "loaned",
    "missing",
    "damaged",
    "repair_needed",
    "disposed",
    "donated",
    "sold",
    "moved_out",
    "returned",
  ],
  loaned: ["active", "returned", "missing", "damaged", "disposed"],
  missing: ["active", "disposed", "sold", "moved_out"],
  damaged: ["active", "repair_needed", "disposed", "donated", "sold"],
  repair_needed: ["active", "damaged", "disposed"],
  disposed: [],
  donated: [],
  sold: [],
  moved_out: [],
  returned: [],
};

const SHOPPING_TRANSITIONS: Record<
  ShoppingItemStatus,
  readonly ShoppingItemStatus[]
> = {
  requested: ["approved", "assigned", "in_cart", "purchased", "unavailable", "cancelled"],
  approved: ["assigned", "in_cart", "purchased", "unavailable", "cancelled"],
  assigned: ["in_cart", "purchased", "unavailable", "cancelled", "requested"],
  in_cart: ["purchased", "unavailable", "cancelled", "assigned"],
  purchased: [],
  unavailable: ["requested", "cancelled"],
  cancelled: [],
};

export function canChangeCondition(
  from: InventoryCondition,
  to: InventoryCondition,
): boolean {
  return from === to || CONDITION_TRANSITIONS[from].includes(to);
}

export function canTransitionInventoryStatus(
  from: InventoryStatus,
  to: InventoryStatus,
): boolean {
  return from === to || STATUS_TRANSITIONS[from].includes(to);
}

export function isTerminalInventoryStatus(status: InventoryStatus): boolean {
  return (TERMINAL_INVENTORY_STATUSES as readonly string[]).includes(status);
}

export function canDisposeInventory(status: InventoryStatus): boolean {
  return canTransitionInventoryStatus(status, "disposed");
}

export function canTransitionShoppingStatus(
  from: ShoppingItemStatus,
  to: ShoppingItemStatus,
): boolean {
  return from === to || SHOPPING_TRANSITIONS[from].includes(to);
}

export function derivePantryStateFromStock(params: {
  stockStateHint?: SupplyStockState | null;
  useSoon: boolean;
  datePassed: boolean;
  finished: boolean;
  discarded: boolean;
}): PantryState {
  if (params.discarded) return "discarded";
  if (params.finished) return "finished";
  if (params.datePassed) return "expired";
  if (params.useSoon) return "use_soon";
  if (params.stockStateHint === "low") return "low";
  if (params.stockStateHint === "out") return "finished";
  if (params.stockStateHint === "unknown") return "unknown";
  return "available";
}
