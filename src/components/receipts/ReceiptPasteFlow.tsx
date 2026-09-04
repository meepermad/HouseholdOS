"use client";

import { useMemo, useState, useTransition } from "react";
import { registerPastedReceiptAction } from "@/app/actions/receipts";
import { formatPastedUsd } from "@/lib/receipts/paste/cents";
import {
  CHATGPT_WORKFLOW_STEPS,
  RECEIPT_FORMAT_EXAMPLE,
  RECEIPT_FORMAT_PLACEHOLDER,
} from "@/lib/receipts/paste/format";
import {
  formatHumanDate,
  parseHouseholdOsReceipt,
  type ParsedPasteReceipt,
  type PasteMember,
} from "@/lib/receipts/paste/parse";
import { pasteStatusCopy, reconcilePastedReceipt } from "@/lib/receipts/paste/reconcile";
import { CurrencyAmountInput } from "@/components/ui/currency-field";

type Stage = "paste" | "preview";

export function ReceiptPasteFlow({
  householdId,
  members,
}: {
  householdId: string;
  members: PasteMember[];
}) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("paste");
  const [receipt, setReceipt] = useState<ParsedPasteReceipt | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionHref, setActionHref] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [showChatGpt, setShowChatGpt] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [editingAmounts, setEditingAmounts] = useState(false);
  const [payerId, setPayerId] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const parsedPreview = useMemo(
    () => (receipt ? reconcilePastedReceipt(receipt) : null),
    [receipt],
  );

  function readReceipt() {
    setMessage(null);
    const result = parseHouseholdOsReceipt(text, members);
    if (result.ok && result.receipt) {
      applyParsed(result.receipt, pasteStatusCopy(result.receipt, result.problems, reconcilePastedReceipt(result.receipt)));
      return;
    }
    if (result.quickCandidate) {
      applyParsed(result.quickCandidate, "We think this is a receipt.");
      return;
    }
    if (result.receipt) {
      applyParsed(
        result.receipt,
        result.problems[0]?.message ?? "We could not confidently understand part of this receipt.",
      );
      setShowRaw(true);
      return;
    }
    setMessage(!result.ok ? result.error.message : "We could not confidently understand part of this receipt.");
  }

  function applyParsed(next: ParsedPasteReceipt, nextStatus: string) {
    setReceipt(next);
    setStatus(nextStatus);
    setPayerId(next.payerMembershipId ?? members[0]?.id ?? "");
    setStage("preview");
    setEditingAmounts(false);
  }

  function persist(totalOnly: boolean) {
    if (!receipt) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("originalText", receipt.originalText);
      fd.set("acceptQuick", receipt.sourceKind === "quick" ? "1" : "0");
      fd.set("totalOnly", totalOnly ? "1" : "0");
      fd.set("idempotencyKey", crypto.randomUUID());
      fd.set(
        "editJson",
        JSON.stringify({
          merchant: receipt.merchant,
          purchaseDate: receipt.purchaseDate,
          totalCents: receipt.totalCents,
          payerMembershipId: payerId || null,
          items: receipt.items.map((item) => ({
            description: item.description,
            totalCents: item.totalCents,
            quantity: item.quantity,
          })),
        }),
      );
      const result = await registerPastedReceiptAction(null, fd);
      if (result.ok && result.data?.redirectTo) {
        window.location.href = result.data.redirectTo;
        return;
      }
      if (!result.ok) {
        setMessage(result.error);
        setActionHref(result.actionHref ?? null);
      }
    });
  }

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(RECEIPT_FORMAT_EXAMPLE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowExample(true);
    }
  }

  if (stage === "preview" && receipt && parsedPreview) {
    const paidByUnmatched = status === "Paid-by person could not be matched" || !receipt.payerMembershipId;
    return (
      <div className="space-y-4" data-testid="receipt-paste-preview">
        <p className="text-sm font-medium text-text-primary" data-testid="receipt-paste-status">
          {status?.startsWith("Read") ? `✓ ${status}` : status}
        </p>
        <section className="rounded-md border border-border bg-surface p-4">
          <p className="text-lg font-semibold">{receipt.merchant || "Receipt"}</p>
          <p className="text-sm text-text-secondary">
            {formatHumanDate(receipt.purchaseDate) ?? "Date not listed"}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {receipt.totalCents != null ? formatPastedUsd(receipt.totalCents) : "—"}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {receipt.items.length === 1 ? "1 item found" : `${receipt.items.length} items found`}
          </p>
        </section>

        <ul className="space-y-2">
          {receipt.items.map((item, index) => (
            <li key={`${item.description}-${index}`} className="flex justify-between gap-3 text-sm">
              <span>
                {item.description}
                {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                {item.ownershipHint ? (
                  <span className="block text-xs text-text-muted">Suggested: {item.ownershipHint}</span>
                ) : null}
              </span>
              {editingAmounts ? (
                <CurrencyAmountInput
                  valueCents={item.totalCents}
                  onChangeCents={(cents) => {
                    if (cents == null) return;
                    setReceipt({
                      ...receipt,
                      items: receipt.items.map((row, i) =>
                        i === index ? { ...row, totalCents: cents } : row,
                      ),
                    });
                  }}
                  ariaLabel={`${item.description} amount`}
                />
              ) : (
                <span className="tabular-nums">{formatPastedUsd(item.totalCents)}</span>
              )}
            </li>
          ))}
        </ul>

        <section className="rounded-md border border-border bg-surface p-4 text-sm" data-testid="receipt-paste-reconciliation">
          {parsedPreview.rows.map((row) => (
            <p key={row.label} className="flex justify-between gap-3">
              <span>{row.label}</span>
              <span className="tabular-nums">{formatPastedUsd(row.cents)}</span>
            </p>
          ))}
          {!parsedPreview.balanced ? (
            <p className="mt-3 font-medium text-text-primary">
              These numbers don&apos;t add up yet.
            </p>
          ) : null}
        </section>

        {paidByUnmatched || members.length > 0 ? (
          <label className="block text-sm">
            Who paid?
            <select
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              data-testid="receipt-paste-payer"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showRaw ? (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-xs">
            {receipt.extractedBlock}
          </pre>
        ) : null}

        {message ? (
          <p className="text-sm text-amber-800 dark:text-amber-200" role="alert">
            {message}
            {actionHref ? (
              <a className="ml-2 underline" href={actionHref}>
                Sign in again
              </a>
            ) : null}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          {!parsedPreview.balanced ? (
            <>
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-4 text-sm font-medium"
                onClick={() => setEditingAmounts(true)}
              >
                Review amounts
              </button>
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-4 text-sm font-medium"
                onClick={() => persist(false)}
                disabled={pending}
              >
                Add adjustment
              </button>
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-4 text-sm font-medium"
                onClick={() => persist(true)}
                disabled={pending}
              >
                Continue as total-only expense
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            onClick={() => persist(false)}
            disabled={pending}
            data-testid="receipt-paste-continue"
          >
            {receipt.sourceKind === "quick" ? "Use this" : "Continue"}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md px-4 text-sm text-text-secondary"
            onClick={() => {
              setStage("paste");
              setReceipt(null);
            }}
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="receipt-paste-flow">
      <p className="text-sm text-text-secondary">
        Paste receipt information from ChatGPT, Live Text, Google Lens, or another
        transcription tool.
      </p>
      <textarea
        className="min-h-64 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm"
        placeholder={RECEIPT_FORMAT_PLACEHOLDER}
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-testid="receipt-paste-input"
        spellCheck={false}
      />
      {message ? (
        <p className="text-sm text-amber-800 dark:text-amber-200" role="alert">
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          onClick={readReceipt}
          data-testid="receipt-paste-read"
        >
          Read receipt
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-4 text-sm font-medium"
          onClick={() => setShowExample((v) => !v)}
        >
          View format example
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md px-4 text-sm text-primary"
          onClick={() => void copyExample()}
          data-testid="receipt-paste-copy-format"
        >
          {copied ? "Copied" : "Copy format example"}
        </button>
      </div>
      {showExample ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-xs">
          {RECEIPT_FORMAT_EXAMPLE}
        </pre>
      ) : null}
      <div>
        <button
          type="button"
          className="text-sm font-medium text-primary"
          onClick={() => setShowChatGpt((v) => !v)}
        >
          Using ChatGPT?
        </button>
        {showChatGpt ? (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text-secondary">
            {CHATGPT_WORKFLOW_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
