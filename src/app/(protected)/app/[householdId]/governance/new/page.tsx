"use client";

import { ActionForm } from "@/components/action-form";
import { createGovernanceDocumentAction } from "@/app/actions/governance";
import {
  GOVERNANCE_DOCUMENT_CLASSES,
  DOCUMENT_CLASS_LABELS,
  LEGAL_COORDINATION_NOTICE,
} from "@/lib/governance/types";
import { useParams } from "next/navigation";

export default function NewGovernanceDocumentPage() {
  const params = useParams<{ householdId: string }>();
  const householdId = params.householdId;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">New governance draft</h1>
      <p className="text-sm text-text-secondary">{LEGAL_COORDINATION_NOTICE}</p>
      <ActionForm action={createGovernanceDocumentAction} className="space-y-4">
        <input type="hidden" name="householdId" value={householdId} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">Document type</span>
          <select
            name="documentClass"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            defaultValue="custom"
          >
            {GOVERNANCE_DOCUMENT_CLASSES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CLASS_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Title</span>
          <input
            name="title"
            required
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Summary</span>
          <textarea
            name="summary"
            className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isFinancial" value="true" />
          Mark as financial policy (financial coordinators may be required)
        </label>
        <input
          type="hidden"
          name="sectionsJson"
          value={JSON.stringify([
            {
              section_type: "explanatory_text",
              heading: "Overview",
              body: "",
            },
          ])}
        />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Create draft
        </button>
      </ActionForm>
    </div>
  );
}
