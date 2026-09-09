"use client";

import { useRef, useState, useTransition } from "react";
import { retagConfirmedExpenseItemAction } from "@/app/actions/expenses";
import type { MemberOption } from "@/lib/expenses/display";
import type { RetagMode } from "@/lib/expenses/apply-item-tag";

export function ExpenseItemRetag({
  householdId,
  expenseId,
  itemId,
  allocationMode,
  personalMembershipId,
  selectedIds,
  members,
  currentMembershipId,
}: {
  householdId: string;
  expenseId: string;
  itemId: string;
  allocationMode: string;
  personalMembershipId: string | null;
  selectedIds: string[];
  members: MemberOption[];
  currentMembershipId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickShared, setPickShared] = useState(false);
  const [sharedIds, setSharedIds] = useState(
    selectedIds.length > 0 ? selectedIds : members.map((m) => m.id),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  function submit(input: {
    allocationMode: RetagMode;
    personalMembershipId?: string;
    membershipIds?: string[];
  }) {
    idempotencyKeyRef.current = crypto.randomUUID();
    const fd = new FormData();
    fd.set("householdId", householdId);
    fd.set("expenseId", expenseId);
    fd.set("itemId", itemId);
    fd.set("allocationMode", input.allocationMode);
    fd.set("idempotencyKey", idempotencyKeyRef.current);
    if (input.personalMembershipId) {
      fd.set("personalMembershipId", input.personalMembershipId);
    }
    if (input.membershipIds) {
      fd.set("membershipIdsJson", JSON.stringify(input.membershipIds));
    }
    startTransition(async () => {
      const res = await retagConfirmedExpenseItemAction(null, fd);
      if (res && !res.ok) {
        setMessage(res.error);
        return;
      }
      setOpen(false);
      setPickShared(false);
    });
  }

  const current =
    allocationMode === "personal"
      ? personalMembershipId === currentMembershipId
        ? "mine"
        : "someone"
      : allocationMode === "excluded"
        ? "excluded"
        : allocationMode === "equal_selected"
          ? "shared"
          : "everyone";

  return (
    <div className="mt-2" data-testid="expense-item-retag">
      <button
        type="button"
        className="min-h-11 rounded-md border border-border px-3 text-sm"
        data-testid="expense-item-retag-open"
        onClick={() => {
          setOpen((v) => !v);
          setPickShared(false);
          setMessage(null);
        }}
      >
        {open ? "Cancel" : "Change who pays"}
      </button>
      {open ? (
        <div className="mt-2 space-y-2" data-testid="expense-item-retag-panel">
          <p className="text-xs text-text-secondary">
            This updates the submitted expense. Who owes what will change right
            away.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={pending || current === "everyone"}
              className="min-h-11 rounded-md border border-border px-3 text-left text-sm disabled:opacity-50"
              data-testid="retag-everyone"
              onClick={() => submit({ allocationMode: "equal_all" })}
            >
              Everyone
            </button>
            <button
              type="button"
              disabled={pending || current === "mine"}
              className="min-h-11 rounded-md border border-border px-3 text-left text-sm disabled:opacity-50"
              data-testid="retag-mine"
              onClick={() =>
                submit({
                  allocationMode: "personal",
                  personalMembershipId: currentMembershipId,
                })
              }
            >
              Just me
            </button>
            <button
              type="button"
              disabled={pending}
              className="min-h-11 rounded-md border border-border px-3 text-left text-sm disabled:opacity-50"
              data-testid="retag-shared"
              onClick={() => setPickShared(true)}
            >
              These people
            </button>
            {members
              .filter((m) => m.id !== currentMembershipId)
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={pending || (current === "someone" && personalMembershipId === m.id)}
                  className="min-h-11 rounded-md border border-border px-3 text-left text-sm disabled:opacity-50"
                  data-testid={`retag-person-${m.id}`}
                  onClick={() =>
                    submit({
                      allocationMode: "personal",
                      personalMembershipId: m.id,
                    })
                  }
                >
                  Just {m.label}
                </button>
              ))}
            <button
              type="button"
              disabled={pending || current === "excluded"}
              className="min-h-11 rounded-md border border-border px-3 text-left text-sm disabled:opacity-50"
              data-testid="retag-exclude"
              onClick={() => submit({ allocationMode: "excluded" })}
            >
              Not reimbursed
            </button>
          </div>
          {pickShared ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <ul className="space-y-1">
                {members.map((m) => (
                  <li key={m.id}>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={sharedIds.includes(m.id)}
                        onChange={(e) =>
                          setSharedIds((prev) =>
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
              <button
                type="button"
                disabled={pending || sharedIds.length === 0}
                className="min-h-11 w-full rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                data-testid="retag-shared-save"
                onClick={() =>
                  submit({
                    allocationMode:
                      sharedIds.length === members.length
                        ? "equal_all"
                        : "equal_selected",
                    membershipIds: sharedIds,
                  })
                }
              >
                Save people
              </button>
            </div>
          ) : null}
          {message ? (
            <p className="text-sm text-destructive" role="status">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
