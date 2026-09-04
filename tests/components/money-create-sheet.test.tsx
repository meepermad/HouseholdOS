import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MoneyCreateSheet } from "@/components/money/MoneyCreateSheet";
import { buildMoneyCreateActions } from "@/lib/money/create-actions";

const create = buildMoneyCreateActions({
  householdId: "hh1",
  activeMemberCount: 3,
  receiptsEnabled: true,
  canCreateExpense: true,
  canCreatePayment: true,
  sharedPurchaseEnabled: true,
});

describe("MoneyCreateSheet", () => {
  it("stays closed until the Add expense button is pressed", () => {
    render(<MoneyCreateSheet create={create} />);
    expect(screen.getByTestId("money-hub-scan-receipt")).toHaveAttribute(
      "href",
      "/app/hh1/money/receipts/new?mode=camera",
    );
    expect(screen.getByTestId("money-create-open")).toHaveTextContent("Add expense");
    expect(screen.queryByTestId("money-create-sheet")).not.toBeInTheDocument();
    expect(screen.getByTestId("money-create-record-payment")).toBeInTheDocument();
  });

  it("lists scan, upload, and manual entry in the sheet", async () => {
    const user = userEvent.setup();
    render(<MoneyCreateSheet create={create} />);
    await user.click(screen.getByTestId("money-create-open"));

    expect(screen.getByTestId("money-create-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("money-create-scan-receipt")).toHaveAttribute(
      "href",
      "/app/hh1/money/receipts/new?mode=camera",
    );
    expect(screen.getByTestId("money-create-upload-receipt")).toHaveAttribute(
      "href",
      "/app/hh1/money/receipts/new?mode=file",
    );
    expect(screen.getByTestId("money-create-add-expense")).toHaveAttribute(
      "href",
      "/app/hh1/money/expenses/new",
    );
  });

  it("keeps rarer options behind a disclosure", async () => {
    const user = userEvent.setup();
    render(<MoneyCreateSheet create={create} />);
    await user.click(screen.getByTestId("money-create-open"));

    expect(
      screen.queryByTestId("money-create-shared-purchase"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("money-create-more"));
    expect(screen.getByTestId("money-create-shared-purchase")).toBeInTheDocument();
  });

  it("does not offer navigation-only destinations", async () => {
    const user = userEvent.setup();
    render(<MoneyCreateSheet create={create} />);
    await user.click(screen.getByTestId("money-create-open"));
    await user.click(screen.getByTestId("money-create-more"));

    const hrefs = Array.from(
      screen.getByTestId("money-create-sheet").querySelectorAll("a"),
    ).map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/app/hh1/money/ledger");
    expect(hrefs).not.toContain("/app/hh1/money/balances");
    expect(hrefs).not.toContain("/app/hh1/settings");
  });

  it("renders nothing when the member cannot create anything", () => {
    const empty = buildMoneyCreateActions({
      householdId: "hh1",
      activeMemberCount: 1,
      receiptsEnabled: false,
      canCreateExpense: false,
      canCreatePayment: false,
      sharedPurchaseEnabled: false,
    });
    const { container } = render(<MoneyCreateSheet create={empty} />);
    expect(container).toBeEmptyDOMElement();
  });
});
