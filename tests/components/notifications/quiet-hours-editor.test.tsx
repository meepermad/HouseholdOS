import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuietHoursEditor } from "@/components/notifications/QuietHoursEditor";

vi.mock("@/app/actions/notifications", () => ({
  saveQuietHoursAction: vi.fn(async () => ({ ok: true as const })),
}));

describe("QuietHoursEditor", () => {
  it("renders quiet-hours form fields", () => {
    render(
      <QuietHoursEditor
        householdId="hh-1"
        quietHours={{
          enabled: true,
          startLocal: "22:00",
          endLocal: "07:00",
          timeZone: "America/Chicago",
          allowUrgentOverride: true,
          previewMode: "generic",
        }}
      />,
    );

    expect(screen.getByLabelText("Enable quiet hours")).toBeInTheDocument();
    expect(screen.getByLabelText("Start (local)")).toHaveValue("22:00");
    expect(screen.getByLabelText("End (local)")).toHaveValue("07:00");
    expect(screen.getByLabelText("Time zone")).toHaveValue("America/Chicago");
    expect(
      screen.getByLabelText("Allow urgent alerts during quiet hours"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save quiet hours" }),
    ).toBeInTheDocument();
  });
});
