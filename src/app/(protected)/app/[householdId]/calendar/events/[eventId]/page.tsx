import { redirect } from "next/navigation";
import { householdRoutes } from "@/lib/routes/household";

export const dynamic = "force-dynamic";

/** Compatibility redirect: `/calendar/events/...` → `/calendar/event/...` */
export default async function LegacyEventDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string; eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { householdId, eventId } = await params;
  if (eventId === "new") {
    redirect(householdRoutes.calendar.new(householdId));
  }
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
  }
  const qs = q.toString();
  const target = householdRoutes.calendar.event(householdId, eventId);
  redirect(`${target}${qs ? `?${qs}` : ""}`);
}
