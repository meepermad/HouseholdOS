import { assertActiveMembership } from "@/lib/household-context";
import { describeReceiptOcrStatus } from "@/lib/receipts/adapters";
import { ReceiptUploader } from "@/components/receipts/ReceiptUploader";
import { ReceiptPasteFlow } from "@/components/receipts/ReceiptPasteFlow";
import { AppBackButton } from "@/components/app-back-button";
import { listActiveMemberOptions } from "@/lib/expenses/queries";

export const dynamic = "force-dynamic";

export default async function NewReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { householdId } = await params;
  const { mode } = await searchParams;
  await assertActiveMembership(householdId);
  const ocr = describeReceiptOcrStatus();
  const captureMode =
    mode === "camera" ? "camera" : mode === "file" ? "file" : mode === "paste" ? "paste" : "auto";
  const members = mode === "paste" ? await listActiveMemberOptions(householdId) : [];
  const isPaste = captureMode === "paste";

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money/receipts`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
          {isPaste ? "Paste receipt" : "Add a receipt"}
        </h1>
        {!isPaste ? (
          <p className="mt-1 text-sm text-text-secondary">
            Upload a photo. HouseholdOS reads it on this device, then you decide
            who each item belongs to.
          </p>
        ) : null}
      </header>
      {isPaste ? (
        <ReceiptPasteFlow householdId={householdId} members={members} />
      ) : (
        <ReceiptUploader
          householdId={householdId}
          ocrConfigured={ocr.configured}
          ocrMessage={ocr.message}
          privacyLabel={ocr.privacyLabel}
          cloudConfigured={ocr.cloudAvailable}
          captureMode={captureMode}
        />
      )}
    </main>
  );
}
