import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { createMaintenanceVendorAction } from "@/app/actions/maintenance";
import { listMaintenanceVendors } from "@/lib/maintenance/queries";
import { VENDOR_CONTACT_TYPES } from "@/lib/maintenance";

export default async function MaintenanceVendorsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const vendors = await listMaintenanceVendors(householdId);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="space-y-2">
        <Link
          href={`/app/${householdId}/maintenance`}
          className="text-sm text-text-secondary"
        >
          ← Maintenance
        </Link>
        <h1 className="text-2xl font-semibold">Vendors & contacts</h1>
      </header>
      <ul className="space-y-2">
        {vendors.map((v) => (
          <li key={v.id}>
            <Link
              href={`/app/${householdId}/maintenance/vendors/${v.id}`}
              className="block rounded-md border border-border p-3"
            >
              <p className="font-medium">{v.display_name}</p>
              <p className="text-sm text-text-secondary">{v.contact_type}</p>
            </Link>
          </li>
        ))}
      </ul>
      <ActionForm action={createMaintenanceVendorAction} className="space-y-3">
        <input type="hidden" name="householdId" value={householdId} />
        <h2 className="text-lg font-semibold">Add contact</h2>
        <input
          name="displayName"
          required
          placeholder="Display name"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
        />
        <select
          name="contactType"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
        >
          {VENDOR_CONTACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground"
        >
          Save contact
        </button>
      </ActionForm>
    </div>
  );
}
