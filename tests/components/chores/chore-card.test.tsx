import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChoreCard } from "@/components/chores/ChoreCard";

describe("ChoreCard", () => {
  it("shows title, due information, assignee, and status", () => {
    render(<ChoreCard householdId="house" chore={{
      id: "occ", definitionId: "def", title: "Take out trash", description: null,
      category: "trash_recycling", visibility: "household", dueAt: "2026-07-16T18:00:00.000Z",
      dueDate: null, allDay: false, status: "scheduled", blockedReason: null,
      blockedNote: null, requiresVerification: false, verifierMembershipId: null,
      creatorMembershipId: "creator", pendingReassignmentId: null,
      assignments: [{ membershipId: "member", label: "Alex", role: "primary", status: "assigned" }],
    }} />);
    expect(screen.getByText("Take out trash")).toBeInTheDocument();
    expect(screen.getByText(/Assigned to Alex/)).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });
});
