import {
  resolveColorScheme,
  reconcileThemePreference,
  parseStoredTheme,
} from "@/lib/theme/resolve";
import { isThemeMode } from "@/lib/theme/types";
import { isStandaloneDisplayMode } from "@/lib/theme/standalone";
import { prefersReducedMotion } from "@/lib/theme/reduced-motion";
import { describe, expect, it } from "vitest";

describe("theme resolve", () => {
  it("resolves light and dark explicitly", () => {
    expect(resolveColorScheme("light", true)).toBe("light");
    expect(resolveColorScheme("dark", false)).toBe("dark");
  });

  it("falls back to system preference", () => {
    expect(resolveColorScheme("system", true)).toBe("dark");
    expect(resolveColorScheme("system", false)).toBe("light");
  });

  it("reconciles DB over local when authenticated", () => {
    expect(
      reconcileThemePreference({ local: "light", database: "dark" }),
    ).toBe("dark");
    expect(
      reconcileThemePreference({ local: "dark", database: null }),
    ).toBe("dark");
    expect(
      reconcileThemePreference({ local: null, database: null }),
    ).toBe("system");
  });

  it("parses stored theme safely", () => {
    expect(parseStoredTheme("system")).toBe("system");
    expect(parseStoredTheme("nope")).toBeNull();
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("neon")).toBe(false);
  });
});

describe("standalone helper", () => {
  it("detects display-mode standalone", () => {
    expect(
      isStandaloneDisplayMode((q) => q.includes("standalone"), false),
    ).toBe(true);
    expect(isStandaloneDisplayMode(() => false, true)).toBe(true);
    expect(isStandaloneDisplayMode(() => false, false)).toBe(false);
  });
});

describe("reduced motion", () => {
  it("detects prefers-reduced-motion", () => {
    expect(prefersReducedMotion((q) => q.includes("reduced-motion"))).toBe(
      true,
    );
    expect(prefersReducedMotion(() => false)).toBe(false);
  });
});
