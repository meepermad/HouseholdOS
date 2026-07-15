import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { listActiveMembers } from "@/lib/calendar/queries";
import { CalendarEventForm } from "@/components/calendar/CalendarEventForm";
import { AppBackButton } from "@/components/app-back-button";
import { DEFAULT_TIMEZONE } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function NewCalendarEventPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  if (!can(ctx.roles, "calendar.create")) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: profile }, members] = await Promise.all([
    supabase
      .from("profiles")
      .select("preferred_timezone")
      .eq("id", ctx.userId)
      .maybeSingle(),
    listActiveMembers(householdId),
  ]);

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/calendar`} />
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          New event
        </h1>
        <p className="text-sm text-text-secondary">
          Add a shared event to the household calendar. You can invite members,
          set reminders, and control who sees the details.
        </p>
      </header>

      <CalendarEventForm
        householdId={householdId}
        members={members}
        currentMembershipId={ctx.membershipId}
        defaultTimeZone={profile?.preferred_timezone || DEFAULT_TIMEZONE}
      />
    </main>
  );
}
