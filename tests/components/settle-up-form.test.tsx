import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettleUpForm } from "@/components/payments/settle-up-form";
import type { SettlementExpense } from "@/lib/payments/selection";

const submitPaymentAction = vi.fn(async (prev: unknown, formData: FormData) => {
  void prev;
  void formData;
  return { ok: true as const, message: "saved" };
});
const recordReceivedPaymentAction = vi.fn(async (prev: unknown, formData: FormData) => {
  void prev;
  void formData;
  return { ok: true as const, message: "saved" };
});

vi.mock("@/app/actions/payments", () => ({
  submitPaymentAction: (prev: unknown, formData: FormData) => submitPaymentAction(prev, formData),
  recordReceivedPaymentAction: (prev: unknown, formData: FormData) =>
    recordReceivedPaymentAction(prev, formData),
}));

const H = "hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh";
const H2 = "22222222-2222-2222-2222-222222222222";
const SENDER = "ssssssss-ssss-ssss-ssss-ssssssssssss";
const RECIPIENT = "rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr";
const OTHER = "oooooooo-oooo-oooo-oooo-oooooooooooo";

function expense(
  partial: Partial<SettlementExpense> & { id: string; creditorMembershipId?: string },
): SettlementExpense {
  return {
    label: partial.label ?? partial.id,
    householdId: H,
    debtorMembershipId: SENDER,
    creditorMembershipId: partial.creditorMembershipId ?? RECIPIENT,
    currency: "USD",
    effectiveAmountCents: partial.officialOutstandingCents ?? 1000,
    officialOutstandingCents: 1000,
    pendingPaymentCents: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    eligible: true,
    ...partial,
  };
}

const three = [
  expense({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", label: "Walmart", officialOutstandingCents: 2000, effectiveAmountCents: 2000, createdAt: "2026-01-01T00:00:00.000Z" }),
  expense({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", label: "Electricity", officialOutstandingCents: 1500, effectiveAmountCents: 1500, createdAt: "2026-01-02T00:00:00.000Z" }),
  expense({ id: "cccccccc-cccc-cccc-cccc-cccccccccccc", label: "Supplies", officialOutstandingCents: 500, effectiveAmountCents: 500, createdAt: "2026-01-03T00:00:00.000Z" }),
];

function renderForm(
  overrides: Partial<ComponentProps<typeof SettleUpForm>> = {},
) {
  return render(
    <SettleUpForm
      householdId={H}
      viewerMembershipId={SENDER}
      currency="USD"
      members={[
        { id: SENDER, label: "Andrew" },
        { id: RECIPIENT, label: "Atem" },
        { id: OTHER, label: "Casey" },
      ]}
      expenses={three}
      direction="sent"
      {...overrides}
    />,
  );
}

describe("SettleUpForm selection", () => {
  it("settles every eligible expense from settle entire balance", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId("settle-entire-balance"));
    expect(screen.getByTestId("selection-summary")).toHaveTextContent("3 expenses selected");
    expect(screen.getByTestId("selected-total")).toHaveTextContent("$40.00");
    expect(screen.getByTestId("allocation-preview")).toBeInTheDocument();
    await user.click(screen.getByTestId("acknowledge-external"));
    await user.click(screen.getByTestId("submit-payment"));
    expect(submitPaymentAction).toHaveBeenCalled();
    const formData = submitPaymentAction.mock.calls.at(-1)?.[1];
    if (!formData) throw new Error("expected form data");
    const ids = (JSON.parse(String(formData.get("allocationsJson"))) as { obligationId: string }[]).map(
      (row) => row.obligationId,
    );
    expect(ids).toEqual(three.map((row) => row.id));
  });

  it("selects one expense, all shown expenses, then clears them", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId("choose-expenses"));
    await user.click(screen.getByTestId("obligation-select-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
    expect(screen.getByTestId("selection-summary")).toHaveTextContent("1 expense selected");
    await user.click(screen.getByTestId("select-all"));
    expect(screen.getByTestId("selection-summary")).toHaveTextContent("3 expenses selected");
    await user.click(screen.getByTestId("deselect-all"));
    expect(screen.getByTestId("selection-summary")).toHaveTextContent("0 expenses selected");
    expect(screen.getByTestId("empty-selection")).toHaveTextContent(
      "Select at least one expense to settle.",
    );
  });

  it("keeps a selection when expense details expand", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId("choose-expenses"));
    const box = screen.getByTestId("obligation-select-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    await user.click(box);
    await user.click(screen.getByTestId("expense-details-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
    expect(screen.getByTestId("expense-detail-panel-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")).toBeInTheDocument();
    expect(box).toBeChecked();
  });

  it("selects only the filtered expenses that are shown", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId("choose-expenses"));
    await user.type(screen.getByTestId("expense-filter"), "Elect");
    await user.click(screen.getByTestId("select-all"));
    expect(screen.getByTestId("selection-summary")).toHaveTextContent("1 expense selected");
    expect(screen.getByTestId("obligation-select-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")).toBeChecked();
  });

  it("names an expense that is no longer eligible", () => {
    renderForm({
      expenses: [
        expense({
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          label: "Electricity",
          eligible: false,
          officialOutstandingCents: 0,
          ineligibleReason: "It has already been settled.",
        }),
      ],
    });
    expect(screen.getByTestId("ineligible-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")).toHaveTextContent(
      "Electricity",
    );
  });

  it("supports a partial amount on the chosen expenses", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId("choose-expenses"));
    await user.click(screen.getByTestId("select-all"));
    const amount = screen.getByTestId("payment-amount");
    await user.clear(amount);
    await user.type(amount, "10.00");
    const preview = screen.getByTestId("allocation-preview");
    expect(within(preview).getByText("Walmart")).toBeInTheDocument();
    expect(preview).toHaveTextContent("$10.00");
  });

  it("switches creditors without keeping the previous selection", async () => {
    const user = userEvent.setup();
    renderForm({
      expenses: [
        ...three,
        expense({
          id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          label: "Casey rent",
          creditorMembershipId: OTHER,
          officialOutstandingCents: 900,
          effectiveAmountCents: 900,
        }),
      ],
    });
    await user.click(screen.getByTestId("settle-entire-balance"));
    expect(screen.getByTestId("selection-summary")).toHaveTextContent("3 expenses selected");
    await user.selectOptions(screen.getByTestId("recipient-select"), OTHER);
    expect(screen.getByTestId("pair-balance")).toHaveTextContent("$9.00");
    expect(screen.queryByTestId("selection-summary")).not.toBeInTheDocument();
  });

  it("clears the selection when the household changes", async () => {
    const user = userEvent.setup();
    const view = renderForm();
    await user.click(screen.getByTestId("choose-expenses"));
    await user.click(screen.getByTestId("select-all"));
    view.rerender(
      <SettleUpForm
        householdId={H2}
        viewerMembershipId={SENDER}
        currency="USD"
        members={[
          { id: SENDER, label: "Andrew" },
          { id: RECIPIENT, label: "Atem" },
        ]}
        expenses={three.map((row) => ({ ...row, householdId: H2 }))}
        direction="sent"
      />,
    );
    expect(screen.getByTestId("settle-entire-balance")).toBeInTheDocument();
    expect(screen.queryByTestId("obligation-select-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")).not.toBeInTheDocument();
  });

  it("keeps the idempotency key stable across selection changes", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId("choose-expenses"));
    const before = screen.getByTestId("idempotency-key").getAttribute("value");
    await user.click(screen.getByTestId("select-all"));
    await user.click(screen.getByTestId("deselect-all"));
    expect(screen.getByTestId("idempotency-key").getAttribute("value")).toBe(before);
  });

  it("uses a full-width control for the payment action", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId("settle-entire-balance"));
    expect(screen.getByTestId("submit-payment").className).toContain("w-full");
    expect(screen.getByTestId("submit-payment").className).toContain("min-h-11");
  });

  it("lets the person who is owed record a receipt for the whole balance", async () => {
    const user = userEvent.setup();
    renderForm({
      direction: "received",
      viewerMembershipId: RECIPIENT,
      expenses: three.map((row) => ({
        ...row,
        debtorMembershipId: SENDER,
        creditorMembershipId: RECIPIENT,
      })),
    });
    expect(screen.getByTestId("balance-sentence")).toHaveTextContent("Andrew owes you");
    await user.click(screen.getByTestId("settle-entire-balance"));
    await user.click(screen.getByTestId("acknowledge-external"));
    await user.click(screen.getByTestId("record-received"));
    expect(recordReceivedPaymentAction).toHaveBeenCalled();
    const formData = recordReceivedPaymentAction.mock.calls.at(-1)?.[1];
    if (!formData) throw new Error("expected form data");
    expect(formData.get("direction")).toBe("received");
    const ids = JSON.parse(String(formData.get("allocationsJson"))) as { obligationId: string }[];
    expect(ids).toHaveLength(3);
  });

  it("pages a long list and selects only the shown page", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 9 }, (_, index) =>
      expense({
        id: `00000000-0000-4000-8000-00000000000${index}`,
        label: `Expense ${index}`,
        officialOutstandingCents: 100,
        effectiveAmountCents: 100,
        createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );
    renderForm({ expenses: many });
    await user.click(screen.getByTestId("choose-expenses"));
    await user.click(screen.getByTestId("select-all"));
    expect(screen.getByTestId("selection-summary")).toHaveTextContent("8 expenses selected");
    await user.click(screen.getByTestId("selection-page-next"));
    await user.click(screen.getByTestId("select-all"));
    expect(screen.getByTestId("selection-summary")).toHaveTextContent("9 expenses selected");
  });
});
