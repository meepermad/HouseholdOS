import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimplifySuggestionList } from "@/components/payments/SimplifySuggestionList";
import type { RoutedSettlementSuggestion } from "@/lib/payments/routed-suggestions";

describe("SimplifySuggestionList", () => {
  it("explains routed payment and external money movement", () => {
    const suggestions: RoutedSettlementSuggestion[] = [
      {
        payerMembershipId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        intermediaryMembershipId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        recipientMembershipId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        obligationAbId: "11111111-1111-1111-1111-111111111111",
        obligationBcId: "22222222-2222-2222-2222-222222222222",
        amountCents: 2500,
        currency: "USD",
        beforeEdges: { ab: 4000, bc: 2500 },
        afterEdges: { ab: 1500, bc: 0 },
      },
    ];
    render(
      <SimplifySuggestionList
        householdId="hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh"
        suggestions={suggestions}
        memberLabel={(id) => id.slice(0, 1).toUpperCase()}
      />,
    );
    expect(screen.getAllByText(/Suggested routed payment/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Before balances change/i)).toBeInTheDocument();
    expect(screen.getAllByText(/outside HouseholdOS/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("propose-routed-payment")).toBeTruthy();
  });
});
