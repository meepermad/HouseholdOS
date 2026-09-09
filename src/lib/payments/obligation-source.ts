export type ObligationPurchaseSource = {
  expenseId: string | null;
  receiptId: string | null;
  merchant: string;
  purchaseDate: string | null;
  kind: string;
};

export function formatObligationPurchaseDate(
  date: string | null | undefined,
): string | null {
  const value = String(date ?? "").trim();
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function obligationPurchaseLabel(source: ObligationPurchaseSource): string {
  if (source.kind === "opening_balance") return "Starting balance";
  const merchant = source.merchant.trim() || "Shared purchase";
  const date = formatObligationPurchaseDate(source.purchaseDate);
  const prefix = source.kind === "refund" ? `Refund from ${merchant}` : merchant;
  return date ? `${prefix} · ${date}` : prefix;
}

export type PurchaseSourceMap = Map<
  string,
  { merchant: string; purchaseDate: string | null; receiptId: string | null }
>;

export function sourceFromMaps(
  expenseId: string | null,
  kind: string,
  sources: PurchaseSourceMap,
): ObligationPurchaseSource {
  const found = expenseId ? sources.get(expenseId) : undefined;
  return {
    expenseId,
    receiptId: found?.receiptId ?? null,
    merchant: found?.merchant ?? "Shared purchase",
    purchaseDate: found?.purchaseDate ?? null,
    kind,
  };
}
