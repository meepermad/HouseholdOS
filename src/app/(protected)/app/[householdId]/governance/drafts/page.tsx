import Link from "next/link";
import { listGovernanceDocuments } from "@/lib/governance/queries";
import { GovernanceStatusBadge } from "@/components/governance/GovernanceStatusBadge";
import type { GovernanceStatus } from "@/lib/governance/types";

export default async function GovernanceDraftsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const docs = await listGovernanceDocuments(householdId);
  const drafts = docs.filter((d) =>
    ["draft", "rejected", "withdrawn", "proposed", "under_review"].includes(
      d.status,
    ),
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Drafts &amp; in review</h1>
        <Link
          href={`/app/${householdId}/governance/new`}
          className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          New draft
        </Link>
      </div>
      <ul className="space-y-2">
        {drafts.map((doc) => (
          <li key={doc.id}>
            <Link
              href={`/app/${householdId}/governance/documents/${doc.id}`}
              className="flex items-center justify-between rounded-md border border-border px-3 py-3"
            >
              <span className="font-medium">{doc.title}</span>
              <GovernanceStatusBadge status={doc.status as GovernanceStatus} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
