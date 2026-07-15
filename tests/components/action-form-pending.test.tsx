import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ActionForm } from "@/components/action-form";
import type { ActionResult } from "@/app/actions/auth";

describe("ActionForm pending", () => {
  it("shows action-specific pending label while the action runs", async () => {
    const user = userEvent.setup();
    const action = async (): Promise<ActionResult> => {
      await new Promise((r) => setTimeout(r, 200));
      return { ok: false, error: "Invalid credentials." };
    };

    render(
      <ActionForm action={action} pendingLabel="Signing in…">
        <button type="submit">Sign in</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Signing in…")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials.");
    });
  });
});
