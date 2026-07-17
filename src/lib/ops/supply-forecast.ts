/** Approximate restock suggestions — not predictive ML. */

export type SupplyForecastInput = {
  id: string;
  name: string;
  quantity: number | null;
  reorderThreshold: number | null;
};

export type SupplyForecastItem = SupplyForecastInput & {
  needsRestock: boolean;
};

export function forecastSupplyRestock(
  items: readonly SupplyForecastInput[],
): SupplyForecastItem[] {
  return items
    .map((item) => {
      const qty = item.quantity;
      const threshold = item.reorderThreshold;
      const needsRestock =
        threshold != null && qty != null && Number.isFinite(qty) && qty <= threshold;
      return { ...item, needsRestock };
    })
    .filter((i) => i.needsRestock);
}
