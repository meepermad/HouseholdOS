import { resolveColorScheme } from "./resolve";
import type { ThemeMode } from "./types";
import { THEME_STORAGE_KEY } from "./types";

export function applyThemeToDocument(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const prefersDark =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false;
  const resolved = resolveColorScheme(mode, prefersDark);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  document.documentElement.dataset.theme = mode;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      "content",
      resolved === "dark" ? "#0f1419" : "#f3efe6",
    );
  }
}

export function readThemeFromStorage(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* private mode */
  }
  return "system";
}

export function writeThemeToStorage(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* private mode */
  }
}

/** Inline script body — keep in sync with applyThemeToDocument. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var m=localStorage.getItem(k);if(m!=="light"&&m!=="dark"&&m!=="system")m="system";var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";r.dataset.theme=m;var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",d?"#0f1419":"#f3efe6");}catch(e){}})();`;
