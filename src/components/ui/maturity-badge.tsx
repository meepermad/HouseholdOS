import {
  maturityLabel,
  type FeatureMaturity,
} from "@/lib/launch/feature-maturity";

const tone: Record<Exclude<FeatureMaturity, "stable">, string> = {
  beta: "bg-info-soft text-info border-info/40",
  preview: "bg-warning-soft text-warning border-warning/40",
  unavailable: "bg-surface-secondary text-text-muted border-border-strong",
};

/**
 * Small honesty chip next to a feature's name. Renders nothing for stable
 * features so shipped surfaces stay quiet.
 */
export function MaturityBadge({
  status,
  className = "",
}: {
  status: FeatureMaturity;
  className?: string;
}) {
  const label = maturityLabel(status);
  if (!label || status === "stable") return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${tone[status]} ${className}`}
      data-testid="maturity-badge"
      data-maturity={status}
    >
      <span className="sr-only">Maturity: </span>
      {label}
    </span>
  );
}

/** Inline sentence for the limit, for use under a heading or row. */
export function MaturityNote({
  note,
  className = "",
}: {
  note: string;
  className?: string;
}) {
  return (
    <p className={`text-xs text-text-muted ${className}`} data-testid="maturity-note">
      {note}
    </p>
  );
}
