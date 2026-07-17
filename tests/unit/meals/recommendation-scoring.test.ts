import { describe, expect, it } from "vitest";
import type { IngredientMatchResult } from "@/lib/meals";
import {
  SCORING_VERSION,
  aggregatePreferences,
  evaluateHardExclusion,
  projectPrivatePreferenceExplanations,
  scoreRecipes,
  scoreRecipesIncludingExcluded,
  selectRelevantPreferences,
  type MemberPreferenceInput,
  type RecipeHistorySignals,
  type ScoreRequestContext,
  type ScoreableRecipe,
} from "@/lib/meals";

const match = (
  partial: Partial<IngredientMatchResult> &
    Pick<IngredientMatchResult, "ingredientId" | "status">,
): IngredientMatchResult => ({
  pantryItemId: null,
  explanation: "",
  coveredQuantity: null,
  ...partial,
});

const recipe = (
  overrides: Partial<ScoreableRecipe> & Pick<ScoreableRecipe, "id" | "name">,
): ScoreableRecipe => ({
  category: "dinner",
  totalMinutes: 40,
  prepMinutes: 15,
  baseServings: 4,
  requiredEquipment: [],
  availableEquipment: [],
  excludedIngredientHits: 0,
  dietaryConflictHits: 0,
  requiredIngredientCount: 4,
  optionalIngredientCount: 0,
  mealPrepSuitable: false,
  guestScalable: true,
  isNewlyImported: false,
  servingScaleFactor: 1,
  maxReasonableScaleFactor: 4,
  ...overrides,
});

const baseContext = (
  overrides: Partial<ScoreRequestContext> = {},
): ScoreRequestContext => ({
  mode: "best_overall",
  preferenceScope: "attendees",
  maxTotalMinutes: null,
  strictTimeLimit: false,
  maxMissingRequired: null,
  targetServings: null,
  mealType: "shared_household",
  guestConstraints: [],
  excludeIngredients: [],
  now: new Date("2026-07-17T12:00:00Z"),
  ...overrides,
});

const fullMatches = (recipeId: string): IngredientMatchResult[] => [
  match({ ingredientId: `${recipeId}-a`, status: "available" }),
  match({ ingredientId: `${recipeId}-b`, status: "available" }),
  match({ ingredientId: `${recipeId}-c`, status: "available" }),
  match({ ingredientId: `${recipeId}-d`, status: "available" }),
];

function run(opts: {
  recipes: ScoreableRecipe[];
  matches?: Map<string, IngredientMatchResult[]>;
  prefs?: Map<string, MemberPreferenceInput[]>;
  history?: Map<string, RecipeHistorySignals>;
  context?: Partial<ScoreRequestContext>;
}) {
  const matches =
    opts.matches ??
    new Map(opts.recipes.map((r) => [r.id, fullMatches(r.id)]));
  return scoreRecipes({
    recipes: opts.recipes,
    matchesByRecipe: matches,
    preferencesByRecipe: opts.prefs ?? new Map(),
    historyByRecipe: opts.history ?? new Map(),
    context: baseContext(opts.context),
  });
}

describe("Phase 7A scoring version", () => {
  it("exposes stable scoring version", () => {
    expect(SCORING_VERSION).toBe("1");
  });
});

describe("preference selection", () => {
  it("ignores nonattendee preferences by default", () => {
    const selected = selectRelevantPreferences(
      [
        {
          membershipId: "a",
          isAttending: true,
          signal: "would_make_again",
        },
        {
          membershipId: "b",
          isAttending: false,
          signal: "would_not_choose_again",
        },
      ],
      "attendees",
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]!.membershipId).toBe("a");
  });

  it("includes household when preference scope is household", () => {
    const selected = selectRelevantPreferences(
      [
        { membershipId: "a", isAttending: true, signal: "okay" },
        {
          membershipId: "b",
          isAttending: false,
          signal: "would_not_choose_again",
        },
      ],
      "household",
    );
    expect(selected).toHaveLength(2);
  });
});

describe("preference scoring", () => {
  it("applies favorite bonus", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Fav" })],
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "m1",
              isAttending: true,
              signal: "favorite",
              isFavorite: true,
            },
          ],
        ],
      ]),
    });
    expect(ranked[0]!.components.some((c) => c.key === "favorite_bonus" && c.contribution > 0)).toBe(
      true,
    );
    expect(ranked[0]!.reasons.some((r) => /favorite/i.test(r))).toBe(true);
  });

  it("applies would-make-again bonus", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Again" })],
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "m1",
              isAttending: true,
              signal: "would_make_again",
            },
          ],
        ],
      ]),
    });
    expect(
      ranked[0]!.components.some(
        (c) => c.key === "attendee_preference" && c.contribution > 0,
      ),
    ).toBe(true);
    expect(ranked[0]!.reasons.some((r) => /would make again/i.test(r))).toBe(
      true,
    );
  });

  it("applies strong dislike penalty", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Nope" })],
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "m1",
              isAttending: true,
              signal: "would_not_choose_again",
            },
          ],
        ],
      ]),
    });
    expect(
      ranked[0]!.components.some(
        (c) => c.key === "strong_dislike_penalty" && c.contribution < 0,
      ),
    ).toBe(true);
  });

  it("treats unknown preference as neutral", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "New" })],
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "m1",
              isAttending: true,
              signal: "have_not_tried",
            },
          ],
        ],
      ]),
    });
    expect(ranked[0]!.preferenceFit).toBe("unknown");
    expect(
      ranked[0]!.components.find((c) => c.key === "attendee_preference")!
        .contribution,
    ).toBe(0);
  });

  it("ignores nonattendee dislike in attendee scope", () => {
    const withNonAttendee = run({
      recipes: [recipe({ id: "r1", name: "Soup" })],
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "andrew",
              isAttending: false,
              signal: "would_not_choose_again",
            },
            {
              membershipId: "atem",
              isAttending: true,
              signal: "have_not_tried",
            },
          ],
        ],
      ]),
    });
    expect(
      withNonAttendee[0]!.components.find(
        (c) => c.key === "strong_dislike_penalty",
      )!.value,
    ).toBe(0);
  });

  it("open-meal household preference includes nonattendees", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Soup" })],
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "andrew",
              isAttending: false,
              signal: "would_not_choose_again",
            },
          ],
        ],
      ]),
      context: { preferenceScope: "household" },
    });
    expect(
      ranked[0]!.components.find((c) => c.key === "strong_dislike_penalty")!
        .value,
    ).toBe(1);
  });

  it("handles mixed attendee preference without simple average collapse", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Mixed" })],
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "m1",
              isAttending: true,
              signal: "favorite",
              isFavorite: true,
            },
            { membershipId: "m2", isAttending: true, signal: "okay" },
          ],
        ],
      ]),
    });
    expect(["positive", "strong"]).toContain(ranked[0]!.preferenceFit);
    expect(ranked[0]!.totalScore).toBeGreaterThan(0);
  });

  it("applies strong conflict guardrail for favorite + dislike", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Conflict" })],
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "m1",
              isAttending: true,
              signal: "favorite",
              isFavorite: true,
            },
            {
              membershipId: "m2",
              isAttending: true,
              signal: "would_not_choose_again",
            },
          ],
        ],
      ]),
    });
    expect(ranked[0]!.preferenceFit).toBe("conflict");
    expect(ranked[0]!.reasons.some((r) => /mixed/i.test(r))).toBe(true);
  });
});

describe("hard constraints", () => {
  it("hard dietary exclusion", () => {
    const all = scoreRecipesIncludingExcluded({
      recipes: [recipe({ id: "r1", name: "Dairy", dietaryConflictHits: 1 })],
      matchesByRecipe: new Map([["r1", fullMatches("r1")]]),
      preferencesByRecipe: new Map(),
      historyByRecipe: new Map(),
      context: baseContext(),
    });
    expect(all[0]!.excluded).toBe(true);
    expect(all[0]!.hardExclusionReason).toMatch(/dietary|constraint/i);
  });

  it("guest constraints hard-exclude via dietaryConflictHits", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Nuts", dietaryConflictHits: 1 })],
      context: {
        guestConstraints: [{ label: "no nuts" }],
      },
    });
    expect(ranked).toHaveLength(0);
  });

  it("time-limit exclusion when strict", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Slow", totalMinutes: 120 })],
      context: {
        maxTotalMinutes: 45,
        strictTimeLimit: true,
      },
    });
    expect(ranked).toHaveLength(0);
  });

  it("equipment exclusion", () => {
    const ranked = run({
      recipes: [
        recipe({
          id: "r1",
          name: "Grill",
          requiredEquipment: ["grill"],
          availableEquipment: ["oven"],
        }),
      ],
    });
    expect(ranked).toHaveLength(0);
  });

  it("maximum-missing constraint", () => {
    const matches = new Map([
      [
        "r1",
        [
          match({ ingredientId: "a", status: "available" }),
          match({ ingredientId: "b", status: "missing" }),
          match({ ingredientId: "c", status: "missing" }),
          match({ ingredientId: "d", status: "missing" }),
        ],
      ],
    ]);
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Short" })],
      matches,
      context: { maxMissingRequired: 1 },
    });
    expect(ranked).toHaveLength(0);
  });

  it("serving scalability hard gate", () => {
    const ranked = run({
      recipes: [
        recipe({
          id: "r1",
          name: "Tiny",
          servingScaleFactor: 10,
          maxReasonableScaleFactor: 4,
        }),
      ],
    });
    expect(ranked).toHaveLength(0);
  });
});

describe("pantry and history signals", () => {
  it("scores pantry coverage", () => {
    const matches = new Map([
      [
        "r1",
        [
          match({ ingredientId: "a", status: "available" }),
          match({ ingredientId: "b", status: "available" }),
          match({ ingredientId: "c", status: "available" }),
          match({ ingredientId: "d", status: "missing" }),
        ],
      ],
    ]);
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Almost" })],
      matches,
    });
    expect(ranked[0]!.pantryCoverageRatio).toBeCloseTo(0.75);
    expect(ranked[0]!.reasons.some((r) => /available/i.test(r))).toBe(true);
  });

  it("applies use-soon bonus", () => {
    const matches = new Map([
      [
        "r1",
        [
          match({ ingredientId: "a", status: "use_soon" }),
          match({ ingredientId: "b", status: "available" }),
          match({ ingredientId: "c", status: "available" }),
          match({ ingredientId: "d", status: "available" }),
        ],
      ],
    ]);
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Spinach" })],
      matches,
      context: { mode: "use_food_soon" },
    });
    expect(ranked[0]!.useSoonCount).toBe(1);
    expect(ranked[0]!.reasons.some((r) => /use soon/i.test(r))).toBe(true);
  });

  it("applies missing ingredient penalty", () => {
    const matches = new Map([
      [
        "r1",
        [
          match({ ingredientId: "a", status: "available" }),
          match({ ingredientId: "b", status: "missing" }),
          match({ ingredientId: "c", status: "available" }),
          match({ ingredientId: "d", status: "available" }),
        ],
      ],
    ]);
    const ranked = run({ recipes: [recipe({ id: "r1", name: "Miss" })], matches });
    expect(ranked[0]!.missingRequired).toBe(1);
    expect(
      ranked[0]!.components.find((c) => c.key === "missing_required_count")!
        .contribution,
    ).toBeLessThan(0);
  });

  it("warns on unit mismatch", () => {
    const matches = new Map([
      [
        "r1",
        [
          match({ ingredientId: "a", status: "unit_mismatch" }),
          match({ ingredientId: "b", status: "available" }),
          match({ ingredientId: "c", status: "available" }),
          match({ ingredientId: "d", status: "available" }),
        ],
      ],
    ]);
    const ranked = run({ recipes: [recipe({ id: "r1", name: "Units" })], matches });
    expect(ranked[0]!.warnings.some((w) => /unit mismatch/i.test(w))).toBe(
      true,
    );
  });

  it("applies recently prepared penalty", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Recent" })],
      history: new Map([
        [
          "r1",
          {
            timesPrepared: 3,
            lastPreparedAt: "2026-07-15T12:00:00Z",
            recentCategoryCount: 1,
          },
        ],
      ]),
    });
    expect(
      ranked[0]!.components.find((c) => c.key === "recently_prepared_penalty")!
        .contribution,
    ).toBeLessThan(0);
  });

  it("applies category repetition penalty in something_different mode", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Pasta Night" })],
      history: new Map([
        [
          "r1",
          {
            timesPrepared: 2,
            lastPreparedAt: "2026-06-01T12:00:00Z",
            recentCategoryCount: 4,
          },
        ],
      ]),
      context: { mode: "something_different" },
    });
    expect(
      ranked[0]!.components.find((c) => c.key === "category_repetition_penalty")!
        .contribution,
    ).toBeLessThan(0);
  });

  it("keeps newly imported recipes neutral", () => {
    const ranked = run({
      recipes: [
        recipe({ id: "r1", name: "Imported", isNewlyImported: true }),
      ],
      history: new Map([
        [
          "r1",
          {
            timesPrepared: 0,
            lastPreparedAt: null,
            recentCategoryCount: 0,
          },
        ],
      ]),
    });
    expect(
      ranked[0]!.components.find((c) => c.key === "novelty_bonus")!.contribution,
    ).toBe(0);
    expect(
      ranked[0]!.components.find((c) => c.key === "strong_dislike_penalty")!
        .contribution,
    ).toBe(0);
  });
});

describe("ranking modes", () => {
  it("meal-prep mode boosts meal_prep_fit", () => {
    const prep = recipe({
      id: "r1",
      name: "Batch Chili",
      mealPrepSuitable: true,
    });
    const other = recipe({
      id: "r2",
      name: "Delicate Souffle",
      mealPrepSuitable: false,
      totalMinutes: 30,
    });
    const ranked = run({
      recipes: [prep, other],
      context: { mode: "meal_prep_friendly", mealType: "meal_prep" },
    });
    expect(ranked[0]!.recipeId).toBe("r1");
  });

  it("guest-friendly mode prioritizes scalable recipes", () => {
    const guest = recipe({
      id: "r1",
      name: "Party Pasta",
      guestScalable: true,
    });
    const personal = recipe({
      id: "r2",
      name: "Solo Toast",
      guestScalable: false,
      totalMinutes: 10,
    });
    const ranked = run({
      recipes: [guest, personal],
      context: { mode: "guest_friendly", mealType: "guest_inclusive" },
      history: new Map([
        [
          "r1",
          {
            timesPrepared: 1,
            lastPreparedAt: "2026-01-01T00:00:00Z",
            recentCategoryCount: 0,
            successfulForGuests: true,
          },
        ],
      ]),
    });
    expect(ranked[0]!.recipeId).toBe("r1");
  });

  it("something-different mode ranks recent recipe lower", () => {
    const recent = recipe({ id: "r1", name: "Alpha Recent" });
    const fresh = recipe({ id: "r2", name: "Beta Fresh" });
    const ranked = run({
      recipes: [recent, fresh],
      history: new Map([
        [
          "r1",
          {
            timesPrepared: 5,
            lastPreparedAt: "2026-07-16T12:00:00Z",
            recentCategoryCount: 3,
          },
        ],
        [
          "r2",
          {
            timesPrepared: 0,
            lastPreparedAt: null,
            recentCategoryCount: 0,
          },
        ],
      ]),
      context: { mode: "something_different" },
    });
    expect(ranked[0]!.recipeId).toBe("r2");
  });
});

describe("explanations and privacy", () => {
  it("explanations correspond to score components", () => {
    const matches = new Map([
      [
        "r1",
        [
          match({ ingredientId: "a", status: "use_soon" }),
          match({ ingredientId: "b", status: "available" }),
          match({ ingredientId: "c", status: "available" }),
          match({ ingredientId: "d", status: "missing" }),
        ],
      ],
    ]);
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Explain" })],
      matches,
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "m1",
              isAttending: true,
              signal: "would_make_again",
            },
            {
              membershipId: "m2",
              isAttending: true,
              signal: "would_make_again",
            },
          ],
        ],
      ]),
    });
    const keys = new Set(ranked[0]!.components.map((c) => c.key));
    expect(keys.has("use_soon_utilization")).toBe(true);
    expect(keys.has("attendee_preference")).toBe(true);
    expect(ranked[0]!.reasons.length).toBeGreaterThan(0);
    for (const reason of ranked[0]!.reasons) {
      expect(reason).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
      );
    }
  });

  it("private preference projection hides identity", () => {
    const agg = aggregatePreferences(
      [
        {
          membershipId: "11111111-1111-1111-1111-111111111111",
          isAttending: true,
          signal: "would_not_choose_again",
          displayName: "Andrew",
          shareIdentityWithOrganizer: false,
        },
      ],
      "attendees",
    );
    const proj = projectPrivatePreferenceExplanations(agg, false);
    expect(proj.warnings.join(" ")).toMatch(/One attending member/i);
    expect(proj.warnings.join(" ")).not.toMatch(/Andrew/);
    expect(proj.reasons.join(" ")).not.toMatch(/11111111/);
  });

  it("does not leak preference identity in score output", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Private" })],
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
              isAttending: true,
              signal: "would_not_choose_again",
              displayName: "Secret Member",
            },
          ],
        ],
      ]),
    });
    const blob = JSON.stringify(ranked[0]);
    expect(blob).not.toMatch(/Secret Member/);
    expect(blob).not.toMatch(/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/);
  });
});

describe("inference guardrails", () => {
  it("does not infer preference from attendance", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Attended" })],
      prefs: new Map([
        [
          "r1",
          [
            {
              membershipId: "m1",
              isAttending: true,
              signal: "have_not_tried",
            },
          ],
        ],
      ]),
      history: new Map([
        [
          "r1",
          {
            timesPrepared: 5,
            lastPreparedAt: "2026-01-01T00:00:00Z",
            recentCategoryCount: 0,
            feedbackSubmittedCount: 0,
          },
        ],
      ]),
    });
    expect(ranked[0]!.preferenceFit).toBe("unknown");
  });

  it("does not infer dislike from leftovers or cancellation", () => {
    const ranked = run({
      recipes: [recipe({ id: "r1", name: "Leftovers" })],
      history: new Map([
        [
          "r1",
          {
            timesPrepared: 2,
            lastPreparedAt: "2026-01-01T00:00:00Z",
            recentCategoryCount: 0,
            leftoverOutcomeApproximate: true,
            preparationCancelled: true,
          },
        ],
      ]),
    });
    expect(
      ranked[0]!.components.find((c) => c.key === "strong_dislike_penalty")!
        .contribution,
    ).toBe(0);
  });
});

describe("determinism", () => {
  it("stable tie-breaking by name then id", () => {
    const a = recipe({ id: "b", name: "Same Score" });
    const b = recipe({ id: "a", name: "Same Score" });
    const ranked = run({ recipes: [a, b] });
    expect(ranked.map((r) => r.recipeId)).toEqual(["a", "b"]);
  });

  it("scoring version stability across identical inputs", () => {
    const input = {
      recipes: [recipe({ id: "r1", name: "Stable" })],
    };
    const first = run(input);
    const second = run(input);
    expect(first[0]!.totalScore).toBe(second[0]!.totalScore);
    expect(first[0]!.components).toEqual(second[0]!.components);
  });

  it("recalculation triggers are material and do not auto-replace", async () => {
    const {
      shouldRecalculateRecommendations,
      acceptedPlanRecalcNotice,
    } = await import("@/lib/meals");
    expect(shouldRecalculateRecommendations("attendance")).toBe(true);
    expect(shouldRecalculateRecommendations("recipe_feedback")).toBe(true);
    const notice = acceptedPlanRecalcNotice();
    expect(notice.shouldReplaceRecipe).toBe(false);
    expect(notice.message).toMatch(/Recommendation inputs changed/i);
  });

  it("evaluateHardExclusion matches score exclusion", () => {
    const r = recipe({
      id: "r1",
      name: "X",
      dietaryConflictHits: 1,
    });
    const reason = evaluateHardExclusion(
      r,
      {
        missingRequired: 0,
        missingOptional: 0,
        useSoonCount: 0,
        unitMismatchCount: 0,
        availableish: 4,
        approximateCount: 0,
      },
      baseContext(),
    );
    expect(reason).toBeTruthy();
  });
});

describe("serving scalability soft score", () => {
  it("reduces score when scaling is high but under hard max", () => {
    const easy = run({
      recipes: [recipe({ id: "r1", name: "Easy Scale", servingScaleFactor: 1 })],
    });
    const hard = run({
      recipes: [
        recipe({
          id: "r2",
          name: "Hard Scale",
          servingScaleFactor: 3,
          maxReasonableScaleFactor: 4,
        }),
      ],
    });
    expect(
      easy[0]!.components.find((c) => c.key === "serving_scalability")!
        .contribution,
    ).toBeGreaterThan(
      hard[0]!.components.find((c) => c.key === "serving_scalability")!
        .contribution,
    );
  });
});
