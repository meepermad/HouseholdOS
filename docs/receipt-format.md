# HouseholdOS Receipt Format v1

Human-readable interchange for pasted receipts. HouseholdOS parses this
deterministically and sends the result through the same receipt draft,
review, split, claim, and confirm workflow as an uploaded photo.

```
HOUSEHOLDOS RECEIPT

Merchant: Walmart
Date: 2026-09-04
Total: 55.41
Subtotal: 51.50
Tax: 3.91

ITEMS
Chocolate-Covered Pretzels | 4.97 | 1
Great Value 9-inch Plates, 100 count | 5.58 | 1

END
```

Required: header `HOUSEHOLDOS RECEIPT`, `Merchant`, `Total`, `ITEMS`, `END`.
`Format: 1` is optional. Missing Format is treated as v1. Unknown future
formats are rejected instead of guessed.

Item line: `Description | Line Total | Quantity` with optional ownership hint
(`mine`, `shared`, `household`, `unassigned`, or a roommate's display name).
Hints are suggestions only. Money is stored as integer cents.

Quantity is informational. `Egg Rolls | 7.78 | 2` means two egg rolls cost
$7.78 together, not $7.78 each.

If a description contains `|`, escape it as `\|`:

```
Candy \| Special Edition | 4.99 | 1
```
