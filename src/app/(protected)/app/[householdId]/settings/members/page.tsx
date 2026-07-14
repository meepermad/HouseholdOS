import { ActionForm } from "@/components/action-form";
import {
  changeRolesAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/app/actions/household";
import { InviteForm } from "@/components/invite-form";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("household_memberships")
    .select(
      "id, user_id, status, profiles(display_name, email), household_membership_roles(role)",
    )
    .eq("household_id", householdId)
    .in("status", ["active", "leaving"]);

  const { data: invitations } = can(ctx.roles, "member.invite")
    ? await supabase
        .from("household_invitations")
        .select("id, invited_email, status, expires_at, intended_roles, created_at")
        .eq("household_id", householdId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  return (
    <main className="space-y-8">
      <h1 className="text-2xl font-semibold">Members & invitations</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Active members
        </h2>
        <ul className="space-y-4">
          {(memberships ?? []).map((m) => {
            const profile = m.profiles as
              | { display_name: string | null; email: string }
              | null;
            const roles = (
              (m.household_membership_roles as { role: string }[] | null) ?? []
            ).map((r) => r.role);

            return (
              <li key={m.id} className="rounded-md border border-line bg-surface p-3">
                <p className="font-medium">
                  {profile?.display_name || profile?.email || m.user_id}
                </p>
                <p className="text-xs text-slate-500">{roles.join(", ")}</p>
                {can(ctx.roles, "member.change_roles") && m.id !== ctx.membershipId ? (
                  <ActionForm action={changeRolesAction} className="mt-3 space-y-2">
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="membershipId" value={m.id} />
                    <label className="mr-3 inline-flex items-center gap-1 text-xs">
                      <input type="checkbox" name="roles" value="member" defaultChecked />
                      member
                    </label>
                    <label className="mr-3 inline-flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        name="roles"
                        value="household_coordinator"
                        defaultChecked={roles.includes("household_coordinator")}
                      />
                      household_coordinator
                    </label>
                    <label className="inline-flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        name="roles"
                        value="financial_coordinator"
                        defaultChecked={roles.includes("financial_coordinator")}
                      />
                      financial_coordinator
                    </label>
                    <button type="submit" className="block text-sm underline">
                      Update roles
                    </button>
                  </ActionForm>
                ) : null}
                {can(ctx.roles, "member.remove") && m.id !== ctx.membershipId ? (
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

      {can(ctx.roles, "member.invite") ? (
        <>
          <InviteForm householdId={householdId} />
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Pending invitations
            </h2>
            {(invitations ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No pending invitations.</p>
            ) : (
              <ul className="space-y-3">
                {(invitations ?? []).map((invite) => (
                  <li
                    key={invite.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-line p-3 text-sm"
                  >
                    <div>
                      <p>{invite.invited_email}</p>
                      <p className="text-xs text-slate-500">
                        Expires {new Date(invite.expires_at).toLocaleString()}
                      </p>
                    </div>
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
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
