"use client";

import { ReceiptCaptureFlow } from "./ReceiptCaptureFlow";

type Props = {
  householdId: string;
  ocrConfigured: boolean;
  ocrMessage: string;
  privacyLabel?: string;
  cloudConfigured?: boolean;
  captureMode?: "camera" | "file" | "auto";
};

/** Legacy entry — delegates to local OCR capture flow. */
export function ReceiptUploader({
  householdId,
  ocrConfigured,
  ocrMessage,
  privacyLabel,
  cloudConfigured = false,
  captureMode = "auto",
}: Props) {
  return (
    <div data-testid="receipt-uploader">
      <ReceiptCaptureFlow
        householdId={householdId}
        ocrConfigured={ocrConfigured}
        ocrMessage={ocrMessage}
        privacyLabel={privacyLabel ?? ocrMessage}
        cloudConfigured={cloudConfigured}
        captureMode={captureMode}
      />
    </div>
  );
}
