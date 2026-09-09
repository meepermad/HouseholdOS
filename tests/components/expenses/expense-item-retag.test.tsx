import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpenseItemRetag } from "@/components/expenses/ExpenseItemRetag";
import { retagConfirmedExpenseItemAction } from "@/app/actions/expenses";

vi.mock("@/app/actions/expenses", () => ({
  retagConfirmedExpenseItemAction: vi.fn(async () => ({ ok: true })),
}));

const members = [
  { id: "m1", label: "Atem" },
  { id: "m2", label: "Andrew" },
];

describe("ExpenseItemRetag", () => {
  it("lets a roommate retag a confirmed item without opening a correction editor", async () => {
    const user = userEvent.setup();
    render(
      <ExpenseItemRetag
        householdId="hh"
        expenseId="e1"
        itemId="i1"
        allocationMode="equal_all"
        personalMembershipId={null}
        selectedIds={["m1", "m2"]}
        members={members}
        currentMembershipId="m1"
      />,
    );

    await user.click(screen.getByTestId("expense-item-retag-open"));
    await user.click(screen.getByTestId("retag-mine"));

    expect(retagConfirmedExpenseItemAction).toHaveBeenCalled();
    const fd = vi.mocked(retagConfirmedExpenseItemAction).mock.calls[0][1] as FormData;
    expect(fd.get("itemId")).toBe("i1");
    expect(fd.get("allocationMode")).toBe("personal");
    expect(fd.get("personalMembershipId")).toBe("m1");
  });
});
