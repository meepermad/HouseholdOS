import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { formatUsdFromCents, toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function HouseholdHomePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const supabase = await createClient();

  const [{ data: household }, { data: settings }, { data: members }, { data: activity }] =
    await Promise.all([
      supabase
        .from("households")
        .select("*")
        .eq("id", householdId)
        .single(),
      supabase
        .from("household_settings")
        .select("*")
        .eq("household_id", householdId)
        .single(),
      supabase
        .from("household_memberships")
        .select("id, user_id, status, profiles(display_name, email)")
        .eq("household_id", householdId)
        .eq("status", "active"),
      supabase
        .from("audit_events")
        .select("id, event_type, created_at, entity_type")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  return (
    <main className="space-y-8">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          {household?.name ?? "Household"}
        </h1>
        {household?.property_nickname ? (
          <p className="mt-1 text-sm text-slate-600">{household.property_nickname}</p>
        ) : null}
        <p className="mt-2 text-sm text-slate-600">
          Your roles: {ctx.roles.join(", ")}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Setup
        </h2>
        <ul className="space-y-1 text-sm">
          <li>Household created</li>
          <li>
            Approval threshold:{" "}
            {settings
              ? formatUsdFromCents(toCents(settings.purchase_approval_threshold_cents))
              : "—"}
          </li>
          <li>
            Reimbursement policy:{" "}
            {settings?.reimbursement_policy_acknowledged_at
              ? "Acknowledged (external payment)"
              : "Pending"}
          </li>
          <li>Active members: {members?.length ?? 0}</li>
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Members
          </h2>
          {can(ctx.roles, "member.invite") ? (
            <Link
              href={`/app/${householdId}/settings/members`}
              className="text-sm underline"
            >
              Manage
            </Link>
          ) : null}
        </div>
        <ul className="space-y-2">
          {(members ?? []).map((m) => {
            const profile = m.profiles as
              | { display_name: string | null; email: string }
              | { display_name: string | null; email: string }[]
              | null;
            const p = Array.isArray(profile) ? profile[0] : profile;
            return (
              <li key={m.id} className="text-sm">
                {p?.display_name || p?.email || m.user_id}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent activity
        </h2>
        {(activity ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(activity ?? []).map((event) => (
              <li key={event.id} className="flex justify-between gap-3">
                <span>{event.event_type}</span>
                <time className="shrink-0 text-slate-500">
                  {new Date(event.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap gap-3 text-sm">
        <Link href={`/app/${householdId}/settings/profile`} className="underline">
          Profile
        </Link>
        <Link href={`/app/${householdId}/settings/household`} className="underline">
          Household settings
        </Link>
        <Link href={`/app/${householdId}/settings/members`} className="underline">
          Members & invites
        </Link>
      </section>
    </main>
  );
}
