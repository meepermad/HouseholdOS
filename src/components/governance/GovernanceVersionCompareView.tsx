import type { VersionComparison } from "@/lib/governance/compare";

export function GovernanceVersionCompareView({
  comparison,
}: {
  comparison: VersionComparison;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">What changed</h2>
      {!comparison.materialChange ? (
        <p className="text-sm text-text-secondary">No material differences.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {comparison.titleChanged ? <li>Title changed</li> : null}
          {comparison.summaryChanged ? <li>Summary changed</li> : null}
          {comparison.approvalRulesChanged ? <li>Approval rules changed</li> : null}
          {comparison.acknowledgmentRulesChanged ? (
            <li>Acknowledgment rules changed</li>
          ) : null}
          {comparison.effectiveDatesChanged ? (
            <li>Effective / review dates changed</li>
          ) : null}
          {comparison.sections
            .filter((s) => s.kind !== "unchanged")
            .map((s) => (
              <li key={`${s.kind}-${s.position}`}>
                <span className="font-medium capitalize">{s.kind}</span> section
                {s.heading ? `: ${s.heading}` : ""}{" "}
                <span className="text-text-secondary">({s.sectionType})</span>
                {s.kind === "changed" ? (
                  <div className="mt-1 grid gap-2 md:grid-cols-2">
                    <pre className="whitespace-pre-wrap rounded bg-surface-muted p-2 text-xs">
                      {s.beforeBody || "(empty)"}
                    </pre>
                    <pre className="whitespace-pre-wrap rounded bg-surface-muted p-2 text-xs">
                      {s.afterBody || "(empty)"}
                    </pre>
                  </div>
                ) : null}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
