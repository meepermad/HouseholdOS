import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GuestCountControl } from "@/components/calendar/GuestCountControl";
import { MAX_GUEST_COUNT } from "@/lib/calendar/headcount";

describe("GuestCountControl", () => {
  it("increments and decrements guest count", async () => {
    const user = userEvent.setup();
    render(<GuestCountControl defaultValue={1} />);

    const input = screen.getByLabelText("Guests you're bringing");
    expect(input).toHaveValue(1);

    await user.click(screen.getByRole("button", { name: "Increase guest count" }));
    expect(input).toHaveValue(2);

    await user.click(screen.getByRole("button", { name: "Decrease guest count" }));
    expect(input).toHaveValue(1);
  });

  it("disables decrease at zero", () => {
    render(<GuestCountControl defaultValue={0} />);

    expect(
      screen.getByRole("button", { name: "Decrease guest count" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Increase guest count" }),
    ).toBeEnabled();
  });

  it("disables increase at max", () => {
    render(<GuestCountControl defaultValue={MAX_GUEST_COUNT} />);

    expect(
      screen.getByRole("button", { name: "Increase guest count" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Decrease guest count" }),
    ).toBeEnabled();
  });
});
