import { describe, expect, it } from "vitest";
import {
  BASE_WEIGHTS,
  MODE_WEIGHT_MULTIPLIERS,
  resolveModeWeights,
  type ScoreWeights,
} from "@/lib/meals/scoring/weights";
import type { RankingMode, ScoreComponentKey } from "@/lib/meals/scoring/types";

const MODES = Object.keys(MODE_WEIGHT_MULTIPLIERS) as RankingMode[];
const KEYS = Object.keys(BASE_WEIGHTS) as ScoreComponentKey[];

/**
 * Authoritative TypeScript weights. SQL `_recommendation_weight` must match
 * these values for every supported mode × component (see recommendation_weight_table).
 */
describe("recipe scoring weight parity (TS authority)", () => {
  it("resolves mode multipliers for all supported modes and keys", () => {
    for (const mode of MODES) {
      const weights = resolveModeWeights(mode);
      for (const key of KEYS) {
        const mult = MODE_WEIGHT_MULTIPLIERS[mode][key] ?? 1;
        expect(weights[key]).toBeCloseTo(BASE_WEIGHTS[key] * mult, 10);
      }
    }
  });

  it("includes meal_prep_friendly.time_fit and guest_friendly.strong_dislike_penalty", () => {
    const prep = resolveModeWeights("meal_prep_friendly");
    const guest = resolveModeWeights("guest_friendly");
    expect(prep.time_fit).toBeCloseTo(BASE_WEIGHTS.time_fit * 0.8, 10);
    expect(guest.strong_dislike_penalty).toBeCloseTo(
      BASE_WEIGHTS.strong_dislike_penalty * 1.3,
      10,
    );
  });

  it("exposes a complete weight matrix for SQL comparison", () => {
    const matrix: Array<{ mode: string; key: string; weight: number }> = [];
    for (const mode of MODES) {
      const weights: ScoreWeights = resolveModeWeights(mode);
      for (const key of KEYS) {
        matrix.push({ mode, key, weight: weights[key] });
      }
    }
    expect(matrix).toHaveLength(MODES.length * KEYS.length);
    expect(matrix.every((row) => Number.isFinite(row.weight))).toBe(true);
  });
});
