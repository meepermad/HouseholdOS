import { notFound } from "next/navigation";
import { getGovernanceDocument } from "@/lib/governance/queries";
import { GovernanceDocumentEditor } from "@/components/governance/GovernanceDocumentEditor";
import type { GovernanceSectionInput, GovernanceVisibility } from "@/lib/governance/types";

export default async function EditGovernanceDocumentPage({
  params,
}: {
  params: Promise<{ householdId: string; documentId: string }>;
}) {
  const { householdId, documentId } = await params;
  const detail = await getGovernanceDocument(documentId);
  if (!detail?.document || detail.document.household_id !== householdId) {
    notFound();
  }
  const sections: GovernanceSectionInput[] = detail.sections.map(
    (s: {
      section_type: string;
      heading: string | null;
      body: string | null;
      payload: Record<string, unknown> | null;
    }) => ({
      section_type: s.section_type as GovernanceSectionInput["section_type"],
      heading: s.heading,
      body: s.body,
      payload: s.payload ?? {},
    }),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-24">
      <h1 className="text-2xl font-semibold">Edit draft</h1>
      <GovernanceDocumentEditor
        householdId={householdId}
        documentId={documentId}
        initialTitle={detail.document.title}
        initialSummary={detail.document.summary}
        initialVisibility={detail.document.visibility as GovernanceVisibility}
        initialSections={sections}
      />
    </div>
  );
}
