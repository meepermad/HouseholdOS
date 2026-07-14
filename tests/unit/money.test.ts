import { describe, expect, it } from "vitest";
import {
  addCents,
  formatUsdFromCents,
  parseUsdToCents,
  splitCentsEvenly,
  subtractCents,
  sumCents,
  toCents,
} from "@/lib/money";

describe("money cents helpers", () => {
  it("rejects non-integer cents", () => {
    expect(() => toCents(10.5)).toThrow(/integer/);
  });

  it("adds and subtracts without floats", () => {
    expect(addCents(toCents(199), toCents(1))).toBe(200);
    expect(subtractCents(toCents(200), toCents(50))).toBe(150);
  });

  it("splits evenly and preserves total", () => {
    const parts = splitCentsEvenly(toCents(100), 3);
    expect(parts).toEqual([34, 33, 33]);
    expect(sumCents(parts)).toBe(100);
  });

  it("formats and parses USD", () => {
    expect(formatUsdFromCents(toCents(12345))).toBe("$123.45");
    expect(parseUsdToCents("$12.34")).toBe(1234);
    expect(parseUsdToCents("-0.99")).toBe(-99);
  });

  it("rejects invalid USD strings", () => {
    expect(() => parseUsdToCents("12.345")).toThrow(/Invalid/);
  });
});
