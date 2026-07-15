import path from "node:path";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    test: {
      environment: "jsdom",
      include: [
        "tests/unit/**/*.test.ts",
        "tests/integration/**/*.test.ts",
        "tests/components/**/*.test.tsx",
      ],
      setupFiles: ["tests/setup.ts"],
      env,
      // Linked Auth rate-limits when many suites create users concurrently.
      fileParallelism: false,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
