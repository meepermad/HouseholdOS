/**
 * Canonical paste-receipt fixtures shared by parser tests, the in-app
 * "Copy format example" button, and the development parser debugger.
 *
 * Do not rewrite these strings to make a test pass. They are real operator receipts.
 */

export const PASTE_FIXTURE_WALMART = `HOUSEHOLDOS RECEIPT

Merchant: Walmart
Date: 2026-09-04
Total: 55.41
Subtotal: 51.50
Tax: 3.91

ITEMS
Chocolate-Covered Pretzels | 4.97 | 1
Chocolate-Covered Pretzels | 4.97 | 1
Chocolate-Covered Pretzels | 4.97 | 1
Great Value 9-inch Plates, 100 count | 5.58 | 1
Clear Plastic Cutlery | 4.13 | 1
Toilet Brush and Plunger Set | 26.88 | 1

END
`;

export const PASTE_FIXTURE_DOLLAR_GENERAL = `HOUSEHOLDOS RECEIPT

Merchant: Dollar General
Date: 2026-09-05
Total: 26.28
Subtotal: 25.60
Tax: 0.68

ITEMS
Clover Valley Baking Soda, 4 lb | 3.50 | 1
Jumex Mango Nectar | 1.50 | 1
Clover Valley Sugar, 4 lb | 3.25 | 1
Knorr Tomato Bouillon | 2.65 | 1
Clover Valley Baking Powder | 2.25 | 1
Hershey's Baking Cocoa | 4.95 | 1
Clover Valley Mini Chocolate Chips, 10 oz | 3.75 | 1
Clover Valley Mini Chocolate Chips, 10 oz | 3.75 | 1

END
`;

export const PASTE_FIXTURE_ALDI = `HOUSEHOLDOS RECEIPT

Merchant: ALDI
Date: 2026-09-03
Total: 111.36
Subtotal: 108.17
Tax: 3.19

ITEMS
Fresh 80% Lean Ground Beef | 12.54 | 1
Boneless Skinless Chicken Thighs | 11.09 | 1
Boneless Skinless Chicken Thighs | 10.64 | 1
Boneless Skinless Chicken Thighs | 10.26 | 1
Family-Size Chicken Nuggets | 6.89 | 1
Farfalle or Rotini Pasta | 1.09 | 1
Penne Pasta | 2.18 | 2
Protein Pasta | 4.38 | 2
Pizza Snacks, 90 count | 5.99 | 1
Croissant Sandwiches | 10.98 | 2
Pasta Sauce, 24 oz | 3.78 | 2
Noodle Meal Kits | 18.58 | 2
Organic Spices | 1.99 | 1
Egg Rolls | 7.78 | 2

END
`;

export const PASTE_FIXTURE_PUNCTUATION = `HOUSEHOLDOS RECEIPT

Merchant: Walmart
Date: 2026-08-19
Total: 64.42
Subtotal: 62.59
Tax: 1.83

ITEMS
Grated Parmesan Cheese | 7.94 | 1
Grated Parmesan Cheese | 7.94 | 1
Bay Leaves | 2.98 | 1
Deli Turkey, 16 oz | 6.48 | 1
Oscar Mayer Deli Meat, 9 oz | 3.97 | 1
8 oz Seasoning (exact product unclear) | 3.54 | 1
Slap Ya Mama Low-Sodium Seasoning | 4.02 | 1
Great Value Bread Rounds (likely) | 1.48 | 1
Propel Electrolyte Water, 12-Pack | 9.97 | 1
Propel Immune Support Variety Pack, 12-Pack | 14.27 | 1

END
`;

export type PasteFixtureId = "walmart" | "dollar_general" | "aldi" | "punctuation";

export type PasteFixtureExpected = {
  merchant: string;
  purchaseDate: string;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  itemCount: number;
  itemSubtotalCents: number;
  reconciled: boolean;
};

export type PasteFixture = {
  id: PasteFixtureId;
  label: string;
  text: string;
  expected: PasteFixtureExpected;
};

export const PASTE_FIXTURES: readonly PasteFixture[] = [
  {
    id: "walmart",
    label: "Walmart",
    text: PASTE_FIXTURE_WALMART,
    expected: {
      merchant: "Walmart",
      purchaseDate: "2026-09-04",
      totalCents: 5541,
      subtotalCents: 5150,
      taxCents: 391,
      itemCount: 6,
      itemSubtotalCents: 5150,
      reconciled: true,
    },
  },
  {
    id: "dollar_general",
    label: "Dollar General",
    text: PASTE_FIXTURE_DOLLAR_GENERAL,
    expected: {
      merchant: "Dollar General",
      purchaseDate: "2026-09-05",
      totalCents: 2628,
      subtotalCents: 2560,
      taxCents: 68,
      itemCount: 8,
      itemSubtotalCents: 2560,
      reconciled: true,
    },
  },
  {
    id: "aldi",
    label: "ALDI",
    text: PASTE_FIXTURE_ALDI,
    expected: {
      merchant: "ALDI",
      purchaseDate: "2026-09-03",
      totalCents: 11136,
      subtotalCents: 10817,
      taxCents: 319,
      itemCount: 14,
      itemSubtotalCents: 10817,
      reconciled: true,
    },
  },
  {
    id: "punctuation",
    label: "Punctuation",
    text: PASTE_FIXTURE_PUNCTUATION,
    expected: {
      merchant: "Walmart",
      purchaseDate: "2026-08-19",
      totalCents: 6442,
      subtotalCents: 6259,
      taxCents: 183,
      itemCount: 10,
      itemSubtotalCents: 6259,
      reconciled: true,
    },
  },
];

export const PASTE_DEV_FIXTURES = PASTE_FIXTURES.filter(
  (fixture) => fixture.id === "walmart" || fixture.id === "dollar_general" || fixture.id === "aldi",
);

/** In-app "Copy format example" must be this same Walmart fixture. */
export function copyFormatExample(): string {
  return PASTE_FIXTURE_WALMART;
}

export function pasteFixtureById(id: PasteFixtureId): PasteFixture {
  const fixture = PASTE_FIXTURES.find((row) => row.id === id);
  if (!fixture) throw new Error(`Unknown paste fixture: ${id}`);
  return fixture;
}
