import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MaintenanceCard } from "@/components/maintenance/MaintenanceCard";
import { MaintenanceReportForm } from "@/components/maintenance/MaintenanceReportForm";

describe("MaintenanceCard", () => {
  it("renders severity without relying on color alone", () => {
    render(
      <MaintenanceCard
        householdId="11111111-1111-1111-1111-111111111111"
        item={{
          id: "22222222-2222-2222-2222-222222222222",
          title: "Sink leak",
          category: "plumbing",
          severity: "urgent",
          status: "reported",
          created_at: "2026-07-17T00:00:00Z",
          location_id: null,
          primary_coordinator_membership_id: null,
        }}
      />,
    );
    expect(screen.getByText("Sink leak")).toBeInTheDocument();
    expect(screen.getByLabelText(/Severity Urgent/i)).toBeInTheDocument();
  });
});

describe("MaintenanceReportForm", () => {
  it("shows emergency disclaimer when hazard selected after safety step", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <MaintenanceReportForm householdId="11111111-1111-1111-1111-111111111111" />,
    );
    await user.click(screen.getAllByRole("button", { name: /^Continue$/i })[0]!);
    await user.click(screen.getByRole("radio", { name: /^Yes$/i }));
    await user.click(screen.getByRole("checkbox", { name: /Gas odor/i }));
    expect(
      screen.getByText(/does not contact emergency services/i),
    ).toBeInTheDocument();
  });
});
