import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChoreStatusBadge } from "@/components/chores/ChoreStatusBadge";

describe("ChoreStatusBadge", () => {
  it("includes a readable status label", () => {
    render(<ChoreStatusBadge status="awaiting_verification" />);
    expect(screen.getByText("Waiting for a check")).toBeInTheDocument();
    expect(screen.getByText("Waiting for a check")).toHaveAttribute("data-status", "awaiting_verification");
  });
});
