import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  confirmExpenseAction,
  createExpenseAmendmentAction,
  voidExpenseAction,
} from "@/app/actions/expenses";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney, itemAllocationLabel } from "@/lib/expenses/display";
import { ExpenseStatusBadge } from "@/components/ui/status-badge";
import { DisclosureSection } from "@/components/ui/disclosure-section";
import { PurchaseItemBreakdown } from "@/components/money/PurchaseItemBreakdown";
import { ExpenseItemRetag } from "@/components/expenses/ExpenseItemRetag";
import { allocatedRowsToBreakdown } from "@/lib/money/purchase-breakdown";
import { loadExpenseBundle, recalculateBundle } from "@/lib/expenses/load-bundle";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { CommentThread } from "@/components/comments/CommentThread";
import { ReceiptRepastePanel, type TranscriptionRevisionSummary } from "@/components/receipts/ReceiptRepastePanel";
import { listRecordComments } from "@/lib/comments/queries";
import { expenseWaitingCopy } from "@/lib/presentation/human-status";
import { formatAuditEventLabel } from "@/lib/presentation/audit-events";
import { settlementStatusCopy } from "@/lib/presentation/human-status";
import {
  householdOsPasteFromStoredReceipt,
  preferExistingPasteText,
} from "@/lib/receipts/paste/to-source-text";
import { resolvePastedDisplayDescription } from "@/lib/receipts/paste/display-description";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string; expenseId: string }>;
  searchParams: Promise<{ fromReceipt?: string }>;
}) {
  const { householdId, expenseId } = await params;
  const { fromReceipt } = await searchParams;
  const ctx = await assertActiveMembership(householdId);
  const supabase = await createClient();
  const bundle = await loadExpenseBundle(supabase, expenseId);
  if (!bundle || bundle.expense.household_id !== householdId) notFound();

  if (bundle.expense.status === "draft") {
    redirect(`/app/${householdId}/money/expenses/${expenseId}/edit`);
  }

  const [members, obligationsResult, auditsResult, comments] = await Promise.all([
    listActiveMemberOptions(householdId),
    supabase
      .from("reimbursement_obligations")
      .select("*")
      .eq("expense_id", expenseId)
      .order("created_at", { ascending: true }),
    supabase
      .from("audit_events")
      .select("event_type, created_at, reason, after_state")
      .eq("household_id", householdId)
      .eq("entity_id", expenseId)
      .order("created_at", { ascending: false })
      .limit(20),
    listRecordComments({
      householdId,
      parentType: "expense",
      parentId: expenseId,
      actorMembershipId: ctx.membershipId,
    }),
  ]);

  const obligations = obligationsResult.data;
  const audits = auditsResult.data;

  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  const calc =
    bundle.expense.status === "confirmed" || bundle.expense.status === "amended"
      ? null
      : recalculateBundle(bundle);

  const e = bundle.expense;
  const shares = calc && calc.ok ? calc.memberShares : [];
  const myShare = shares.find((s) => s.membershipId === ctx.membershipId);
  const myObligation = (obligations ?? []).find(
    (o) => o.debtor_membership_id === ctx.membershipId,
  );
  const othersOwe = (obligations ?? [])
    .filter((o) => o.creditor_membership_id === ctx.membershipId)
    .reduce((sum, o) => sum + (o.current_amount_cents ?? 0), 0);
  const isPayer = ctx.membershipId === e.payer_membership_id;
  const waitingConfirm = e.status === "ready_for_review";
  const previewOwed =
    calc && calc.ok
      ? calc.obligations
          .filter((o) => o.creditorMembershipId === ctx.membershipId)
          .reduce((sum, o) => sum + o.amountCents, 0)
      : 0;
  const payerLabel = label(e.payer_membership_id);
  const receiptLookupIds = [expenseId, e.supersedes_expense_id].filter(
    (id): id is string => Boolean(id),
  );
  const { data: linkedReceipt } = await supabase
    .from("expense_receipts")
    .select(
      "id, status, transcription_corrected, intake_source, merchant_corrected, purchase_date_corrected, declared_total_cents, expense_id",
    )
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .in("expense_id", receiptLookupIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let revisionRows: Array<{
    id: string;
    revision_number: number;
    created_at: string;
    reason: "initial_paste" | "user_repaste";
    source_text: string;
    superseded_at: string | null;
  }> = [];
  let extractionText: string | null = null;
  let rebuiltPaste: string | null = null;
  if (linkedReceipt) {
    const [revisionsResult, extractionResult, linesResult] = await Promise.all([
      supabase
        .from("expense_receipt_transcription_revisions")
        .select("id, revision_number, created_at, reason, source_text, superseded_at")
        .eq("receipt_id", linkedReceipt.id)
        .order("revision_number", { ascending: false }),
      supabase
        .from("expense_receipt_extractions")
        .select("ocr_full_text, proposed")
        .eq("receipt_id", linkedReceipt.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("expense_receipt_line_items")
        .select("corrected_name, source_text, ocr_text, quantity, total_price_cents")
        .eq("receipt_id", linkedReceipt.id)
        .order("sort_index"),
    ]);
    revisionRows = (revisionsResult.data ?? []) as typeof revisionRows;
    const extraction = extractionResult.data as {
      ocr_full_text?: string | null;
      proposed?: {
        subtotalCents?: number | null;
        taxCents?: number | null;
        tipCents?: number | null;
        feeCents?: number | null;
        discountCents?: number | null;
      } | null;
    } | null;
    extractionText =
      typeof extraction?.ocr_full_text === "string" ? extraction.ocr_full_text : null;
    const proposed = extraction?.proposed ?? {};
    rebuiltPaste = householdOsPasteFromStoredReceipt({
      merchant: linkedReceipt.merchant_corrected ?? e.merchant,
      purchaseDate: linkedReceipt.purchase_date_corrected ?? e.purchase_date,
      totalCents: linkedReceipt.declared_total_cents ?? e.declared_total_cents,
      subtotalCents: proposed.subtotalCents ?? null,
      taxCents: proposed.taxCents ?? null,
      tipCents: proposed.tipCents ?? null,
      feeCents: proposed.feeCents ?? null,
      discountCents: proposed.discountCents ?? null,
      items: (linesResult.data ?? []).map((line) => ({
        description: resolvePastedDisplayDescription({
          correctedName: line.corrected_name,
          sourceText: line.source_text ?? line.ocr_text,
          ocrText: line.ocr_text,
        }),
        sourceText: line.source_text ?? line.ocr_text,
        totalCents: line.total_price_cents,
        quantity: line.quantity,
      })),
    });
  }

  const receiptRevisions: TranscriptionRevisionSummary[] = revisionRows.map((r) => ({
    id: r.id,
    revisionNumber: r.revision_number,
    createdAt: r.created_at,
    reason: r.reason,
    active: r.superseded_at == null,
    sourceText: r.source_text,
  }));
  const originalTranscription = preferExistingPasteText([
    receiptRevisions.find((r) => r.active)?.sourceText,
    receiptRevisions[0]?.sourceText,
    extractionText,
    rebuiltPaste,
  ]);
  const statusDetail = expenseWaitingCopy({
    status: e.status,
    isPayer,
    payerLabel,
  });

  const canRetag =
    e.status === "confirmed" && can(ctx.roles, "expense.amend");
  const itemBreakdown = allocatedRowsToBreakdown(
    bundle.items.map((item) => ({
      id: item.id,
      name: item.description,
      totalCents: item.total_cents,
      allocationMode: item.allocation_mode,
      personalMembershipId: item.personal_membership_id,
      allocations: item.allocations,
    })),
    label,
  );

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{e.merchant || "Expense"}</h1>
        <p className="text-2xl font-semibold tabular-nums">
          {formatMoney(e.declared_total_cents)}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          <span>Paid by {payerLabel}</span>
          <ExpenseStatusBadge status={e.status} />
        </p>
      </header>

      <section
        className="rounded-md border border-border bg-surface p-4"
        data-testid="expense-your-share"
      >
        {isPayer ? (
          <>
            <p className="text-sm text-text-secondary">You paid</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(e.declared_total_cents)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Others owe you</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(othersOwe || previewOwed)}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-text-secondary">Your share</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(
                myShare?.totalShareCents ?? myObligation?.current_amount_cents ?? 0,
              )}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              You owe {payerLabel}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(
                myObligation?.current_amount_cents ??
                  myShare?.totalShareCents ??
                  0,
              )}
            </p>
          </>
        )}
        <p className="mt-3 text-sm text-text-secondary">{statusDetail}</p>
        {waitingConfirm && can(ctx.roles, "expense.confirm") ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionForm action={confirmExpenseAction} pendingLabel="Confirming…">
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="expenseId" value={expenseId} />
              <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
              <button
                type="submit"
                className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Confirm
              </button>
            </ActionForm>
            <Link
              href={`/app/${householdId}/money/disputes`}
              className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm"
            >
              Dispute
            </Link>
          </div>
        ) : null}
      </section>

      {fromReceipt === "1" ? (
        <section
          className="rounded-md border border-border bg-surface p-4"
          data-testid="receipt-inventory-followup"
        >
          <p className="font-medium">Receipt submitted.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Optional later: update household supplies. This does not change who
            owes what.
          </p>
        </section>
      ) : null}

      <section className="space-y-2" data-testid="expense-purchase-breakdown">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          What was purchased
        </h2>
        <PurchaseItemBreakdown
          merchant={e.merchant || "Receipt"}
          items={itemBreakdown.map((line) => {
            const item = bundle.items.find((row) => row.id === line.id);
            if (!item || !canRetag) return line;
            return {
              ...line,
              action: (
                <ExpenseItemRetag
                  householdId={householdId}
                  expenseId={expenseId}
                  itemId={item.id}
                  allocationMode={item.allocation_mode}
                  personalMembershipId={item.personal_membership_id}
                  selectedIds={item.allocations.map((a) => a.membership_id)}
                  members={members}
                  currentMembershipId={ctx.membershipId}
                />
              ),
            };
          })}
          adjustments={allocatedRowsToBreakdown(
            bundle.adjustments.map((adj) => ({
              id: adj.id,
              name: adj.description,
              totalCents: adj.amount_cents,
              allocationMode: adj.allocation_mode,
              personalMembershipId: adj.assigned_membership_id,
              allocations: adj.allocations,
            })),
            label,
          )}
          testId="expense-item-breakdown"
        />
      </section>

      <section className="space-y-2" data-testid="obligation-breakdown">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Who owes what
        </h2>
        {(obligations ?? []).length === 0 && !(calc && calc.ok && calc.obligations.length) ? (
          <p className="text-sm text-text-secondary">
            No one owes anyone for this purchase.
          </p>
        ) : (
          <ul className="space-y-3">
            {((obligations ?? []).length > 0
              ? (obligations ?? []).map((o) => ({
                  id: o.id,
                  debtor: o.debtor_membership_id,
                  creditor: o.creditor_membership_id,
                  amount: o.current_amount_cents,
                  status: o.status,
                }))
              : calc && calc.ok
                ? calc.obligations.map((o) => ({
                    id: `${o.debtorMembershipId}-${o.creditorMembershipId}`,
                    debtor: o.debtorMembershipId,
                    creditor: o.creditorMembershipId,
                    amount: o.amountCents,
                    status: "unpaid",
                  }))
                : []
            ).map((o) => (
              <li
                key={o.id}
                className="rounded-md border border-border bg-surface p-3 text-sm"
              >
                <p className="font-medium">
                  {label(o.debtor)} owes {label(o.creditor)} {formatMoney(o.amount)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {settlementStatusCopy(o.status).label}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" data-testid="expense-receipt">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Receipt
        </h2>
        {linkedReceipt ? (
          <div className="space-y-3 rounded-md border border-border bg-surface p-4">
            <Link
              href={`/app/${householdId}/money/receipts/${linkedReceipt.id}`}
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              View original receipt
            </Link>
            {can(ctx.roles, "expense.amend") ? (
              <ReceiptRepastePanel
                householdId={householdId}
                receiptId={linkedReceipt.id}
                status={linkedReceipt.status}
                expenseId={expenseId}
                originalTranscription={originalTranscription}
                transcriptionCorrected={Boolean(linkedReceipt.transcription_corrected)}
                revisionCount={receiptRevisions.length}
                revisions={receiptRevisions}
                intakeSource={
                  linkedReceipt.intake_source === "camera" ||
                  linkedReceipt.intake_source === "upload" ||
                  linkedReceipt.intake_source === "paste"
                    ? linkedReceipt.intake_source
                    : "paste"
                }
                variant="advanced"
              />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            This expense has no linked receipt to re-paste.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Activity
        </h2>
        <CommentThread
          householdId={householdId}
          parentType="expense"
          parentId={expenseId}
          comments={comments}
        />
      </section>

      <DisclosureSection
        title="Advanced"
        description="Re-paste a corrected receipt, history, and extra details"
        testId="expense-advanced"
        defaultOpen={Boolean(linkedReceipt)}
      >
        {linkedReceipt && can(ctx.roles, "expense.amend") ? (
          <ReceiptRepastePanel
            householdId={householdId}
            receiptId={linkedReceipt.id}
            status={linkedReceipt.status}
            expenseId={expenseId}
            originalTranscription={originalTranscription}
            transcriptionCorrected={Boolean(linkedReceipt.transcription_corrected)}
            revisionCount={receiptRevisions.length}
            revisions={receiptRevisions}
            intakeSource={
              linkedReceipt.intake_source === "camera" ||
              linkedReceipt.intake_source === "upload" ||
              linkedReceipt.intake_source === "paste"
                ? linkedReceipt.intake_source
                : "paste"
            }
            variant="advanced"
          />
        ) : (
          <p className="text-sm text-text-secondary">
            {linkedReceipt
              ? "You can view this receipt, but you cannot start a correction."
              : "This expense has no linked receipt to re-paste."}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <dt className="text-text-muted">Paid by</dt>
          <dd>{payerLabel}</dd>
          <dt className="text-text-muted">Added by</dt>
          <dd>{label(e.created_by_membership_id)}</dd>
          <dt className="text-text-muted">Confirmed</dt>
          <dd>{e.confirmed_at ? new Date(e.confirmed_at).toLocaleString() : "—"}</dd>
          {e.void_reason ? (
            <>
              <dt className="text-text-muted">Cancelled because</dt>
              <dd>{e.void_reason}</dd>
            </>
          ) : null}
          {e.supersedes_expense_id ? (
            <>
              <dt className="text-text-muted">Replaces</dt>
              <dd>
                <Link
                  className="underline"
                  href={`/app/${householdId}/money/expenses/${e.supersedes_expense_id}`}
                >
                  Original expense
                </Link>
              </dd>
            </>
          ) : null}
          {e.superseded_by_expense_id ? (
            <>
              <dt className="text-text-muted">Replaced by</dt>
              <dd>
                <Link
                  className="underline"
                  href={`/app/${householdId}/money/expenses/${e.superseded_by_expense_id}`}
                >
                  Updated expense
                </Link>
              </dd>
            </>
          ) : null}
        </dl>

        <div>
          <h3 className="text-sm font-semibold">History</h3>
          <ul className="mt-2 space-y-1 text-xs text-text-secondary">
            {(audits ?? []).map((a, i) => (
              <li key={`${a.created_at}-${i}`}>
                {new Date(a.created_at).toLocaleString()} —{" "}
                {formatAuditEventLabel(a.event_type)}
                {a.reason ? `: ${a.reason}` : ""}
              </li>
            ))}
            {(audits ?? []).length === 0 ? <li>No history yet.</li> : null}
          </ul>
        </div>

        {bundle.items.some((item) => item.allocation_mode) ? (
          <p className="text-xs text-text-muted">
            Split details:{" "}
            {[...new Set(bundle.items.map((item) => itemAllocationLabel(item.allocation_mode)))].join(
              "; ",
            )}
          </p>
        ) : null}

        {e.status === "confirmed" ? (
          <div className="space-y-4">
            {can(ctx.roles, "expense.amend") ? (
              <ActionForm
                action={createExpenseAmendmentAction}
                className="space-y-2"
                pendingLabel="Creating correction…"
              >
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="expenseId" value={expenseId} />
                <label className="block text-sm">
                  Correct this expense — reason
                  <textarea
                    name="reason"
                    required
                    rows={2}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2"
                    placeholder="What needs to change?"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm"
                  data-testid="amend-expense"
                >
                  Start a correction
                </button>
              </ActionForm>
            ) : null}

            {can(ctx.roles, "expense.void") ? (
              <ActionForm
                action={voidExpenseAction}
                className="space-y-2"
                pendingLabel="Cancelling…"
              >
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="expenseId" value={expenseId} />
                <label className="block text-sm">
                  Cancel this expense — reason
                  <textarea
                    name="reason"
                    required
                    rows={2}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2"
                    placeholder="Why should this no longer count?"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive"
                  data-testid="void-expense"
                >
                  Cancel expense
                </button>
              </ActionForm>
            ) : null}
          </div>
        ) : null}
      </DisclosureSection>
    </main>
  );
}
