export const RECEIPT_FORMAT_HEADER = "HOUSEHOLDOS RECEIPT";
export const RECEIPT_FORMAT_ITEMS = "ITEMS";
export const RECEIPT_FORMAT_END = "END";

export const RECEIPT_FORMAT_EXAMPLE = `${RECEIPT_FORMAT_HEADER}

Merchant: Target
Date: 2026-09-04
Paid By: Atem
Total: 42.17
Subtotal: 37.94
Tax: 4.23
Tip: 0.00
Fees: 0.00
Discount: 0.00

${RECEIPT_FORMAT_ITEMS}
Milk | 4.29 | 1
Paper towels | 12.99 | 1

${RECEIPT_FORMAT_END}
`;

export const RECEIPT_FORMAT_PLACEHOLDER = `${RECEIPT_FORMAT_HEADER}

Merchant: Target
Date: 2026-09-04
Total: 42.17

${RECEIPT_FORMAT_ITEMS}
Milk | 4.29 | 1
Paper towels | 12.99 | 1

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
