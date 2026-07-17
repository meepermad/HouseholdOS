import { describe, expect, it } from "vitest";
import {
  neutralizeSpreadsheetInjection,
  parseCsv,
  rowsToCsv,
} from "@/lib/import/csv";
import { autoMapColumns, applyColumnMapping } from "@/lib/import/map-columns";
import { validateImportRows } from "@/lib/import/validate";

describe("csv import helpers", () => {
  it("parses csv and maps columns", () => {
    const { headers, rows } = parseCsv("Name,Notes\nMilk,Fresh\n");
    expect(headers).toEqual(["Name", "Notes"]);
    expect(rows[0]).toEqual(["Milk", "Fresh"]);
    const mapping = autoMapColumns("pantry", headers);
    expect(mapping.name).toBe(0);
    expect(applyColumnMapping(rows[0]!, mapping).name).toBe("Milk");
  });

  it("neutralizes spreadsheet injection", () => {
    expect(neutralizeSpreadsheetInjection("=cmd()")).toBe("'=cmd()");
    expect(neutralizeSpreadsheetInjection("ok")).toBe("ok");
  });

  it("validates required fields", () => {
    const mapping = autoMapColumns("inventory", ["Name"]);
    const result = validateImportRows("inventory", [[""], ["Chair"]], mapping);
    expect(result[0]?.status).toBe("error");
    expect(result[1]?.status).toBe("valid");
  });

  it("re-exports with neutralization", () => {
    const csv = rowsToCsv(["name"], [["=1+1"], ["safe"]]);
    expect(csv).toContain("'=1+1");
  });
});
