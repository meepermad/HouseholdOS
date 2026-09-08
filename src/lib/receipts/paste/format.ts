export const RECEIPT_FORMAT_HEADER = "HOUSEHOLDOS RECEIPT";
export const RECEIPT_FORMAT_ITEMS = "ITEMS";
export const RECEIPT_FORMAT_END = "END";
/** Current documented paste format. Missing Format field implies this version. */
export const PASTE_FORMAT_VERSION = 1;

export {
  copyFormatExample,
  PASTE_FIXTURE_WALMART as RECEIPT_FORMAT_EXAMPLE,
} from "./fixtures";

export const RECEIPT_FORMAT_PLACEHOLDER = `${RECEIPT_FORMAT_HEADER}

Merchant: Walmart
Date: 2026-09-04
Total: 55.41

${RECEIPT_FORMAT_ITEMS}
Chocolate-Covered Pretzels | 4.97 | 1
Great Value 9-inch Plates, 100 count | 5.58 | 1

${RECEIPT_FORMAT_END}
`;

export const CHATGPT_FORMAT_PROMPT = "Format this as a HouseholdOS receipt.";

export const CHATGPT_WORKFLOW_STEPS = [
  "Upload your receipt.",
  `Ask: "${CHATGPT_FORMAT_PROMPT}"`,
  "Copy the response.",
  "Paste it here.",
] as const;

export type OwnershipHintKind =
  | "mine"
  | "shared"
  | "household"
  | "unassigned"
  | "member";

export const OWNERSHIP_HINT_WORDS = new Set([
  "mine",
  "shared",
  "household",
  "unassigned",
]);
