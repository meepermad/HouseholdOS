import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  archiveHouseholdAction,
  changeRoleAction,
  inviteMemberAction,
  leaveHouseholdAction,
  removeMemberAction,
  revokeInviteAction,
  transferOwnershipAction,
  updateHouseholdAction,
  updateSettingsAction,
} from "@/app/actions/household";
import { can, type HouseholdRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatInTimezone } from "@/lib/time";

export default async function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: household } = await supabase
    .from("households")
    .select("*")
    .eq("id", householdId)
    .maybeSingle();

  if (!household) notFound();

  const { data: settings } = await supabase
    .from("household_settings")
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();

  const { data: myMembership } = await supabase
    .from("household_memberships")
    .select("*")
    .eq("household_id", householdId)
    .eq("user_id", user!.id)
    .eq("status", "active")
    .maybeSingle();

  if (!myMembership) notFound();
  const role = myMembership.role as HouseholdRole;

  const { data: members } = await supabase
    .from("household_memberships")
    .select("id, role, status, user_id, profiles(display_name)")
    .eq("household_id", householdId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  const { data: invitations } = await supabase
    .from("household_invitations")
    .select("*")
    .eq("household_id", householdId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: audits } = await supabase
    .from("audit_events")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-8">
      <section>
        <Link href="/households" className="text-sm text-slate-600 underline">
          All households
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          {household.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Your role: {role} · {household.status}
        </p>
      </section>

      {can(role, "household.update") ? (
        <section className="rounded-md border border-line bg-surface p-4">
          <h2 className="font-semibold">Household</h2>
          <ActionForm action={updateHouseholdAction} className="mt-3 space-y-3">
            <input type="hidden" name="householdId" value={householdId} />
            <label className="block text-sm">
              Name
              <input
                name="name"
                defaultValue={household.name}
                required
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
              Save name
            </button>
          </ActionForm>
        </section>
      ) : null}

      {can(role, "settings.update") && settings ? (
        <section className="rounded-md border border-line bg-surface p-4">
          <h2 className="font-semibold">Settings</h2>
          <ActionForm action={updateSettingsAction} className="mt-3 space-y-3">
            <input type="hidden" name="householdId" value={householdId} />
            <label className="block text-sm">
              Display name
              <input
                name="displayName"
                defaultValue={settings.display_name}
                required
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Timezone
              <input
                name="timezone"
                defaultValue={settings.timezone}
                required
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Currency
              <input
                name="currency"
                defaultValue={settings.currency}
                required
                readOnly
                className="mt-1 w-full rounded-md border border-line bg-[#f3efe6] px-3 py-2"
              />
            </label>
            <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
              Save settings
            </button>
          </ActionForm>
        </section>
      ) : null}

      <section className="rounded-md border border-line bg-surface p-4">
        <h2 className="font-semibold">Members</h2>
        <ul className="mt-3 space-y-3">
          {(members ?? []).map((m) => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return (
              <li key={m.id} className="border-b border-line pb-3 last:border-0">
                <div className="text-sm font-medium">
                  {profile?.display_name ?? m.user_id.slice(0, 8)}
                </div>
                <div className="text-xs text-slate-600">{m.role}</div>
                {can(role, "member.change_role") && m.user_id !== user!.id && m.role !== "owner" ? (
                  <ActionForm action={changeRoleAction} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="membershipId" value={m.id} />
                    <select
                      name="role"
                      defaultValue={m.role}
                      className="rounded-md border border-line px-2 py-1 text-sm"
                    >
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                    </select>
                    <button type="submit" className="text-sm underline">
                      Update role
                    </button>
                  </ActionForm>
                ) : null}
                {can(role, "member.transfer_ownership") &&
                m.user_id !== user!.id &&
                m.status === "active" ? (
                  <ActionForm action={transferOwnershipAction} className="mt-2">
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="membershipId" value={m.id} />
                    <button type="submit" className="text-sm text-amber-800 underline">
                      Transfer ownership
                    </button>
                  </ActionForm>
                ) : null}
                {can(role, "member.remove") && m.user_id !== user!.id && m.role !== "owner" ? (
                  <ActionForm action={removeMemberAction} className="mt-2">
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="membershipId" value={m.id} />
                    <button type="submit" className="text-sm text-red-700 underline">
                      Remove
                    </button>
                  </ActionForm>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {can(role, "member.invite") ? (
        <section className="rounded-md border border-line bg-surface p-4">
          <h2 className="font-semibold">Invite member</h2>
          <ActionForm action={inviteMemberAction} className="mt-3 space-y-3">
            <input type="hidden" name="householdId" value={householdId} />
            <label className="block text-sm">
              Email
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Role
              <select name="role" defaultValue="member" className="mt-1 w-full rounded-md border border-line px-3 py-2">
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
              Create invite
            </button>
          </ActionForm>
          <ul className="mt-4 space-y-2">
            {(invitations ?? []).map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {invite.email} · {invite.role}
                </span>
                <ActionForm action={revokeInviteAction}>
                  <input type="hidden" name="householdId" value={householdId} />
                  <input type="hidden" name="invitationId" value={invite.id} />
                  <button type="submit" className="text-red-700 underline">
                    Revoke
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-md border border-line bg-surface p-4">
        <h2 className="font-semibold">Recent audit</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(audits ?? []).length === 0 ? (
            <li className="text-slate-600">No events yet.</li>
          ) : (
            (audits ?? []).map((event) => (
              <li key={event.id} className="border-b border-line pb-2 last:border-0">
                <div className="font-medium">{event.action}</div>
                <div className="text-xs text-slate-600">
                  {formatInTimezone(event.created_at, settings?.timezone)}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-3">
        {can(role, "member.leave") ? (
          <ActionForm action={leaveHouseholdAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <button type="submit" className="text-sm text-red-700 underline">
              Leave household
            </button>
          </ActionForm>
        ) : null}
        {can(role, "household.archive") ? (
          <ActionForm action={archiveHouseholdAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <button type="submit" className="text-sm text-amber-800 underline">
              Archive household
            </button>
          </ActionForm>
        ) : null}
      </section>
    </div>
  );
}
