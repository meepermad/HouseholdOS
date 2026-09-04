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
    expect(screen.getByTestId("route-load-guard-back")).toBeInTheDocument();
    expect(screen.getByTestId("route-load-guard-home")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^retry$/i })).toBeInTheDocument();
    expect(screen.getByText(/This is taking longer than expected/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });
});
