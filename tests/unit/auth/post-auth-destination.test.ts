import { describe, expect, it } from "vitest";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";

const H1 = "11111111-1111-4111-8111-111111111111";
const H2 = "22222222-2222-4222-8222-222222222222";
const STALE = "33333333-3333-4333-8333-333333333333";

describe("resolvePostAuthDestination", () => {
  it("keeps a valid household deep link", () => {
    expect(
      resolvePostAuthDestination({
        requestedNext: `/app/${H1}/calendar/agenda`,
        authorizedHouseholdIds: [H1, H2],
        preferredHouseholdId: H2,
      }),
    ).toBe(`/app/${H1}/calendar/agenda`);
  });

  it("falls back from unauthorized household to preferred", () => {
    expect(
      resolvePostAuthDestination({
        requestedNext: `/app/${STALE}`,
        authorizedHouseholdIds: [H1, H2],
        preferredHouseholdId: H1,
      }),
    ).toBe(`/app/${H1}`);
  });

  it("uses onboarding when no preferred household", () => {
    expect(
      resolvePostAuthDestination({
        requestedNext: `/app/${STALE}`,
        authorizedHouseholdIds: [H1, H2],
        preferredHouseholdId: null,
      }),
    ).toBe("/onboarding");
  });

  it("resolves bare /app to preferred household", () => {
    expect(
      resolvePostAuthDestination({
        requestedNext: "/app",
        authorizedHouseholdIds: [H1],
        preferredHouseholdId: H1,
      }),
    ).toBe(`/app/${H1}`);
  });

  it("rejects external next values via safeRedirectPath", () => {
    expect(
      resolvePostAuthDestination({
        requestedNext: "https://evil.example",
        authorizedHouseholdIds: [H1],
        preferredHouseholdId: H1,
      }),
    ).toBe(`/app/${H1}`);
  });

  it("sends users with no households to onboarding", () => {
    expect(
      resolvePostAuthDestination({
        requestedNext: "/app",
        authorizedHouseholdIds: [],
        preferredHouseholdId: null,
      }),
    ).toBe("/onboarding");
  });
});
