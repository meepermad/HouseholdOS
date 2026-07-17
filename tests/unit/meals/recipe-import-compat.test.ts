import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildShoppingPrepLines,
  calculateShortfalls,
  matchIngredient,
  mayMutateShoppingFromRequest,
  scaleIngredients,
  type AuthorizedPantryItem,
  type IngredientMatchInput,
} from "@/lib/meals";
import {
  candidateToReviewPayload,
  runRecipeImportPipeline,
} from "@/lib/meals/import";

const fixturesDir = path.join(process.cwd(), "tests/fixtures/recipes");

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("recipe import → meals compatibility", () => {
  it("candidateToReviewPayload scales and matches pantry without crawler side effects", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const html = loadFixture("json-ld-lemon-pasta.html");
    const pipeline = runRecipeImportPipeline({
      html,
      sourceUrl: "https://fixtures.example/recipes/lemon-pasta",
    });

    expect(pipeline.primary).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    const payload = candidateToReviewPayload(pipeline.primary!);
    expect(payload.name).toBe("Fixture Lemon Pasta");
    expect(payload.baseServings).toBe(4);
    expect(payload.ingredients.length).toBeGreaterThan(0);
    expect(payload.steps.length).toBe(4);

    const scalable = payload.ingredients
      .filter((ing) => ing.quantity != null && ing.quantity_mode === "exact")
      .map((ing, index) => ({
        id: `ing-${index}`,
        displayName: ing.display_name,
        quantity: ing.quantity,
        unit: ing.quantity_unit as IngredientMatchInput["unit"],
        quantityMode: ing.quantity_mode as IngredientMatchInput["quantityMode"],
        required: ing.required,
      }));

    const scaled = scaleIngredients(scalable, payload.baseServings, 8);
    expect(scaled.ok).toBe(true);
    if (scaled.ok) {
      expect(scaled.factor).toBe("2");
      const flour = scaled.ingredients.find((i) =>
        i.displayName.toLowerCase().includes("flour"),
      );
      expect(flour?.scaledQuantity).toBe("3");
      expect(flour?.scaledNumerically).toBe(true);
    }

    const pantry: AuthorizedPantryItem[] = [
      {
        id: "p-butter",
        name: "butter",
        quantity: "4",
        unit: "tablespoon",
        quantityIsApproximate: false,
        state: "available",
        communalAvailable: true,
        ownershipMode: "household",
        usableByViewer: true,
      },
    ];

    const butterIng = payload.ingredients.find((i) =>
      i.display_name.toLowerCase().includes("butter"),
    );
    expect(butterIng).toBeTruthy();

    const matchInput: IngredientMatchInput = {
      id: "butter-1",
      displayName: butterIng!.display_name,
      quantity: butterIng!.quantity,
      unit: (butterIng!.quantity_unit ?? "tablespoon") as IngredientMatchInput["unit"],
      quantityMode: butterIng!.quantity_mode as IngredientMatchInput["quantityMode"],
      required: butterIng!.required,
    };
    const match = matchIngredient(matchInput, pantry);
    expect(match.status).toBe("available");

    const shortfalls = calculateShortfalls(
      [
        {
          id: matchInput.id,
          displayName: matchInput.displayName,
          scaledQuantity: matchInput.quantity,
          unit: matchInput.unit,
          quantityMode: matchInput.quantityMode,
          required: matchInput.required,
        },
      ],
      [match],
    );
    const lines = buildShoppingPrepLines(shortfalls, []);
    expect(lines[0]!.action.kind).toBe("none");
    expect(lines[0]!.lineStatus).toBe("available");

    // Import alone never reaches a shopping-mutating fulfillment phase.
    expect(mayMutateShoppingFromRequest("ranked")).toBe(false);
    expect(mayMutateShoppingFromRequest("recipe_accepted")).toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("pipeline remains pure across multi-candidate fixture", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const html = loadFixture("json-ld-graph-multi.html");
    const pipeline = runRecipeImportPipeline({
      html,
      sourceUrl: "https://fixtures.example/recipes/multi",
    });
    const payloads = pipeline.candidates.map(candidateToReviewPayload);
    expect(payloads).toHaveLength(2);
    expect(payloads.map((p) => p.name)).toEqual(
      expect.arrayContaining(["Fixture Soup", "Fixture Salad"]),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
