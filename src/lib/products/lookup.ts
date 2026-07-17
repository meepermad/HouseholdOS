/**
 * Product lookup adapter boundary — no continuous video upload.
 */

export type ProductLookupResult = {
  barcode: string;
  name: string | null;
  brand: string | null;
  source: "provider" | "household_cache" | "fixture" | "manual";
  requiresReview: boolean;
};

export interface ProductLookupAdapter {
  lookup(barcode: string): Promise<ProductLookupResult | null>;
}

export class FixtureProductLookupAdapter implements ProductLookupAdapter {
  async lookup(barcode: string): Promise<ProductLookupResult | null> {
    const cleaned = barcode.trim();
    if (!cleaned) return null;
    return {
      barcode: cleaned,
      name: `Fixture product ${cleaned.slice(-4)}`,
      brand: "Fixture Brand",
      source: "fixture",
      requiresReview: true,
    };
  }
}

export class ManualProductLookupAdapter implements ProductLookupAdapter {
  async lookup(barcode: string): Promise<ProductLookupResult | null> {
    const cleaned = barcode.trim();
    if (!cleaned) return null;
    return {
      barcode: cleaned,
      name: null,
      brand: null,
      source: "manual",
      requiresReview: true,
    };
  }
}

export function getProductLookupAdapter(): ProductLookupAdapter {
  const mode = process.env.PRODUCT_LOOKUP_ADAPTER ?? "fixture";
  if (mode === "manual") return new ManualProductLookupAdapter();
  return new FixtureProductLookupAdapter();
}

export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 14);
}
