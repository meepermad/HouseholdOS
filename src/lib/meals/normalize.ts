/**
 * Practical ingredient name normalization for pantry matching.
 * Does not merge distinct cream variants (cream vs heavy cream vs sour cream).
 */

const IRREGULAR_PLURALS: Record<string, string> = {
  tomatoes: "tomato",
  potatoes: "potato",
  leaves: "leaf",
  loaves: "loaf",
  berries: "berry",
  cherries: "cherry",
  peppers: "pepper",
  onions: "onion",
  cloves: "clove",
  eggs: "egg",
  mushrooms: "mushroom",
  carrots: "carrot",
  beans: "bean",
};

/** Safe common aliases — never cream/heavy cream/sour cream/cream cheese. */
export const COMMON_INGREDIENT_ALIASES: ReadonlyArray<{
  canonical: string;
  aliases: readonly string[];
}> = [
  { canonical: "bell pepper", aliases: ["capsicum", "sweet pepper"] },
  { canonical: "green onion", aliases: ["scallion", "spring onion"] },
  { canonical: "chickpea", aliases: ["garbanzo bean", "garbanzo"] },
  { canonical: "cilantro", aliases: ["coriander leaf", "fresh coriander"] },
  { canonical: "zucchini", aliases: ["courgette"] },
  { canonical: "eggplant", aliases: ["aubergine"] },
  { canonical: "ground beef", aliases: ["minced beef", "beef mince"] },
  { canonical: "heavy cream", aliases: ["whipping cream", "double cream"] },
  { canonical: "confectioners sugar", aliases: ["powdered sugar", "icing sugar"] },
  { canonical: "all purpose flour", aliases: ["plain flour", "ap flour"] },
];

export function normalizeIngredientName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function singularizeToken(token: string): string {
  if (IRREGULAR_PLURALS[token]) return IRREGULAR_PLURALS[token];
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("oes") && token.length > 4) {
    return token.slice(0, -2);
  }
  if (
    token.endsWith("s") &&
    !token.endsWith("ss") &&
    !token.endsWith("us") &&
    !token.endsWith("is") &&
    token.length > 3
  ) {
    return token.slice(0, -1);
  }
  return token;
}

export function normalizeForMatch(raw: string): string {
  const base = normalizeIngredientName(raw);
  if (!base) return "";
  return base
    .split(" ")
    .map(singularizeToken)
    .join(" ")
    .trim();
}

export type AliasTable = ReadonlyMap<string, string>;

/** Build alias → canonical map from common + household aliases. */
export function buildAliasTable(
  extra: ReadonlyArray<{ canonical: string; aliases: readonly string[] }> = [],
): AliasTable {
  const map = new Map<string, string>();
  for (const entry of [...COMMON_INGREDIENT_ALIASES, ...extra]) {
    const canonical = normalizeForMatch(entry.canonical);
    if (!canonical) continue;
    map.set(canonical, canonical);
    for (const alias of entry.aliases) {
      const key = normalizeForMatch(alias);
      if (key) map.set(key, canonical);
    }
  }
  return map;
}

export function resolveCanonicalName(
  raw: string,
  aliases: AliasTable = buildAliasTable(),
): string {
  const key = normalizeForMatch(raw);
  if (!key) return "";
  return aliases.get(key) ?? key;
}

/**
 * Distinct cream family names must not collapse into each other.
 * Used by tests / matching safety checks.
 */
export function areDistinctCreamVariants(a: string, b: string): boolean {
  const left = normalizeForMatch(a);
  const right = normalizeForMatch(b);
  const creamFamily = new Set([
    "cream",
    "heavy cream",
    "sour cream",
    "cream cheese",
  ]);
  return (
    creamFamily.has(left) &&
    creamFamily.has(right) &&
    left !== right
  );
}

export function namesMatch(
  a: string,
  b: string,
  aliases: AliasTable = buildAliasTable(),
): boolean {
  const left = resolveCanonicalName(a, aliases);
  const right = resolveCanonicalName(b, aliases);
  if (!left || !right) return false;
  if (areDistinctCreamVariants(left, right)) return false;
  return left === right;
}
