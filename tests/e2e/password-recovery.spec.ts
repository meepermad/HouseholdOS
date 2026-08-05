import { expect, test } from "@playwright/test";

/**
 * Password recovery UI + security smoke (no live email).
 */
test.describe("password recovery routes", () => {
  test("forgot-password form posts without credentials in the URL", async ({
    page,
    request,
    baseURL,
  }) => {
    const headersRes = await request.get("/forgot-password");
    const cacheControl = headersRes.headers()["cache-control"] ?? "";
    expect(cacheControl).toMatch(/no-store|no-cache/i);

    await page.goto("/forgot-password");
    const form = page.getByTestId("forgot-password-form");
    await expect(form).toHaveAttribute("method", /post/i);
    await expect(form).toHaveAttribute("action", "/api/auth/forgot-password");

    // Drive the Route Handler directly (same as native form POST) for a stable
    // assertion, then confirm the success UI via navigation.
    const origin = baseURL ?? "http://127.0.0.1:3000";
    const post = await request.post("/api/auth/forgot-password", {
      form: { email: "unknown-user@example.com" },
      headers: {
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      maxRedirects: 0,
    });
    expect([200, 303]).toContain(post.status());
    const location = post.headers().location ?? "";
    if (post.status() === 303) {
      expect(location).toMatch(/sent=1/);
      expect(location).not.toMatch(/password=/i);
      expect(location).not.toMatch(/access_token=/i);
      await page.goto(location.startsWith("http") ? location : new URL(location, origin).toString());
    } else {
      await page.goto("/forgot-password?sent=1");
    }
    await expect(page.getByTestId("forgot-password-success")).toBeVisible();
  });

  test("reset-password without session redirects to login", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/login\?error=session_expired/);
  });

  test("login surfaces recovery error codes", async ({ page }) => {
    await page.goto("/login?error=link_expired");
    await expect(page.getByRole("alert")).toContainText(/expired/i);
    await expect(
      page.getByRole("link", { name: /request a new reset link/i }),
    ).toBeVisible();
  });

  test("auth callback rejects external next via safe path", async ({
    request,
  }) => {
    const res = await request.get(
      "/auth/callback?next=https://evil.example/phish",
      { maxRedirects: 0 },
    );
    expect([302, 307, 308]).toContain(res.status());
    const location = res.headers().location ?? "";
    expect(location).not.toMatch(/evil\.example/);
  });

  test("cleared sensitive query notice links to forgot-password", async ({
    page,
  }) => {
    await page.goto("/login?reason=cleared_sensitive_query");
    await expect(page.getByTestId("login-forgot-from-security")).toBeVisible();
  });
});
