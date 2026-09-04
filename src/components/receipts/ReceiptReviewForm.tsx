"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyRemainingReceiptLinesAction,
  assignReceiptLineAction,
  claimReceiptLinesAction,
  confirmReceiptAsExpenseAction,
  finalizeReceiptClaimsAction,
  finishReceiptClaimingAction,
  markReceiptLineSharedAction,
  remindReceiptClaimingAction,
  setReceiptSplitWorkflowAction,
  unclaimReceiptLineAction,
  updateReceiptReviewAction,
} from "@/app/actions/receipts";
import { CurrencyAmountInput } from "@/components/ui/currency-field";
import { formatCentsAsUsd } from "@/lib/receipts/currency";
import { describeReceiptReadFailure, SHARE_NEEDS_PERSON } from "@/lib/receipts/errors";
import { ownershipLabel, classificationToSimpleOwnership } from "@/lib/receipts/ownership";
import { previewReceiptSplit, type PreviewLine } from "@/lib/receipts/split-preview";
import { remainingQuantity, type LineClaim } from "@/lib/receipts/claims";
import type { LineItemClassification, ResourceDestination } from "@/lib/receipts/types";

export type ReviewLineItem = {
  id?: string;
  sortIndex: number;
  ocrText: string;
  correctedName: string;
  quantity: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  classification: LineItemClassification;
  resourceDestination: ResourceDestination;
  reviewStatus: string;
  participantMembershipIds: string[];
};

export type ReviewMember = { id: string; label: string };

export type ReviewInvite = {
  membershipId: string;
  status: "waiting" | "claimed" | "skipped";
};

export type ReviewClaim = {
  lineItemId: string;
  membershipId: string;
  quantity: number;
  kind: LineClaim["kind"];
};

type Props = {
  householdId: string;
  receiptId: string;
  merchant: string;
  purchaseDate: string;
  declaredTotalCents: number;
  taxCents?: number | null;
  tipCents?: number | null;
  discountCents?: number | null;
  lineItems: ReviewLineItem[];
  duplicateOutcome?: string | null;
  status: string;
  splitWorkflow?: string | null;
  payerMembershipId: string;
  currentMembershipId: string;
  members: ReviewMember[];
  invites?: ReviewInvite[];
  claims?: ReviewClaim[];
  ocrOutcome?: string | null;
  lastError?: string | null;
  startInClaimMode?: boolean;
  intakeSource?: "upload" | "camera" | "paste" | null;
  originalTranscription?: string | null;
};

type Workflow = "choose" | "equal_all" | "assign_items" | "claiming" | "review";

function nameOf(members: ReviewMember[], id: string) {
  return members.find((m) => m.id === id)?.label ?? "Roommate";
}

export function ReceiptReviewForm({
  householdId,
  receiptId,
  merchant: initialMerchant,
  purchaseDate: initialDate,
  declaredTotalCents: initialTotal,
  taxCents = null,
  tipCents = null,
  discountCents = null,
  lineItems: initialLines,
  duplicateOutcome,
  status,
  splitWorkflow,
  payerMembershipId: initialPayer,
  currentMembershipId,
  members,
  invites = [],
  claims = [],
  ocrOutcome = null,
  lastError = null,
  startInClaimMode = false,
  intakeSource = null,
  originalTranscription = null,
}: Props) {
  const [merchant, setMerchant] = useState(initialMerchant);
  const [purchaseDate, setPurchaseDate] = useState(initialDate);
  const [declaredTotalCents, setDeclaredTotalCents] = useState(initialTotal);
  const [payerMembershipId, setPayerMembershipId] = useState(initialPayer);
  const [lines, setLines] = useState(initialLines);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [looksRight, setLooksRight] = useState(
    Boolean(splitWorkflow) || status === "claiming" || status === "ready_for_review",
  );
  const [workflow, setWorkflow] = useState<Workflow>(
    startInClaimMode || status === "claiming"
      ? "claiming"
      : splitWorkflow === "equal_all"
        ? "equal_all"
        : splitWorkflow === "assign_items"
          ? "assign_items"
          : splitWorkflow === "claiming"
            ? "claiming"
            : "choose",
  );
  const [splitMembers, setSplitMembers] = useState<string[]>(
    members.map((m) => m.id),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const pasted = intakeSource === "paste";
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [claimQty, setClaimQty] = useState<Record<string, number>>({});
  const [sharedPick, setSharedPick] = useState<Record<string, string[]>>({});
  const router = useRouter();
  const canCoordinate = currentMembershipId === payerMembershipId;

  function refreshAfter(ok: boolean, nextMessage?: string) {
    if (nextMessage) setMessage(nextMessage);
    if (ok) router.refresh();
  }

  const previewLines: PreviewLine[] = useMemo(
    () =>
      lines.map((l, i) => ({
        id: l.id ?? `line-${i}`,
        name: l.correctedName || l.ocrText || "Item",
        totalCents: l.totalPriceCents ?? 0,
        classification: l.classification,
        participantMembershipIds: l.participantMembershipIds,
        quantity: l.quantity,
        claims: claims
          .filter((c) => c.lineItemId === l.id)
          .map((c) => ({
            membershipId: c.membershipId,
            quantity: c.quantity,
            kind: c.kind,
          })),
      })),
    [lines, claims],
  );

  const preview = useMemo(
    () =>
      previewReceiptSplit({
        merchant,
        payerMembershipId,
        eligibleMembershipIds: members.map((m) => m.id),
        declaredTotalCents,
        taxCents,
        tipCents,
        discountCents,
        lines: previewLines,
        splitEverything:
          workflow === "equal_all"
            ? { membershipIds: splitMembers }
            : null,
      }),
    [
      merchant,
      payerMembershipId,
      members,
      declaredTotalCents,
      taxCents,
      tipCents,
      discountCents,
      previewLines,
      workflow,
      splitMembers,
    ],
  );

  const selectedTotal = lines
    .filter((l) => l.id && selected.includes(l.id))
    .reduce((sum, l) => sum + (l.totalPriceCents ?? 0), 0);

  function persistHeader() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("receiptId", receiptId);
      fd.set("merchant", merchant);
      fd.set("purchaseDate", purchaseDate);
      fd.set("declaredTotalCents", String(declaredTotalCents));
      fd.set(
        "lineItemsJson",
        JSON.stringify(
          lines.map((l, i) => ({
            sortIndex: i,
            ocrText: l.ocrText,
            correctedName: l.correctedName,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            totalPriceCents: l.totalPriceCents,
            classification: l.classification,
            resourceDestination: "none",
            reviewStatus: l.reviewStatus,
            participantMembershipIds: l.participantMembershipIds,
          })),
        ),
      );
      const res = await updateReceiptReviewAction(null, fd);
      refreshAfter(res.ok, res.ok ? undefined : res.error ?? "Could not save.");
    });
  }

  function chooseWorkflow(next: "equal_all" | "assign_items" | "claiming") {
    try {
      window.localStorage.setItem(
        `householdos-receipt-split:${householdId}`,
        next,
      );
    } catch {
      // ignore
    }
    setWorkflow(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("receiptId", receiptId);
      fd.set("workflow", next);
      fd.set("membershipIds", splitMembers.join(","));
      fd.set("payerMembershipId", payerMembershipId);
      const res = await setReceiptSplitWorkflowAction(null, fd);
      if (!res.ok) setMessage(res.error ?? "Could not start that split.");
    });
  }

  function claimSelected() {
    const ids = selected.filter(Boolean);
    if (ids.length === 0) return;
    const quantities = ids.map((id) => {
      const line = lines.find((l) => l.id === id);
      const lineClaims = claims
        .filter((c) => c.lineItemId === id)
        .map((c) => ({
          membershipId: c.membershipId,
          quantity: c.quantity,
          kind: c.kind,
        }));
      const remaining = remainingQuantity(line?.quantity, lineClaims);
      return remaining > 0 ? remaining : 1;
    });
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("lineIds", ids.join(","));
      fd.set("quantities", quantities.join(","));
      fd.set("idempotencyKey", crypto.randomUUID());
      const res = await claimReceiptLinesAction(null, fd);
      refreshAfter(res.ok, res.ok ? "Claimed." : res.error ?? "Could not claim.");
      if (res.ok) setSelected([]);
    });
  }

  function submitExpense() {
    if (workflow === "equal_all" && splitMembers.length === 0) {
      setMessage(SHARE_NEEDS_PERSON);
      return;
    }
    if (preview.unclaimed.count > 0 && workflow !== "equal_all") {
      setMessage(
        `${preview.unclaimed.count} items still need assignment · ${formatCentsAsUsd(preview.unclaimed.cents)} unassigned`,
      );
      return;
    }
    startTransition(async () => {
      const header = new FormData();
      header.set("householdId", householdId);
      header.set("receiptId", receiptId);
      header.set("merchant", merchant);
      header.set("purchaseDate", purchaseDate);
      header.set("declaredTotalCents", String(declaredTotalCents));
      header.set(
        "lineItemsJson",
        JSON.stringify(
          lines.map((l, i) => ({
            sortIndex: i,
            ocrText: l.ocrText,
            correctedName: l.correctedName,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            totalPriceCents: l.totalPriceCents,
            classification: l.classification,
            resourceDestination: "none",
            reviewStatus: l.reviewStatus,
            participantMembershipIds: l.participantMembershipIds,
          })),
        ),
      );
      const saved = await updateReceiptReviewAction(null, header);
      if (!saved.ok) {
        setMessage(saved.error ?? "Could not save.");
        return;
      }
      if (workflow === "equal_all") {
        const split = new FormData();
        split.set("householdId", householdId);
        split.set("receiptId", receiptId);
        split.set("workflow", "equal_all");
        split.set("membershipIds", splitMembers.join(","));
        split.set("payerMembershipId", payerMembershipId);
        const splitRes = await setReceiptSplitWorkflowAction(null, split);
        if (!splitRes.ok) {
          setMessage(splitRes.error ?? "Could not save the split.");
          return;
        }
      }
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("receiptId", receiptId);
      fd.set("idempotencyKey", crypto.randomUUID());
      const res = await confirmReceiptAsExpenseAction(null, fd);
      if (res && !res.ok) setMessage(res.error ?? "Could not submit.");
    });
  }

  const confirmed = status === "confirmed";
  const claimMode = workflow === "claiming" || status === "claiming";
  const readFailed =
    !pasted &&
    (ocrOutcome === "failed" ||
      ocrOutcome === "timeout" ||
      ocrOutcome === "manual" ||
      status === "failed");
  const readFailure = readFailed
    ? describeReceiptReadFailure({ ocrOutcome, lastError, status })
    : null;

  return (
    <div className="space-y-6 pb-[calc(6rem+env(safe-area-inset-bottom))]" data-testid="receipt-review">
      {duplicateOutcome && duplicateOutcome !== "none" ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
          data-testid="receipt-duplicate-warning"
          role="status"
        >
          This looks similar to another receipt. Review before submitting.
        </div>
      ) : null}

      {readFailure ? (
        <div
          className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3"
          data-testid="receipt-manual-fallback"
        >
          <p className="text-sm font-medium text-text-primary">{readFailure.title}</p>
          <p className="text-sm text-text-secondary">{readFailure.explanation}</p>
          <p className="text-sm text-text-secondary">{readFailure.nextStep}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="min-h-11 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
              onClick={() => setHeaderOpen(true)}
              data-testid="receipt-enter-manually"
            >
              Enter manually
            </button>
            <a
              href={`/app/${householdId}/money/receipts/new`}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm"
              data-testid="receipt-try-again"
            >
              Try again
            </a>
          </div>
        </div>
      ) : null}

      <section className="rounded-md border border-border bg-surface p-4">
        {headerOpen ? (
          <div className="grid gap-3">
            <label className="text-sm">
              Merchant
              <input
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                data-testid="receipt-merchant"
              />
            </label>
            <label className="text-sm">
              Date
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                data-testid="receipt-purchase-date"
              />
            </label>
            <div>
              <p className="text-sm font-medium">Total</p>
              <CurrencyAmountInput
                valueCents={declaredTotalCents}
                onChangeCents={(cents) => setDeclaredTotalCents(cents ?? 0)}
                ariaLabel="Receipt total"
              />
            </div>
            <label className="text-sm">
              Paid by
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2"
                value={payerMembershipId}
                onChange={(e) => setPayerMembershipId(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-3 text-sm"
              onClick={() => {
                persistHeader();
                setHeaderOpen(false);
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="w-full text-left"
            onClick={() => setHeaderOpen(true)}
          >
            <p className="text-lg font-semibold text-text-primary">
              {merchant || "Receipt"}
            </p>
            <p className="text-sm text-text-secondary">
              {purchaseDate
                ? new Date(`${purchaseDate}T00:00:00`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Date needed"}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
              {formatCentsAsUsd(declaredTotalCents)}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Paid by: {nameOf(members, payerMembershipId)}
            </p>
          </button>
        )}
        <p className="mt-3 text-sm text-text-secondary">
          {lines.length === 1 ? "1 item found" : `${lines.length} items found`}
        </p>
        {pasted ? (
          <div className="mt-3 space-y-2" data-testid="receipt-paste-source">
            <p className="text-sm text-text-secondary">Source: Pasted transcription</p>
            {originalTranscription ? (
              <button
                type="button"
                className="text-sm font-medium text-primary"
                onClick={() => setShowOriginal((v) => !v)}
                data-testid="receipt-view-original"
              >
                {showOriginal ? "Hide original transcription" : "View original transcription"}
              </button>
            ) : null}
            {showOriginal && originalTranscription ? (
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs">
                {originalTranscription}
              </pre>
            ) : null}
          </div>
        ) : null}
        {!looksRight ? (
          <button
            type="button"
            className="mt-3 min-h-11 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            onClick={() => {
              persistHeader();
              setLooksRight(true);
            }}
            data-testid="receipt-looks-right"
          >
            Looks right
          </button>
        ) : null}
      </section>

      {looksRight && workflow === "choose" && !confirmed ? (
        <section className="space-y-3" data-testid="receipt-split-choice">
          <h2 className="text-lg font-semibold text-text-primary">
            How should we split this receipt?
          </h2>
          <button
            type="button"
            className="flex min-h-16 w-full flex-col items-start rounded-md border border-border bg-surface px-4 py-3 text-left"
            onClick={() => chooseWorkflow("equal_all")}
            data-testid="split-everything"
          >
            <span className="font-semibold">Split everything</span>
            <span className="text-sm text-text-secondary">
              Everyone shares the whole receipt.
            </span>
          </button>
          <button
            type="button"
            className="flex min-h-16 w-full flex-col items-start rounded-md border border-border bg-surface px-4 py-3 text-left"
            onClick={() => chooseWorkflow("assign_items")}
            data-testid="assign-items"
          >
            <span className="font-semibold">Assign items</span>
            <span className="text-sm text-text-secondary">
              I’ll choose who each item belongs to.
            </span>
          </button>
          <button
            type="button"
            className="flex min-h-16 w-full flex-col items-start rounded-md border border-border bg-surface px-4 py-3 text-left"
            onClick={() => chooseWorkflow("claiming")}
            data-testid="let-everyone-claim"
          >
            <span className="font-semibold">Let everyone claim their items</span>
            <span className="text-sm text-text-secondary">
              Roommates can select what belongs to them.
            </span>
          </button>
        </section>
      ) : null}

      {looksRight && workflow === "equal_all" && !confirmed ? (
        <section className="space-y-3" data-testid="receipt-equal-split">
          <h2 className="text-lg font-semibold">Who shares this?</h2>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id}>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={splitMembers.includes(m.id)}
                    onChange={(e) =>
                      setSplitMembers((prev) =>
                        e.target.checked
                          ? [...prev, m.id]
                          : prev.filter((id) => id !== m.id),
                      )
                    }
                  />
                  <span>{m.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {looksRight && (workflow === "assign_items" || claimMode) && !confirmed ? (
        <section className="space-y-3">
          {claimMode ? (
            <div>
              <h2 className="text-lg font-semibold">
                {canCoordinate ? "Who should pay for these items?" : "Select what is yours"}
              </h2>
              {invites.length > 0 && canCoordinate ? (
                <ul className="mt-2 space-y-1 text-sm text-text-secondary" data-testid="claim-response-status">
                  {invites.map((invite) => (
                    <li key={invite.membershipId}>
                      {nameOf(members, invite.membershipId)} —{" "}
                      {invite.membershipId === payerMembershipId
                        ? "payer"
                        : invite.status === "claimed"
                          ? "claimed"
                          : "waiting"}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <h2 className="text-lg font-semibold">Who should pay for these items?</h2>
          )}

          <ul className="space-y-2" data-testid="receipt-line-items">
            {lines.map((line, index) => {
              const id = line.id ?? `tmp-${index}`;
              const ownership = classificationToSimpleOwnership({
                classification: line.classification,
                participantMembershipIds: line.participantMembershipIds,
                currentMembershipId,
                payerMembershipId,
              });
              const checked = Boolean(line.id && selected.includes(line.id));
              return (
                <li
                  key={id}
                  className={`rounded-md border p-3 ${
                    checked
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {claimMode && line.id ? (
                      <input
                        type="checkbox"
                        className="mt-1 size-6"
                        checked={checked}
                        aria-label={`Select ${line.correctedName || "item"}`}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, line.id!]
                              : prev.filter((x) => x !== line.id),
                          )
                        }
                      />
                    ) : null}
                    <button
                      type="button"
                      className="min-h-11 flex-1 text-left"
                      onClick={() => setExpandedId(expandedId === id ? null : id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-medium text-text-primary">
                          {line.correctedName || "Item"}
                        </span>
                        <span className="tabular-nums text-text-primary">
                          {formatCentsAsUsd(line.totalPriceCents ?? 0)}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary">
                        {ownershipLabel(
                          ownership.kind,
                          ownership.membershipIds[0]
                            ? nameOf(members, ownership.membershipIds[0])
                            : undefined,
                        )}
                        {line.quantity && line.quantity > 1
                          ? ` · qty ${line.quantity}`
                          : ""}
                      </p>
                    </button>
                  </div>
                  {expandedId === id ? (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      <label className="block text-sm">
                        Item
                        <input
                          className="mt-1 w-full rounded-md border border-border px-3 py-2"
                          value={line.correctedName}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === index
                                  ? { ...l, correctedName: e.target.value }
                                  : l,
                              ),
                            )
                          }
                        />
                      </label>
                      <div>
                        <p className="text-sm font-medium">Price</p>
                        <CurrencyAmountInput
                          valueCents={line.totalPriceCents ?? 0}
                          onChangeCents={(cents) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === index
                                  ? { ...l, totalPriceCents: cents ?? 0 }
                                  : l,
                              ),
                            )
                          }
                          ariaLabel={`${line.correctedName} price`}
                        />
                      </div>
                      <label className="block text-sm">
                        Quantity
                        <input
                          type="number"
                          min={1}
                          className="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2"
                          value={line.quantity ?? 1}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === index
                                  ? {
                                      ...l,
                                      quantity: Math.max(1, Number(e.target.value) || 1),
                                    }
                                  : l,
                              ),
                            )
                          }
                        />
                      </label>
                      {line.quantity && line.quantity > 1 && line.id ? (
                        <div className="space-y-2">
                          <p className="text-sm text-text-secondary">
                            {remainingQuantity(
                              line.quantity,
                              claims
                                .filter((c) => c.lineItemId === line.id)
                                .map((c) => ({
                                  membershipId: c.membershipId,
                                  quantity: c.quantity,
                                  kind: c.kind,
                                })),
                            )}{" "}
                            left to claim
                          </p>
                          <label className="block text-sm">
                            How many are yours?
                            <input
                              type="number"
                              min={1}
                              max={line.quantity}
                              className="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2"
                              value={claimQty[line.id] ?? 1}
                              onChange={(e) =>
                                setClaimQty((prev) => ({
                                  ...prev,
                                  [line.id!]: Math.max(1, Number(e.target.value) || 1),
                                }))
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="min-h-11 rounded-md border border-border px-3 text-sm"
                            onClick={() => {
                              const fd = new FormData();
                              fd.set("householdId", householdId);
                              fd.set("lineIds", line.id!);
                              fd.set(
                                "quantities",
                                String(claimQty[line.id!] ?? 1),
                              );
                              fd.set("idempotencyKey", crypto.randomUUID());
                              startTransition(async () => {
                                const res = await claimReceiptLinesAction(null, fd);
                                refreshAfter(
                                  res.ok,
                                  res.ok ? "Quantity claimed." : res.error ?? "Could not claim.",
                                );
                              });
                            }}
                          >
                            Claim this quantity
                          </button>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="min-h-11 rounded-md border border-border px-3 text-sm"
                          onClick={() => {
                            if (!line.id) return;
                            const fd = new FormData();
                            fd.set("householdId", householdId);
                            fd.set("lineIds", line.id);
                            fd.set("idempotencyKey", crypto.randomUUID());
                            startTransition(async () => {
                              const res = await claimReceiptLinesAction(null, fd);
                              refreshAfter(
                                res.ok,
                                res.ok ? "Marked as yours." : res.error ?? "Could not claim.",
                              );
                            });
                          }}
                        >
                          Mine
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-md border border-border px-3 text-sm"
                          onClick={() => {
                            if (!line.id) return;
                            const fd = new FormData();
                            fd.set("householdId", householdId);
                            fd.set("lineId", line.id);
                            startTransition(async () => {
                              const res = await markReceiptLineSharedAction(null, fd);
                              refreshAfter(
                                res.ok,
                                res.ok
                                  ? "Shared with everyone."
                                  : res.error ?? "Could not share.",
                              );
                            });
                          }}
                        >
                          Shared with everyone
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-md border border-border px-3 text-sm"
                          onClick={() => {
                            if (!line.id) return;
                            const fd = new FormData();
                            fd.set("householdId", householdId);
                            fd.set("lineId", line.id);
                            startTransition(async () => {
                              const res = await unclaimReceiptLineAction(null, fd);
                              refreshAfter(
                                res.ok,
                                res.ok ? "Unclaimed." : res.error ?? "Could not unclaim.",
                              );
                            });
                          }}
                        >
                          Unclaimed
                        </button>
                        {canCoordinate ? (
                          <button
                            type="button"
                            className="min-h-11 rounded-md border border-border px-3 text-sm"
                            onClick={() => {
                              if (!line.id) return;
                              const fd = new FormData();
                              fd.set("householdId", householdId);
                              fd.set("lineId", line.id);
                              fd.set("membershipId", currentMembershipId);
                              fd.set("excluded", "1");
                              startTransition(async () => {
                                const res = await assignReceiptLineAction(null, fd);
                                refreshAfter(
                                  res.ok,
                                  res.ok
                                    ? "Not part of reimbursement."
                                    : res.error ?? "Could not exclude.",
                                );
                              });
                            }}
                          >
                            Not part of reimbursement
                          </button>
                        ) : null}
                      </div>
                      {line.id ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Shared between</p>
                          <ul className="space-y-1">
                            {members.map((m) => {
                              const picked =
                                sharedPick[line.id!] ??
                                (line.participantMembershipIds.length
                                  ? line.participantMembershipIds
                                  : members.map((x) => x.id));
                              return (
                                <li key={m.id}>
                                  <label className="flex min-h-11 items-center gap-3 text-sm">
                                    <input
                                      type="checkbox"
                                      className="size-5"
                                      checked={picked.includes(m.id)}
                                      onChange={(e) =>
                                        setSharedPick((prev) => {
                                          const current =
                                            prev[line.id!] ??
                                            (line.participantMembershipIds.length
                                              ? line.participantMembershipIds
                                              : members.map((x) => x.id));
                                          return {
                                            ...prev,
                                            [line.id!]: e.target.checked
                                              ? [...current, m.id]
                                              : current.filter((id) => id !== m.id),
                                          };
                                        })
                                      }
                                    />
                                    {m.label}
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                          <button
                            type="button"
                            className="min-h-11 rounded-md border border-border px-3 text-sm"
                            onClick={() => {
                              const ids =
                                sharedPick[line.id!] ??
                                (line.participantMembershipIds.length
                                  ? line.participantMembershipIds
                                  : members.map((m) => m.id));
                              if (ids.length === 0) {
                                setMessage(SHARE_NEEDS_PERSON);
                                return;
                              }
                              const fd = new FormData();
                              fd.set("householdId", householdId);
                              fd.set("lineId", line.id!);
                              fd.set("membershipIds", ids.join(","));
                              startTransition(async () => {
                                const res = await markReceiptLineSharedAction(null, fd);
                                refreshAfter(
                                  res.ok,
                                  res.ok ? "Shared." : res.error ?? "Could not share.",
                                );
                              });
                            }}
                          >
                            Save shared people
                          </button>
                        </div>
                      ) : null}
                      {canCoordinate ? (
                        <label className="block text-sm">
                          Belongs to
                          <select
                            className="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2"
                            value={line.participantMembershipIds[0] ?? ""}
                            onChange={(e) => {
                              if (!line.id || !e.target.value) return;
                              const fd = new FormData();
                              fd.set("householdId", householdId);
                              fd.set("lineId", line.id);
                              fd.set("membershipId", e.target.value);
                              startTransition(async () => {
                                const res = await assignReceiptLineAction(null, fd);
                                refreshAfter(
                                  res.ok,
                                  res.ok ? "Assigned." : res.error ?? "Could not assign.",
                                );
                              });
                            }}
                          >
                            <option value="">Choose someone</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <details className="text-sm">
                        <summary>Advanced</summary>
                        <p className="mt-2 text-text-muted">OCR: {line.ocrText || "—"}</p>
                        {line.quantity != null ? (
                          <p className="text-text-muted">Quantity {line.quantity}</p>
                        ) : null}
                      </details>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {preview.unclaimed.count > 0 && workflow !== "equal_all" && looksRight ? (
        <section
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          data-testid="receipt-unclaimed"
        >
          <p>
            {preview.unclaimed.count} items still need assignment ·{" "}
            {formatCentsAsUsd(preview.unclaimed.cents)} unassigned
          </p>
          <button
            type="button"
            className="mt-2 min-h-11 rounded-md border border-border bg-surface px-3 text-sm"
            onClick={() => {
              const first = lines.find((l) => l.classification === "needs_review");
              if (first) setExpandedId(first.id ?? `tmp-${lines.indexOf(first)}`);
            }}
          >
            Review unassigned
          </button>
          {canCoordinate ? (
            <div className="mt-2 flex flex-col gap-2">
              {(["shared", "mine", "exclude"] as const).map((action) => (
                <button
                  key={action}
                  type="button"
                  className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("householdId", householdId);
                    fd.set("receiptId", receiptId);
                    fd.set("remainingAction", action);
                    startTransition(async () => {
                      const res = await applyRemainingReceiptLinesAction(null, fd);
                      refreshAfter(
                        res.ok,
                        res.ok ? "Updated remaining items." : res.error ?? "Failed.",
                      );
                    });
                  }}
                >
                  {action === "shared"
                    ? "Make all remaining shared"
                    : action === "mine"
                      ? "Assign all remaining to me"
                      : "Exclude remaining"}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {looksRight && (workflow !== "choose" || status === "ready_for_review") ? (
        <section className="space-y-3" data-testid="receipt-final-review">
          <h2 className="text-lg font-semibold">Who owes what?</h2>
          <div className="rounded-md border border-border bg-surface p-4 text-sm" data-testid="receipt-reconciliation">
            <p className="font-medium">{merchant || "Receipt"}</p>
            <p className="text-text-secondary">
              Paid by {nameOf(members, payerMembershipId)} · Total{" "}
              {formatCentsAsUsd(declaredTotalCents)}
            </p>
            <ul className="mt-3 space-y-2">
              {preview.members.map((row) => (
                <li key={row.membershipId} className="flex justify-between gap-3">
                  <span>
                    {nameOf(members, row.membershipId)}
                    {row.itemCount > 0
                      ? ` · ${row.itemCount} item${row.itemCount === 1 ? "" : "s"}`
                      : ""}
                  </span>
                  <span className="tabular-nums">{formatCentsAsUsd(row.totalCents)}</span>
                </li>
              ))}
            </ul>
            {preview.householdSharedCents > 0 ? (
              <p className="mt-2 text-text-secondary">
                Shared household {formatCentsAsUsd(preview.householdSharedCents)}
              </p>
            ) : null}
            {preview.taxCents > 0 ? (
              <p className="mt-2 text-text-secondary">
                Tax: {formatCentsAsUsd(preview.taxCents)} · Distributed proportionally
              </p>
            ) : null}
            {preview.discountCents > 0 ? (
              <p className="text-text-secondary">
                Discount: {formatCentsAsUsd(preview.discountCents)} · Distributed
                proportionally
              </p>
            ) : null}
            <div className="mt-3 space-y-1 border-t border-border pt-3 font-medium">
              {preview.members
                .filter((m) => m.membershipId !== payerMembershipId && m.owesPayerCents > 0)
                .map((m) => (
                  <p key={m.membershipId}>
                    {nameOf(members, m.membershipId)} owes{" "}
                    {nameOf(members, payerMembershipId)}{" "}
                    {formatCentsAsUsd(m.owesPayerCents)}
                  </p>
                ))}
              <p>
                {nameOf(members, payerMembershipId)}&apos;s own share{" "}
                {formatCentsAsUsd(preview.payerOwnShareCents)}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {claimMode && canCoordinate && !confirmed ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-secondary">
            Wait for everyone, or finish now if you want to continue without
            people who have not responded.
          </p>
          <button
            type="button"
            className="min-h-11 rounded-md border border-border px-4 text-sm"
            onClick={() => {
              const fd = new FormData();
              fd.set("householdId", householdId);
              fd.set("receiptId", receiptId);
              fd.set("force", "1");
              startTransition(async () => {
                const res = await finalizeReceiptClaimsAction(null, fd);
                refreshAfter(
                  res.ok,
                  res.ok ? "Ready to review." : res.error ?? "Could not finish.",
                );
                if (res.ok) setWorkflow("review");
              });
            }}
          >
            Finish now
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md border border-border px-4 text-sm"
            onClick={() => {
              const fd = new FormData();
              fd.set("householdId", householdId);
              fd.set("receiptId", receiptId);
              startTransition(async () => {
                await remindReceiptClaimingAction(null, fd);
              });
            }}
          >
            Send a reminder
          </button>
        </div>
      ) : null}

      <details className="text-sm">
        <summary>Advanced split options</summary>
        <div className="mt-2 space-y-2 text-text-secondary">
          <p>
            Fixed-cent, percent, and weighted splits stay in the expense editor
            after you submit, if you need them.
          </p>
          <button
            type="button"
            className="min-h-11 rounded-md border border-border px-3"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide technical fields" : "Show technical fields"}
          </button>
        </div>
      </details>

      {showAdvanced ? (
        <div className="text-xs text-text-muted" data-testid="receipt-bulk-actions">
          Legacy classification and stock destinations are available after you
          submit, under household updates.
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-text-secondary" role="status">
          {message}
        </p>
      ) : null}

      {!confirmed ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-lg flex-col gap-2">
            {claimMode && selected.length > 0 ? (
              <p className="text-sm text-text-secondary">
                {selected.length} selected · {formatCentsAsUsd(selectedTotal)}
              </p>
            ) : null}
            {claimMode && !canCoordinate ? (
              <>
                <button
                  type="button"
                  disabled={pending || selected.length === 0}
                  onClick={claimSelected}
                  className="min-h-12 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  data-testid="claim-mine"
                >
                  Claim selected{selectedTotal > 0 ? ` — ${formatCentsAsUsd(selectedTotal)}` : ""}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="min-h-11 rounded-md border border-border px-4 text-sm"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("householdId", householdId);
                    fd.set("receiptId", receiptId);
                    startTransition(async () => {
                      const res = await finishReceiptClaimingAction(null, fd);
                      refreshAfter(
                        res.ok,
                        res.ok
                          ? "Thanks — your claims were saved."
                          : res.error ?? "Could not finish.",
                      );
                    });
                  }}
                >
                  I’m done
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pending || !looksRight || workflow === "choose"}
                onClick={submitExpense}
                className="min-h-12 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                data-testid="receipt-confirm-expense"
              >
                Submit expense
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">This receipt already created an expense.</p>
      )}
    </div>
  );
}
