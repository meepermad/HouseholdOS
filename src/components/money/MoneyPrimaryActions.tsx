import Link from "next/link";
import type { PrimaryAction } from "@/lib/money/primary-actions";

export function MoneyPrimaryActions({ actions }: { actions: PrimaryAction[] }) {
  if (actions.length === 0) return null;
  return (
    <section
      className="flex flex-wrap gap-2"
      aria-label="Primary actions"
      data-testid="money-primary-actions"
    >
      {actions.map((action, index) => (
        <Link
          key={action.key}
          href={action.href}
          data-testid={action.testId}
          className={
            index === 0
              ? "inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              : "inline-flex min-h-11 items-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"
          }
        >
          {action.label}
        </Link>
      ))}
    </section>
  );
}
