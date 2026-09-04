import { describe, expect, it } from "vitest";
import {
  classifyHouseholdPageError,
  householdReceiptsPathFromLocation,
} from "@/lib/recovery/household-page-error";

const H1 = "11111111-1111-4111-8111-111111111111";

describe("classifyHouseholdPageError", () => {
  it("treats redirect digests as a session expiry, not a crashed page", () => {
    const error = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login?next=/app",
    });
    const copy = classifyHouseholdPageError(error);
    expect(copy.kind).toBe("session");
    expect(copy.title).toMatch(/session expired/i);
    expect(copy.title).not.toMatch(/page failed after login/i);
  });

  it("explains HEIC / receipt failures without login-crash copy", () => {
    const copy = classifyHouseholdPageError(
      new Error("This iPhone photo format (HEIC) could not be converted here."),
    );
    expect(copy.kind).toBe("receipt");
    expect(copy.title).toMatch(/receipt/i);
    expect(copy.body).toMatch(/JPEG|PNG|manually/i);
  });

  it("no longer uses Page failed after login for unknown errors", () => {
    const copy = classifyHouseholdPageError(new Error("boom"));
    expect(copy.title).not.toMatch(/page failed after login/i);
  });
});

describe("householdReceiptsPathFromLocation", () => {
  it("extracts the household from a receipts route", () => {
    expect(
      householdReceiptsPathFromLocation(`/app/${H1}/money/receipts/new`),
    ).toEqual({ householdId: H1 });
    expect(householdReceiptsPathFromLocation(`/app/${H1}/money`)).toBeNull();
  });
});
