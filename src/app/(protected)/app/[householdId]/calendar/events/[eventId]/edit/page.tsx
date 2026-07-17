import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyEventEditRedirect({
  params,
}: {
  params: Promise<{ householdId: string; eventId: string }>;
}) {
  const { householdId, eventId } = await params;
  redirect(`/app/${householdId}/calendar/event/${eventId}/edit`);
}
