/** Deterministic name normalization for shopping recommendation dedupe. */

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "or"]);

export function normalizeShoppingName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t))
    .join(" ")
    .trim();
}

/** Alias map for common household synonyms — exact key match only. */
const ALIASES: Record<string, string> = {
  dishwashingliquid: "dishsoap",
  dishwashingsoap: "dishsoap",
  dawn: "dishsoap",
  trashbags: "trashbags",
  garbagebags: "trashbags",
  binbags: "trashbags",
};

export function canonicalShoppingKey(name: string): string {
  const normalized = normalizeShoppingName(name).replace(/\s+/g, "");
  return ALIASES[normalized] ?? normalized;
}
