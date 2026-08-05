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
    actorName: null,
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

  it("shows needs-action badge and Review CTA for unread action items", () => {
    render(
      <ul>
        <NotificationCard
          notification={makeNotification()}
          householdId="hh-1"
        />
      </ul>,
    );
    expect(screen.getByTestId("notification-kind-badge")).toHaveTextContent(
      "Needs action",
    );
    expect(screen.getByTestId("notification-cta")).toHaveTextContent("Review");
    expect(screen.getByTestId("notification-cta")).toHaveAttribute(
      "href",
      "/app/hh-1/money/payments/p-1",
    );
  });

  it("names who caused the notification when the actor is known", () => {
    const { rerender } = render(
      <ul>
        <NotificationCard
          notification={makeNotification({ actorName: "Jordan" })}
          householdId="hh-1"
        />
      </ul>,
    );
    expect(screen.getByTestId("notification-actor")).toHaveTextContent(
      "Jordan",
    );

    rerender(
      <ul>
        <NotificationCard
          notification={makeNotification({ actorName: null })}
          householdId="hh-1"
        />
      </ul>,
    );
    expect(screen.queryByTestId("notification-actor")).toBeNull();
  });

  it("shows household, category, and a machine-readable time", () => {
    render(
      <ul>
        <NotificationCard
          notification={makeNotification()}
          householdId="hh-1"
        />
      </ul>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
    const time = document.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-07-15T12:00:00.000Z");
  });

  it("keeps the deep link exactly as provided", () => {
    render(
      <ul>
        <NotificationCard
          notification={makeNotification({
            actionHref: "/app/hh-1/chores/c-9",
            category: "chores",
          })}
          householdId="hh-1"
        />
      </ul>,
    );
    expect(screen.getByTestId("notification-cta")).toHaveAttribute(
      "href",
      "/app/hh-1/chores/c-9",
    );
  });

  it("shows Update badge when the item is not action-oriented", () => {
    render(
      <ul>
        <NotificationCard
          notification={makeNotification({
            actionHref: null,
            actionOriented: false,
          })}
          householdId="hh-1"
        />
      </ul>,
    );
    expect(screen.getByTestId("notification-kind-badge")).toHaveTextContent(
      "Update",
    );
    expect(screen.queryByTestId("notification-cta")).not.toBeInTheDocument();
  });
});
