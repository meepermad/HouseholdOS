"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { MoneyToolsGroups } from "@/lib/money/overview";

export function MoneyToolsSheet({ tools }: { tools: MoneyToolsGroups }) {
  const [open, setOpen] = useState(false);
  const groups: { title: string; items: MoneyToolsGroups["records"] }[] = [
    { title: "Records", items: tools.records },
    { title: "Balance tools", items: tools.balanceTools },
    { title: "Receipts and reporting", items: tools.receiptsReporting },
    { title: "Settings", items: tools.settings },
  ];

  return (
    <section data-testid="money-secondary-tools">
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
        onClick={() => setOpen(true)}
        data-testid="money-tools-open"
      >
        Tools
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Money tools"
        testId="money-tools-sheet"
      >
        <div className="flex flex-col gap-4">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.title}>
                <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {group.title}
                </p>
                <ul className="flex flex-col gap-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        data-testid={item.testId}
                        className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-surface-interactive"
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      </BottomSheet>
    </section>
  );
}
