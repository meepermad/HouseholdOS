"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { registerPastedReceiptAction } from "@/app/actions/receipts";
import { formatPastedUsd } from "@/lib/receipts/paste/cents";
import {
  CHATGPT_WORKFLOW_STEPS,
  RECEIPT_FORMAT_EXAMPLE,
  RECEIPT_FORMAT_PLACEHOLDER,
  copyFormatExample,
} from "@/lib/receipts/paste/format";
import { findLineNumberInText, replacePasteLine } from "@/lib/receipts/paste/normalize";
import {
  canContinueItemized,
  formatHumanDate,
  parseHouseholdOsReceipt,
  type ParsedPasteReceipt,
  type PasteMember,
  type PasteProblem,
} from "@/lib/receipts/paste/parse";
import { itemLineIssues } from "@/lib/receipts/paste/problems";
import { pasteStatusCopy, reconcilePastedReceipt } from "@/lib/receipts/paste/reconcile";
import { CurrencyAmountInput } from "@/components/ui/currency-field";
import { PasteParserDebug } from "@/components/receipts/PasteParserDebug";

type Stage = "paste" | "preview";

export function ReceiptPasteFlow({
  householdId,
  members,
  parserDebug = false,
  manualHref,
}: {
  householdId: string;
  members: PasteMember[];
  parserDebug?: boolean;
  manualHref?: string;
}) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("paste");
  const [receipt, setReceipt] = useState<ParsedPasteReceipt | null>(null);
  const [problems, setProblems] = useState<PasteProblem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionHref, setActionHref] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [showChatGpt, setShowChatGpt] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [editingAmounts, setEditingAmounts] = useState(false);
  const [payerId, setPayerId] = useState("");
  const [copied, setCopied] = useState(false);
  const [fixDrafts, setFixDrafts] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const parsedPreview = useMemo(
    () => (receipt ? reconcilePastedReceipt(receipt) : null),
    [receipt],
  );
  const lineIssues = itemLineIssues(problems);
  const continueBlocked = receipt
    ? !canContinueItemized({
        merchant: receipt.merchant,
        totalCents: receipt.totalCents,
        problems,
      })
    : true;

  function focusLine(originalLine: string) {
    const area = textareaRef.current;
    if (!area) return;
    const lineNumber = findLineNumberInText(text, originalLine);
    if (lineNumber == null) {
      area.focus();
      return;
    }
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    let start = 0;
    for (let i = 0; i < lineNumber - 1; i++) start += (lines[i]?.length ?? 0) + 1;
    const end = start + (lines[lineNumber - 1]?.length ?? 0);
    area.focus();
    area.setSelectionRange(start, end);
    const lineHeight = Number.parseFloat(getComputedStyle(area).lineHeight) || 22;
    area.scrollTop = Math.max(0, (lineNumber - 2) * lineHeight);
  }

  function applyParsed(
    next: ParsedPasteReceipt,
    nextProblems: PasteProblem[],
    nextStatus: string,
  ) {
    setReceipt(next);
    setProblems(nextProblems);
    setStatus(nextStatus);
    setPayerId(next.payerMembershipId ?? members[0]?.id ?? "");
    setStage("preview");
    setEditingAmounts(false);
    setFixDrafts({});
  }

  function readReceipt() {
    setMessage(null);
    const result = parseHouseholdOsReceipt(text, members);
    if (result.quickCandidate && !result.receipt) {
      applyParsed(result.quickCandidate, result.problems, "We think this is a receipt.");
      return;
    }
    if (result.receipt) {
      const rec = reconcilePastedReceipt(result.receipt);
      applyParsed(
        result.receipt,
        result.problems,
        pasteStatusCopy(result.receipt, result.problems, rec),
      );
      if (!result.ok || itemLineIssues(result.problems).length > 0) {
        setShowRaw(true);
      }
      return;
    }
    setStage("paste");
    setReceipt(null);
    setProblems(result.problems);
    setMessage(
      result.ok ? "We could not find a HouseholdOS receipt in that paste." : result.error.message,
    );
  }

  function persist(totalOnly: boolean) {
    if (!receipt) return;
    if (
      !totalOnly &&
      !canContinueItemized({
        merchant: receipt.merchant,
        totalCents: receipt.totalCents,
        problems,
      })
    ) {
      setMessage("Fix the highlighted lines before continuing, or continue as total-only.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("originalText", text || receipt.originalText);
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
      await navigator.clipboard.writeText(copyFormatExample());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowExample(true);
    }
  }

  function applyLineFix(issue: PasteProblem) {
    if (!issue.originalLine) return;
    const nextLine = (fixDrafts[issue.originalLine] ?? issue.originalLine).trim();
    const nextText = replacePasteLine(text || receipt?.originalText || "", issue.originalLine, nextLine);
    setText(nextText);
    const result = parseHouseholdOsReceipt(nextText, members);
    if (result.receipt) {
      const rec = reconcilePastedReceipt(result.receipt);
      applyParsed(
        result.receipt,
        result.problems,
        pasteStatusCopy(result.receipt, result.problems, rec),
      );
      return;
    }
    setMessage(result.ok ? null : result.error.message);
    setProblems(result.problems);
    setStage("paste");
  }

  if (stage === "preview" && receipt && parsedPreview) {
    const paidByUnmatched =
      status === "Paid-by person could not be matched" || !receipt.payerMembershipId;
    return (
      <div className="max-w-full space-y-4 overflow-x-hidden" data-testid="receipt-paste-preview">
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
            {lineIssues.length > 0
              ? ` · ${lineIssues.length === 1 ? "1 item needs review" : `${lineIssues.length} items need review`}`
              : ""}
          </p>
        </section>

        {lineIssues.length > 0 ? (
          <section
            className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40"
            data-testid="receipt-paste-line-issues"
          >
            <p className="font-medium">
              We couldn&apos;t read {lineIssues.length === 1 ? "1 line" : `${lineIssues.length} lines`}.
            </p>
            <ul className="mt-3 space-y-3">
              {lineIssues.map((issue) => (
                <li key={`${issue.lineNumber}-${issue.originalLine}`}>
                  <p>Line {issue.lineNumber ?? "?"}:</p>
                  <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface p-2 text-xs">
                    {issue.originalLine}
                  </pre>
                  <p className="mt-1">Reason: {issue.reason ?? issue.message}</p>
                  <label className="mt-2 block">
                    Fix this line
                    <input
                      className="mt-1 min-h-11 w-full max-w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-base"
                      value={fixDrafts[issue.originalLine ?? ""] ?? issue.originalLine ?? ""}
                      onChange={(e) =>
                        setFixDrafts((prev) => ({
                          ...prev,
                          [issue.originalLine ?? ""]: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="min-h-11 rounded-md border border-border px-4 text-sm font-medium"
                      onClick={() => applyLineFix(issue)}
                    >
                      Apply fix
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-md px-4 text-sm text-text-secondary"
                      onClick={() => {
                        setStage("paste");
                        window.setTimeout(() => focusLine(issue.originalLine ?? ""), 0);
                      }}
                    >
                      Edit text
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ul className="space-y-2">
          {receipt.items.map((item, index) => (
            <li key={`${item.description}-${index}`} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 break-words">
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
                <span className="shrink-0 tabular-nums">{formatPastedUsd(item.totalCents)}</span>
              )}
            </li>
          ))}
        </ul>

        <section
          className="rounded-md border border-border bg-surface p-4 text-sm"
          data-testid="receipt-paste-reconciliation"
        >
          {parsedPreview.rows.map((row) => (
            <p key={row.label} className="flex justify-between gap-3">
              <span>{row.label}</span>
              <span className="tabular-nums">{formatPastedUsd(row.cents)}</span>
            </p>
          ))}
          {!parsedPreview.balanced ? (
            <div className="mt-3 space-y-1 font-medium text-text-primary">
              <p>These numbers don&apos;t add up yet.</p>
              <p>Expected: {formatPastedUsd(parsedPreview.receiptTotalCents)}</p>
              <p>Accounted for: {formatPastedUsd(parsedPreview.accountedForCents)}</p>
              <p>Difference: {formatPastedUsd(parsedPreview.unaccountedCents)}</p>
            </div>
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
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface p-3 text-xs">
            {receipt.extractedBlock}
          </pre>
        ) : null}

        <label className="block text-sm">
          Pasted text
          <textarea
            ref={textareaRef}
            className="mt-1 max-h-[40dvh] min-h-32 w-full max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface px-3 py-2 font-mono text-base"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            data-testid="receipt-paste-input"
          />
        </label>

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

        <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-background/95 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!parsedPreview.balanced || continueBlocked ? (
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
                disabled={pending || continueBlocked}
              >
                Add adjustment
              </button>
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-4 text-sm font-medium"
                onClick={() => persist(true)}
                disabled={pending || !receipt.merchant || receipt.totalCents == null}
              >
                Continue as total-only expense
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            onClick={() => persist(false)}
            disabled={pending || continueBlocked}
            data-testid="receipt-paste-continue"
          >
            {receipt.sourceKind === "quick" ? "Use this" : "Continue"}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md px-4 text-sm text-text-secondary"
            onClick={() => setStage("paste")}
          >
            Edit text
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-4 overflow-x-hidden" data-testid="receipt-paste-flow">
      <p className="text-sm text-text-secondary">
        Paste receipt information from ChatGPT, Live Text, Google Lens, or another
        transcription tool.
      </p>
      <textarea
        ref={textareaRef}
        className="max-h-[50dvh] min-h-64 w-full max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface px-3 py-2 font-mono text-base"
        placeholder={RECEIPT_FORMAT_PLACEHOLDER}
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-testid="receipt-paste-input"
        spellCheck={false}
      />
      {message || problems.length > 0 ? (
        <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200" role="alert">
          {message ? <p>{message}</p> : null}
          {lineIssues.map((issue) => (
            <button
              key={`${issue.lineNumber}-${issue.originalLine}`}
              type="button"
              className="block w-full rounded-md border border-amber-300 p-3 text-left"
              onClick={() => focusLine(issue.originalLine ?? "")}
            >
              <p className="font-medium">Line {issue.lineNumber ?? "?"}</p>
              <p className="break-words font-mono text-xs">{issue.originalLine}</p>
              <p>{issue.reason ?? issue.message}</p>
            </button>
          ))}
        </div>
      ) : null}
      <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-background/95 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
          onClick={() => void readReceipt()}
        >
          Try again
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-4 text-sm font-medium"
          onClick={() => textareaRef.current?.focus()}
        >
          Edit text
        </button>
        {manualHref ? (
          <a
            className="flex min-h-11 items-center justify-center rounded-md px-4 text-sm text-text-secondary"
            href={manualHref}
          >
            Enter manually
          </a>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
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
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface p-3 text-xs">
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
      {parserDebug ? (
        <PasteParserDebug text={text} members={members} onLoadFixture={setText} />
      ) : null}
    </div>
  );
}
