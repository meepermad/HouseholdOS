import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReceiptPasteFlow } from "@/components/receipts/ReceiptPasteFlow";
import { MoneyCreateSheet } from "@/components/money/MoneyCreateSheet";
import { buildMoneyCreateActions } from "@/lib/money/create-actions";

vi.mock("@/app/actions/receipts", () => ({
  registerPastedReceiptAction: vi.fn(async () => ({
    ok: true,
    data: { redirectTo: "/app/hh1/money/receipts/r1", receiptId: "r1" },
  })),
}));

const CANONICAL = `HOUSEHOLDOS RECEIPT
Merchant: Target
Date: 2026-09-04
Total: 42.17
ITEMS
Milk | 4.29 | 1
Paper towels | 12.99 | 1
END`;

describe("Paste receipt launch and read", () => {
  it("opens paste receipt from the Add expense sheet", async () => {
    const user = userEvent.setup();
    const create = buildMoneyCreateActions({
      householdId: "hh1",
      activeMemberCount: 2,
      receiptsEnabled: true,
      canCreateExpense: true,
      canCreatePayment: true,
      sharedPurchaseEnabled: false,
    });
    render(<MoneyCreateSheet create={create} />);
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    const paste = screen.getByTestId("money-create-paste-receipt");
    expect(paste).toHaveAttribute("href", "/app/hh1/money/receipts/new?mode=paste");
    expect(paste).toHaveTextContent("Paste receipt");
  });

  it("reads a canonical paste into a reviewable interpretation", async () => {
    const user = userEvent.setup();
    render(
      <ReceiptPasteFlow
        householdId="hh1"
        members={[{ id: "m1", label: "Atem" }]}
      />,
    );
    fireEvent.change(screen.getByTestId("receipt-paste-input"), {
      target: { value: CANONICAL },
    });
    await user.click(screen.getByRole("button", { name: /read receipt/i }));
    expect(screen.getByTestId("receipt-paste-preview")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(screen.getByText(/these numbers don't add up yet/i)).toBeInTheDocument();
    expect(screen.getByTestId("receipt-paste-continue")).toBeEnabled();
  });
});
