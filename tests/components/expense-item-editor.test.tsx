import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpenseItemEditor } from "@/components/expenses/expense-item-editor";

vi.mock("@/app/actions/expenses", () => ({
  upsertExpenseItemAction: vi.fn(async () => ({ ok: true, message: "saved" })),
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

function renderEditor(initial?: Parameters<typeof ExpenseItemEditor>[0]["initial"]) {
  return render(
    <ExpenseItemEditor
      householdId="hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh"
      expenseId="eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
      members={members}
      initial={initial}
    />,
  );
}

describe("ExpenseItemEditor", () => {
  it("takes the amount in dollars, not cents", () => {
    renderEditor({ totalCents: 1250 });
    expect(screen.getByLabelText(/^Amount/)).toHaveValue("12.50");
    expect(screen.queryByText(/Amount \(cents\)/i)).not.toBeInTheDocument();
  });

  it("summarizes the default equal split without showing allocation controls", () => {
    renderEditor();
    expect(screen.getByTestId("item-split-summary")).toHaveTextContent(
      "Split equally between everyone",
    );
    expect(screen.queryByTestId("item-split-controls")).not.toBeInTheDocument();
  });

  it("reveals allocation controls when the split is changed", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByTestId("item-split-change"));

    expect(screen.getByTestId("item-split-controls")).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Allocation/i }),
      "personal",
    );
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("opens expanded when the item already uses a non-default split", () => {
    renderEditor({ allocationMode: "equal_selected", selectedIds: [members[0]!.id] });
    expect(screen.getByTestId("item-split-controls")).toBeInTheDocument();
    expect(screen.queryByTestId("item-split-change")).not.toBeInTheDocument();
  });

  it("collects per-member amounts in dollars for exact splits", async () => {
    const user = userEvent.setup();
    renderEditor({ allocationMode: "fixed_cents", selectedIds: members.map((m) => m.id) });

    const field = screen.getByLabelText("Amount for Atem");
    await user.type(field, "4.25");
    expect(field).toHaveValue("4.25");
  });
});
