"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "inventory", label: "Inventory" },
  { key: "supplies", label: "Supplies" },
  { key: "pantry", label: "Pantry" },
  { key: "shopping", label: "Shopping" },
] as const;

export function HouseHubTabs({ householdId }: { householdId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="House resources" className="flex flex-wrap gap-2 border-b border-border pb-2 text-sm">
      {TABS.map((tab) => {
        const href = `/app/${householdId}/house/${tab.key}`;
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={tab.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`min-h-11 rounded-md px-3 py-2.5 font-medium ${
              active
                ? "bg-primary text-primary-foreground"
                : "border border-border text-text-secondary hover:bg-surface-interactive"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
