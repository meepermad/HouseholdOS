import { describe, expect, it } from "vitest";
import { itemTagToWrite } from "@/lib/expenses/apply-item-tag";

const payer = "payer-1";
const other = "other-1";

describe("itemTagToWrite", () => {
  it("tags everyone as a household split", () => {
    expect(
      itemTagToWrite({ allocationMode: "equal_all", payerMembershipId: payer }),
    ).toMatchObject({
      allocationMode: "equal_all",
      classification: "shared_household",
      participants: [],
    });
  });

  it("tags one roommate as personal", () => {
    expect(
      itemTagToWrite({
        allocationMode: "personal",
        personalMembershipId: other,
        payerMembershipId: payer,
      }),
    ).toMatchObject({
      allocationMode: "personal",
      personalMembershipId: other,
      classification: "personal_other",
      participants: [{ membershipId: other }],
    });
  });

  it("tags selected people as a shared split", () => {
    expect(
      itemTagToWrite({
        allocationMode: "equal_selected",
        membershipIds: [payer, other],
        payerMembershipId: payer,
      }),
    ).toMatchObject({
      allocationMode: "equal_selected",
      classification: "shared_selected",
      participants: [{ membershipId: payer }, { membershipId: other }],
    });
  });
});
