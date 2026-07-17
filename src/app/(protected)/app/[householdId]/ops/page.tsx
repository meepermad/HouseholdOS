import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { AppBackButton } from "@/components/app-back-button";
import { RoommateOpsForms } from "@/components/ops/RoommateOpsForms";
import { forecastSupplyRestock } from "@/lib/ops/supply-forecast";

export const dynamic = "force-dynamic";

export default async function RoommateOpsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const supabase = await createClient();

  const [purchases, meetings, packages, contacts, supplies, household, members] =
    await Promise.all([
      supabase
        .from("shared_purchase_proposals")
        .select("id, title, status, estimated_amount_cents, created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("household_meeting_notes")
        .select("id, title, meeting_at, outcomes")
        .eq("household_id", householdId)
        .order("meeting_at", { ascending: false })
        .limit(10),
      supabase
        .from("household_packages")
        .select("id, carrier, status, location_note, created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("household_directory_contacts")
        .select("id, name, role_label, phone, email")
        .eq("household_id", householdId)
        .order("name")
        .limit(30),
      supabase
        .from("supply_items")
        .select("id, name, quantity, reorder_threshold, updated_at")
        .eq("household_id", householdId)
        .limit(40),
      supabase
        .from("households")
        .select("parking_module_enabled")
        .eq("id", householdId)
        .maybeSingle(),
      listActiveMemberOptions(householdId),
    ]);

  const forecast = forecastSupplyRestock(
    (supplies.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      quantity: s.quantity,
      reorderThreshold: s.reorder_threshold,
    })),
  );

  return (
    <main className="space-y-8">
      <AppBackButton fallbackHref={`/app/${householdId}`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Roommate ops
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Shared purchases, meetings, packages, directory, and approximate supply
          forecasts. Parking module{" "}
          {household.data?.parking_module_enabled ? "enabled" : "hidden until enabled"}.
        </p>
      </header>

      <RoommateOpsForms householdId={householdId} members={members} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Shared purchase proposals</h2>
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {(purchases.data ?? []).length === 0 ? (
            <li className="px-3 py-3 text-text-muted">None yet.</li>
          ) : (
            (purchases.data ?? []).map((p) => (
              <li key={p.id} className="px-3 py-2">
                {p.title} · {p.status}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Meeting board</h2>
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {(meetings.data ?? []).length === 0 ? (
            <li className="px-3 py-3 text-text-muted">No meetings logged.</li>
          ) : (
            (meetings.data ?? []).map((m) => (
              <li key={m.id} className="px-3 py-2">
                {m.title} · {new Date(m.meeting_at).toLocaleString()}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Packages</h2>
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {(packages.data ?? []).length === 0 ? (
            <li className="px-3 py-3 text-text-muted">No packages.</li>
          ) : (
            (packages.data ?? []).map((p) => (
              <li key={p.id} className="px-3 py-2">
                {p.carrier || "Package"} · {p.status}
                {p.location_note ? ` · ${p.location_note}` : ""}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Directory</h2>
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {(contacts.data ?? []).length === 0 ? (
            <li className="px-3 py-3 text-text-muted">No contacts.</li>
          ) : (
            (contacts.data ?? []).map((c) => (
              <li key={c.id} className="px-3 py-2">
                {c.name}
                {c.role_label ? ` · ${c.role_label}` : ""}
                {c.phone ? (
                  <>
                    {" "}
                    · <a href={`tel:${c.phone}`}>{c.phone}</a>
                  </>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Supply forecast (approximate)</h2>
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {forecast.length === 0 ? (
            <li className="px-3 py-3 text-text-muted">Nothing looks low right now.</li>
          ) : (
            forecast.map((f) => (
              <li key={f.id} className="px-3 py-2">
                {f.name} · consider restocking (qty {f.quantity ?? "?"} / threshold{" "}
                {f.reorderThreshold ?? "?"})
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
