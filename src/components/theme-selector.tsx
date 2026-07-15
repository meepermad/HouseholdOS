"use client";

import { useTheme } from "@/components/theme-provider";
import type { ThemeMode } from "@/lib/theme/types";
import { THEME_MODES } from "@/lib/theme/types";

const LABELS: Record<ThemeMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function ThemeSelector({
  id = "theme-selector",
  className,
}: {
  id?: string;
  className?: string;
}) {
  const { theme, setTheme, pending } = useTheme();

  return (
    <fieldset
      className={className}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      <legend className="mb-2 text-sm font-medium text-text-primary">
        Appearance
      </legend>
      <p className="mb-3 text-sm text-text-muted">
        Choose light, dark, or match your device settings.
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="flex flex-col gap-2 sm:flex-row"
        id={id}
      >
        <span id={`${id}-label`} className="sr-only">
          Theme
        </span>
        {THEME_MODES.map((mode) => {
          const selected = theme === mode;
          return (
            <label
              key={mode}
              className={
                selected
                  ? "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-2 border-primary bg-surface-interactive px-3 py-2 text-sm font-medium text-text-primary"
                  : "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-secondary hover:bg-surface-interactive"
              }
            >
              <input
                type="radio"
                name={id}
                value={mode}
                checked={selected}
                onChange={() => setTheme(mode)}
                className="size-4 accent-[var(--primary)]"
              />
              {LABELS[mode]}
            </label>
          );
        })}
      </div>
      {pending ? (
        <p className="mt-2 text-sm text-text-muted" aria-live="polite">
          Saving appearance…
        </p>
      ) : null}
    </fieldset>
  );
}
