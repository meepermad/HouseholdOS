import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import type { UserNotificationRow } from "@/lib/notifications/queries";

vi.mock("@/app/actions/notifications", () => ({
  markAllNotificationsReadAction: vi.fn(async () => ({ ok: true as const })),
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
    actorName: "Alex",
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderInbox(props: Partial<Parameters<typeof NotificationInbox>[0]> = {}) {
  return render(
    <NotificationInbox
      householdId="hh-1"
      notifications={[makeNotification()]}
      hasMore={false}
      offset={0}
      filter="all"
      category="all"
      {...props}
    />,
  );
}

describe("NotificationInbox filters", () => {
  it("offers exactly All, Needs action, and Updates", () => {
    renderInbox();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "All",
      "Needs action",
      "Updates",
    ]);
    expect(screen.queryByRole("tab", { name: "Unread" })).toBeNull();
  });

  it("deep links each filter and resets paging", () => {
    renderInbox({ offset: 40 });
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
      "href",
      "/app/hh-1/notifications",
    );
    expect(screen.getByRole("tab", { name: "Needs action" })).toHaveAttribute(
      "href",
      "/app/hh-1/notifications?filter=action",
    );
    expect(screen.getByRole("tab", { name: "Updates" })).toHaveAttribute(
      "href",
      "/app/hh-1/notifications?filter=updates",
    );
  });

  it("keeps the active filter when switching category", () => {
    renderInbox({ filter: "action" });
    expect(screen.getByRole("tab", { name: "Needs action" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByTestId("inbox-filter-button"));
    expect(screen.getByRole("link", { name: "Chores" })).toHaveAttribute(
      "href",
      "/app/hh-1/notifications?filter=action&category=chores",
    );
    // Categories the emitter never writes must not be offered.
    expect(screen.queryByRole("link", { name: "Expenses" })).toBeNull();
    expect(screen.getByRole("link", { name: "House" })).toBeInTheDocument();
  });

  it("keeps the active filter on Load more", () => {
    renderInbox({ filter: "updates", hasMore: true, offset: 20 });
    expect(screen.getByRole("link", { name: "Load more" })).toHaveAttribute(
      "href",
      "/app/hh-1/notifications?filter=updates&offset=21",
    );
  });

  it("explains each empty state in the filter's own terms", () => {
    const { rerender } = renderInbox({ notifications: [], filter: "action" });
    expect(screen.getByText("Nothing needs your action")).toBeInTheDocument();

    rerender(
      <NotificationInbox
        householdId="hh-1"
        notifications={[]}
        hasMore={false}
        offset={0}
        filter="updates"
        category="all"
      />,
    );
    expect(screen.getByText("No updates yet")).toBeInTheDocument();
  });

  it("renders rows the server returned without re-filtering them", () => {
    renderInbox({
      filter: "updates",
      notifications: [
        makeNotification({ id: "a", actionOriented: false, actionHref: null }),
        makeNotification({ id: "b", actionOriented: false }),
      ],
    });
    expect(screen.getAllByTestId("notification-card")).toHaveLength(2);
  });
});
