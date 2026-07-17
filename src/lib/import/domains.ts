export type ImportDomain =
  | "inventory"
  | "supplies"
  | "pantry"
  | "shopping"
  | "chores"
  | "responsibilities"
  | "utilities"
  | "calendar_events";

export type ImportColumnDef = {
  key: string;
  label: string;
  required?: boolean;
};

export const IMPORT_DOMAIN_COLUMNS: Record<ImportDomain, readonly ImportColumnDef[]> = {
  inventory: [
    { key: "name", label: "Name", required: true },
    { key: "category", label: "Category" },
    { key: "condition", label: "Condition" },
    { key: "notes", label: "Notes" },
  ],
  supplies: [
    { key: "name", label: "Name", required: true },
    { key: "quantity", label: "Quantity" },
    { key: "unit", label: "Unit" },
    { key: "notes", label: "Notes" },
  ],
  pantry: [
    { key: "name", label: "Name", required: true },
    { key: "quantity", label: "Quantity" },
    { key: "unit", label: "Unit" },
    { key: "notes", label: "Notes" },
  ],
  shopping: [
    { key: "name", label: "Name", required: true },
    { key: "quantity", label: "Quantity" },
    { key: "notes", label: "Notes" },
  ],
  chores: [
    { key: "name", label: "Name", required: true },
    { key: "description", label: "Description" },
    { key: "frequency", label: "Frequency" },
  ],
  responsibilities: [
    { key: "name", label: "Name", required: true },
    { key: "description", label: "Description" },
    { key: "category", label: "Category" },
  ],
  utilities: [
    { key: "name", label: "Name", required: true },
    { key: "category", label: "Category" },
    { key: "due_day", label: "Due day" },
    { key: "estimated_amount", label: "Estimated amount" },
  ],
  calendar_events: [
    { key: "title", label: "Title", required: true },
    { key: "starts_at", label: "Starts at", required: true },
    { key: "ends_at", label: "Ends at" },
    { key: "location", label: "Location" },
    { key: "notes", label: "Notes" },
  ],
};

export const IMPORT_DOMAIN_LABELS: Record<ImportDomain, string> = {
  inventory: "Durable inventory",
  supplies: "Supplies",
  pantry: "Pantry",
  shopping: "Shopping items",
  chores: "Chores",
  responsibilities: "Responsibility areas",
  utilities: "Recurring utilities",
  calendar_events: "Calendar events",
};
