"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const PRIMARY_TABS = [
  {
    key: "chores",
    label: "Chores",
    href: (id: string) => `/app/${id}/chores`,
    testId: "house-link-chores",
  },
  { key: "shopping", label: "Shopping", href: (id: string) => `/app/${id}/house/shopping` },
  { key: "pantry", label: "Pantry", href: (id: string) => `/app/${id}/house/pantry` },
  { key: "recipes", label: "Recipes", href: (id: string) => `/app/${id}/recipes` },
  {
    key: "maintenance",
    label: "Maintenance",
    href: (id: string) => `/app/${id}/maintenance`,
    testId: "house-link-maintenance",
  },
] as const;

const MORE_TABS = [
  { key: "supplies", label: "Supplies", href: (id: string) => `/app/${id}/house/supplies` },
  { key: "inventory", label: "Household items", href: (id: string) => `/app/${id}/house/inventory` },
  { key: "meals", label: "Meals", href: (id: string) => `/app/${id}/meals` },
  { key: "meal-prep", label: "Meal prep", href: (id: string) => `/app/${id}/meal-prep` },
] as const;

function tabActive(pathname: string | null, href: string, key: string) {
  return (
    pathname === href ||
    pathname?.startsWith(`${href}/`) ||
    (key === "meals" && pathname?.includes("/meals")) ||
    (key === "recipes" && pathname?.includes("/recipes")) ||
    (key === "meal-prep" && pathname?.includes("/meal-prep")) ||
    (key === "chores" && pathname?.includes("/responsibilities"))
  );
}

export function HouseHubTabs({ householdId }: { householdId: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_TABS.some((tab) =>
    tabActive(pathname, tab.href(householdId), tab.key),
  );

  return (
    <nav aria-label="House" className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-sm">
      {PRIMARY_TABS.map((tab) => {
        const href = tab.href(householdId);
        const active = tabActive(pathname, href, tab.key);
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
      <button
        type="button"
        data-testid="house-tools-open"
        aria-expanded={moreOpen}
        className={`min-h-11 rounded-md px-3 py-2.5 font-medium ${
          moreActive || moreOpen
            ? "bg-primary text-primary-foreground"
            : "border border-border text-text-secondary hover:bg-surface-interactive"
        }`}
        onClick={() => setMoreOpen(true)}
      >
        More house tools
      </button>
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More house tools"
        testId="house-tools-sheet"
      >
        <ul className="flex flex-col gap-1">
          {MORE_TABS.map((tab) => {
            const href = tab.href(householdId);
            const active = tabActive(pathname, href, tab.key);
            return (
              <li key={tab.key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-surface-interactive"
                  onClick={() => setMoreOpen(false)}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </nav>
  );
}
