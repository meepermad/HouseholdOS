"use client";

import { ActionForm } from "@/components/action-form";
import {
  activateGovernanceAction,
  overrideGovernanceApprovalAction,
  proposeGovernanceAction,
  respondApprovalAction,
} from "@/app/actions/governance";

type Props = {
  householdId: string;
  documentId: string;
  versionId: string | null;
  approvalRequestId: string | null;
  approvalStatus: {
    can_advance?: boolean;
    reason?: string;
    approve_count?: number;
    reject_count?: number;
    abstain_count?: number;
    changes_count?: number;
    pending_count?: number;
    quorum?: number;
  } | null;
  documentStatus: string;
  canActivate: boolean;
  canOverride: boolean;
};

export function GovernanceApprovalPanel({
  householdId,
  documentId,
  versionId,
  approvalRequestId,
  approvalStatus,
  documentStatus,
  canActivate,
  canOverride,
}: Props) {
  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <h2 className="text-lg font-semibold">Review &amp; approval</h2>
      {approvalStatus ? (
        <ul className="space-y-1 text-sm text-text-secondary">
          <li>Approvals: {approvalStatus.approve_count ?? 0}</li>
          <li>Rejections: {approvalStatus.reject_count ?? 0}</li>
          <li>Abstentions: {approvalStatus.abstain_count ?? 0} (not counted as approval)</li>
          <li>Changes requested: {approvalStatus.changes_count ?? 0}</li>
          <li>Pending: {approvalStatus.pending_count ?? 0}</li>
          <li>Quorum: {approvalStatus.quorum ?? 1}</li>
          <li>
            {approvalStatus.can_advance
              ? "Ready to advance"
              : approvalStatus.reason ?? "Cannot advance yet"}
          </li>
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">
          No open approval request. Propose a draft to start review.
        </p>
      )}

      {(documentStatus === "draft" ||
        documentStatus === "rejected" ||
        documentStatus === "withdrawn") && (
        <ActionForm action={proposeGovernanceAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="documentId" value={documentId} />
          {versionId ? (
            <input type="hidden" name="versionId" value={versionId} />
          ) : null}
          <button
            type="submit"
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Propose for review
          </button>
        </ActionForm>
      )}

      {approvalRequestId ? (
        <div className="space-y-3">
          <ActionForm action={respondApprovalAction} className="space-y-2">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="requestId" value={approvalRequestId} />
            <label className="block space-y-1 text-sm">
              <span>Your response</span>
              <select
                name="decision"
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
                defaultValue="approve"
              >
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="abstain">Abstain</option>
                <option value="request_changes">Request changes</option>
              </select>
            </label>
            <textarea
              name="comment"
              className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Optional comment"
            />
            <button
              type="submit"
              className="min-h-11 rounded-md border border-border px-4 text-sm"
            >
              Submit response
            </button>
          </ActionForm>

          {canOverride ? (
            <ActionForm
              action={overrideGovernanceApprovalAction}
              className="space-y-2 border-t border-border pt-3"
            >
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="requestId" value={approvalRequestId} />
              <p className="text-sm text-text-secondary">
                Coordinator override records an explicit override outcome. It never
                fabricates individual approvals.
              </p>
              <textarea
                name="reason"
                required
                className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                placeholder="Required override reason"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="activate" value="true" />
                Also activate after override
              </label>
              <button
                type="submit"
                className="min-h-11 rounded-md border border-amber-600 px-4 text-sm text-amber-800"
              >
                Coordinator override
              </button>
            </ActionForm>
          ) : null}
        </div>
      ) : null}

      {canActivate && documentStatus === "approved" ? (
        <ActionForm action={activateGovernanceAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="documentId" value={documentId} />
          {versionId ? (
            <input type="hidden" name="versionId" value={versionId} />
          ) : null}
          <button
            type="submit"
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Activate approved version
          </button>
        </ActionForm>
      ) : null}
    </div>
  );
}
