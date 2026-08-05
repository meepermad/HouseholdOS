import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  NotificationPreferencesForm,
  resolveGroupPushMode,
} from "@/components/notifications/NotificationPreferencesForm";
import { NOTIFICATION_PREFERENCE_GROUPS } from "@/lib/notifications/catalog";
import type { ChannelPreferenceRow } from "@/lib/notifications/queries";

vi.mock("@/app/actions/notifications", () => ({
  saveNotificationPreferencesAction: vi.fn(async () => ({ ok: true as const })),
}));

function group(key: string) {
  const found = NOTIFICATION_PREFERENCE_GROUPS.find((g) => g.key === key);
  if (!found) throw new Error(`missing group ${key}`);
  return found;
}

describe("NotificationPreferencesForm", () => {
  it("shows every preference group with an in-app and push column", () => {
    render(
      <NotificationPreferencesForm householdId="hh-1" preferences={[]} />,
    );

    for (const g of NOTIFICATION_PREFERENCE_GROUPS) {
      expect(screen.getByText(g.label)).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", { name: `${g.label} push alerts` }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("columnheader", { name: "In-app" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Push" })).toBeInTheDocument();
  });

  it("offers no email control at all", () => {
    render(
      <NotificationPreferencesForm householdId="hh-1" preferences={[]} />,
    );
    expect(
      screen.queryByRole("columnheader", { name: "Email" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /email/i }),
    ).not.toBeInTheDocument();
  });

  it("offers only On and Off, never daily digest", () => {
    render(
      <NotificationPreferencesForm householdId="hh-1" preferences={[]} />,
    );
    const select = screen.getByRole("combobox", { name: "Money push alerts" });
    const options = Array.from(select.querySelectorAll("option"));
    expect(options.map((o) => o.textContent)).toEqual(["On", "Off"]);
    expect(options.map((o) => o.getAttribute("value"))).toEqual([
      "immediate",
      "off",
    ]);
    expect(screen.queryByText(/digest/i)).not.toBeInTheDocument();
  });

  it("presents in-app as always on rather than a fake toggle", () => {
    render(
      <NotificationPreferencesForm householdId="hh-1" preferences={[]} />,
    );
    expect(screen.getAllByText("Always on")).toHaveLength(
      NOTIFICATION_PREFERENCE_GROUPS.length,
    );
    // One select per group means no in-app select was rendered.
    expect(screen.getAllByRole("combobox")).toHaveLength(
      NOTIFICATION_PREFERENCE_GROUPS.length,
    );
  });

  it("says so when push cannot be delivered on this deployment", () => {
    const { rerender } = render(
      <NotificationPreferencesForm
        householdId="hh-1"
        preferences={[]}
        pushDeliverable={false}
      />,
    );
    expect(screen.getByTestId("prefs-push-unavailable")).toBeInTheDocument();

    rerender(
      <NotificationPreferencesForm
        householdId="hh-1"
        preferences={[]}
        pushDeliverable
      />,
    );
    expect(
      screen.queryByTestId("prefs-push-unavailable"),
    ).not.toBeInTheDocument();
  });

  it("names push fields by group so one save covers every category", () => {
    const { container } = render(
      <NotificationPreferencesForm householdId="hh-1" preferences={[]} />,
    );
    expect(container.querySelector('select[name="push_money"]')).not.toBeNull();
    expect(
      container.querySelector('select[name="push_shopping_meals"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('select[name="mode_payments_email"]'),
    ).toBeNull();
  });
});

describe("resolveGroupPushMode", () => {
  const stored = (
    category: string,
    deliveryMode: ChannelPreferenceRow["deliveryMode"],
  ): ChannelPreferenceRow => ({ category, channel: "push", deliveryMode });

  it("defaults to on when nothing is stored", () => {
    expect(resolveGroupPushMode([], group("money"))).toBe("immediate");
  });

  it("reads a stored off as off", () => {
    const prefs = [stored("payments", "off"), stored("disputes", "off")];
    expect(resolveGroupPushMode(prefs, group("money"))).toBe("off");
  });

  it("treats a legacy daily_digest row as on, matching delivery", () => {
    const prefs = [stored("chores", "daily_digest")];
    expect(resolveGroupPushMode(prefs, group("chores"))).toBe("immediate");
  });

  it("stays on when only part of a group is off", () => {
    const prefs = [stored("house", "off")];
    expect(resolveGroupPushMode(prefs, group("shopping_meals"))).toBe(
      "immediate",
    );
  });

  it("ignores rows for other channels", () => {
    const prefs: ChannelPreferenceRow[] = [
      { category: "chores", channel: "in_app", deliveryMode: "off" },
    ];
    expect(resolveGroupPushMode(prefs, group("chores"))).toBe("immediate");
  });
});
