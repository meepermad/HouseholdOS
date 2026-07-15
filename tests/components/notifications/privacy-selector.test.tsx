import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationPrivacySelector } from "@/components/notifications/NotificationPrivacySelector";

vi.mock("@/app/actions/notifications", () => ({
  saveQuietHoursAction: vi.fn(async () => ({ ok: true as const })),
}));

const quietHours = {
  enabled: false,
  startLocal: "22:00",
  endLocal: "07:00",
  timeZone: "America/Chicago",
  allowUrgentOverride: true,
  previewMode: "generic" as const,
};

describe("NotificationPrivacySelector", () => {
  it("offers generic and detailed privacy options", () => {
    render(
      <NotificationPrivacySelector
        householdId="hh-1"
        quietHours={quietHours}
        privacyPreview="generic"
      />,
    );

    expect(screen.getByText("Lock-screen preview")).toBeInTheDocument();
    const generic = screen.getByLabelText(/Generic — category only/i);
    const detailed = screen.getByLabelText(/Detailed — include safe actor/i);
    expect(generic).toBeChecked();
    expect(detailed).not.toBeChecked();
    expect(generic).toHaveAttribute("value", "generic");
    expect(detailed).toHaveAttribute("value", "detailed");
  });
});
