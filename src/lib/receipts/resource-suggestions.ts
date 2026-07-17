import type { ResourceDestination } from "./types";

const SUPPLY_KEYWORDS = [
  "toilet paper",
  "paper towel",
  "trash bag",
  "garbage bag",
  "dish soap",
  "laundry detergent",
  "detergent",
  "cleaning spray",
  "bleach",
  "sponge",
];

const PANTRY_KEYWORDS = [
  "milk",
  "eggs",
  "bread",
  "rice",
  "pasta",
  "flour",
  "sugar",
  "salt",
  "pepper",
  "oil",
  "butter",
  "cheese",
  "yogurt",
  "cereal",
  "coffee",
  "tea",
];

const DURABLE_KEYWORDS = [
  "air fryer",
  "blender",
  "toaster",
  "microwave",
  "vacuum",
  "lamp",
  "fan",
  "heater",
  "kettle",
  "coffee maker",
];

export type ResourceSuggestion = {
  destination: ResourceDestination;
  reason: string;
};

/** Suggest pantry/supply/inventory destination from purchased item name. */
export function suggestResourceDestination(itemName: string): ResourceSuggestion {
  const name = itemName.trim().toLowerCase();
  if (!name) {
    return { destination: "none", reason: "No item name" };
  }
  for (const kw of DURABLE_KEYWORDS) {
    if (name.includes(kw)) {
      return {
        destination: "inventory_add",
        reason: `Looks like durable equipment (${kw})`,
      };
    }
  }
  for (const kw of SUPPLY_KEYWORDS) {
    if (name.includes(kw)) {
      return {
        destination: "supply_restock",
        reason: `Matches common household supply (${kw})`,
      };
    }
  }
  for (const kw of PANTRY_KEYWORDS) {
    if (name.includes(kw)) {
      return {
        destination: "pantry_restock",
        reason: `Matches common pantry staple (${kw})`,
      };
    }
  }
  return { destination: "none", reason: "No automatic suggestion" };
}
