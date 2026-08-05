"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Every House sub-destination, in the order people reach for them. This row is
 * the only directory for the hub — House is a primary nav tab, so Chores and
 * Maintenance must be findable here rather than only under More.
 */
const TABS = [
  {
    key: "chores",
    label: "Chores",
    href: (id: string) => `/app/${id}/chores`,
    testId: "house-link-chores",
  },
  { key: "shopping", label: "Shopping", href: (id: string) => `/app/${id}/house/shopping` },
  { key: "pantry", label: "Pantry", href: (id: string) => `/app/${id}/house/pantry` },
  { key: "supplies", label: "Supplies", href: (id: string) => `/app/${id}/house/supplies` },
  { key: "inventory", label: "Inventory", href: (id: string) => `/app/${id}/house/inventory` },
  { key: "recipes", label: "Recipes", href: (id: string) => `/app/${id}/recipes` },
  { key: "meals", label: "Meals", href: (id: string) => `/app/${id}/meals` },
  { key: "meal-prep", label: "Meal prep", href: (id: string) => `/app/${id}/meal-prep` },
  {
    key: "maintenance",
    label: "Maintenance",
    href: (id: string) => `/app/${id}/maintenance`,
    testId: "house-link-maintenance",
  },
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
          (tab.key === "meal-prep" && pathname?.includes("/meal-prep")) ||
          (tab.key === "chores" && pathname?.includes("/responsibilities"));
        return (
          <Link
            key={tab.key}
            href={href}
            data-testid={"testId" in tab ? tab.testId : undefined}
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
