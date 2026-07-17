import { assertActiveMembership } from "@/lib/household-context";
import { describeReceiptOcrStatus } from "@/lib/receipts/adapters";
import { ReceiptUploader } from "@/components/receipts/ReceiptUploader";
import { AppBackButton } from "@/components/app-back-button";

export const dynamic = "force-dynamic";

export default async function NewReceiptPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const ocr = describeReceiptOcrStatus();

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money/receipts`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
          Scan receipt
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Capture, improve, and read the receipt on this device. Review and
          correct every field before any expense is created.
        </p>
      </header>
      <ReceiptUploader
        householdId={householdId}
        ocrConfigured={ocr.configured}
        ocrMessage={ocr.message}
        privacyLabel={ocr.privacyLabel}
        cloudConfigured={ocr.cloudAvailable}
      />
    </main>
  );
}
