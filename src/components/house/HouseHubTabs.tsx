"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "inventory", label: "Inventory", href: (id: string) => `/app/${id}/house/inventory` },
  { key: "supplies", label: "Supplies", href: (id: string) => `/app/${id}/house/supplies` },
  { key: "pantry", label: "Pantry", href: (id: string) => `/app/${id}/house/pantry` },
  { key: "shopping", label: "Shopping", href: (id: string) => `/app/${id}/house/shopping` },
  { key: "meals", label: "Meals", href: (id: string) => `/app/${id}/meals` },
  { key: "recipes", label: "Recipes", href: (id: string) => `/app/${id}/recipes` },
  { key: "meal-prep", label: "Meal prep", href: (id: string) => `/app/${id}/meal-prep` },
] as const;

export function HouseHubTabs({ householdId }: { householdId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="House resources" className="flex flex-wrap gap-2 border-b border-border pb-2 text-sm">
      {TABS.map((tab) => {
        const href = tab.href(householdId);
        const active =
          pathname === href ||
          pathname?.startsWith(`${href}/`) ||
          (tab.key === "meals" && pathname?.includes("/meals")) ||
          (tab.key === "recipes" && pathname?.includes("/recipes")) ||
          (tab.key === "meal-prep" && pathname?.includes("/meal-prep"));
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
