import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationCard } from "@/components/notifications/NotificationCard";
import type { UserNotificationRow } from "@/lib/notifications/queries";

vi.mock("@/app/actions/notifications", () => ({
  markNotificationReadAction: vi.fn(async () => ({ ok: true as const })),
  markNotificationUnreadAction: vi.fn(async () => ({ ok: true as const })),
}));

function makeNotification(
  overrides: Partial<UserNotificationRow> = {},
): UserNotificationRow {
  return {
    id: "n-1",
    userId: "u-1",
    householdId: "hh-1",
    householdName: "Home",
    title: "Payment awaiting confirmation",
    body: "Alex recorded a payment for your review.",
    actionHref: "/app/hh-1/money/payments/p-1",
    category: "payments",
    urgency: "high",
    actionOriented: true,
    readAt: null,
    createdAt: "2026-07-15T12:00:00.000Z",
    ...overrides,
  };
}

describe("NotificationCard", () => {
  it("renders the notification title and body", () => {
    render(
      <ul>
        <NotificationCard
          notification={makeNotification()}
          householdId="hh-1"
        />
      </ul>,
    );
    expect(
      screen.getByText("Payment awaiting confirmation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Alex recorded a payment for your review."),
    ).toBeInTheDocument();
  });

  it("applies unread elevated styling when unread", () => {
    const { rerender } = render(
      <ul>
        <NotificationCard
          notification={makeNotification({ readAt: null })}
          householdId="hh-1"
        />
      </ul>,
    );
    const unread = screen.getByTestId("notification-card");
    expect(unread.className).toContain("bg-surface-elevated");
    expect(screen.getByRole("button", { name: "Mark read" })).toBeInTheDocument();

    rerender(
      <ul>
        <NotificationCard
          notification={makeNotification({
            readAt: "2026-07-15T13:00:00.000Z",
          })}
          householdId="hh-1"
        />
      </ul>,
    );
    const read = screen.getByTestId("notification-card");
    expect(read.className).toContain("bg-surface");
    expect(read.className).not.toContain("bg-surface-elevated");
  });
});
