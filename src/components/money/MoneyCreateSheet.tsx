"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  isMoneyCreateEmpty,
  type MoneyCreateAction,
  type MoneyCreateGroups,
} from "@/lib/money/create-actions";

function CreateLink({
  action,
  onNavigate,
}: {
  action: MoneyCreateAction;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={action.href}
      data-testid={action.testId}
      onClick={onNavigate}
      className="flex min-h-11 flex-col justify-center rounded-md px-3 py-2 hover:bg-surface-interactive"
    >
      <span className="text-sm font-medium text-text-primary">{action.label}</span>
      <span className="text-xs text-text-secondary">{action.description}</span>
    </Link>
  );
}

export function MoneyCreateSheet({ create }: { create: MoneyCreateGroups }) {
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);

  if (isMoneyCreateEmpty(create)) return null;

  function close() {
    setOpen(false);
    setShowMore(false);
  }

  return (
    <section data-testid="money-create">
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        onClick={() => setOpen(true)}
        data-testid="money-create-open"
      >
        Add
      </button>
      <BottomSheet
        open={open}
        onClose={close}
        title="Add to Money"
        testId="money-create-sheet"
      >
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1">
            {create.primary.map((action) => (
              <li key={action.key}>
                <CreateLink action={action} onNavigate={close} />
              </li>
            ))}
          </ul>

          {create.more.length > 0 ? (
            showMore ? (
              <div>
                <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  More ways to add
                </p>
                <ul className="flex flex-col gap-1" data-testid="money-create-more-list">
                  {create.more.map((action) => (
                    <li key={action.key}>
                      <CreateLink action={action} onNavigate={close} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <button
                type="button"
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-primary hover:bg-surface-interactive"
                onClick={() => setShowMore(true)}
                data-testid="money-create-more"
              >
                More ways to add
              </button>
            )
          ) : null}
        </div>
      </BottomSheet>
    </section>
  );
}
