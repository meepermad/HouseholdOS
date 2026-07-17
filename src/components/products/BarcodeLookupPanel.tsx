"use client";

import { useState, useTransition } from "react";
import { normalizeBarcode } from "@/lib/products/lookup";

type LookupResult = {
  barcode: string;
  name: string | null;
  brand: string | null;
  source: string;
  requiresReview: boolean;
};

export function BarcodeLookupPanel({
  onResolved,
}: {
  onResolved?: (result: LookupResult) => void;
}) {
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);

  async function lookup(code: string) {
    setError(null);
    const barcode = normalizeBarcode(code);
    if (barcode.length < 6) {
      setError("Enter at least 6 digits.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/products/lookup?barcode=${encodeURIComponent(barcode)}`);
      if (!res.ok) {
        setError("Lookup failed.");
        return;
      }
      const data = (await res.json()) as LookupResult;
      setResult(data);
      onResolved?.(data);
    });
  }

  async function startScan() {
    setError(null);
    setScanning(true);
    try {
      // BarcodeDetector is available in Chromium-based browsers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setError("Barcode scanning is not supported here — use manual entry.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      const track = stream.getVideoTracks()[0];
      const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "qr_code"] });
      // Single-shot: capture one frame via ImageCapture if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ImageCaptureCtor = (window as any).ImageCapture;
      if (!ImageCaptureCtor) {
        track.stop();
        setError("Camera capture unavailable — use manual entry.");
        return;
      }
      const capture = new ImageCaptureCtor(track);
      const bitmap = await capture.grabFrame();
      const codes = await detector.detect(bitmap);
      track.stop();
      if (!codes?.length) {
        setError("No barcode detected. Try again or enter digits.");
        return;
      }
      await lookup(String(codes[0].rawValue ?? ""));
    } catch {
      setError("Camera permission denied or scan failed. Use manual entry.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <section className="space-y-3" data-testid="barcode-lookup">
      <h2 className="text-lg font-semibold">Barcode / product lookup</h2>
      <p className="text-sm text-text-muted">
        Browser-native scan or manual digits. External suggestions always require review.
        Video is not uploaded.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          inputMode="numeric"
          placeholder="Barcode digits"
          className="min-w-[12rem] flex-1 rounded-md border border-border px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void lookup(manual)}
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Look up
        </button>
        <button
          type="button"
          disabled={scanning || pending}
          onClick={() => void startScan()}
          className="min-h-11 rounded-md border border-border px-4 text-sm font-semibold"
        >
          {scanning ? "Scanning…" : "Scan once"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="rounded-md border border-border p-3 text-sm" data-testid="barcode-result">
          <p>
            <strong>{result.name ?? "Unnamed"}</strong>
            {result.brand ? ` · ${result.brand}` : ""}
          </p>
          <p className="text-text-muted">
            {result.barcode} · {result.source}
            {result.requiresReview ? " · review required" : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
