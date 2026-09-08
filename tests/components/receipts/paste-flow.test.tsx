import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReceiptPasteFlow } from "@/components/receipts/ReceiptPasteFlow";
import { MoneyCreateSheet } from "@/components/money/MoneyCreateSheet";
import { buildMoneyCreateActions } from "@/lib/money/create-actions";
import { PASTE_FIXTURE_WALMART } from "@/lib/receipts/paste/fixtures";

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
    expect(screen.getByTestId("receipt-paste-status")).toHaveTextContent(
      /these numbers don't add up yet/i,
    );
    expect(screen.getByTestId("receipt-paste-continue")).toBeEnabled();
  });

  it("reads the operator Walmart fixture without cleanup", async () => {
    const user = userEvent.setup();
    render(
      <ReceiptPasteFlow
        householdId="hh1"
        members={[{ id: "m1", label: "Atem" }]}
      />,
    );
    fireEvent.change(screen.getByTestId("receipt-paste-input"), {
      target: { value: PASTE_FIXTURE_WALMART },
    });
    await user.click(screen.getByRole("button", { name: /read receipt/i }));
    expect(screen.getByText("Walmart")).toBeInTheDocument();
    expect(screen.getByText(/6 items found/i)).toBeInTheDocument();
    expect(screen.getByTestId("receipt-paste-continue")).toBeEnabled();
  });

  it("keeps pasted text and shows a line-level recovery when one item is unreadable", async () => {
    const user = userEvent.setup();
    render(
      <ReceiptPasteFlow
        householdId="hh1"
        members={[{ id: "m1", label: "Atem" }]}
        manualHref="/app/hh1/money/expenses/new"
      />,
    );
    fireEvent.change(screen.getByTestId("receipt-paste-input"), {
      target: {
        value: `HOUSEHOLDOS RECEIPT
Merchant: Shop
Total: 10.00
ITEMS
Milk | 9.00 | 1
Broken | nope | 1
END`,
      },
    });
    await user.click(screen.getByRole("button", { name: /read receipt/i }));
    expect(screen.getByTestId("receipt-paste-line-issues")).toHaveTextContent(/couldn't read 1 line/i);
    expect(screen.getByTestId("receipt-paste-line-issues")).toHaveTextContent("Broken | nope | 1");
    expect((screen.getByTestId("receipt-paste-input") as HTMLTextAreaElement).value).toContain(
      "Broken | nope | 1",
    );
    expect(screen.getByTestId("receipt-paste-continue")).toBeDisabled();
    expect(screen.getByRole("button", { name: /continue as total-only/i })).toBeEnabled();
  });

  it("does not expose the parser debugger by default", () => {
    render(
      <ReceiptPasteFlow householdId="hh1" members={[{ id: "m1", label: "Atem" }]} />,
    );
    expect(screen.queryByTestId("paste-parser-debug")).not.toBeInTheDocument();
  });

  it("loads a development fixture when parser debug is enabled", async () => {
    const user = userEvent.setup();
    render(
      <ReceiptPasteFlow
        householdId="hh1"
        members={[{ id: "m1", label: "Atem" }]}
        parserDebug
      />,
    );
    await user.click(screen.getByRole("button", { name: /test paste parser/i }));
    await user.click(screen.getByTestId("paste-parser-debug-walmart"));
    expect(screen.getByTestId("receipt-paste-input")).toHaveValue(PASTE_FIXTURE_WALMART);
  });

  it("keeps the textarea wrapping on a narrow width", () => {
    render(
      <ReceiptPasteFlow householdId="hh1" members={[{ id: "m1", label: "Atem" }]} />,
    );
    const area = screen.getByTestId("receipt-paste-input");
    expect(area.className).toMatch(/w-full/);
    expect(area.className).toMatch(/max-w-full/);
    expect(area.className).toMatch(/whitespace-pre-wrap/);
    expect(area.className).toMatch(/text-base/);
  });
});
