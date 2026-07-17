import { notFound } from "next/navigation";
import {
  getVersionWithSections,
} from "@/lib/governance/queries";
import { compareGovernanceVersions } from "@/lib/governance/compare";
import { GovernanceVersionCompareView } from "@/components/governance/GovernanceVersionCompareView";
import type { GovernanceSectionInput } from "@/lib/governance/types";

export default async function CompareGovernanceVersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string; documentId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { householdId, documentId } = await params;
  const { from, to } = await searchParams;
  if (!from || !to) notFound();
  const [before, after] = await Promise.all([
    getVersionWithSections(from),
    getVersionWithSections(to),
  ]);
  if (!before || !after) notFound();
  if (
    before.version.document_id !== documentId ||
    after.version.document_id !== documentId ||
    before.version.household_id !== householdId
  ) {
    notFound();
  }

  const mapSections = (
    rows: Array<{
      section_type: string;
      heading: string | null;
      body: string | null;
      payload: Record<string, unknown> | null;
    }>,
  ): GovernanceSectionInput[] =>
    rows.map((s) => ({
      section_type: s.section_type as GovernanceSectionInput["section_type"],
      heading: s.heading,
      body: s.body,
      payload: s.payload ?? {},
    }));

  const comparison = compareGovernanceVersions(
    {
      title: before.version.title,
      summary: before.version.summary,
      effectiveAt: before.version.effective_at,
      expiresAt: before.version.expires_at,
      reviewAt: before.version.review_at,
      approvalRules: before.version.approval_rules ?? {},
      acknowledgmentRules: before.version.acknowledgment_rules ?? {},
      sections: mapSections(before.sections),
    },
    {
      title: after.version.title,
      summary: after.version.summary,
      effectiveAt: after.version.effective_at,
      expiresAt: after.version.expires_at,
      reviewAt: after.version.review_at,
      approvalRules: after.version.approval_rules ?? {},
      acknowledgmentRules: after.version.acknowledgment_rules ?? {},
      sections: mapSections(after.sections),
    },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Version comparison</h1>
      <p className="text-sm text-text-secondary">
        v{before.version.version_number} → v{after.version.version_number}
      </p>
      <GovernanceVersionCompareView comparison={comparison} />
    </div>
  );
}
