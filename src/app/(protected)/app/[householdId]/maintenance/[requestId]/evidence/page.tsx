import Link from "next/link";

export default async function MaintenanceEvidencePage({
  params,
}: {
  params: Promise<{ householdId: string; requestId: string }>;
}) {
  const { householdId, requestId } = await params;
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link
        href={`/app/${householdId}/maintenance/${requestId}`}
        className="text-sm text-text-secondary"
      >
        ← Request
      </Link>
      <h1 className="text-2xl font-semibold">Evidence</h1>
      <p className="text-sm text-text-secondary">
        JPEG, PNG, WebP, and PDF files up to 8 MB. Evidence is private to
        authorized household viewers. Upload via the secure attachment RPC after
        selecting a file in a follow-up enhancement; metadata listing is on the
        request detail page.
      </p>
    </div>
  );
}
