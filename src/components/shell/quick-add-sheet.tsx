"use client";

import Link from "next/link";
import {
  CalendarPlus,
  CheckSquare,
  ClipboardList,
  Plus,
  Receipt,
  ScrollText,
  ShoppingCart,
  Users,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { QUICK_ADD_ACTIONS } from "@/lib/nav-items";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const ACTION_ICONS = {
  expense: Receipt,
  shopping: ShoppingCart,
  meal: UtensilsCrossed,
  chore: CheckSquare,
  event: CalendarPlus,
  maintenance: Wrench,
  guest: Users,
  decision: ScrollText,
} as const;

export function QuickAddSheet({
  open,
  onClose,
  householdId,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Quick add"
      testId="quick-add-sheet"
    >
      <ul className="flex flex-col gap-1">
        {QUICK_ADD_ACTIONS.map((action) => {
          const Icon =
            ACTION_ICONS[action.key as keyof typeof ACTION_ICONS] ??
            ClipboardList;
          return (
            <li key={action.key}>
              <Link
                href={action.href(householdId)}
                className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-text-primary hover:bg-surface-interactive"
                onClick={onClose}
                data-testid={`quick-add-${action.key}`}
              >
                <Icon className="h-5 w-5 text-text-muted" aria-hidden />
                {action.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}

export function QuickAddButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      aria-label="Quick add"
      data-testid="quick-add-button"
      onClick={onClick}
    >
      <Plus className="h-5 w-5" aria-hidden />
    </button>
  );
}
