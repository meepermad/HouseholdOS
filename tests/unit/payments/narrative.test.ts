import { describe, expect, it } from "vitest";
import { describePaymentRecord } from "@/lib/payments/narrative";

const ANDREW = "andrew-id";
const ATEM = "atem-id";

describe("payment narrative", () => {
  it("describes a payer report without calling it received", () => {
    expect(
      describePaymentRecord({
        status: "submitted",
        amountCents: 2500,
        senderName: "Andrew",
        recipientName: "Atem",
        senderMembershipId: ANDREW,
        recipientMembershipId: ATEM,
        createdByMembershipId: ANDREW,
      }),
    ).toBe("Andrew reported sending $25.00.");
  });

  it("describes a recipient receipt as a single event", () => {
    expect(
      describePaymentRecord({
        status: "confirmed",
        amountCents: 5000,
        senderName: "Andrew",
        recipientName: "Atem",
        senderMembershipId: ANDREW,
        recipientMembershipId: ATEM,
        createdByMembershipId: ATEM,
      }),
    ).toBe("Atem recorded receiving $50.00 from Andrew.");
  });

  it("describes an acknowledgment of a payer report separately", () => {
    expect(
      describePaymentRecord({
        status: "confirmed",
        amountCents: 2500,
        senderName: "Andrew",
        recipientName: "Atem",
        senderMembershipId: ANDREW,
        recipientMembershipId: ATEM,
        createdByMembershipId: ANDREW,
      }),
    ).toBe("Atem acknowledged receiving $25.00.");
  });
});
