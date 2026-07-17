import Link from "next/link";
import { listGovernanceDocuments } from "@/lib/governance/queries";
import { GovernanceStatusBadge } from "@/components/governance/GovernanceStatusBadge";
import type { GovernanceStatus } from "@/lib/governance/types";

export default async function GovernanceActivePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const docs = await listGovernanceDocuments(householdId, { status: "active" });
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Active policies</h1>
      <ul className="space-y-2">
        {docs.map((doc) => (
          <li key={doc.id}>
            <Link
              href={`/app/${householdId}/governance/documents/${doc.id}`}
              className="flex items-center justify-between rounded-md border border-border px-3 py-3"
            >
              <div>
                <p className="font-medium">{doc.title}</p>
                {doc.summary ? (
                  <p className="text-sm text-text-secondary">{doc.summary}</p>
                ) : null}
              </div>
              <GovernanceStatusBadge status={doc.status as GovernanceStatus} />
            </Link>
          </li>
        ))}
      </ul>
      {docs.length === 0 ? (
        <p className="text-sm text-text-secondary">No active documents.</p>
      ) : null}
    </div>
  );
}
