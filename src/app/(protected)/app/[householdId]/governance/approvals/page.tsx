import Link from "next/link";
import { listOpenApprovalRequests } from "@/lib/governance/queries";

export default async function GovernanceApprovalsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const rows = await listOpenApprovalRequests(householdId);
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Pending approvals</h1>
      <ul className="space-y-2">
        {rows.map((row: {
          id: string;
          document_id: string;
          approval_mode: string;
          quorum: number;
          governance_documents:
            | { id: string; title: string }
            | null;
        }) => {
          const doc = row.governance_documents;
          return (
            <li key={row.id}>
              <Link
                href={`/app/${householdId}/governance/documents/${doc?.id ?? row.document_id}`}
                className="block rounded-md border border-border px-3 py-3"
              >
                <p className="font-medium">{doc?.title ?? "Document"}</p>
                <p className="text-sm text-text-secondary">
                  Mode: {row.approval_mode} · Quorum: {row.quorum}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">No open approval requests.</p>
      ) : null}
    </div>
  );
}
