import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettleUpForm } from "@/components/payments/settle-up-form";

vi.mock("@/app/actions/payments", () => ({
  submitPaymentAction: vi.fn(async () => ({ ok: false, error: "blocked" })),
}));

const H = "hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh";
const SENDER = "ssssssss-ssss-ssss-ssss-ssssssssssss";
const RECIPIENT = "rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr";

describe("SettleUpForm", () => {
  it("supports recipient selection, obligation multi-select, and allocation preview", async () => {
    const user = userEvent.setup();
    render(
      <SettleUpForm
        householdId={H}
        senderMembershipId={SENDER}
        currency="USD"
        members={[
          { id: SENDER, label: "Andrew" },
          { id: RECIPIENT, label: "Michael" },
        ]}
        obligations={[
          {
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            householdId: H,
            debtorMembershipId: SENDER,
            creditorMembershipId: RECIPIENT,
            currency: "USD",
            effectiveAmountCents: 2000,
            officialOutstandingCents: 2000,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            householdId: H,
            debtorMembershipId: SENDER,
            creditorMembershipId: RECIPIENT,
            currency: "USD",
            effectiveAmountCents: 1000,
            officialOutstandingCents: 1000,
            createdAt: "2026-01-02T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("recipient-select")).toHaveValue(RECIPIENT);
    await user.click(
      screen.getByTestId("obligation-select-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
    );
    await user.click(
      screen.getByTestId("obligation-select-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
    );
    await user.clear(screen.getByTestId("payment-amount"));
    await user.type(screen.getByTestId("payment-amount"), "25.00");
    await user.click(screen.getByTestId("suggest-allocation"));

    expect(screen.getByTestId("allocation-preview")).toBeInTheDocument();
    expect(screen.getByTestId("payment-method")).toBeInTheDocument();
    expect(screen.getByTestId("acknowledge-external")).toBeInTheDocument();
  });
});
