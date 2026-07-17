export const CALENDAR_CATEGORIES = [
  "household_meeting",
  "social",
  "shared_meal",
  "meal_prep",
  "guest_visit",
  "maintenance",
  "cleaning",
  "grocery_trip",
  "bill_deadline",
  "move_in_out",
  "personal",
  "other",
] as const;

export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number];

export const CALENDAR_CATEGORY_LABELS: Record<CalendarCategory, string> = {
  household_meeting: "Household meeting",
  social: "Social",
  shared_meal: "Shared meal",
  meal_prep: "Meal prep",
  guest_visit: "Guest visit",
  maintenance: "Maintenance",
  cleaning: "Cleaning",
  grocery_trip: "Grocery trip",
  bill_deadline: "Bill deadline",
  move_in_out: "Move-in / move-out",
  personal: "Personal",
  other: "Other",
};

/** Semantic marks — labels provide the accessible name; color is never the only cue. */
export const CALENDAR_CATEGORY_MARKS: Record<CalendarCategory, string> = {
  household_meeting: "◎",
  social: "◌",
  shared_meal: "◇",
  meal_prep: "▣",
  guest_visit: "▹",
  maintenance: "⚒",
  cleaning: "▤",
  grocery_trip: "▤",
  bill_deadline: "$",
  move_in_out: "⇄",
  personal: "·",
  other: "•",
};

export function isCalendarCategory(value: string): value is CalendarCategory {
  return (CALENDAR_CATEGORIES as readonly string[]).includes(value);
}
