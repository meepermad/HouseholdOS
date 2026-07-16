import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSelector } from "@/components/theme-selector";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpenseStatusBadge } from "@/components/ui/status-badge";
import { OfflineBanner } from "@/components/offline-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { HouseholdNav } from "@/components/household-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/hh-1/money",
}));

describe("ThemeSelector", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("shows three labeled options and selects dark", async () => {
    const user = userEvent.setup();
    const persist = vi.fn(async () => undefined);
    render(
      <ThemeProvider persistAction={persist}>
        <ThemeSelector />
      </ThemeProvider>,
    );

    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Dark"));
    expect(localStorage.getItem("householdos-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("selects light and clears dark class", async () => {
    const user = userEvent.setup();
    document.documentElement.classList.add("dark");
    render(
      <ThemeProvider>
        <ThemeSelector />
      </ThemeProvider>,
    );
    await user.click(screen.getByLabelText("Light"));
    expect(localStorage.getItem("householdos-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("HouseholdNav", () => {
  it("renders only implemented destinations", () => {
    render(<HouseholdNav householdId="hh-1" variant="bottom" />);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chores" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Money" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByText("Tasks")).not.toBeInTheDocument();
    expect(screen.queryByText("House")).not.toBeInTheDocument();
  });

  it("marks money as current on money path", () => {
    render(<HouseholdNav householdId="hh-1" variant="sidebar" />);
    expect(screen.getByRole("link", { name: "Money" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("ExpenseStatusBadge", () => {
  it("renders text status not color alone", () => {
    render(<ExpenseStatusBadge status="ready_for_review" />);
    expect(screen.getByText("Ready for review")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("answers what why next", () => {
    render(
      <EmptyState
        title="No expenses yet"
        description="Create a draft to get started."
        testId="empty"
      />,
    );
    expect(screen.getByTestId("empty")).toHaveTextContent("No expenses yet");
    expect(screen.getByTestId("empty")).toHaveTextContent("Create a draft");
  });
});

describe("Skeleton", () => {
  it("exposes busy status", () => {
    render(<Skeleton aria-label="Loading expenses" className="h-4 w-full" />);
    expect(
      screen.getByRole("status", { name: "Loading expenses" }),
    ).toBeInTheDocument();
  });
});

describe("OfflineBanner", () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("shows when offline", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    render(<OfflineBanner />);
    expect(await screen.findByTestId("offline-banner")).toBeInTheDocument();
    expect(screen.getByTestId("offline-banner")).toHaveTextContent("offline");
  });
});
