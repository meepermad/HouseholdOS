import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PushPermissionCard } from "@/components/notifications/PushPermissionCard";

const detectPushSupport = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/notifications/push-support", () => ({
  detectPushSupport: (...args: unknown[]) => detectPushSupport(...args),
}));

vi.mock("@/lib/notifications/push-client", () => ({
  subscribeCurrentDevice: vi.fn(),
  unsubscribeCurrentDevice: vi.fn(),
  getCurrentEndpointHash: vi.fn(),
}));

vi.mock("@/app/actions/notifications", () => ({
  deactivateCurrentEndpointAction: vi.fn(),
}));

describe("PushPermissionCard", () => {
  beforeEach(() => {
    detectPushSupport.mockReset();
  });

  it("shows unsupported messaging", async () => {
    detectPushSupport.mockResolvedValue({ state: "unsupported" });
    render(
      <PushPermissionCard
        householdId="hh-1"
        vapidPublicKey="BK-test-key"
      />,
    );
    expect(await screen.findByText("Push not supported")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enable alerts" }),
    ).not.toBeInTheDocument();
  });

  it("shows denied messaging without enable button", async () => {
    detectPushSupport.mockResolvedValue({ state: "denied" });
    render(
      <PushPermissionCard
        householdId="hh-1"
        vapidPublicKey="BK-test-key"
      />,
    );
    expect(await screen.findByText("Permission blocked")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enable alerts" }),
    ).not.toBeInTheDocument();
  });

  it("shows enable button when settings allows a permission prompt", async () => {
    detectPushSupport.mockResolvedValue({ state: "not_requested" });
    render(
      <PushPermissionCard
        householdId="hh-1"
        vapidPublicKey="BK-test-key"
        allowPermissionRequest
      />,
    );
    expect(
      await screen.findByText("Enable push on this device"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Enable alerts" }),
      ).toBeInTheDocument();
    });
  });

  it("never prompts for permission outside settings", async () => {
    detectPushSupport.mockResolvedValue({ state: "not_requested" });
    render(
      <PushPermissionCard householdId="hh-1" vapidPublicKey="BK-test-key" />,
    );
    expect(
      await screen.findByText("Enable push on this device"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enable alerts" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("push-settings-link")).toHaveAttribute(
      "href",
      "/app/hh-1/settings/notifications",
    );
  });

  it("says push is not configured when the VAPID key is missing", async () => {
    detectPushSupport.mockResolvedValue({ state: "not_requested" });
    render(<PushPermissionCard householdId="hh-1" allowPermissionRequest />);
    expect(
      await screen.findByText("Push is not configured"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enable alerts" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("push-settings-link")).toBeNull();
  });

  it("says delivery is off when keys exist but sending is disabled", async () => {
    detectPushSupport.mockResolvedValue({ state: "not_requested" });
    render(
      <PushPermissionCard
        householdId="hh-1"
        vapidPublicKey="BK-test-key"
        deliveryEnabled={false}
        allowPermissionRequest
      />,
    );
    expect(
      await screen.findByText("Push delivery is turned off"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enable alerts" }),
    ).not.toBeInTheDocument();
  });
});
