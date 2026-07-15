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
 * DB wins for signed-in users (cross-device sync) and should overwrite localStorage.
 */
export function reconcileThemePreference(args: {
  local: ThemeMode | null;
  database: ThemeMode | null;
}): ThemeMode {
  if (args.database && isThemeMode(args.database)) {
    return args.database;
  }
  if (args.local && isThemeMode(args.local)) {
    return args.local;
  }
  return "system";
}

export function parseStoredTheme(raw: string | null | undefined): ThemeMode | null {
  if (!raw) return null;
  return isThemeMode(raw) ? raw : null;
}
