import { assertActiveMembership } from "@/lib/household-context";
import { listPendingAcknowledgments } from "@/lib/governance/queries";
import { GovernanceAcknowledgmentPrompt } from "@/components/governance/GovernanceAcknowledgmentPrompt";

export default async function GovernanceAcknowledgmentsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const membership = await assertActiveMembership(householdId);
  const rows = await listPendingAcknowledgments(
    householdId,
    membership.membershipId,
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Pending acknowledgments</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Nothing waiting for your acknowledgment.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row: {
            id: string;
            version_id: string;
            governance_documents:
              | { id: string; title: string }
              | null;
          }) => {
            const doc = row.governance_documents;
            return (
              <GovernanceAcknowledgmentPrompt
                key={row.id}
                householdId={householdId}
                versionId={row.version_id}
                documentTitle={doc?.title ?? "Household document"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
