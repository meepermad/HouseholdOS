import type { ThemeMode } from "./types";
import { isThemeMode } from "./types";

export type ResolvedColorScheme = "light" | "dark";

/** Resolve stored preference + OS preference into light/dark. */
export function resolveColorScheme(
  mode: ThemeMode,
  prefersDark: boolean,
): ResolvedColorScheme {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return prefersDark ? "dark" : "light";
}

/**
 * Reconciliation when an authenticated DB preference arrives.
 * Precedence: explicit localStorage preference wins on this device (immediate paint).
 * DB preference applies only when localStorage has no explicit value (cross-device seed).
 */
export function reconcileThemePreference(args: {
  local: ThemeMode | null;
  database: ThemeMode | null;
}): ThemeMode {
  if (args.local && isThemeMode(args.local)) {
    return args.local;
  }
  if (args.database && isThemeMode(args.database)) {
    return args.database;
  }
  return "system";
}

export function parseStoredTheme(raw: string | null | undefined): ThemeMode | null {
  if (!raw) return null;
  return isThemeMode(raw) ? raw : null;
}
