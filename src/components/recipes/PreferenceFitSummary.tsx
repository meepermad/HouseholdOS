import type { PreferenceFitSummary as PreferenceFit } from "@/lib/meals/types";

const FIT_LABELS: Record<PreferenceFit, string> = {
  strong: "Strong fit",
  positive: "Positive fit",
  neutral: "Neutral fit",
  mixed: "Mixed fit",
  negative: "Negative fit",
  conflict: "Conflicting preferences",
  unknown: "Preference fit unknown",
};

const FIT_TONE: Record<PreferenceFit, string> = {
  strong:
    "border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  positive:
    "border-emerald-600/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200",
  neutral: "border-border bg-surface-secondary text-text-secondary",
  mixed:
    "border-amber-600/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  negative:
    "border-rose-600/40 bg-rose-500/10 text-rose-900 dark:text-rose-200",
  conflict:
    "border-rose-600/50 bg-rose-500/15 text-rose-900 dark:text-rose-200",
  unknown: "border-border bg-surface text-text-muted",
};

export function PreferenceFitSummary({
  fit,
  className = "",
}: {
  fit: PreferenceFit | string | null | undefined;
  className?: string;
}) {
  const value = (fit && fit in FIT_LABELS ? fit : "unknown") as PreferenceFit;
  return (
    <p
      className={`inline-flex min-h-8 items-center rounded-md border px-2.5 py-1 text-sm ${FIT_TONE[value]} ${className}`}
      role="status"
      aria-label={FIT_LABELS[value]}
    >
      {FIT_LABELS[value]}
    </p>
  );
}
