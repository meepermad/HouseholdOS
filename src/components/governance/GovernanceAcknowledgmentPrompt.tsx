"use client";

import { ActionForm } from "@/components/action-form";
import { acknowledgeGovernanceAction } from "@/app/actions/governance";

type Props = {
  householdId: string;
  versionId: string;
  documentTitle: string;
};

export function GovernanceAcknowledgmentPrompt({
  householdId,
  versionId,
  documentTitle,
}: Props) {
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <h2 className="text-lg font-semibold">Acknowledge receipt</h2>
      <p className="text-sm text-text-secondary">
        Confirm you have reviewed <strong>{documentTitle}</strong>. This records
        acknowledgment of receipt — not legal consent — unless your household also
        used a separate approval workflow.
      </p>
      <p className="text-xs text-text-secondary">
        Opening or viewing this page is not acknowledgment.
      </p>
      <ActionForm action={acknowledgeGovernanceAction} className="space-y-2">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="versionId" value={versionId} />
        <textarea
          name="comment"
          className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Optional note"
        />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          I acknowledge receipt
        </button>
      </ActionForm>
    </div>
  );
}
