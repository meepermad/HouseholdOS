import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteLoadGuard } from "@/components/route-load-guard";

describe("RouteLoadGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a loading skeleton initially", () => {
    render(<RouteLoadGuard stage="home" />);
    expect(screen.getByTestId("route-load-guard")).toBeInTheDocument();
    expect(screen.queryByTestId("route-load-guard-recovery")).not.toBeInTheDocument();
  });

  it("replaces the skeleton with recovery after 7 seconds", async () => {
    render(<RouteLoadGuard stage="home" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_000);
    });
    expect(screen.getByTestId("route-load-guard-recovery")).toBeInTheDocument();
    expect(screen.getByTestId("route-load-guard-retry")).toBeInTheDocument();
    expect(screen.getByTestId("route-load-guard-reload-latest")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /choose household/i })).toHaveAttribute(
      "href",
      "/app",
    );
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByText(/Home data is taking too long/i)).toBeInTheDocument();
  });
});
