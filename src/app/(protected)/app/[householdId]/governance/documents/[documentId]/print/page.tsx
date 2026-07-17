import { notFound } from "next/navigation";
import { getGovernanceDocument } from "@/lib/governance/queries";
import {
  exportGovernancePrintableHtml,
  type ExportDocument,
} from "@/lib/governance/export";
import type { GovernanceSectionInput } from "@/lib/governance/types";

export default async function PrintGovernanceDocumentPage({
  params,
}: {
  params: Promise<{ householdId: string; documentId: string }>;
}) {
  const { householdId, documentId } = await params;
  const detail = await getGovernanceDocument(documentId);
  if (!detail?.document || detail.document.household_id !== householdId) {
    notFound();
  }
  const exportDoc: ExportDocument = {
    id: detail.document.id,
    householdId,
    title: detail.document.title,
    summary: detail.document.summary,
    status: detail.document.status,
    documentClass: detail.document.document_class,
    versionNumber: detail.version?.version_number ?? 1,
    contentHash: detail.version?.content_hash ?? "",
    effectiveAt: detail.version?.effective_at ?? null,
    sections: detail.sections.map(
      (s: {
        section_type: string;
        heading: string | null;
        body: string | null;
        payload: Record<string, unknown> | null;
      }) =>
        ({
          section_type: s.section_type,
          heading: s.heading,
          body: s.body,
          payload: s.payload ?? {},
        }) as GovernanceSectionInput,
    ),
  };
  const html = exportGovernancePrintableHtml(exportDoc);
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
