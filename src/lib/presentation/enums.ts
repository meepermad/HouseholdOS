/** Shared humanization for snake_case enums shown in the UI. */

export function humanizeEnum(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      if (part.toLowerCase() === "rsvp") return "RSVP";
      if (part.toLowerCase() === "ics") return "ICS";
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

const NOTIFICATION_CATEGORY_LABELS: Record<string, string> = {
  payments: "Payments",
  disputes: "Disputes",
  membership: "Membership",
  chores: "Chores",
  calendar: "Calendar",
  meals: "Meals",
  maintenance: "Maintenance",
  governance: "Governance",
  system: "System",
  house: "House",
  expenses: "Expenses",
};

export function formatNotificationCategory(category: string): string {
  return NOTIFICATION_CATEGORY_LABELS[category] ?? humanizeEnum(category);
}

const VISIBILITY_LABELS: Record<string, string> = {
  household: "Everyone in the household",
  members_only: "Members only",
  private: "Private",
  coordinators: "Coordinators",
};

export function formatVisibilityLabel(value: string): string {
  return VISIBILITY_LABELS[value] ?? humanizeEnum(value);
}

export const FINANCE_COPY = {
  receiptTotal: "Receipt total",
  applyOldestFirst: "Apply payment to oldest balances",
  youOwe: "You owe",
  youAreOwed: "You are owed",
  awaitingConfirmation: "Awaiting confirmation",
  net: "Net",
} as const;

export const CALENDAR_COPY = {
  earliestTime: "Earliest time",
  latestTime: "Latest time",
  findTime: "Find a time",
  duration: "Duration",
} as const;
