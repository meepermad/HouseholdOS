"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  submitLocalReceiptExtractionAction,
  uploadReceiptAction,
  upsertReceiptAliasAction,
} from "@/app/actions/receipts";
import { formatCentsAsUsd } from "@/lib/receipts/currency";
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
import { parseReceiptFromOcr } from "@/lib/receipts/local-ocr/parse";
import { buildReconciliationSummary } from "@/lib/receipts/local-ocr/reconcile";
import { userConfidenceLabel } from "@/lib/receipts/local-ocr/confidence-ui";
import type { ParsedReceiptProposal, ReceiptAlias } from "@/lib/receipts/local-ocr/types";
import {
  correctExifOrientation,
  preprocessReceiptImage,
  suggestReceiptBounds,
} from "@/lib/receipts/preprocess/pipeline";
import { describeProviderChoices } from "@/lib/receipts/adapters/provider-copy";

type Props = {
  householdId: string;
  ocrConfigured: boolean;
  ocrMessage: string;
  privacyLabel: string;
  cloudConfigured: boolean;
  aliases?: ReceiptAlias[];
};

type Step =
  | "capture"
  | "preview"
  | "enhance"
  | "ocr"
  | "review"
  | "manual";

async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function revokeUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

export function ReceiptCaptureFlow({
  householdId,
  ocrConfigured,
  ocrMessage,
  privacyLabel,
  cloudConfigured,
  aliases = [],
}: Props) {
  const [step, setStep] = useState<Step>("capture");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [enhancedBlob, setEnhancedBlob] = useState<Blob | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [showEnhanced, setShowEnhanced] = useState(true);
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [contrast, setContrast] = useState(1.15);
  const [brightness, setBrightness] = useState(8);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [crop, setCrop] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [proposal, setProposal] = useState<ParsedReceiptProposal | null>(null);
  const [ocrFullText, setOcrFullText] = useState("");
  const [ocrLinesJson, setOcrLinesJson] = useState("[]");
  const [merchant, setMerchant] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [totalCents, setTotalCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const [tipCents, setTipCents] = useState(0);
  const [discountCents, setDiscountCents] = useState(0);
  const [adjustmentCents, setAdjustmentCents] = useState(0);
  const [lines, setLines] = useState<
    Array<{
      ocrText: string;
      name: string;
      quantity: number | null;
      unitPriceCents: number | null;
      totalPriceCents: number | null;
      excluded: boolean;
      classification: string;
    }>
  >([]);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [providerChoice, setProviderChoice] = useState<
    "local" | "manual" | "cloud"
  >("local");
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineReceiptDraft[]>([]);
  const [unsynced, setUnsynced] = useState(false);
  const [saveMerchantAlias, setSaveMerchantAlias] = useState(false);
  const receiptKeyRef = useRef(`receipt-${crypto.randomUUID()}`);
  const objectUrls = useRef<string[]>([]);
  const choices = describeProviderChoices();

  useEffect(() => {
    void listOfflineReceiptDrafts(householdId).then(setOfflineDrafts);
    return () => {
      // Revoke any object URLs created during this mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional latest ref cleanup
      objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
      void terminateLocalOcrWorker();
    };
  }, [householdId]);

  const reconciliation = useMemo(
    () =>
      buildReconciliationSummary({
        lineItems: lines.map((l) => ({
          totalPriceCents: l.totalPriceCents,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          excluded: l.excluded,
        })),
        subtotalCents: null,
        taxCents,
        tipCents,
        discountCents,
        totalCents,
        adjustments:
          adjustmentCents !== 0
            ? [{ label: "Adjustment", amountCents: adjustmentCents }]
            : [],
      }),
    [lines, taxCents, tipCents, discountCents, totalCents, adjustmentCents],
  );

  function trackUrl(url: string) {
    objectUrls.current.push(url);
    return url;
  }

  async function onFileSelected(file: File) {
    setError(null);
    revokeUrl(originalUrl);
    revokeUrl(enhancedUrl);
    const oriented =
      file.type === "application/pdf"
        ? file
        : new File([await correctExifOrientation(file)], file.name, {
            type: file.type,
          });
    setOriginalFile(oriented);
    if (oriented.type.startsWith("image/")) {
      const url = trackUrl(URL.createObjectURL(oriented));
      setOriginalUrl(url);
      const bmp = await createImageBitmap(oriented);
      setCrop(suggestReceiptBounds(bmp.width, bmp.height));
      bmp.close();
    } else {
      setOriginalUrl(null);
      setCrop(null);
    }
    setStep("preview");
  }

  async function improveScan() {
    if (!originalFile || originalFile.type === "application/pdf") {
      setStep("ocr");
      return;
    }
    setProgress({
      stage: "straightening",
      label: "Straightening image…",
      progress: 0.1,
    });
    setStep("enhance");
    try {
      setProgress({
        stage: "improving",
        label: "Improving contrast…",
        progress: 0.2,
      });
      const result = await preprocessReceiptImage(originalFile, {
        rotateDegrees: rotate,
        crop,
        grayscale: true,
        contrast,
        brightness,
        threshold,
      });
      revokeUrl(enhancedUrl);
      const url = trackUrl(URL.createObjectURL(result.blob));
      setEnhancedBlob(result.blob);
      setEnhancedUrl(url);
      result.canvas.width = 0;
      result.canvas.height = 0;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not improve scan.");
    }
  }

  async function runOcr() {
    if (!originalFile) return;
    if (providerChoice === "manual") {
      setStep("manual");
      return;
    }
    if (providerChoice === "cloud") {
      if (!cloudConfigured) {
        setError("Cloud extraction is not configured for this household.");
        return;
      }
      setError(
        "Cloud extraction requires explicit coordinator configuration and is not run automatically from this screen.",
      );
      return;
    }

    setError(null);
    setStep("ocr");
    setProgress({
      stage: "preparing",
      label: "Preparing receipt…",
      progress: 0.05,
    });

    try {
      const images: Array<{
        blob: Blob;
        pageNumber: number;
        width: number;
        height: number;
      }> = [];

      if (originalFile.type === "application/pdf") {
        if (originalFile.size > 6 * 1024 * 1024) {
          const ok = window.confirm(
            "This PDF is large and may use significant memory. Continue?",
          );
          if (!ok) {
            setStep("preview");
            return;
          }
        }
        const rendered = await renderPdfReceiptPages(originalFile, {
          onPage: (pageNumber, pageCount) =>
            setProgress({
              stage: "preparing",
              label: `Preparing receipt… (page ${pageNumber}/${pageCount})`,
              progress: 0.1,
              pageNumber,
              pageCount,
            }),
        });
        for (const page of rendered.pages) {
          if (page.error || page.width === 0) {
            setError(
              `PDF page ${page.pageNumber} could not be rendered. You can enter details manually.`,
            );
            continue;
          }
          const processed = await preprocessReceiptImage(page.blob, {
            grayscale: true,
            contrast,
            brightness,
            threshold,
          });
          images.push({
            blob: processed.blob,
            pageNumber: page.pageNumber,
            width: processed.width,
            height: processed.height,
          });
        }
        if (!images.length) {
          setStep("manual");
          return;
        }
      } else {
        const source = enhancedBlob ?? originalFile;
        const processed = await preprocessReceiptImage(source, {
          rotateDegrees: enhancedBlob ? 0 : rotate,
          crop: enhancedBlob ? null : crop,
          grayscale: true,
          contrast,
          brightness,
          threshold,
        });
        images.push({
          blob: processed.blob,
          pageNumber: 1,
          width: processed.width,
          height: processed.height,
        });
      }

      const doc = await runLocalOcrOnImages(images, {
        receiptKey: receiptKeyRef.current,
        onProgress: setProgress,
      });

      const parsed = parseReceiptFromOcr(doc, { aliases });
      setProposal(parsed);
      setOcrFullText(doc.fullText);
      setOcrLinesJson(
        JSON.stringify(
          doc.pages.flatMap((p) =>
            p.lines.map((l) => ({
              text: l.text,
              pageNumber: l.pageNumber,
              bbox: l.bbox,
              confidence: l.confidence,
            })),
          ),
        ),
      );
      setMerchant(parsed.merchant.value ?? "");
      setPurchaseDate(
        parsed.purchaseDate.value ?? new Date().toISOString().slice(0, 10),
      );
      setTotalCents(parsed.totalCents.value ?? 0);
      setTaxCents(parsed.taxCents.value ?? 0);
      setTipCents(parsed.tipCents.value ?? 0);
      setDiscountCents(parsed.discountCents.value ?? 0);
      setLines(
        parsed.lineItems.map((li) => ({
          ocrText: li.ocrText,
          name: li.name,
          quantity: li.quantity,
          unitPriceCents: li.unitPriceCents,
          totalPriceCents: li.totalPriceCents,
          excluded: false,
          classification: "needs_review",
        })),
      );
      setStep("review");
    } catch (e) {
      if (e instanceof Error && e.message === "cancelled") {
        setError("OCR cancelled. You can enter the receipt manually.");
      } else {
        setError(
          e instanceof Error
            ? e.message
            : "Local OCR failed. You can enter details manually.",
        );
      }
      setStep("manual");
    }
  }

  function applyProposalToManual() {
    setStep("manual");
  }

  async function uploadAndSubmit(manualOnly: boolean) {
    if (!originalFile) return;
    const online = typeof navigator === "undefined" ? true : navigator.onLine;

    if (!online) {
      const bytes = await originalFile.arrayBuffer();
      const draft: OfflineReceiptDraft = {
        id: crypto.randomUUID(),
        householdId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileName: originalFile.name,
        mimeType: originalFile.type,
        originalBytes: bytes.slice(0),
        proposalJson: JSON.stringify({
          merchant,
          purchaseDate,
          totalCents,
          taxCents,
          tipCents,
          discountCents,
          adjustmentCents,
          lines,
          proposal,
        }),
        status: "waiting_upload",
      };
      await saveOfflineReceiptDraft(draft);
      setUnsynced(true);
      setOfflineDrafts(await listOfflineReceiptDrafts(householdId));
      setError(null);
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("file", originalFile);
      const upload = await uploadReceiptAction(null, fd);
      if (!upload.ok) {
        setError(upload.error ?? "Upload failed.");
        return;
      }
      const redirectTo = upload.data?.redirectTo as string | undefined;
      const receiptId = String(
        (upload.data as { receiptId?: string } | undefined)?.receiptId ?? "",
      );

      if (!manualOnly && receiptId && proposal) {
        const contentHash = await sha256Hex(
          new TextEncoder().encode(ocrFullText || JSON.stringify(lines)),
        );
        const extractFd = new FormData();
        extractFd.set("householdId", householdId);
        extractFd.set("receiptId", String(receiptId));
        extractFd.set("adapterName", "local_tesseract");
        extractFd.set(
          "confidence",
          String(proposal.overallConfidence ?? 0),
        );
        extractFd.set("contentHash", contentHash);
        extractFd.set(
          "proposedJson",
          JSON.stringify({
            merchant,
            purchaseDate,
            subtotalCents: null,
            taxCents,
            tipCents,
            totalCents,
            currency: "USD",
            paymentMethodSummary: proposal.paymentMethodSummary.value,
            discountCents,
            adjustmentCents,
          }),
        );
        extractFd.set(
          "lineItemsJson",
          JSON.stringify(
            lines.map((l) => ({
              ocrText: l.ocrText,
              name: l.name,
              quantity: l.quantity,
              unitPriceCents: l.unitPriceCents,
              totalPriceCents: l.totalPriceCents,
              confidence: null,
            })),
          ),
        );
        extractFd.set("ocrFullText", ocrFullText.slice(0, 50_000));
        extractFd.set("ocrLinesJson", ocrLinesJson.slice(0, 100_000));
        extractFd.set(
          "processingMetaJson",
          JSON.stringify({
            adapter: "local_tesseract",
            privacy: "on_device",
          }),
        );
        await submitLocalReceiptExtractionAction(null, extractFd);
      }

      if (saveMerchantAlias && merchant && proposal?.merchant.sourceText) {
        const aliasFd = new FormData();
        aliasFd.set("householdId", householdId);
        aliasFd.set("kind", "merchant");
        aliasFd.set("sourceText", proposal.merchant.sourceText);
        aliasFd.set("targetText", merchant);
        await upsertReceiptAliasAction(null, aliasFd);
      }

      await terminateLocalOcrWorker();
      if (redirectTo) window.location.href = redirectTo;
    });
  }

  return (
    <div className="space-y-4" data-testid="receipt-capture-flow">
      <p
        className={`text-sm ${ocrConfigured ? "text-text-secondary" : "text-amber-700 dark:text-amber-300"}`}
        data-testid="receipt-ocr-status"
      >
        {privacyLabel || ocrMessage}
      </p>
      <p className="text-xs text-text-muted" data-testid="receipt-privacy-note">
        Local OCR runs on this device. Uploading stores the original image in
        private HouseholdOS storage for your household — that is separate from
        on-device reading.
      </p>

      <div
        className="space-y-2 rounded-md border border-border p-3 text-sm"
        data-testid="receipt-provider-disclosure"
      >
        <p className="font-medium text-text-primary">{choices.local.title}</p>
        <p className="text-text-secondary">{choices.local.body}</p>
        <p className="mt-2 font-medium text-text-primary">{choices.cloud.title}</p>
        <p className="text-text-secondary">{choices.cloud.body}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={`min-h-11 rounded-md px-3 text-sm ${providerChoice === "local" ? "bg-primary text-primary-foreground" : "border border-border"}`}
            onClick={() => setProviderChoice("local")}
            data-testid="provider-local"
          >
            Try local OCR
          </button>
          <button
            type="button"
            className={`min-h-11 rounded-md px-3 text-sm ${providerChoice === "manual" ? "bg-primary text-primary-foreground" : "border border-border"}`}
            onClick={() => setProviderChoice("manual")}
            data-testid="provider-manual"
          >
            Enter manually
          </button>
          <button
            type="button"
            className={`min-h-11 rounded-md px-3 text-sm ${providerChoice === "cloud" ? "bg-primary text-primary-foreground" : "border border-border"}`}
            onClick={() => setProviderChoice("cloud")}
            data-testid="provider-cloud"
            disabled={!cloudConfigured}
          >
            Use configured cloud extraction
          </button>
        </div>
      </div>

      {unsynced || offlineDrafts.length > 0 ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
          data-testid="receipt-offline-pending"
        >
          Unsynchronized offline receipt draft
          {offlineDrafts.length > 0 ? ` (${offlineDrafts.length})` : ""}.
          Expense creation waits until upload succeeds online.
          {offlineDrafts.map((d) => (
            <button
              key={d.id}
              type="button"
              className="ml-2 underline"
              onClick={() => void discardOfflineReceiptDraft(d.id).then(async () => {
                setOfflineDrafts(await listOfflineReceiptDrafts(householdId));
              })}
            >
              Discard
            </button>
          ))}
        </div>
      ) : null}

      {step === "capture" ? (
        <label className="block text-sm font-medium text-text-primary">
          Capture or select receipt
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,capture=environment"
            capture="environment"
            className="mt-2 block w-full text-sm"
            data-testid="receipt-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFileSelected(f);
            }}
          />
        </label>
      ) : null}

      {(step === "preview" || step === "enhance") && originalUrl ? (
        <div className="space-y-3" data-testid="receipt-preview">
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className={`min-h-11 px-3 ${!showEnhanced ? "font-semibold underline" : ""}`}
              onClick={() => setShowEnhanced(false)}
              data-testid="compare-original"
            >
              Original
            </button>
            <button
              type="button"
              className={`min-h-11 px-3 ${showEnhanced ? "font-semibold underline" : ""}`}
              onClick={() => setShowEnhanced(true)}
              data-testid="compare-enhanced"
              disabled={!enhancedUrl}
            >
              Enhanced
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={showEnhanced && enhancedUrl ? enhancedUrl : originalUrl}
            alt="Receipt preview"
            className="max-h-[50vh] w-full rounded-md object-contain bg-black/5"
            data-testid="receipt-preview-image"
          />
          <div className="grid gap-2 sm:grid-cols-2" data-testid="receipt-crop-rotate">
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-3 text-sm"
              onClick={() =>
                setRotate((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)
              }
              data-testid="receipt-rotate"
            >
              Rotate ({rotate}°)
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-3 text-sm"
              onClick={() => void improveScan()}
              data-testid="receipt-improve-scan"
            >
              Improve scan
            </button>
          </div>
          <details className="text-sm">
            <summary>Advanced adjustments</summary>
            <div className="mt-2 grid gap-2">
              <label>
                Contrast
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                />
              </label>
              <label>
                Brightness
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={1}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                />
              </label>
              <label>
                Black-and-white threshold
                <input
                  type="range"
                  min={0}
                  max={255}
                  step={1}
                  value={threshold ?? 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setThreshold(v === 0 ? null : v);
                  }}
                />
              </label>
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              onClick={() => void (improveScan().then(() => runOcr()))}
              data-testid="receipt-run-ocr"
            >
              Read receipt
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-4 text-sm"
              onClick={() => {
                setProviderChoice("manual");
                setStep("manual");
              }}
            >
              Enter manually
            </button>
          </div>
        </div>
      ) : null}

      {step === "preview" && originalFile?.type === "application/pdf" ? (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            PDF selected: {originalFile.name}
          </p>
          <button
            type="button"
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            onClick={() => void runOcr()}
            data-testid="receipt-run-ocr"
          >
            Read PDF receipt
          </button>
        </div>
      ) : null}

      {step === "ocr" ? (
        <div className="space-y-3" data-testid="receipt-ocr-progress">
          <p className="text-sm text-text-primary">
            {progress?.label ?? "Reading text…"}
          </p>
          <div className="h-2 overflow-hidden rounded bg-border">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round((progress?.progress ?? 0) * 100)}%` }}
            />
          </div>
          <button
            type="button"
            className="min-h-11 rounded-md border border-border px-4 text-sm"
            onClick={() => {
              cancelLocalOcr();
              setStep("manual");
            }}
            data-testid="receipt-ocr-cancel"
          >
            Cancel and enter manually
          </button>
        </div>
      ) : null}

      {(step === "review" || step === "manual") && (
        <div className="space-y-4" data-testid="receipt-local-review">
          {(originalUrl || enhancedUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={enhancedUrl || originalUrl || ""}
              alt="Receipt for review"
              className="max-h-[40vh] w-full object-contain"
              data-testid="receipt-review-image"
            />
          )}

          {proposal ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <span data-testid="confidence-merchant">
                Merchant: {userConfidenceLabel(proposal.merchant.userState)}
              </span>
              <span data-testid="confidence-date">
                Date: {userConfidenceLabel(proposal.purchaseDate.userState)}
              </span>
              <span data-testid="confidence-total">
                Total: {userConfidenceLabel(proposal.totalCents.userState)}
              </span>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Merchant
              <input
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                data-testid="receipt-merchant"
              />
            </label>
            <label className="text-sm">
              Purchase date
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                data-testid="receipt-purchase-date"
              />
            </label>
            <label className="text-sm">
              Total (cents)
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                value={totalCents}
                onChange={(e) => setTotalCents(Number(e.target.value) || 0)}
                data-testid="receipt-total-cents"
              />
            </label>
            {proposal?.totalCents.alternatives?.length ? (
              <div className="text-sm" data-testid="total-alternatives">
                Alternatives:{" "}
                {proposal.totalCents.alternatives.map((a) => (
                  <button
                    key={String(a.value)}
                    type="button"
                    className="mr-2 underline"
                    onClick={() => setTotalCents(Number(a.value) || 0)}
                  >
                    {formatCentsAsUsd(Number(a.value) || 0)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {proposal?.dateAmbiguous ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Date may be ambiguous — confirm the purchase date.
            </p>
          ) : null}

          <div
            className="rounded-md border border-border p-3 text-sm"
            data-testid="receipt-reconciliation"
          >
            <div className="flex justify-between">
              <span>Receipt total</span>
              <span>{reconciliation.display.receiptTotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Reviewed items</span>
              <span>{reconciliation.display.reviewedItems}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax and adjustments</span>
              <span>{reconciliation.display.taxAndAdjustments}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Difference</span>
              <span>{reconciliation.display.difference}</span>
            </div>
            {!reconciliation.balanced ? (
              <button
                type="button"
                className="mt-2 min-h-11 rounded-md border border-border px-3 text-sm"
                onClick={() =>
                  setAdjustmentCents(
                    (reconciliation.differenceCents ?? 0) - adjustmentCents,
                  )
                }
                data-testid="add-adjustment"
              >
                Add adjustment
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2" data-testid="receipt-bulk-actions">
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-3 text-sm"
              onClick={() =>
                setLines((prev) =>
                  prev.map((l) => ({
                    ...l,
                    classification: "shared_household",
                  })),
                )
              }
            >
              Mark all shared
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-3 text-sm"
              onClick={() =>
                setLines((prev) =>
                  prev.map((l, i) =>
                    selectedIndexes.includes(i)
                      ? { ...l, excluded: true }
                      : l,
                  ),
                )
              }
            >
              Exclude selected items
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-3 text-sm"
              onClick={() =>
                setLines((prev) =>
                  prev.map((l, i) => {
                    const conf = proposal?.lineItems[i]?.userState;
                    if (conf === "looks_clear") {
                      return { ...l, classification: l.classification === "needs_review" ? "shared_household" : l.classification };
                    }
                    return l;
                  }),
                )
              }
            >
              Accept high-confidence items
            </button>
          </div>

          <ul className="space-y-3" data-testid="receipt-line-items">
            {lines.map((line, index) => (
              <li key={index} className="rounded-md border border-border p-3">
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  <input
                    type="checkbox"
                    checked={selectedIndexes.includes(index)}
                    onChange={(e) =>
                      setSelectedIndexes((prev) =>
                        e.target.checked
                          ? [...prev, index]
                          : prev.filter((i) => i !== index),
                      )
                    }
                  />
                  OCR: {line.ocrText || "—"}
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  value={line.name}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === index ? { ...l, name: e.target.value } : l,
                      ),
                    )
                  }
                />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    className="rounded-md border border-border px-2 py-1 text-sm"
                    value={line.quantity ?? ""}
                    placeholder="Qty"
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index
                            ? {
                                ...l,
                                quantity: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              }
                            : l,
                        ),
                      )
                    }
                  />
                  <input
                    type="number"
                    className="rounded-md border border-border px-2 py-1 text-sm"
                    value={line.totalPriceCents ?? ""}
                    placeholder="Cents"
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index
                            ? {
                                ...l,
                                totalPriceCents: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              }
                            : l,
                        ),
                      )
                    }
                  />
                  <select
                    className="rounded-md border border-border px-2 py-1 text-sm"
                    value={line.classification}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index
                            ? { ...l, classification: e.target.value }
                            : l,
                        ),
                      )
                    }
                    data-testid={`receipt-classification-${index}`}
                  >
                    <option value="needs_review">Needs review</option>
                    <option value="shared_household">Shared</option>
                    <option value="personal_purchaser">Personal</option>
                    <option value="excluded">Exclude</option>
                  </select>
                </div>
              </li>
            ))}
          </ul>

          {proposal?.unmatchedLines?.length ? (
            <div data-testid="unmatched-receipt-text">
              <h3 className="text-sm font-medium">Unmatched receipt text</h3>
              <ul className="mt-1 space-y-1 text-xs text-text-muted">
                {proposal.unmatchedLines.map((u, i) => (
                  <li key={i}>
                    p{u.pageNumber}: {u.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {proposal?.merchant.sourceText &&
          merchant &&
          merchant !== proposal.merchant.sourceText ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={saveMerchantAlias}
                onChange={(e) => setSaveMerchantAlias(e.target.checked)}
                data-testid="save-merchant-alias"
              />
              Save merchant alias for future receipts in this household
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              onClick={() => void uploadAndSubmit(step === "manual" && !proposal)}
              data-testid="receipt-upload-submit"
            >
              {pending ? "Saving…" : "Upload and continue review"}
            </button>
            {step === "review" ? (
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-4 text-sm"
                onClick={applyProposalToManual}
              >
                Edit as manual entry
              </button>
            ) : null}
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-4 text-sm"
              onClick={() => {
                cancelLocalOcr();
                void terminateLocalOcrWorker();
                setStep("capture");
                setOriginalFile(null);
              }}
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
