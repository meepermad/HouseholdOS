"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import {
  applyThemeToDocument,
  readThemeFromStorage,
  writeThemeToStorage,
} from "@/lib/theme/apply-dom";
import { reconcileThemePreference } from "@/lib/theme/resolve";
import type { ThemeMode } from "@/lib/theme/types";
import { isThemeMode, THEME_STORAGE_KEY } from "@/lib/theme/types";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  pending: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_CHANGE_EVENT = "householdos-theme-change";

function subscribeTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) onStoreChange();
  };
  const onCustom = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onCustom);
  };
}

function getThemeSnapshot(): ThemeMode {
  return readThemeFromStorage();
}

function getServerSnapshot(): ThemeMode {
  return "system";
}

function notifyThemeListeners() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
}

export function ThemeProvider({
  children,
  databaseTheme,
  persistAction,
}: {
  children: ReactNode;
  databaseTheme?: ThemeMode | null;
  persistAction?: (mode: ThemeMode) => Promise<void>;
}) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerSnapshot,
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (!databaseTheme || !isThemeMode(databaseTheme)) return;
    const local = readThemeFromStorage();
    const next = reconcileThemePreference({ local, database: databaseTheme });
    if (next === local) return;
    writeThemeToStorage(next);
    applyThemeToDocument(next);
    notifyThemeListeners();
  }, [databaseTheme]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readThemeFromStorage() === "system") {
        applyThemeToDocument("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      writeThemeToStorage(mode);
      applyThemeToDocument(mode);
      notifyThemeListeners();
      if (persistAction) {
        startTransition(() => {
          void persistAction(mode);
        });
      }
    },
    [persistAction],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, pending }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

export function useThemeOptional() {
  return useContext(ThemeContext);
}
