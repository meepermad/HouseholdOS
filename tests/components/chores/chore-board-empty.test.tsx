import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChoreBoard } from "@/components/chores/ChoreBoard";

describe("empty chore board", () => {
  it.each(["light", "dark"])("renders in %s mode", (theme) => {
    render(<div data-theme={theme}><ChoreBoard householdId="house" chores={[]} canCreate /></div>);
    expect(screen.getByTestId("chore-board-empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create chore" })).toHaveAttribute("href", "/app/house/chores/new");
  });
});
