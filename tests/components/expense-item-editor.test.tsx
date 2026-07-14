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

describe("ExpenseItemEditor", () => {
  it("renders allocation mode selector and amount field", async () => {
    const user = userEvent.setup();
    render(
      <ExpenseItemEditor
        householdId="hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh"
        expenseId="eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
        members={members}
      />,
    );
    expect(screen.getByText("Allocation")).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount \(cents\)/i)).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Allocation/i }),
      "personal",
    );
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });
});
