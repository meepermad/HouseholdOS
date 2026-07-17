import { createHash } from "node:crypto";
import { normalizeForMatch } from "../normalize";
import type {
  DuplicateDetectionResult,
  DuplicateMatch,
  ExistingRecipeDuplicateProbe,
  ExtractedRecipeCandidate,
  ParsedIngredient,
} from "./types";

/** Tracking / session query params stripped from canonical URLs. */
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "mkt_tok",
  "vero_id",
  "yclid",
  "_ga",
  "_gl",
  "_hsenc",
  "_hsmi",
  "ref",
  "ref_src",
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_reader",
  "utm_name",
  "utm_social",
  "utm_social-type",
  "spm",
  "scm",
  "si",
  "feature",
  "share",
]);

/**
 * Normalize a URL for duplicate detection / storage:
 * strip fragment, drop tracking params, sort remaining query keys.
 */
export function normalizeCanonicalUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return url.trim();
    }
    u.hash = "";
    const kept: Array<[string, string]> = [];
    u.searchParams.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower)) return;
      if (lower.startsWith("utm_")) return;
      kept.push([key, value]);
    });
    kept.sort((a, b) => {
      const c = a[0].localeCompare(b[0]);
      return c !== 0 ? c : a[1].localeCompare(b[1]);
    });
    u.search = "";
    for (const [k, v] of kept) {
      u.searchParams.append(k, v);
    }
    // Stable host casing; keep path as-is except trailing slash collapse for root
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }
    return u.toString();
  } catch {
    return url.trim();
  }
}

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Stable SHA-256 over normalized cooking content (not raw HTML).
 */
export function computeContentHash(
  candidate: Pick<
    ExtractedRecipeCandidate,
    "name" | "ingredients" | "steps" | "yieldText" | "prepMinutes" | "cookMinutes"
  >,
): string {
  const payload = {
    name: normalizeName(candidate.name),
    ingredients: candidate.ingredients.map((i) => ({
      t: i.originalText.trim().toLowerCase(),
      n: normalizeForMatch(i.displayName),
      q: i.quantity,
      u: i.unit,
    })),
    steps: candidate.steps.map((s) =>
      s.instruction.trim().toLowerCase().replace(/\s+/g, " "),
    ),
    yield: (candidate.yieldText ?? "").trim().toLowerCase(),
    prep: candidate.prepMinutes,
    cook: candidate.cookMinutes,
  };
  return createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}

/**
 * Exact source URL / content hash, then similar name + ingredient Jaccard.
 */
export function detectDuplicates(
  candidate: {
    canonicalUrl?: string | null;
    contentHash?: string | null;
    name?: string | null;
    ingredients?: readonly ParsedIngredient[];
  },
  existing: readonly ExistingRecipeDuplicateProbe[],
  options?: { jaccardThreshold?: number },
): DuplicateDetectionResult {
  const threshold = options?.jaccardThreshold ?? 0.72;
  const matches: DuplicateMatch[] = [];
  const canonical = candidate.canonicalUrl
    ? normalizeCanonicalUrl(candidate.canonicalUrl)
    : null;
  const hash = candidate.contentHash ?? null;
  const candNames = ingredientNameSet(candidate.ingredients ?? []);
  const candName = normalizeName(candidate.name);

  for (const recipe of existing) {
    if (
      canonical &&
      recipe.sourceCanonicalUrl &&
      normalizeCanonicalUrl(recipe.sourceCanonicalUrl) === canonical
    ) {
      matches.push({
        recipeId: recipe.id,
        kind: "exact_source",
        score: 1,
        reason: "Same canonical source URL",
      });
      continue;
    }
    if (hash && recipe.importedContentHash && hash === recipe.importedContentHash) {
      matches.push({
        recipeId: recipe.id,
        kind: "exact_hash",
        score: 1,
        reason: "Identical imported content hash",
      });
      continue;
    }

    const existingName = normalizeName(recipe.name);
    if (!candName || !existingName || candName !== existingName) continue;

    const existingNames = new Set(
      (recipe.ingredientNames ?? []).map((n) => normalizeForMatch(n)).filter(Boolean),
    );
    if (candNames.size === 0 || existingNames.size === 0) continue;

    const score = jaccard(candNames, existingNames);
    if (score >= threshold) {
      matches.push({
        recipeId: recipe.id,
        kind: "similar_content",
        score,
        reason: `Same name with ingredient Jaccard ${score.toFixed(2)}`,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return {
    matches,
    hasExact: matches.some(
      (m) => m.kind === "exact_source" || m.kind === "exact_hash",
    ),
  };
}

export function jaccardSimilarity(
  a: readonly string[],
  b: readonly string[],
): number {
  return jaccard(
    new Set(a.map((x) => normalizeForMatch(x)).filter(Boolean)),
    new Set(b.map((x) => normalizeForMatch(x)).filter(Boolean)),
  );
}

function ingredientNameSet(
  ingredients: readonly ParsedIngredient[],
): Set<string> {
  const set = new Set<string>();
  for (const i of ingredients) {
    if (i.isSectionHeading) continue;
    const n = normalizeForMatch(i.displayName);
    if (n) set.add(n);
  }
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function normalizeName(name: string | null | undefined): string {
  return normalizeForMatch(name ?? "");
}
