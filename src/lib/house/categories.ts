export const INVENTORY_CATEGORIES = [
  "appliance",
  "kitchenware",
  "furniture",
  "electronics",
  "cleaning_equipment",
  "bathroom",
  "bedroom",
  "tool",
  "safety",
  "decor",
  "outdoor",
  "documented_property",
  "other",
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  appliance: "Appliance",
  kitchenware: "Kitchenware",
  furniture: "Furniture",
  electronics: "Electronics",
  cleaning_equipment: "Cleaning equipment",
  bathroom: "Bathroom",
  bedroom: "Bedroom",
  tool: "Tool",
  safety: "Safety",
  decor: "Decor",
  outdoor: "Outdoor",
  documented_property: "Documented property",
  other: "Other",
};

export const SUPPLY_CATEGORIES = [
  "paper_goods",
  "cleaning",
  "laundry",
  "dishwashing",
  "bathroom",
  "trash_recycling",
  "maintenance",
  "safety",
  "office",
  "other",
] as const;

export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[number];

export const SUPPLY_CATEGORY_LABELS: Record<SupplyCategory, string> = {
  paper_goods: "Paper goods",
  cleaning: "Cleaning",
  laundry: "Laundry",
  dishwashing: "Dishwashing",
  bathroom: "Bathroom",
  trash_recycling: "Trash and recycling",
  maintenance: "Maintenance",
  safety: "Safety",
  office: "Office",
  other: "Other",
};

export const PANTRY_CATEGORIES = [
  "produce",
  "meat",
  "seafood",
  "dairy",
  "eggs",
  "grains",
  "pasta",
  "bread",
  "canned",
  "frozen",
  "snacks",
  "beverages",
  "condiments",
  "spices",
  "baking",
  "prepared_food",
  "leftovers",
  "other",
] as const;

export type PantryCategory = (typeof PANTRY_CATEGORIES)[number];

export const PANTRY_CATEGORY_LABELS: Record<PantryCategory, string> = {
  produce: "Produce",
  meat: "Meat",
  seafood: "Seafood",
  dairy: "Dairy",
  eggs: "Eggs",
  grains: "Grains",
  pasta: "Pasta",
  bread: "Bread",
  canned: "Canned",
  frozen: "Frozen",
  snacks: "Snacks",
  beverages: "Beverages",
  condiments: "Condiments",
  spices: "Spices",
  baking: "Baking",
  prepared_food: "Prepared food",
  leftovers: "Leftovers",
  other: "Other",
};

export const SHOPPING_CATEGORIES = [
  "groceries",
  "supplies",
  "household",
  "hardware",
  "personal",
  "other",
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  groceries: "Groceries",
  supplies: "Supplies",
  household: "Household",
  hardware: "Hardware",
  personal: "Personal",
  other: "Other",
};

export function isInventoryCategory(value: string): value is InventoryCategory {
  return (INVENTORY_CATEGORIES as readonly string[]).includes(value);
}

export function isSupplyCategory(value: string): value is SupplyCategory {
  return (SUPPLY_CATEGORIES as readonly string[]).includes(value);
}

export function isPantryCategory(value: string): value is PantryCategory {
  return (PANTRY_CATEGORIES as readonly string[]).includes(value);
}

export function isShoppingCategory(value: string): value is ShoppingCategory {
  return (SHOPPING_CATEGORIES as readonly string[]).includes(value);
}
