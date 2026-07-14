import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { createHouseholdAction } from "@/app/actions/household";
import { createClient } from "@/lib/supabase/server";

export default async function HouseholdsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("household_memberships")
    .select("id, role, household_id, households(id, name, status, slug)")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .order("joined_at", { ascending: false });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Your households</h1>
        <p className="mt-1 text-sm text-slate-600">
          Phase 0: membership, settings, and audit foundations.
        </p>
      </section>

      <section className="space-y-3">
        {(memberships ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">No households yet. Create one below.</p>
        ) : (
          (memberships ?? []).map((m) => {
            const household = Array.isArray(m.households) ? m.households[0] : m.households;
            if (!household) return null;
            return (
              <Link
                key={m.id}
                href={`/households/${household.id}`}
                className="block rounded-md border border-line bg-surface px-4 py-3"
              >
                <div className="font-semibold">{household.name}</div>
                <div className="text-xs text-slate-600">
                  {m.role} · {household.status}
                </div>
              </Link>
            );
          })
        )}
      </section>

      <section className="rounded-md border border-line bg-surface p-4">
        <h2 className="font-semibold">Create household</h2>
        <ActionForm action={createHouseholdAction} className="mt-3 space-y-3">
          <label className="block text-sm">
            Name
            <input
              name="name"
              required
              minLength={2}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
              placeholder="Oak Street House"
            />
          </label>
          <label className="block text-sm">
            Display name
            <input
              name="displayName"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
              placeholder="Optional"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Create
          </button>
        </ActionForm>
      </section>
    </div>
  );
}
