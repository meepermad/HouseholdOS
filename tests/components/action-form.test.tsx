import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionForm } from "@/components/action-form";

describe("ActionForm", () => {
  it("shows validation error from action result", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({
      ok: false as const,
      error: "Valid email and password are required.",
    }));

    render(
      <ActionForm action={action}>
        <button type="submit">Submit</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Valid email and password are required.");
  });
});
