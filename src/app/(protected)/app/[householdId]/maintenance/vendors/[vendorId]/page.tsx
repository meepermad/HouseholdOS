import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function MaintenanceVendorDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; vendorId: string }>;
}) {
  const { householdId, vendorId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_external_contacts")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", vendorId)
    .maybeSingle();
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link
        href={`/app/${householdId}/maintenance/vendors`}
        className="text-sm text-text-secondary"
      >
        ← Vendors
      </Link>
      <h1 className="text-2xl font-semibold">{data.display_name}</h1>
      <p className="text-sm text-text-secondary">
        {data.contact_type.replaceAll("_", " ")}
      </p>
      {data.organization ? <p className="text-sm">{data.organization}</p> : null}
      {data.phone ? <p className="text-sm">Phone: {data.phone}</p> : null}
      {data.email ? <p className="text-sm">Email: {data.email}</p> : null}
      {data.notes ? (
        <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
      ) : null}
      <p className="text-xs text-text-secondary">
        HouseholdOS does not automatically email or SMS vendors.
      </p>
    </div>
  );
}
