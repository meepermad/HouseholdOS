import type { ShoppingCandidate } from "./types";
import { compareCandidates } from "./candidates";

/**
 * Consolidate candidates that share a canonical key and compatible units.
 * Preserves every source reason. Does not merge personal into shared.
 */
export function consolidateCandidates(
  candidates: readonly ShoppingCandidate[],
): ShoppingCandidate[] {
  const buckets = new Map<string, ShoppingCandidate[]>();
  for (const c of candidates) {
    const key = `${c.visibility}:${c.ownerMembershipId ?? ""}:${c.normalizedKey}`;
    const list = buckets.get(key) ?? [];
    list.push(c);
    buckets.set(key, list);
  }

  const out: ShoppingCandidate[] = [];
  for (const group of buckets.values()) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    const units = new Set(
      group.map((g) => g.suggestedUnit).filter((u) => u && u !== "unknown"),
    );
    const unitMismatch = units.size > 1;
    const primary = [...group].sort(compareCandidates)[0]!;
    const sources = group.flatMap((g) => g.sources);
    const reasonCodes = [...new Set(group.flatMap((g) => g.reasonCodes))];
    const modeTags = [...new Set(group.flatMap((g) => g.modeTags))];
    const breakdown = group.flatMap((g) =>
      g.quantityBreakdown.length
        ? g.quantityBreakdown
        : [
            {
              label: g.explanation,
              quantity: g.suggestedQuantity,
              unit: g.suggestedUnit,
            },
          ],
    );

    let suggestedQuantity = primary.suggestedQuantity;
    if (!unitMismatch) {
      const qty = group
        .map((g) => g.suggestedQuantity)
        .filter((q): q is number => q != null && Number.isFinite(q));
      if (qty.length > 0) {
        suggestedQuantity = qty.reduce((a, b) => a + b, 0);
      }
    }

    out.push({
      ...primary,
      suggestedQuantity: unitMismatch ? primary.suggestedQuantity : suggestedQuantity,
      unitMismatch: unitMismatch || primary.unitMismatch,
      explanation: group.map((g) => g.explanation).join(" "),
      reasonCodes,
      sources,
      modeTags,
      quantityBreakdown: breakdown,
      relatedSupplyId:
        group.find((g) => g.relatedSupplyId)?.relatedSupplyId ?? null,
      relatedPantryId:
        group.find((g) => g.relatedPantryId)?.relatedPantryId ?? null,
      existingListItemId:
        group.find((g) => g.existingListItemId)?.existingListItemId ?? null,
      confidence: group.some((g) => g.confidence === "low")
        ? "low"
        : group.every((g) => g.confidence === "high")
          ? "high"
          : "medium",
    });
  }

  return out.sort(compareCandidates);
}

/** Drop candidates already fully covered by an open list item unless more qty needed. */
export function excludeAlreadyOnList(
  candidates: readonly ShoppingCandidate[],
  openListKeys: ReadonlySet<string>,
): ShoppingCandidate[] {
  return candidates.filter((c) => {
    if (!c.existingListItemId && openListKeys.has(c.normalizedKey)) {
      // Already on list with no additional-quantity signal
      return c.quantityBreakdown.length > 1;
    }
    if (c.existingListItemId && openListKeys.has(c.normalizedKey)) {
      return false;
    }
    return true;
  });
}
