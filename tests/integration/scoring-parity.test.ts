import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  BASE_WEIGHTS,
  MODE_WEIGHT_MULTIPLIERS,
  resolveModeWeights,
} from "@/lib/meals/scoring/weights";
import type { RankingMode, ScoreComponentKey } from "@/lib/meals/scoring/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(url && key);

describe.skipIf(!hasSupabase)("scoring parity SQL ↔ TypeScript", () => {
  it("matches recommendation_weight_table to resolveModeWeights", async () => {
    const supabase = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("recommendation_weight_table");
    if (error) {
      // Migration may not be applied yet in some local environments.
      expect(error.message).toMatch(/could not find|does not exist|PGRST/i);
      return;
    }
    expect(Array.isArray(data)).toBe(true);
    for (const row of data as Array<{
      mode: RankingMode;
      component_key: ScoreComponentKey;
      weight: number;
    }>) {
      const expected = resolveModeWeights(row.mode)[row.component_key];
      expect(Number(row.weight)).toBeCloseTo(expected, 8);
    }
    // sanity: multipliers that were previously missing in SQL
    const prepTime = (data as Array<{ mode: string; component_key: string; weight: number }>).find(
      (r) => r.mode === "meal_prep_friendly" && r.component_key === "time_fit",
    );
    expect(Number(prepTime?.weight)).toBeCloseTo(
      BASE_WEIGHTS.time_fit *
        (MODE_WEIGHT_MULTIPLIERS.meal_prep_friendly.time_fit ?? 1),
      8,
    );
  });
});
