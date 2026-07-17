"use client";

import { RANKING_MODES, type RankingMode } from "@/lib/meals/types";

const MODE_LABELS: Record<RankingMode, string> = {
  best_overall: "Best overall",
  use_what_we_have: "Use what we have",
  use_food_soon: "Use food soon",
  household_favorite: "Household favorite",
  fastest: "Fastest",
  fewest_missing_items: "Fewest missing items",
  meal_prep_friendly: "Meal-prep friendly",
  guest_friendly: "Guest friendly",
  something_different: "Something different",
};

export function RecommendationModeSelector({
  name = "rankingMode",
  defaultValue = "best_overall",
  id = "rankingMode",
}: {
  name?: string;
  defaultValue?: RankingMode;
  id?: string;
}) {
  return (
    <label className="block space-y-1" htmlFor={id}>
      <span className="text-sm font-medium">Ranking mode</span>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
      >
        {RANKING_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {MODE_LABELS[mode]}
          </option>
        ))}
      </select>
    </label>
  );
}
