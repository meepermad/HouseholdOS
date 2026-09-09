"use client";

import { useRef, useState, useTransition } from "react";
import {
  applyRepasteReceiptAction,
  previewRepasteReceiptAction,
} from "@/app/actions/receipts";
import { formatCentsAsUsd } from "@/lib/receipts/currency";
import { isReceiptRepasteEditable } from "@/lib/receipts/paste/display-description";
import {
  REPASTE_CHANGE_LABELS,
  type RepasteDiffRow,
} from "@/lib/receipts/paste/repaste-diff";
import type { DescriptionChoice, RepastePlan } from "@/lib/receipts/paste/repaste-plan";

export type TranscriptionRevisionSummary = {
  id: string;
  revisionNumber: number;
  createdAt: string;
  reason: "initial_paste" | "user_repaste";
  active: boolean;
  sourceText: string;
};

type Step = "closed" | "editor" | "diff" | "history";

type IntakeSource = "upload" | "camera" | "paste" | null;

type Props = {
  householdId: string;
  receiptId: string;
  status: string;
  expenseId?: string | null;
  originalTranscription: string | null;
  transcriptionCorrected?: boolean;
  revisionCount?: number;
  revisions?: TranscriptionRevisionSummary[];
  claiming?: boolean;
  intakeSource?: IntakeSource;
  /** Confirmed receipts only show re-paste from Advanced. */
  variant?: "inline" | "advanced";
};

function looksLikeHouseholdOsPaste(text: string | null | undefined) {
  return /householdos\s+receipt/i.test(text ?? "");
}

function seedRepasteText(
  prefill: string | undefined,
  originalTranscription: string | null,
  intakeSource: IntakeSource,
) {
  if (prefill != null) return prefill;
  const seed = originalTranscription ?? "";
  if (!seed.trim()) return "";
  if (
    intakeSource === "paste" ||
    looksLikeHouseholdOsPaste(seed) ||
    seed.includes("|")
  ) {
    return seed;
  }
  return "";
}

function sourceCopy(opts: {
  intakeSource?: IntakeSource;
  transcriptionCorrected: boolean;
}) {
  if (opts.intakeSource === "camera") return "Source: Camera";
  if (opts.intakeSource === "upload") return "Source: Uploaded photo";
  if (opts.intakeSource === "paste" || opts.intakeSource == null) {
    return `Source: Pasted transcription${opts.transcriptionCorrected ? " · corrected" : ""}`;
  }
  return null;
}

export function ReceiptRepastePanel({
  householdId,
  receiptId,
  status,
  originalTranscription,
  transcriptionCorrected = false,
  revisionCount = 0,
  revisions = [],
  claiming = false,
  intakeSource = null,
  variant = "inline",
}: Props) {
  const editable = isReceiptRepasteEditable(status);
  const confirmed = status === "confirmed";
  const showRepaste = editable || (confirmed && variant === "advanced");
  const [step, setStep] = useState<Step>("closed");
  const [text, setText] = useState(originalTranscription ?? "");
  const [plan, setPlan] = useState<RepastePlan | null>(null);
  const [acceptedRemoved, setAcceptedRemoved] = useState<string[]>([]);
  const [descriptionChoices, setDescriptionChoices] = useState<
    Record<string, DescriptionChoice>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showTranscription, setShowTranscription] = useState(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const visibleRows = (plan?.rows ?? []).filter((row) => {
    if (row.kind === "description_changed" && row.unchanged) return true;
    return !row.unchanged;
  });

  function openEditor(prefill?: string) {
    idempotencyKeyRef.current = crypto.randomUUID();
    setText(seedRepasteText(prefill, originalTranscription, intakeSource));
    setPlan(null);
    setMessage(null);
    setAcceptedRemoved([]);
    setDescriptionChoices({});
    setStep("editor");
  }

  function readCorrected() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("receiptId", receiptId);
      fd.set("originalText", text);
      const res = await previewRepasteReceiptAction(null, fd);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      try {
        const next = JSON.parse(res.previewJson) as RepastePlan;
        setPlan(next);
        setStep("diff");
        setMessage(null);
      } catch {
        setMessage("Could not read that receipt. Try again.");
      }
    });
  }

  function apply() {
    if (!plan) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("receiptId", receiptId);
      fd.set("originalText", text);
      fd.set("idempotencyKey", idempotencyKeyRef.current);
      fd.set("acceptedRemovedLineIds", acceptedRemoved.join(","));
      fd.set("descriptionChoicesJson", JSON.stringify(descriptionChoices));
      const res = await applyRepasteReceiptAction(null, fd);
      if (!res.ok) {
        setMessage(res.error ?? "Could not apply the corrected receipt.");
        return;
      }
      const amendmentExpenseId = res.data?.amendmentExpenseId;
      if (amendmentExpenseId) {
        window.location.assign(
          `/app/${householdId}/money/expenses/${amendmentExpenseId}/edit`,
        );
        return;
      }
      setStep("closed");
      setPlan(null);
      window.location.reload();
    });
  }

  if (confirmed && variant !== "advanced") {
    const source = sourceCopy({ intakeSource, transcriptionCorrected });
    return (
      <div className="mt-3 space-y-2" data-testid="receipt-correct-finalized">
        {source ? <p className="text-sm text-text-secondary">{source}</p> : null}
        <p className="text-sm text-text-secondary">
          To paste a corrected receipt, open Advanced.
        </p>
      </div>
    );
  }

  if (!showRepaste) return null;

  return (
    <div
      className={variant === "advanced" ? "space-y-2" : "mt-3 space-y-2"}
      data-testid="receipt-repaste-panel"
    >
      {variant !== "advanced" ? (
        <p className="text-sm text-text-secondary" data-testid="receipt-paste-source-label">
          {sourceCopy({ intakeSource, transcriptionCorrected })}
        </p>
      ) : (
        <p className="text-sm text-text-secondary">
          Paste a corrected receipt. This starts a correction so the submitted
          expense stays on record. You&apos;ll assign items on that correction
          before it replaces the original.
        </p>
      )}
      {revisionCount > 1 ? (
        <p className="text-xs text-text-muted">
          {revisionCount} transcription versions
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {originalTranscription ? (
          <button
            type="button"
            className="min-h-11 rounded-md border border-border px-3 text-sm"
            data-testid="receipt-view-original"
            onClick={() => setShowTranscription((v) => !v)}
          >
            {showTranscription ? "Hide transcription" : "View transcription"}
          </button>
        ) : null}
        {variant === "advanced" ? (
          <button
            type="button"
            className="min-h-11 rounded-md border border-border px-3 text-left text-sm"
            data-testid="receipt-repaste"
            onClick={() => openEditor()}
          >
            Re-paste receipt
          </button>
        ) : (
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 font-medium" data-testid="receipt-more-menu">
              More
            </summary>
            <div className="mt-1 flex flex-col gap-2">
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-3 text-left text-sm"
                data-testid="receipt-repaste"
                onClick={() => openEditor()}
              >
                Re-paste receipt
              </button>
              {revisions.length > 0 ? (
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-border px-3 text-left text-sm"
                  data-testid="receipt-transcription-history"
                  onClick={() => setStep("history")}
                >
                  View transcription history
                </button>
              ) : null}
            </div>
          </details>
        )}
        {variant === "advanced" && revisions.length > 0 ? (
          <button
            type="button"
            className="min-h-11 rounded-md border border-border px-3 text-left text-sm"
            data-testid="receipt-transcription-history"
            onClick={() => setStep("history")}
          >
            View transcription history
          </button>
        ) : null}
      </div>
      {showTranscription && originalTranscription ? (
        <div className="space-y-2">
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs">
            {originalTranscription}
          </pre>
          <button
            type="button"
            className="text-sm font-medium text-primary"
            data-testid="receipt-repaste-from-original"
            onClick={() => openEditor()}
          >
            Re-paste corrected version
          </button>
        </div>
      ) : null}

      {step === "history" ? (
        <section
          className="rounded-md border border-border bg-surface p-3"
          data-testid="receipt-transcription-history-list"
        >
          <h2 className="text-base font-semibold">Transcription history</h2>
          <ul className="mt-2 space-y-3">
            {revisions.map((rev) => (
              <li key={rev.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">
                  {rev.active ? "Current" : "Earlier version"} ·{" "}
                  {rev.reason === "initial_paste" ? "Initial paste" : "Corrected paste"}
                </p>
                <p className="text-text-muted">
                  {new Date(rev.createdAt).toLocaleString()}
                </p>
                {!rev.active ? (
                  <button
                    type="button"
                    className="mt-2 min-h-11 rounded-md border border-border px-3"
                    data-testid={`receipt-restore-${rev.id}`}
                    onClick={() => openEditor(rev.sourceText)}
                  >
                    Restore this version
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 min-h-11 text-sm"
            onClick={() => setStep("closed")}
          >
            Close
          </button>
        </section>
      ) : null}

      {step === "editor" ? (
        <section
          className="rounded-md border border-border bg-surface p-3"
          data-testid="receipt-repaste-editor"
        >
          <h2 className="text-base font-semibold">Correct receipt transcription</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {confirmed
              ? "Paste a corrected version of this receipt. You'll review the changes, then assign items on a correction draft so the submitted expense stays on record."
              : "Paste a corrected version of this receipt. You'll review the changes before anything is replaced."}
          </p>
          {claiming ? (
            <p className="mt-2 text-sm text-text-secondary" data-testid="receipt-repaste-claiming-warning">
              Roommates may already be claiming items. Changes will be reviewed before applying.
            </p>
          ) : null}
          <textarea
            className="mt-3 min-h-48 w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            data-testid="receipt-repaste-textarea"
          />
          {message ? (
            <p className="mt-2 text-sm text-text-secondary" role="status">
              {message}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              data-testid="receipt-read-corrected"
              disabled={pending}
              onClick={readCorrected}
            >
              Read corrected receipt
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-4 text-sm"
              data-testid="receipt-repaste-cancel"
              onClick={() => {
                setStep("closed");
                setPlan(null);
                setMessage(null);
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {step === "diff" && plan ? (
        <section
          className="rounded-md border border-border bg-surface p-3"
          data-testid="receipt-repaste-diff"
        >
          <h2 className="text-base font-semibold">Here&apos;s what changed</h2>
          {plan.claimingWarning ? (
            <p className="mt-2 text-sm text-text-secondary">{plan.claimingWarning}</p>
          ) : null}
          <ul className="mt-3 space-y-3">
            {visibleRows.map((row, index) => (
              <DiffRowView
                key={`${row.kind}-${row.lineId ?? row.incomingIndex ?? index}`}
                row={row}
              />
            ))}
          </ul>
          {plan.descriptionConflicts.map((conflict) => (
            <div
              key={conflict.lineId}
              className="mt-3 rounded-md border border-border p-3 text-sm"
              data-testid={`receipt-name-conflict-${conflict.lineId}`}
            >
              <p>Current name: {conflict.currentName}</p>
              <p>Corrected transcription: {conflict.newName}</p>
              <div className="mt-2 flex flex-col gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-border px-3"
                  onClick={() =>
                    setDescriptionChoices((prev) => ({ ...prev, [conflict.lineId]: "use_new" }))
                  }
                >
                  Use corrected
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-border px-3"
                  onClick={() =>
                    setDescriptionChoices((prev) => ({
                      ...prev,
                      [conflict.lineId]: "keep_current",
                    }))
                  }
                >
                  Keep mine
                </button>
              </div>
            </div>
          ))}
          {plan.claimedRemovals.map((row) => (
            <label
              key={row.lineId}
              className="mt-3 flex min-h-11 items-start gap-2 text-sm"
              data-testid={`receipt-remove-claim-${row.lineId}`}
            >
              <input
                type="checkbox"
                className="mt-1 size-5"
                checked={acceptedRemoved.includes(row.lineId)}
                onChange={(e) =>
                  setAcceptedRemoved((prev) =>
                    e.target.checked
                      ? [...prev, row.lineId]
                      : prev.filter((id) => id !== row.lineId),
                  )
                }
              />
              <span>
                {row.name} currently belongs to {row.belongsTo}. This corrected receipt
                removes it.
              </span>
            </label>
          ))}
          {plan.reconciliation.copy ? (
            <p className="mt-3 text-sm text-text-secondary" data-testid="receipt-repaste-unbalanced">
              {plan.reconciliation.copy}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-text-secondary">
            {plan.financialChanged
              ? plan.confirmationCopy
              : "Only item names changed. Existing assignments can be kept."}
          </p>
          {message ? (
            <p className="mt-2 text-sm text-text-secondary" role="status">
              {message}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              data-testid="receipt-use-corrected"
              disabled={
                pending ||
                !plan.reconciliation.balanced ||
                plan.claimedRemovals.some((row) => !acceptedRemoved.includes(row.lineId))
              }
              onClick={apply}
            >
              Use corrected receipt
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-4 text-sm"
              data-testid="receipt-keep-current"
              onClick={() => {
                setStep("closed");
                setPlan(null);
                setMessage(null);
              }}
            >
              Keep current receipt
            </button>
            <button
              type="button"
              className="min-h-11 text-sm"
              onClick={() => setStep("editor")}
            >
              Edit transcription
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DiffRowView({ row }: { row: RepasteDiffRow }) {
  return (
    <li className="text-sm" data-testid={`receipt-diff-${row.kind}`}>
      <p className="font-medium">{row.label}</p>
      <pre className="mt-1 whitespace-pre-wrap text-text-secondary">{row.detail}</pre>
      {row.kind !== "merchant_changed" &&
      row.kind !== "date_changed" &&
      row.kind !== "total_changed" &&
      row.kind !== "subtotal_changed" &&
      row.kind !== "tax_changed" &&
      row.kind !== "tip_changed" &&
      row.kind !== "fees_changed" &&
      row.kind !== "discount_changed" ? (
        <p className="mt-1 text-text-muted">
          {row.unchanged ? "No change" : REPASTE_CHANGE_LABELS[row.kind]}
        </p>
      ) : null}
      {row.oldCents != null && row.newCents != null && row.oldCents !== row.newCents ? (
        <p className="tabular-nums text-text-secondary">
          {formatCentsAsUsd(row.oldCents)} → {formatCentsAsUsd(row.newCents)}
        </p>
      ) : null}
    </li>
  );
}
