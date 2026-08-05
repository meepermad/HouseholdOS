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
import {
  parseStoredTheme,
  reconcileThemePreference,
} from "@/lib/theme/resolve";
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

function readExplicitLocalTheme(): ThemeMode | null {
  try {
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function ThemeProvider({
  children,
  databaseTheme,
  loadDatabaseTheme,
  persistAction,
}: {
  children: ReactNode;
  /** Synchronous DB theme when already known (optional). */
  databaseTheme?: ThemeMode | null;
  /**
   * Async DB theme loader — runs after paint so auth/theme never blocks the document.
   * Applied only when localStorage has no explicit preference.
   */
  loadDatabaseTheme?: () => Promise<ThemeMode | null>;
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

  const applyDatabaseTheme = useCallback((db: ThemeMode | null | undefined) => {
    if (!db || !isThemeMode(db)) return;
    const local = readExplicitLocalTheme();
    if (local !== null) return; // local wins — do not overwrite
    const next = reconcileThemePreference({ local, database: db });
    const current = readThemeFromStorage();
    if (next === current) return;
    writeThemeToStorage(next);
    applyThemeToDocument(next);
    notifyThemeListeners();
  }, []);

  useEffect(() => {
    applyDatabaseTheme(databaseTheme);
  }, [databaseTheme, applyDatabaseTheme]);

  useEffect(() => {
    if (!loadDatabaseTheme) return;
    let cancelled = false;
    void loadDatabaseTheme().then((db) => {
      if (cancelled) return;
      applyDatabaseTheme(db);
    });
    return () => {
      cancelled = true;
    };
  }, [loadDatabaseTheme, applyDatabaseTheme]);

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
