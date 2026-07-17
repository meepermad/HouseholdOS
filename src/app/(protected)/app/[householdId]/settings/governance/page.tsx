import { LEGAL_COORDINATION_NOTICE } from "@/lib/governance/types";
import Link from "next/link";

export default async function GovernanceSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Governance settings</h1>
      <p className="text-sm text-text-secondary">{LEGAL_COORDINATION_NOTICE}</p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-text-secondary">
        <li>
          Active household members can view household-wide active policies.
        </li>
        <li>
          Financial coordinator status does not grant broad governance override.
        </li>
        <li>
          Coordinator override always requires a reason and is audited separately
          from individual approvals.
        </li>
        <li>
          Move-out workflows never remove membership by themselves — an authorized
          completion action is required, and membership removal remains a separate
          membership action.
        </li>
      </ul>
      <Link
        href={`/app/${householdId}/governance`}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm"
      >
        Back to governance
      </Link>
    </div>
  );
}
