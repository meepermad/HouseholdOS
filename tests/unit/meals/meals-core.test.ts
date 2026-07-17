import { describe, expect, it } from "vitest";
import {
  areDistinctCreamVariants,
  assertMealBatchHasNoPortions,
  assertNeverDeletesPurchased,
  buildAliasTable,
  buildShoppingPrepLines,
  calculateShortfall,
  calculateShortfalls,
  decimalSafeScale,
  estimateServings,
  explainRanking,
  matchIngredient,
  mayMutateShoppingFromRequest,
  namesMatch,
  normalizeForMatch,
  normalizeIngredientName,
  projectDietaryConstraintsForOrganizer,
  rankRecipes,
  recalculateShoppingPrep,
  resolveShoppingPrepPolicy,
  scaleIngredients,
  shouldAutoApplyShopping,
  shouldNotifyHouseholdForMeal,
  suggestMealExpenseAllocation,
  validateRecipeBasics,
  type AuthorizedPantryItem,
  type IngredientMatchInput,
  type RankableRecipe,
} from "@/lib/meals";

const pantry = (
  overrides: Partial<AuthorizedPantryItem> & Pick<AuthorizedPantryItem, "id" | "name">,
): AuthorizedPantryItem => ({
  quantity: "2",
  unit: "pound",
  quantityIsApproximate: false,
  state: "available",
  communalAvailable: true,
  ownershipMode: "household",
  usableByViewer: true,
  ...overrides,
});

const ing = (
  overrides: Partial<IngredientMatchInput> & Pick<IngredientMatchInput, "id" | "displayName">,
): IngredientMatchInput => ({
  quantity: "2",
  unit: "pound",
  quantityMode: "exact",
  required: true,
  ...overrides,
});

describe("recipe validation", () => {
  it("accepts a normal recipe", () => {
    expect(
      validateRecipeBasics({ name: "Chicken Alfredo", baseServings: 4 }),
    ).toEqual({ ok: true });
  });
  it("rejects empty name and zero servings", () => {
    expect(validateRecipeBasics({ name: " ", baseServings: 4 }).ok).toBe(false);
    expect(validateRecipeBasics({ name: "X", baseServings: 0 }).ok).toBe(false);
  });
});

describe("ingredient normalization", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeIngredientName("Bell Peppers!")).toBe("bell peppers");
  });
  it("singularizes safely", () => {
    expect(normalizeForMatch("Tomatoes")).toBe("tomato");
  });
  it("matches aliases", () => {
    const aliases = buildAliasTable();
    expect(namesMatch("capsicum", "bell pepper", aliases)).toBe(true);
    expect(namesMatch("scallion", "green onion", aliases)).toBe(true);
    expect(namesMatch("garbanzo bean", "chickpea", aliases)).toBe(true);
  });
  it("does not merge distinct cream variants", () => {
    expect(areDistinctCreamVariants("cream", "heavy cream")).toBe(true);
    expect(namesMatch("cream", "sour cream")).toBe(false);
    expect(namesMatch("cream cheese", "heavy cream")).toBe(false);
  });
});

describe("pantry matching", () => {
  it("exact available match", () => {
    const r = matchIngredient(
      ing({ id: "1", displayName: "chicken breast" }),
      [pantry({ id: "p1", name: "chicken breast", quantity: "3" })],
    );
    expect(r.status).toBe("available");
  });
  it("approximate → probably_available", () => {
    const r = matchIngredient(
      ing({ id: "1", displayName: "spinach" }),
      [
        pantry({
          id: "p1",
          name: "spinach",
          quantity: "2",
          quantityIsApproximate: true,
        }),
      ],
    );
    expect(r.status).toBe("probably_available");
  });
  it("personal unavailable without revealing owner", () => {
    const r = matchIngredient(ing({ id: "1", displayName: "butter" }), [
      pantry({
        id: "p1",
        name: "butter",
        usableByViewer: false,
        privateUnavailable: true,
      }),
    ]);
    expect(r.status).toBe("personal_unavailable");
    expect(r.pantryItemId).toBeNull();
    expect(r.explanation).toMatch(/not available/i);
  });
  it("low ingredient", () => {
    const r = matchIngredient(
      ing({ id: "1", displayName: "rice", quantity: "4" }),
      [pantry({ id: "p1", name: "rice", quantity: "1", state: "low" })],
    );
    expect(r.status).toBe("low");
  });
  it("use soon", () => {
    const r = matchIngredient(
      ing({ id: "1", displayName: "spinach" }),
      [
        pantry({
          id: "p1",
          name: "spinach",
          state: "use_soon",
          useSoonAt: "2026-07-16",
        }),
      ],
      { today: "2026-07-16" },
    );
    expect(r.status).toBe("use_soon");
  });
  it("missing required", () => {
    const r = matchIngredient(ing({ id: "1", displayName: "parmesan" }), []);
    expect(r.status).toBe("missing");
  });
  it("missing optional", () => {
    const r = matchIngredient(
      ing({
        id: "1",
        displayName: "parsley",
        required: false,
        quantityMode: "optional",
      }),
      [],
    );
    expect(r.status).toBe("optional_missing");
  });
  it("unit mismatch", () => {
    const r = matchIngredient(
      ing({ id: "1", displayName: "oil", unit: "cup", quantity: "1" }),
      [pantry({ id: "p1", name: "oil", unit: "bottle", quantity: "1" })],
    );
    expect(r.status).toBe("unit_mismatch");
  });
  it("quantity unknown", () => {
    const r = matchIngredient(
      ing({ id: "1", displayName: "flour", quantity: "2" }),
      [pantry({ id: "p1", name: "flour", quantity: null })],
    );
    expect(r.status).toBe("probably_available");
  });
});

describe("recipe scaling", () => {
  it("scales exact quantities 4→6 (1.5×)", () => {
    const result = scaleIngredients(
      [
        {
          id: "1",
          displayName: "pasta",
          quantity: "2",
          unit: "pound",
          quantityMode: "exact",
          required: true,
        },
      ],
      4,
      6,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.factor).toBe("1.5");
    expect(result.ingredients[0]!.scaledQuantity).toBe("3");
  });
  it("does not scale to_taste", () => {
    const result = scaleIngredients(
      [
        {
          id: "1",
          displayName: "salt",
          quantity: null,
          unit: "teaspoon",
          quantityMode: "to_taste",
          required: true,
        },
      ],
      4,
      8,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ingredients[0]!.scaledNumerically).toBe(false);
  });
  it("decimal-safe scaling", () => {
    expect(decimalSafeScale("0.1", 1, 3)).toBe("0.3");
  });
});

describe("serving estimates", () => {
  it("guest-inclusive with buffer and leftovers", () => {
    const est = estimateServings({
      attendees: [
        { rsvpStatus: "going", guestCount: 0 },
        { rsvpStatus: "going", guestCount: 0 },
        { rsvpStatus: "going", guestCount: 0 },
      ],
      eventGuestCount: 2,
      bufferServings: 1,
      desiredLeftoverServings: 0,
    });
    expect(est.confirmedPeople).toBe(5);
    expect(est.recommendedMinimum).toBe(6);
  });
  it("maybe attendees and leftover target", () => {
    const est = estimateServings({
      attendees: [
        { rsvpStatus: "going", guestCount: 0 },
        { rsvpStatus: "maybe", guestCount: 1 },
      ],
      includeMaybeInMinimum: true,
      bufferServings: 0,
      desiredLeftoverServings: 2,
    });
    expect(est.possibleAdditionalPeople).toBe(2);
    expect(est.recommendedMinimum).toBe(1 + 2 + 2);
  });
  it("organizer override", () => {
    const est = estimateServings({
      attendees: [{ rsvpStatus: "going", guestCount: 0 }],
      organizerTarget: 7,
    });
    expect(est.organizerTarget).toBe(7);
  });
});

describe("meal type behavior", () => {
  it("personal meals do not notify household", () => {
    expect(shouldNotifyHouseholdForMeal("personal")).toBe(false);
    expect(shouldNotifyHouseholdForMeal("shared_household")).toBe(true);
    expect(shouldNotifyHouseholdForMeal("open_household")).toBe(true);
    expect(shouldNotifyHouseholdForMeal("meal_prep")).toBe(true);
  });
});

describe("recommendation ranking", () => {
  const recipe = (id: string, name: string): RankableRecipe => ({
    id,
    name,
    category: "dinner",
    totalMinutes: 45,
    baseServings: 4,
    requiredIngredientCount: 3,
  });

  it("ranks and explains", () => {
    const matches = new Map([
      [
        "r1",
        [
          {
            ingredientId: "a",
            status: "use_soon" as const,
            pantryItemId: "p",
            explanation: "",
            coveredQuantity: "1",
          },
          {
            ingredientId: "b",
            status: "available" as const,
            pantryItemId: "p2",
            explanation: "",
            coveredQuantity: "1",
          },
          {
            ingredientId: "c",
            status: "missing" as const,
            pantryItemId: null,
            explanation: "",
            coveredQuantity: null,
          },
        ],
      ],
    ]);
    const ranked = rankRecipes([recipe("r1", "Alfredo")], matches, {
      maxMissingIngredients: 2,
      maxTotalMinutes: 60,
    });
    expect(ranked[0]!.recipeId).toBe("r1");
    expect(explainRanking(ranked[0]!).some((r) => /use soon/i.test(r))).toBe(
      true,
    );
  });
  it("excludes excluded-ingredient conflicts and over-time recipes", () => {
    expect(
      rankRecipes(
        [{ ...recipe("r1", "X"), excludedIngredientHits: 1, totalMinutes: 90 }],
        new Map(),
        { maxTotalMinutes: 60 },
      ),
    ).toHaveLength(0);
  });
});

describe("shortfall and shopping prep", () => {
  it("suggests pantry usage shortfall for low stock", () => {
    const sf = calculateShortfall(
      {
        id: "1",
        displayName: "chicken",
        scaledQuantity: "3",
        unit: "pound",
        quantityMode: "exact",
        required: true,
      },
      {
        ingredientId: "1",
        status: "low",
        pantryItemId: "p",
        explanation: "",
        coveredQuantity: "1",
      },
    );
    expect(sf.shortfallQuantity).toBe("2");
    expect(sf.includeInShoppingByDefault).toBe(true);
  });

  it("dedupes against active shopping and preserves purchased", () => {
    const shortfalls = calculateShortfalls(
      [
        {
          id: "ing1",
          displayName: "parmesan",
          scaledQuantity: "1",
          unit: "item",
          quantityMode: "exact",
          required: true,
        },
      ],
      [
        {
          ingredientId: "ing1",
          status: "missing",
          pantryItemId: null,
          explanation: "",
          coveredQuantity: null,
        },
      ],
    );
    const lines = buildShoppingPrepLines(shortfalls, [
      {
        id: "s1",
        name: "parmesan",
        quantity: "1",
        unit: "item",
        status: "requested",
        relatedRecipeIngredientId: "ing1",
        relatedMealPlanId: "m1",
      },
    ]);
    expect(lines[0]!.alreadyOnList).toBe(true);
    expect(lines[0]!.action.kind).toBe("update");

    const purchased = recalculateShoppingPrep({
      shortfalls,
      activeShopping: [
        {
          id: "s2",
          name: "parmesan",
          quantity: "1",
          unit: "item",
          status: "purchased",
          relatedRecipeIngredientId: "ing1",
          relatedMealPlanId: "m1",
        },
      ],
    });
    expect(purchased.lines[0]!.action.kind).toBe("preserve_purchased");
    expect(
      assertNeverDeletesPurchased(
        [
          {
            id: "s2",
            name: "parmesan",
            quantity: "1",
            unit: "item",
            status: "purchased",
            relatedRecipeIngredientId: "ing1",
            relatedMealPlanId: "m1",
          },
        ],
        purchased.lines.map((l) => l.action),
      ),
    ).toBe(true);
  });

  it("shopping policy modes", () => {
    expect(resolveShoppingPrepPolicy(null)).toBe("suggest_and_confirm");
    expect(shouldAutoApplyShopping("automatic_on_acceptance", "recipe_accepted")).toBe(
      true,
    );
    expect(shouldAutoApplyShopping("manual", "recipe_accepted")).toBe(false);
    expect(mayMutateShoppingFromRequest("ranked")).toBe(false);
    expect(mayMutateShoppingFromRequest("recipe_accepted")).toBe(true);
  });
});

describe("guest cost and dietary privacy", () => {
  it("suggests host_covers allocation without confirming", () => {
    const suggestion = suggestMealExpenseAllocation({
      totalCents: 3000,
      organizerMembershipId: "org",
      hostMembershipId: "m2",
      guestCostPolicy: "host_covers",
      participants: [
        { membershipId: "m1", displayName: "Atem", guestCount: 0 },
        { membershipId: "m2", displayName: "Michael", guestCount: 2 },
        { membershipId: "m3", displayName: "Henry", guestCount: 0 },
      ],
      nonParticipants: [
        { membershipId: "m4", displayName: "Andrew", guestCount: 0 },
      ],
    });
    expect(suggestion.requiresManualConfirmation).toBe(true);
    expect(suggestion.shares.reduce((a, s) => a + s.shareCents, 0)).toBe(3000);
    expect(suggestion.explanation.some((e) => /Andrew/.test(e))).toBe(true);
  });

  it("projects anonymous dietary constraints", () => {
    const proj = projectDietaryConstraintsForOrganizer([
      {
        membershipId: "a",
        label: "no dairy",
        shareIdentityWithOrganizer: false,
      },
      {
        membershipId: "b",
        label: "no dairy",
        shareIdentityWithOrganizer: false,
      },
    ]);
    expect(proj.summaries[0]).toMatch(/2 attendees requested no dairy/);
    expect(proj.namedDetails).toHaveLength(0);
  });
});

describe("no portion claim", () => {
  it("rejects portion memberships on batches", () => {
    expect(assertMealBatchHasNoPortions(["m1"]).ok).toBe(false);
    expect(assertMealBatchHasNoPortions([]).ok).toBe(true);
  });
});

describe("deployment path import integrity", () => {
  it("exports meal modules from barrel", async () => {
    const mod = await import("@/lib/meals");
    expect(typeof mod.rankRecipes).toBe("function");
    expect(typeof mod.recalculateShoppingPrep).toBe("function");
    expect(typeof mod.estimateServings).toBe("function");
  });
});
