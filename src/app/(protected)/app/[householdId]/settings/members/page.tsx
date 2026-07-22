import { ActionForm } from "@/components/action-form";
import {
  changeRolesAction,
  removeMemberAction,
} from "@/app/actions/household";
import { InviteForm } from "@/components/invite-form";
import { PendingInviteActions } from "@/components/pending-invite-actions";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function deliveryLabel(status: string | null | undefined): string {
  switch (status) {
    case "sent":
      return "Email sent";
    case "existing_account":
      return "Existing account";
    case "failed":
      return "Email failed";
    case "not_attempted":
      return "Not attempted";
    default:
      return "Unknown";
  }
}

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
        .select(
          "id, invited_email, status, expires_at, intended_roles, created_at, delivery_status, delivery_attempted_at, delivery_error_category",
        )
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
              <li key={m.id} className="rounded-md border border-border bg-surface p-4">
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
              <p className="text-sm text-text-muted">
                No pending invitations. Create an invitation above when you are ready to add a
                roommate.
              </p>
            ) : (
              <ul className="space-y-3">
                {(invitations ?? []).map((invite) => {
                  const canRetry =
                    invite.delivery_status === "failed" ||
                    invite.delivery_status === "not_attempted";
                  return (
                    <li
                      key={invite.id}
                      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 text-sm sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{invite.invited_email}</p>
                        <p className="text-xs text-slate-500">
                          Roles: {(invite.intended_roles ?? []).join(", ") || "member"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Expires {new Date(invite.expires_at).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">
                          Delivery: {deliveryLabel(invite.delivery_status)}
                          {invite.delivery_error_category
                            ? ` (${invite.delivery_error_category})`
                            : ""}
                        </p>
                        {invite.delivery_status === "failed" ? (
                          <p className="text-xs text-amber-800">
                            Plaintext join tokens are not stored. Regenerate this invitation to
                            get a new canonical join link, or revoke it if it was exposed.
                          </p>
                        ) : null}
                      </div>
                      <PendingInviteActions
                        householdId={householdId}
                        invitationId={invite.id}
                        canRetry={canRetry}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
