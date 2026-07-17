import Link from "next/link";
import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { getGovernanceDocument } from "@/lib/governance/queries";
import { LEGAL_COORDINATION_NOTICE } from "@/lib/governance/types";
import { GovernanceStatusBadge } from "@/components/governance/GovernanceStatusBadge";
import { GovernanceApprovalPanel } from "@/components/governance/GovernanceApprovalPanel";
import type { GovernanceStatus } from "@/lib/governance/types";

export default async function GovernanceDocumentPage({
  params,
}: {
  params: Promise<{ householdId: string; documentId: string }>;
}) {
  const { householdId, documentId } = await params;
  const membership = await assertActiveMembership(householdId);
  const detail = await getGovernanceDocument(documentId);
  if (!detail?.document || detail.document.household_id !== householdId) {
    notFound();
  }
  const { document, version, sections, events, approvalRequest, approvalStatus } =
    detail;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-24">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{document.title}</h1>
          <GovernanceStatusBadge status={document.status as GovernanceStatus} />
        </div>
        {document.summary ? (
          <p className="text-sm text-text-secondary">{document.summary}</p>
        ) : null}
        <p className="text-xs text-text-secondary">{LEGAL_COORDINATION_NOTICE}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/${householdId}/governance/documents/${documentId}/edit`}
            className="min-h-11 rounded-md border border-border px-3 py-2 text-sm"
          >
            Edit draft
          </Link>
          {version?.prior_version_id ? (
            <Link
              href={`/app/${householdId}/governance/documents/${documentId}/compare?from=${version.prior_version_id}&to=${version.id}`}
              className="min-h-11 rounded-md border border-border px-3 py-2 text-sm"
            >
              Compare versions
            </Link>
          ) : null}
          <Link
            href={`/app/${householdId}/governance/documents/${documentId}/print`}
            className="min-h-11 rounded-md border border-border px-3 py-2 text-sm"
          >
            Printable view
          </Link>
        </div>
      </header>

      <article className="space-y-4">
        {sections.map(
          (s: {
            id: string;
            heading: string | null;
            body: string | null;
            section_type: string;
          }) => (
            <section key={s.id} className="space-y-1">
              {s.heading ? <h2 className="text-lg font-medium">{s.heading}</h2> : null}
              {s.body ? (
                <p className="whitespace-pre-wrap text-sm">{s.body}</p>
              ) : null}
              <p className="text-xs text-text-secondary">{s.section_type}</p>
            </section>
          ),
        )}
      </article>

      <GovernanceApprovalPanel
        householdId={householdId}
        documentId={documentId}
        versionId={version?.id ?? null}
        approvalRequestId={approvalRequest?.id ?? null}
        approvalStatus={approvalStatus}
        documentStatus={document.status}
        canActivate={can(membership.roles, "governance.activate")}
        canOverride={can(membership.roles, "governance.coordinator_override")}
      />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <ol className="space-y-2 border-l border-border pl-4">
          {events.map(
            (e: {
              id: string;
              event_type: string;
              body: string | null;
              created_at: string;
            }) => (
              <li key={e.id} className="text-sm">
                <p className="font-medium">{e.event_type.replaceAll("_", " ")}</p>
                {e.body ? (
                  <p className="text-text-secondary">{e.body}</p>
                ) : null}
                <p className="text-xs text-text-secondary">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </li>
            ),
          )}
        </ol>
      </section>
    </div>
  );
}
