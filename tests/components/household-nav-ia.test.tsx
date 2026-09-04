import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HouseholdNav } from "@/components/household-nav";

// Chores lives inside the House hub, so this path exercises hub-vs-destination
// highlighting and the More sheet contents at the same time.
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/hh-1/chores",
}));

describe("House hub owns its sub-destinations", () => {
  it("marks House as the current page for chore routes", () => {
    render(<HouseholdNav householdId="hh-1" variant="sidebar" />);

    expect(screen.getByRole("link", { name: "House" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("link", { name: "Chores" })).not.toBeInTheDocument();

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
  });

  it("does not highlight More when a primary tab owns the path", () => {
    render(<HouseholdNav householdId="hh-1" variant="bottom" />);

    expect(screen.getByRole("link", { name: "House" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Only the inactive style carries the muted text token.
    expect(screen.getByTestId("mobile-more-nav").className).toContain(
      "text-text-secondary",
    );
  });
});

describe("nav maturity honesty", () => {
  it("labels unfinished destinations in the sidebar", () => {
    render(<HouseholdNav householdId="hh-1" variant="sidebar" />);

    for (const name of ["Products", "Roommate ops", "Search"]) {
      const link = screen.getByRole("link", { name: new RegExp(`^${name}`) });
      expect(link).toHaveTextContent("Beta");
    }
  });

  it("leaves finished destinations unlabeled", () => {
    render(<HouseholdNav householdId="hh-1" variant="sidebar" />);

    expect(screen.getByRole("link", { name: /^Money/ })).not.toHaveTextContent(
      "Beta",
    );
    expect(screen.getByRole("link", { name: /^Governance/ })).not.toHaveTextContent(
      "Beta",
    );
  });
});
