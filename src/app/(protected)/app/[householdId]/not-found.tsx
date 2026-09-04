"use client";

import { usePathname } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { ResourceGone } from "@/components/recovery/resource-gone";

export default function HouseholdResourceNotFound() {
  const pathname = usePathname();
  const householdId = pathname.match(/^\/app\/([^/]+)/)?.[1];
  const home = householdId ? `/app/${householdId}` : "/app";
  const money = householdId ? `/app/${householdId}/money` : home;
  const house = householdId ? `/app/${householdId}/house` : home;
  const calendar = householdId ? `/app/${householdId}/calendar/agenda` : home;

  let href = home;
  let actionLabel = "Go home";
  if (pathname.includes("/money")) {
    href = money;
    actionLabel = "Go to Money";
  } else if (pathname.includes("/calendar")) {
    href = calendar;
    actionLabel = "Go to Calendar";
  } else if (
    pathname.includes("/house") ||
    pathname.includes("/chores") ||
    pathname.includes("/maintenance") ||
    pathname.includes("/recipes") ||
    pathname.includes("/meals")
  ) {
    href = house;
    actionLabel = "Go to House";
  }

  return (
    <main className="space-y-4">
      <AppBackButton fallbackHref={href} />
      <ResourceGone
        title="This item is no longer available."
        href={href}
        actionLabel={actionLabel}
      />
    </main>
  );
}
