"use client";

import { useState, useTransition } from "react";
import { uploadReceiptAction } from "@/app/actions/receipts";

type Props = {
  householdId: string;
  ocrConfigured: boolean;
  ocrMessage: string;
};

export function ReceiptUploader({
  householdId,
  ocrConfigured,
  ocrMessage,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4" data-testid="receipt-uploader">
      <p
        className={`text-sm ${ocrConfigured ? "text-text-secondary" : "text-amber-700 dark:text-amber-300"}`}
        data-testid="receipt-ocr-status"
      >
        {ocrMessage}
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("householdId", householdId);
          startTransition(async () => {
            const res = await uploadReceiptAction(null, fd);
            if (!res.ok) setError(res.error ?? "Upload failed.");
            else if (res.data?.redirectTo) {
              window.location.href = res.data.redirectTo;
            }
          });
        }}
      >
        <label className="block text-sm font-medium text-text-primary">
          Receipt photo or PDF
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,capture=environment"
            capture="environment"
            required
            className="mt-2 block w-full text-sm"
            data-testid="receipt-file-input"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          data-testid="receipt-upload-submit"
        >
          {pending ? "Uploading…" : "Upload receipt"}
        </button>
      </form>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
