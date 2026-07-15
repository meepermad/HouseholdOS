import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Load .env.local for linked Supabase e2e credentials (no overwrite of existing env).
const envLocal = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i);
    const value = line.slice(i + 1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      // Chromium + iPhone SE viewport (WebKit not required locally).
      name: "iPhone SE",
      use: {
        ...devices["Desktop Chrome"],
        ...devices["iPhone SE"],
        browserName: "chromium",
      },
    },
    {
      name: "iPhone 13",
      use: {
        ...devices["Desktop Chrome"],
        ...devices["iPhone 13"],
        browserName: "chromium",
      },
    },
    {
      name: "iPhone 14 Pro Max",
      use: {
        ...devices["Desktop Chrome"],
        ...devices["iPhone 14 Pro Max"],
        browserName: "chromium",
      },
    },
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
      },
});
