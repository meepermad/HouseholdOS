import { redirect } from "next/navigation";

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
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
  }
  const qs = q.toString();
  redirect(
    `/app/${householdId}/calendar/event/${eventId}${qs ? `?${qs}` : ""}`,
  );
}
