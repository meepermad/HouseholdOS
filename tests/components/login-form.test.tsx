import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

const FIXTURE_PASSWORD = "test-password-not-real";

describe("LoginForm progressive enhancement", () => {
  it("renders method=post and action=/api/auth/sign-in", () => {
    render(<LoginForm next="/app" />);
    const form = screen.getByTestId("login-form");
    expect(form.tagName).toBe("FORM");
    expect(form.getAttribute("method")).toBe("post");
    expect(form.getAttribute("action")).toBe("/api/auth/sign-in");
    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("type")).toBe("password");
    expect(password.getAttribute("autocomplete")).toBe("current-password");
  });

  it("blocks invalid email without native submit", async () => {
    const user = userEvent.setup();
    render(<LoginForm next="/app" />);
    const form = screen.getByTestId("login-form");
    const submitSpy = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", submitSpy);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), FIXTURE_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
  });

  it("allows native POST after valid input", async () => {
    const user = userEvent.setup();
    render(<LoginForm next="/app" />);
    const form = screen.getByTestId("login-form") as HTMLFormElement;
    let defaultPrevented = false;
    form.addEventListener("submit", (e) => {
      defaultPrevented = e.defaultPrevented;
      e.preventDefault(); // keep jsdom from navigating
    });

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), FIXTURE_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(defaultPrevented).toBe(false);
    expect(screen.getByRole("button", { name: /Signing in/i })).toBeDisabled();
  });
});
