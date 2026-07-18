import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoneyBalanceSummary } from "@/components/money/MoneyBalanceSummary";
import { MoneyPrimaryActions } from "@/components/money/MoneyPrimaryActions";
import { MoneyAttentionQueue } from "@/components/money/MoneyAttentionQueue";

describe("Money dashboard components", () => {
  it("renders balance summary with accessible net", () => {
    render(
      <MoneyBalanceSummary
        balance={{
          officialYouOweCents: 2410,
          officialYouAreOwedCents: 850,
          officialNetCents: -1560,
          pendingOutgoingCents: 0,
          pendingIncomingCents: 500,
          projectedYouOweCents: 2410,
          projectedYouAreOwedCents: 350,
        }}
      />,
    );
    expect(screen.getByTestId("money-balance-summary")).toBeInTheDocument();
    expect(screen.getByLabelText(/You owe \$24\.10/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending payments/i)).toBeInTheDocument();
  });

  it("renders at most two primary actions", () => {
    render(
      <MoneyPrimaryActions
        actions={[
          {
            key: "scan_receipt",
            label: "Scan receipt",
            href: "/r",
            testId: "money-primary-scan-receipt",
          },
          {
            key: "add_expense",
            label: "Add expense",
            href: "/e",
            testId: "money-primary-add-expense",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("money-primary-actions").querySelectorAll("a")).toHaveLength(
      2,
    );
  });

  it("renders attention queue with CTA", () => {
    render(
      <MoneyAttentionQueue
        items={[
          {
            id: "payment-confirm-1",
            urgency: 20,
            title: "Michael recorded a payment to you.",
            body: "Confirm that you received $24.10.",
            href: "/p/1",
            amountCents: 2410,
            memberLabel: "Michael",
            ctaLabel: "Review payment",
          },
        ]}
      />,
    );
    expect(screen.getByText("Review payment")).toBeInTheDocument();
  });
});
