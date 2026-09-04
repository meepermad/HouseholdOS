"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  markReceiptOcrOutcomeAction,
  submitLocalReceiptExtractionAction,
  uploadReceiptAction,
} from "@/app/actions/receipts";
import { loginUrlForPath, receiptCaptureReturnPath } from "@/lib/auth/login-next";
import {
  cancelLocalOcr,
  runLocalOcrOnImages,
  terminateLocalOcrWorker,
  type OcrProgress,
} from "@/lib/receipts/client/tesseract-session";
import { renderPdfReceiptPages } from "@/lib/receipts/client/pdf-render";
import {
  discardOfflineReceiptDraft,
  listOfflineReceiptDrafts,
  saveOfflineReceiptDraft,
  type OfflineReceiptDraft,
} from "@/lib/receipts/client/offline-draft";
import { normalizeReceiptUpload } from "@/lib/receipts/client/normalize-upload";
import { parseReceiptFromOcr } from "@/lib/receipts/local-ocr/parse";
import { preprocessReceiptImage } from "@/lib/receipts/preprocess/pipeline";
import { describeProviderChoices } from "@/lib/receipts/adapters/provider-copy";
import { describeReceiptReadFailure } from "@/lib/receipts/errors";
import { mapReceiptUploadFailure } from "@/lib/receipts/upload-errors";
import {
  RECEIPT_CAMERA_ACCEPT,
  RECEIPT_LIBRARY_ACCEPT,
  RECEIPT_OCR_TIMEOUT_MS,
} from "@/lib/receipts/types";
import type { ReceiptAlias } from "@/lib/receipts/local-ocr/types";

type Props = {
  householdId: string;
  ocrConfigured: boolean;
  ocrMessage: string;
  privacyLabel: string;
  cloudConfigured: boolean;
  aliases?: ReceiptAlias[];
  captureMode?: "camera" | "file" | "auto";
};

type Stage =
  | "capture"
  | "uploading"
  | "reading"
  | "checking"
  | "ready"
  | "timeout"
  | "manual";

type CaptureRecovery = "none" | "heic" | "session" | "generic";

async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function ReceiptCaptureFlow({
  householdId,
  ocrConfigured,
  ocrMessage,
  privacyLabel,
  cloudConfigured,
  aliases = [],
  captureMode = "auto",
}: Props) {
  const [stage, setStage] = useState<Stage>("capture");
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<CaptureRecovery>("none");
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineReceiptDraft[]>([]);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const receiptKeyRef = useRef(`receipt-${crypto.randomUUID()}`);
  const idempotencyRef = useRef(crypto.randomUUID());
  const normalizedRef = useRef<File | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const choices = describeProviderChoices();

  useEffect(() => {
    void listOfflineReceiptDrafts(householdId).then(setOfflineDrafts);
    return () => {
      void terminateLocalOcrWorker();
    };
  }, [householdId]);

  async function persistOffline(file: File, reason: string) {
    try {
      const bytes = await file.arrayBuffer();
      await saveOfflineReceiptDraft({
        id: idempotencyRef.current,
        householdId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileName: file.name,
        mimeType: file.type,
        originalBytes: bytes.slice(0),
        proposalJson: JSON.stringify({ reason }),
        status: "waiting_upload",
      });
      setOfflineDrafts(await listOfflineReceiptDrafts(householdId));
    } catch {
      // IndexedDB may be unavailable in private mode.
    }
  }

  function resetFileInputs() {
    if (cameraRef.current) cameraRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  }

  function showCaptureFailure(mapped: ReturnType<typeof mapReceiptUploadFailure>) {
    setRecovery(
      mapped.code === "session_expired"
        ? "session"
        : mapped.code === "unsupported_heic"
          ? "heic"
          : "generic",
    );
    setError(mapped.message);
    setStage("capture");
    resetFileInputs();
  }

  async function handleFile(file: File) {
    try {
      setError(null);
      setRecovery("none");
      setFileLabel(file.name);
      setStage("uploading");
      setProgress({ stage: "preparing", label: "Uploading receipt…", progress: 0.15 });

    let normalized: File;
    try {
      const result = await normalizeReceiptUpload(file);
      normalized = result.file;
      normalizedRef.current = normalized;
    } catch (e) {
      const mapped = mapReceiptUploadFailure({
        stage: "preprocessing",
        raw: e instanceof Error ? e.message : "read",
      });
      showCaptureFailure(mapped);
      return;
    }

    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    if (!online) {
      await persistOffline(normalized, "offline");
      showCaptureFailure(mapReceiptUploadFailure({ offline: true }));
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const fd = new FormData();
          fd.set("householdId", householdId);
          fd.set("file", normalized);
          fd.set("idempotencyKey", idempotencyRef.current);
          const upload = await uploadReceiptAction(null, fd);
          if (!upload.ok) {
            if (!navigator.onLine) {
              await persistOffline(normalized, "connection_lost");
            }
            const mapped = mapReceiptUploadFailure({
              stage: "storage_upload",
              raw: upload.error,
            });
            showCaptureFailure(mapped);
            return;
          }

          const nextId = String(
            (upload.data as { receiptId?: string } | undefined)?.receiptId ?? "",
          );
          const nextRedirect = upload.data?.redirectTo as string | undefined;
          setReceiptId(nextId);
          setRedirectTo(nextRedirect ?? null);
          await discardOfflineReceiptDraft(idempotencyRef.current).catch(
            () => undefined,
          );

          setStage("reading");
          setProgress({ stage: "reading", label: "Reading receipt…", progress: 0.4 });

          try {
            await withTimeout(
              runOcrAndPersist(normalized, nextId),
              RECEIPT_OCR_TIMEOUT_MS,
            );
            setStage("checking");
            setProgress({ stage: "parsing", label: "Checking items…", progress: 0.9 });
            await markReceiptOcrOutcomeAction(householdId, nextId, "succeeded");
            setStage("ready");
            setProgress({ stage: "ready", label: "Ready to review", progress: 1 });
            await terminateLocalOcrWorker();
            if (nextRedirect) window.location.href = nextRedirect;
          } catch (e) {
            const timedOut = e instanceof Error && e.message === "timeout";
            if (timedOut) {
              cancelLocalOcr();
              if (nextId) {
                await markReceiptOcrOutcomeAction(householdId, nextId, "timeout");
              }
              setStage("timeout");
              const failure = describeReceiptReadFailure({ ocrOutcome: "timeout" });
              setError(`${failure.explanation} ${failure.nextStep}`);
              return;
            }
            if (nextId) {
              await markReceiptOcrOutcomeAction(householdId, nextId, "failed");
            }
            setStage("manual");
            setError(
              mapReceiptUploadFailure({
                stage: "ocr_processing",
                raw: e instanceof Error ? e.message : "ocr",
              }).message,
            );
          }
        } catch (e) {
          const mapped = mapReceiptUploadFailure({
            stage: "storage_upload",
            raw: e instanceof Error ? e.message : "upload",
          });
          showCaptureFailure(mapped);
        }
      })();
    });
    } catch (e) {
      showCaptureFailure(
        mapReceiptUploadFailure({
          stage: "preprocessing",
          raw: e instanceof Error ? e.message : "read",
        }),
      );
    }
  }

  async function runOcrAndPersist(file: File, savedReceiptId: string) {
    const images: Array<{
      blob: Blob;
      pageNumber: number;
      width: number;
      height: number;
    }> = [];

    if (file.type === "application/pdf") {
      const rendered = await renderPdfReceiptPages(file, {
        onPage: (pageNumber, pageCount) =>
          setProgress({
            stage: "preparing",
            label: `Reading receipt… (page ${pageNumber}/${pageCount})`,
            progress: 0.45,
            pageNumber,
            pageCount,
          }),
      });
      for (const page of rendered.pages) {
        if (page.error || page.width === 0) continue;
        const processed = await preprocessReceiptImage(page.blob, {
          grayscale: true,
          contrast: 1.1,
          brightness: 6,
        });
        images.push({
          blob: processed.blob,
          pageNumber: page.pageNumber,
          width: processed.width,
          height: processed.height,
        });
      }
    } else {
      const processed = await preprocessReceiptImage(file, {
        grayscale: true,
        contrast: 1.1,
        brightness: 6,
      });
      images.push({
        blob: processed.blob,
        pageNumber: 1,
        width: processed.width,
        height: processed.height,
      });
    }

    if (!images.length) {
      throw new Error("ocr");
    }

    const doc = await runLocalOcrOnImages(images, {
      receiptKey: receiptKeyRef.current,
      onProgress: setProgress,
    });
    const parsed = parseReceiptFromOcr(doc, { aliases });
    const contentHash = await sha256Hex(
      new TextEncoder().encode(doc.fullText || JSON.stringify(parsed.lineItems)),
    );
    const extractFd = new FormData();
    extractFd.set("householdId", householdId);
    extractFd.set("receiptId", savedReceiptId);
    extractFd.set("adapterName", "local_tesseract");
    extractFd.set("confidence", String(parsed.overallConfidence ?? 0));
    extractFd.set("contentHash", contentHash);
    extractFd.set(
      "proposedJson",
      JSON.stringify({
        merchant: parsed.merchant.value,
        purchaseDate: parsed.purchaseDate.value,
        subtotalCents: null,
        taxCents: parsed.taxCents.value,
        tipCents: parsed.tipCents.value,
        totalCents: parsed.totalCents.value,
        currency: "USD",
        paymentMethodSummary: parsed.paymentMethodSummary.value,
        discountCents: parsed.discountCents.value,
      }),
    );
    extractFd.set(
      "lineItemsJson",
      JSON.stringify(
        parsed.lineItems.map((l) => ({
          ocrText: l.ocrText,
          name: l.name,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          totalPriceCents: l.totalPriceCents,
          confidence: null,
        })),
      ),
    );
    extractFd.set("ocrFullText", doc.fullText.slice(0, 50_000));
    extractFd.set(
      "ocrLinesJson",
      JSON.stringify(
        doc.pages.flatMap((p) =>
          p.lines.map((l) => ({
            text: l.text,
            pageNumber: l.pageNumber,
            bbox: l.bbox,
            confidence: l.confidence,
          })),
        ),
      ).slice(0, 100_000),
    );
    extractFd.set(
      "processingMetaJson",
      JSON.stringify({ adapter: "local_tesseract", privacy: "on_device" }),
    );
    const saved = await submitLocalReceiptExtractionAction(null, extractFd);
    if (!saved.ok) throw new Error(saved.error ?? "ocr");
  }

  function goToReceipt() {
    if (redirectTo) window.location.href = redirectTo;
  }

  return (
    <div className="space-y-4" data-testid="receipt-capture-flow">
      <p
        className={`text-sm ${ocrConfigured ? "text-text-secondary" : "text-amber-700 dark:text-amber-300"}`}
        data-testid="receipt-ocr-status"
      >
        {privacyLabel || ocrMessage}
      </p>

      {offlineDrafts.length > 0 ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
          data-testid="receipt-offline-pending"
        >
          {offlineDrafts.length === 1
            ? "One receipt is waiting to upload."
            : `${offlineDrafts.length} receipts are waiting to upload.`}
          {offlineDrafts.map((d) => (
            <button
              key={d.id}
              type="button"
              className="ml-2 underline"
              onClick={() =>
                void discardOfflineReceiptDraft(d.id).then(async () => {
                  setOfflineDrafts(await listOfflineReceiptDrafts(householdId));
                })
              }
            >
              Discard
            </button>
          ))}
        </div>
      ) : null}

      {stage === "capture" ? (
        <div className="space-y-3">
          <input
            ref={cameraRef}
            type="file"
            accept={RECEIPT_CAMERA_ACCEPT}
            capture="environment"
            className="sr-only"
            data-testid="receipt-camera-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept={RECEIPT_LIBRARY_ACCEPT}
            className="sr-only"
            data-testid="receipt-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <div className="grid gap-2">
            {captureMode !== "file" ? (
              <button
                type="button"
                className="min-h-12 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
                onClick={() => cameraRef.current?.click()}
                data-testid="receipt-take-photo"
              >
                Take a photo
              </button>
            ) : null}
            {captureMode !== "camera" ? (
              <button
                type="button"
                className="min-h-12 rounded-md border border-border px-4 text-sm font-medium"
                onClick={() => fileRef.current?.click()}
                data-testid="receipt-choose-file"
              >
                Upload a photo or PDF
              </button>
            ) : null}
          </div>
          <p className="text-xs text-text-muted">
            JPEG, PNG, WebP, or PDF. iPhone photos are converted on this device
            when possible. If a photo fails, try a screenshot or choose Most
            Compatible in Camera settings.
          </p>
        </div>
      ) : null}

      {stage === "uploading" || stage === "reading" || stage === "checking" || stage === "ready" ? (
        <div className="space-y-3" data-testid="receipt-ocr-progress">
          <p className="text-sm text-text-primary">
            {progress?.label ??
              (stage === "uploading"
                ? "Uploading receipt…"
                : stage === "reading"
                  ? "Reading receipt…"
                  : stage === "checking"
                    ? "Checking items…"
                    : "Ready to review")}
          </p>
          {fileLabel ? (
            <p className="text-xs text-text-muted">{fileLabel}</p>
          ) : null}
          <div className="h-2 overflow-hidden rounded bg-border">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round((progress?.progress ?? 0.2) * 100)}%` }}
            />
          </div>
          <button
            type="button"
            className="min-h-11 rounded-md border border-border px-4 text-sm"
            onClick={() => {
              cancelLocalOcr();
              setStage("manual");
            }}
            data-testid="receipt-ocr-cancel"
          >
            Continue manually
          </button>
        </div>
      ) : null}

      {stage === "timeout" || stage === "manual" ? (
        <div className="space-y-3 rounded-md border border-border p-4">
          <p className="text-sm text-text-primary" role="status">
            {error ?? "Receipt uploaded. Enter the details manually."}
          </p>
          <div className="flex flex-col gap-2">
            {receiptId ? (
              <button
                type="button"
                className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
                onClick={goToReceipt}
              >
                Continue manually
              </button>
            ) : null}
            {normalizedRef.current && receiptId ? (
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-4 text-sm"
                disabled={pending}
                onClick={() => {
                  const file = normalizedRef.current;
                  if (file && receiptId) {
                    setStage("reading");
                    setError(null);
                    startTransition(async () => {
                      try {
                        await withTimeout(
                          runOcrAndPersist(file, receiptId),
                          RECEIPT_OCR_TIMEOUT_MS,
                        );
                        await markReceiptOcrOutcomeAction(
                          householdId,
                          receiptId,
                          "succeeded",
                        );
                        goToReceipt();
                      } catch {
                        setStage("timeout");
                        const failure = describeReceiptReadFailure({
                          ocrOutcome: "timeout",
                        });
                        setError(`${failure.explanation} ${failure.nextStep}`);
                      }
                    });
                  }
                }}
              >
                Try reading again
              </button>
            ) : null}
            {receiptId ? (
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-4 text-sm"
                onClick={goToReceipt}
              >
                View receipt
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <details className="text-sm" data-testid="receipt-provider-disclosure">
        <summary className="min-h-11 cursor-pointer text-text-secondary">
          Advanced: how reading works
        </summary>
        <div className="mt-2 space-y-2 text-text-secondary">
          <p>{choices.local.body}</p>
          <p>{choices.cloud.body}</p>
          {!cloudConfigured ? (
            <p>Cloud extraction is not configured for this household.</p>
          ) : null}
        </div>
      </details>

      {error && stage === "capture" ? (
        <div className="space-y-2" role="alert" data-testid="receipt-capture-error">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex flex-col gap-2">
            {recovery === "session" ? (
              <Link
                href={loginUrlForPath(
                  receiptCaptureReturnPath(householdId),
                  "session_expired",
                )}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
                data-testid="receipt-sign-in-again"
              >
                Sign in again
              </Link>
            ) : null}
            <Link
              href={`/app/${householdId}/money/expenses/new`}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-medium"
              data-testid="receipt-enter-manually"
            >
              Enter manually
            </Link>
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-4 text-sm"
              onClick={() => {
                setError(null);
                setRecovery("none");
                fileRef.current?.click();
              }}
              data-testid="receipt-try-jpeg"
            >
              Try a JPEG or PNG
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
