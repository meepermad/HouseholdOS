# HouseholdOS Receipt Format v1

Human-readable interchange for pasted receipts. HouseholdOS parses this
deterministically and sends the result through the same receipt draft,
review, split, claim, and confirm workflow as an uploaded photo.

```
HOUSEHOLDOS RECEIPT

Merchant: Walmart
Date: 2026-09-04
Paid By: Atem
Total: 84.72
Subtotal: 79.41
Tax: 5.31
Tip: 0.00
Fees: 0.00
Discount: 0.00

ITEMS
Chicken thighs | 13.48 | 1
Rice | 8.97 | 1

END
```

Required: header `HOUSEHOLDOS RECEIPT`, `Merchant`, `Total`, `ITEMS`, `END`.

Item line: `Description | Line Total | Quantity` with optional ownership hint
(`mine`, `shared`, `household`, `unassigned`, or a roommate's display name).
Hints are suggestions only. Money is stored as integer cents.
