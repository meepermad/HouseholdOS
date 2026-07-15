import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProtectedAppError from "@/app/(protected)/app/error";
import RootErrorBoundary from "@/app/error";
import {
  RecoveryClearHouseholdForm,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { UnauthorizedHouseholdState } from "@/components/unauthorized-household";

describe("recovery UI escape hatches", () => {
  it("protected error boundary renders retry, recovery, logout, and clear-household", () => {
    render(
      <ProtectedAppError
        error={Object.assign(new Error("boom"), { digest: "digest-abc" })}
        reset={vi.fn()}
      />,
    );
    const root = screen.getByTestId("protected-error-boundary");
    expect(within(root).getByTestId("error-retry")).toHaveAccessibleName("Try again");
    expect(within(root).getByRole("link", { name: /recovery options/i })).toHaveAttribute(
      "href",
      "/recovery",
    );
    expect(within(root).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(
      within(root).getByRole("button", { name: "Clear household selection" }),
    ).toBeInTheDocument();
    expect(within(root).getByTestId("error-reference")).toHaveTextContent("digest-abc");
  });

  it("root error boundary renders escape controls and themed copy", () => {
    render(
      <RootErrorBoundary
        error={Object.assign(new Error("boom"), { digest: "root-1" })}
        reset={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sign out" }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Clear household selection" }).length,
    ).toBeGreaterThan(0);
  });

  it("logout and clear-household forms post to independent routes", () => {
    const { container: logout } = render(<RecoveryLogoutForm />);
    expect(logout.querySelector("form")?.getAttribute("action")).toBe("/auth/logout");
    expect(logout.querySelector("form")?.getAttribute("method")).toBe("post");

    const { container: clear } = render(<RecoveryClearHouseholdForm next="/app" />);
    expect(clear.querySelector("form")?.getAttribute("action")).toBe(
      "/auth/clear-household",
    );
    expect(clear.querySelector('input[name="next"]')).toHaveValue("/app");
  });

  it("unauthorized household state provides escape controls", () => {
    render(
      <UnauthorizedHouseholdState message="You do not have access to this household." />,
    );
    const root = screen.getByTestId("unauthorized-household");
    expect(
      within(root).getByRole("link", { name: /choose a household/i }),
    ).toHaveAttribute("href", "/app");
    expect(within(root).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(
      within(root).getByRole("button", { name: "Clear household selection" }),
    ).toBeInTheDocument();
  });
});
