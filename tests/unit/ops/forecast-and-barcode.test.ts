import { describe, expect, it } from "vitest";
import { forecastSupplyRestock } from "@/lib/ops/supply-forecast";
import { normalizeBarcode } from "@/lib/products/lookup";

describe("supply forecast", () => {
  it("flags items at or below threshold", () => {
    const result = forecastSupplyRestock([
      { id: "1", name: "Soap", quantity: 1, reorderThreshold: 2 },
      { id: "2", name: "Bags", quantity: 5, reorderThreshold: 2 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Soap");
  });
});

describe("barcode normalize", () => {
  it("keeps digits only", () => {
    expect(normalizeBarcode("12-345-67890")).toBe("1234567890");
  });
});
