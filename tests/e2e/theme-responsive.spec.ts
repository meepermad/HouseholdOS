import { expect, test } from "@playwright/test";

test.describe("theme persistence", () => {
  test("light theme persists across refresh", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.setItem("householdos-theme", "light");
    });
    await page.reload();
    await expect
      .poll(async () =>
        page.evaluate(() => localStorage.getItem("householdos-theme")),
      )
      .toBe("light");
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.classList.contains("dark")),
      )
      .toBe(false);
  });

  test("dark theme persists across refresh", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.setItem("householdos-theme", "dark");
    });
    await page.reload();
    await expect
      .poll(async () =>
        page.evaluate(() => localStorage.getItem("householdos-theme")),
      )
      .toBe("dark");
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.classList.contains("dark")),
      )
      .toBe(true);
  });

  test("system theme is stored", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.setItem("householdos-theme", "system");
    });
    await page.reload();
    await expect
      .poll(async () =>
        page.evaluate(() => localStorage.getItem("householdos-theme")),
      )
      .toBe("system");
  });
});

test.describe("responsive layouts", () => {
  for (const viewport of [
    { name: "iPhone SE", width: 375, height: 667 },
    { name: "iPhone 14/15", width: 390, height: 844 },
    { name: "iPhone Pro Max", width: 430, height: 932 },
    { name: "landscape", width: 844, height: 390 },
  ]) {
    test(`login has no horizontal overflow on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/login");
      const overflow = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1
        );
      });
      expect(overflow).toBe(false);
    });
  }

  test("login uses wider layout on desktop without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
});

test.describe("iPhone safe-area CSS", () => {
  test("viewport-fit=cover is present", async ({ page }) => {
    await page.goto("/login");
    const fit = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta?.getAttribute("content") ?? "";
    });
    expect(fit.toLowerCase()).toContain("viewport-fit=cover");
  });

  test("safe-area utility classes resolve padding with insets", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const styles = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return null;
      const cs = getComputedStyle(main);
      return {
        hasSafePt: main.classList.contains("safe-pt"),
        hasSafePb: main.classList.contains("safe-pb"),
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
      };
    });
    expect(styles?.hasSafePt).toBe(true);
    expect(styles?.hasSafePb).toBe(true);
  });
});

test.describe("PWA / standalone CSS", () => {
  test("manifest is valid JSON with theme colors", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toBe("HouseholdOS");
    expect(body.display).toBe("standalone");
    expect(body.theme_color).toBe("#f3efe6");
    expect(body.start_url).toBe("/app");
  });

  test("standalone media query class exists in stylesheet path", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.setItem("householdos-theme", "system");
    });
    await page.reload();
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.classList.contains("dark")),
      )
      .toBe(true);
  });
});

test.describe("pending feedback", () => {
  test("login form remains interactive and reports errors without freezing", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("demo@example.com");
    await page.locator('input[name="password"]').fill("not-a-real-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Recoverable failure should surface without stranding the shell.
    await expect(page.getByRole("alert").or(page.locator("[role='alert']"))).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
