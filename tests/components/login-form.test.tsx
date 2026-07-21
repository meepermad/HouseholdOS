import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

const FIXTURE_PASSWORD = "test-password-not-real";

describe("LoginForm progressive enhancement", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, error: "Unable to sign in." }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders method=post and action=/api/auth/sign-in", () => {
    render(<LoginForm next="/app" />);
    const form = screen.getByTestId("login-form");
    expect(form.tagName).toBe("FORM");
    expect(form.getAttribute("method")).toBe("post");
    expect(form.getAttribute("action")).toBe("/api/auth/sign-in");
    expect(form.getAttribute("action")).not.toMatch(/^javascript:/i);
    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("type")).toBe("password");
    expect(password.getAttribute("autocomplete")).toBe("current-password");
  });

  it("calls preventDefault and POSTs JSON without query credentials", async () => {
    const user = userEvent.setup();
    const preventSpy = vi.spyOn(Event.prototype, "preventDefault");
    render(<LoginForm next="/app" />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), FIXTURE_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(preventSpy).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalled();
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/auth/sign-in");
    expect(init.method).toBe("POST");
    expect(String(init.body)).not.toMatch(/\?email=/);
    preventSpy.mockRestore();
  });

  it("does not construct credential query URLs on failure", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<LoginForm next="/app" />);
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), FIXTURE_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });
});
