import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpenseAdjustmentEditor } from "@/components/expenses/expense-adjustment-editor";

vi.mock("@/app/actions/expenses", () => ({
  upsertExpenseAdjustmentAction: vi.fn(async () => ({ ok: true, message: "saved" })),
}));

vi.mock("@/components/action-form", () => ({
  ActionForm: ({
    children,
    action,
  }: {
    children: React.ReactNode;
    action: (p: null, fd: FormData) => Promise<{ ok: boolean }>;
  }) => (
    <form
      data-testid="adjustment-form"
      onSubmit={(e) => {
        e.preventDefault();
        void action(null, new FormData(e.currentTarget));
      }}
    >
      {children}
    </form>
  ),
}));

const members = [
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", label: "Atem" },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", label: "Michael" },
];

function renderEditor(
  initial?: Parameters<typeof ExpenseAdjustmentEditor>[0]["initial"],
) {
  return render(
    <ExpenseAdjustmentEditor
      householdId="hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh"
      expenseId="eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
      members={members}
      initial={initial}
    />,
  );
}

function participants(container: HTMLElement): Array<Record<string, unknown>> {
  const input = container.querySelector<HTMLInputElement>(
    'input[name="participantsJson"]',
  );
  return JSON.parse(input?.value ?? "[]");
}

describe("ExpenseAdjustmentEditor", () => {
  it("takes the amount in dollars and allows discounts", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor({ amountCents: 450 });

    const amount = screen.getByLabelText(/^Amount/);
    expect(amount).toHaveValue("4.50");

    await user.clear(amount);
    await user.type(amount, "-2.00");
    await user.tab();
    expect(
      container.querySelector<HTMLInputElement>('input[name="amountCents"]')?.value,
    ).toBe("-200");
  });

  it("summarizes the default proportional split before expanding", () => {
    renderEditor();
    expect(screen.getByTestId("adjustment-split-summary")).toHaveTextContent(
      "In proportion to each person's items",
    );
    expect(
      screen.queryByTestId("adjustment-split-controls"),
    ).not.toBeInTheDocument();
  });

  it("collects exact per-member amounts for the fixed mode", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor({ allocationMode: "fixed_cents" });

    await user.type(screen.getByLabelText("Amount for Atem"), "1.50");
    await user.type(screen.getByLabelText("Amount for Michael"), "2.50");

    expect(participants(container)).toEqual([
      { membershipId: members[0]!.id, fixedCents: 150 },
      { membershipId: members[1]!.id, fixedCents: 250 },
    ]);
  });

  it("collects percentages as basis points", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor({ allocationMode: "percentage" });

    await user.type(screen.getByLabelText("Percentage for Atem"), "60");
    await user.type(screen.getByLabelText("Percentage for Michael"), "40");

    expect(participants(container)).toEqual([
      { membershipId: members[0]!.id, percentBps: 6000 },
      { membershipId: members[1]!.id, percentBps: 4000 },
    ]);
  });

  it("collects weights for the shares mode", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor({ allocationMode: "weighted" });

    await user.type(screen.getByLabelText("Shares for Atem"), "2");
    await user.type(screen.getByLabelText("Shares for Michael"), "1");

    expect(participants(container)).toEqual([
      { membershipId: members[0]!.id, weight: 2 },
      { membershipId: members[1]!.id, weight: 1 },
    ]);
  });

  it("sends no participants for whole-expense modes", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor({ allocationMode: "equal_selected" });

    await user.selectOptions(
      screen.getByRole("combobox", { name: /Allocation/i }),
      "payer_absorbs",
    );
    expect(participants(container)).toEqual([]);
  });
});
