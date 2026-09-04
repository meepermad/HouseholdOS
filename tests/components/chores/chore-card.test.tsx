import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChoreCard } from "@/components/chores/ChoreCard";
import type { ChoreOccurrenceView } from "@/lib/chores/queries";

vi.mock("@/app/actions/chores", () => ({
  completeChoreAction: vi.fn(async () => ({ ok: true })),
}));

const chore: ChoreOccurrenceView = {
  id: "c1",
  definitionId: "d1",
  title: "Take out trash",
  description: null,
  category: "trash_recycling",
  visibility: "household",
  dueAt: new Date().toISOString(),
  dueDate: null,
  allDay: true,
  status: "scheduled",
  blockedReason: null,
  blockedNote: null,
  requiresVerification: false,
  verifierMembershipId: null,
  creatorMembershipId: "m1",
  assignments: [
    {
      membershipId: "m2",
      label: "Andrew",
      role: "assignee",
      status: "accepted",
    },
  ],
  pendingReassignmentId: null,
};

describe("ChoreCard", () => {
  it("shows a Done action and assigned person without recurrence internals", () => {
    render(
      <ul>
        <ChoreCard householdId="h1" chore={chore} />
      </ul>,
    );
    expect(screen.getByText("Take out trash")).toBeInTheDocument();
    expect(screen.getByText(/Assigned to Andrew/)).toBeInTheDocument();
    expect(screen.getByTestId("chore-quick-complete")).toHaveTextContent("Done");
    expect(screen.queryByText(/recurrence/i)).not.toBeInTheDocument();
    expect(screen.queryByText("scheduled")).not.toBeInTheDocument();
  });
});
