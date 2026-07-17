import { resolveDomainProjection } from "@/lib/calendar/domain-projections";

export function DomainSourceBadge({ sourceType }: { sourceType: string }) {
  const meta = resolveDomainProjection(sourceType);
  return (
    <span
      className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary"
      title={meta.readOnlyExplanation ?? meta.label}
    >
      {meta.badge}
    </span>
  );
}
