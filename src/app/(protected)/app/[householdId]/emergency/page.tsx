import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { upsertEmergencyCardAction } from "@/app/actions/ux-c";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function EmergencyCardPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_emergency_cards" as never)
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();
  const card = (data ?? null) as Record<string, string | null> | null;
  const canEdit = ctx.roles.includes("household_coordinator");

  return (
    <main className="space-y-4" data-testid="emergency-card">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Emergency household card
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Household reference information only. HouseholdOS never replaces
          emergency services — call your local emergency number if you are in
          danger. Sensitive fields are member-visible and not publicly cached.
        </p>
      </header>

      {canEdit ? (
        <ActionForm
          action={upsertEmergencyCardAction}
          className="space-y-3"
          pendingLabel="Saving…"
        >
          <input type="hidden" name="householdId" value={householdId} />
          <Field label="Property address">
            <Input
              name="propertyAddress"
              defaultValue={card?.property_address ?? ""}
            />
          </Field>
          <Field label="Landlord contact">
            <Input
              name="landlordContact"
              defaultValue={card?.landlord_contact ?? ""}
            />
          </Field>
          <Field label="Emergency maintenance number">
            <Input
              name="emergencyMaintenanceNumber"
              defaultValue={card?.emergency_maintenance_number ?? ""}
            />
          </Field>
          <Field label="Utility emergency contacts">
            <Textarea
              name="utilityEmergencyContacts"
              rows={2}
              defaultValue={card?.utility_emergency_contacts ?? ""}
            />
          </Field>
          <Field label="Water shutoff location">
            <Input
              name="waterShutoffLocation"
              defaultValue={card?.water_shutoff_location ?? ""}
            />
          </Field>
          <Field label="Breaker panel location">
            <Input
              name="breakerPanelLocation"
              defaultValue={card?.breaker_panel_location ?? ""}
            />
          </Field>
          <Field label="Fire extinguisher locations">
            <Input
              name="fireExtinguisherLocations"
              defaultValue={card?.fire_extinguisher_locations ?? ""}
            />
          </Field>
          <Field label="Emergency meeting point">
            <Input
              name="emergencyMeetingPoint"
              defaultValue={card?.emergency_meeting_point ?? ""}
            />
          </Field>
          <Field label="Protected Wi-Fi details">
            <Input
              name="wifiDetailsProtected"
              defaultValue={card?.wifi_details_protected ?? ""}
            />
          </Field>
          <Field label="Pet instructions">
            <Textarea
              name="petInstructions"
              rows={2}
              defaultValue={card?.pet_instructions ?? ""}
            />
          </Field>
          <Field label="Other notes">
            <Textarea
              name="otherNotes"
              rows={2}
              defaultValue={card?.other_notes ?? ""}
            />
          </Field>
          <Field label="Visibility">
            <Select
              name="visibility"
              defaultValue={card?.visibility ?? "members"}
            >
              <option value="members">All members</option>
              <option value="coordinators">Coordinators only</option>
            </Select>
          </Field>
          <SubmitButton>Save emergency card</SubmitButton>
        </ActionForm>
      ) : card ? (
        <dl className="space-y-3 text-sm">
          {[
            ["Property address", card.property_address],
            ["Landlord contact", card.landlord_contact],
            ["Emergency maintenance", card.emergency_maintenance_number],
            ["Utility emergencies", card.utility_emergency_contacts],
            ["Water shutoff", card.water_shutoff_location],
            ["Breaker panel", card.breaker_panel_location],
            ["Fire extinguishers", card.fire_extinguisher_locations],
            ["Meeting point", card.emergency_meeting_point],
            ["Pet instructions", card.pet_instructions],
            ["Notes", card.other_notes],
          ].map(([label, value]) =>
            value ? (
              <div key={label as string}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {label}
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{value}</dd>
              </div>
            ) : null,
          )}
        </dl>
      ) : (
        <p className="text-sm text-text-secondary">
          No emergency card has been published yet. Ask a household coordinator
          to add it.
        </p>
      )}
    </main>
  );
}
