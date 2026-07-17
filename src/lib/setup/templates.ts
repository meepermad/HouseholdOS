/**
 * Starter templates for the household launch wizard.
 * Applied only when the user confirms — never auto-inserted.
 */

export type ResponsibilityTemplate = {
  key: string;
  name: string;
  description: string;
  category: string;
};

export type NamedTemplate = {
  key: string;
  name: string;
};

export const RESPONSIBILITY_TEMPLATES: readonly ResponsibilityTemplate[] = [
  {
    key: "kitchen_food",
    name: "Kitchen and food",
    description: "Shared kitchen cleanliness, leftovers, and food labeling.",
    category: "kitchen",
  },
  {
    key: "trash_recycling",
    name: "Trash and recycling",
    description: "Empty bins, take out trash, and manage recycling schedule.",
    category: "cleaning",
  },
  {
    key: "shared_bathroom",
    name: "Shared bathroom",
    description: "Keep shared bathrooms stocked and reasonably clean.",
    category: "cleaning",
  },
  {
    key: "cleaning_supplies",
    name: "Cleaning supplies",
    description: "Track and restock shared cleaning products.",
    category: "supplies",
  },
  {
    key: "utilities",
    name: "Utilities",
    description: "Monitor bills, due dates, and shared utility accounts.",
    category: "utilities",
  },
  {
    key: "guests_calendar",
    name: "Guests and calendar",
    description: "Guest notices, quiet hours expectations, and shared events.",
    category: "guests",
  },
  {
    key: "maintenance",
    name: "Maintenance",
    description: "Report and coordinate repairs and landlord contact.",
    category: "maintenance",
  },
  {
    key: "household_finances",
    name: "Household finances",
    description: "Shared expenses, reimbursements, and settlement follow-up.",
    category: "finances",
  },
] as const;

export const SUPPLY_TEMPLATES: readonly NamedTemplate[] = [
  { key: "toilet_paper", name: "Toilet paper" },
  { key: "paper_towels", name: "Paper towels" },
  { key: "trash_bags", name: "Trash bags" },
  { key: "dish_soap", name: "Dish soap" },
  { key: "laundry_detergent", name: "Laundry detergent" },
  { key: "cleaning_spray", name: "Cleaning spray" },
] as const;

export const PANTRY_TEMPLATES: readonly NamedTemplate[] = [
  { key: "rice", name: "Rice" },
  { key: "pasta", name: "Pasta" },
  { key: "salt", name: "Salt" },
  { key: "pepper", name: "Pepper" },
  { key: "cooking_oil", name: "Cooking oil" },
  { key: "flour", name: "Flour" },
  { key: "sugar", name: "Sugar" },
] as const;
