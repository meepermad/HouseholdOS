export const CHORE_CATEGORIES = [
  "kitchen",
  "bathroom",
  "trash_recycling",
  "floors",
  "shared_spaces",
  "laundry",
  "supplies",
  "outdoor",
  "administrative",
  "other",
] as const;

export type ChoreCategory = (typeof CHORE_CATEGORIES)[number];

export const CHORE_CATEGORY_LABELS: Record<ChoreCategory, string> = {
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  trash_recycling: "Trash and recycling",
  floors: "Floors",
  shared_spaces: "Shared spaces",
  laundry: "Laundry",
  supplies: "Supplies",
  outdoor: "Outdoor",
  administrative: "Administrative",
  other: "Other",
};

export function isChoreCategory(value: string): value is ChoreCategory {
  return (CHORE_CATEGORIES as readonly string[]).includes(value);
}
