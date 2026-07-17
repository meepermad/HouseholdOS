import { normalizeAliasKey } from "./normalize";
import type { ReceiptAlias, ReceiptAliasKind } from "./types";

export function findAlias(
  aliases: ReceiptAlias[],
  kind: ReceiptAliasKind,
  sourceText: string,
  merchantScope?: string | null,
): ReceiptAlias | null {
  const key = normalizeAliasKey(sourceText);
  return (
    aliases.find((a) => {
      if (a.kind !== kind) return false;
      if (normalizeAliasKey(a.sourceText) !== key) return false;
      if (merchantScope && a.merchantScope) {
        return normalizeAliasKey(a.merchantScope) === normalizeAliasKey(merchantScope);
      }
      return true;
    }) ?? null
  );
}

export function applyAliasCorrection(
  aliases: ReceiptAlias[],
  kind: ReceiptAliasKind,
  sourceText: string,
  merchantScope?: string | null,
): string {
  return findAlias(aliases, kind, sourceText, merchantScope)?.targetText ?? sourceText;
}

export function shouldSuggestMerchantPattern(
  reviewedExamples: number,
  minExamples = 3,
): boolean {
  return reviewedExamples >= minExamples;
}
