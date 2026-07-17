"use client";

import { RECEIPT_MAX_PDF_PAGES } from "../types";

export const RECEIPT_PDF_MAX_BYTES = 8 * 1024 * 1024;

export type PdfPageRender = {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
  error?: string;
};

export type PdfRenderResult = {
  pages: PdfPageRender[];
  pageCount: number;
  truncated: boolean;
};

function assertPdfSafe(file: Blob): void {
  if (file.size > RECEIPT_PDF_MAX_BYTES) {
    throw new Error(
      `PDF exceeds the ${Math.round(RECEIPT_PDF_MAX_BYTES / (1024 * 1024))} MiB limit.`,
    );
  }
  if (file.type && file.type !== "application/pdf") {
    throw new Error("File is not a PDF.");
  }
}

/**
 * Render allowed PDF pages to images via PDF.js (no script execution / FS access).
 */
export async function renderPdfReceiptPages(
  file: Blob,
  options?: {
    maxPages?: number;
    scale?: number;
    onPage?: (pageNumber: number, pageCount: number) => void;
  },
): Promise<PdfRenderResult> {
  assertPdfSafe(file);
  const maxPages = options?.maxPages ?? RECEIPT_MAX_PDF_PAGES;
  const scale = options?.scale ?? 2;

  const pdfjs = await import("pdfjs-dist");
  // Disable worker eval / use app-hosted worker
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    disableAutoFetch: true,
    disableStream: true,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  if (pageCount < 1) {
    throw new Error("PDF has no pages.");
  }

  const limit = Math.min(pageCount, maxPages);
  const pages: PdfPageRender[] = [];

  for (let i = 1; i <= limit; i++) {
    options?.onPage?.(i, limit);
    try {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("PDF page render failed"))),
          "image/png",
        );
      });
      pages.push({
        pageNumber: i,
        blob,
        width: canvas.width,
        height: canvas.height,
      });
      canvas.width = 0;
      canvas.height = 0;
    } catch (e) {
      pages.push({
        pageNumber: i,
        blob: new Blob(),
        width: 0,
        height: 0,
        error: e instanceof Error ? e.message : "Page render failed",
      });
    }
  }

  try {
    // pdf.js v4+ cleanup
    await (pdf as { cleanup?: () => Promise<void> }).cleanup?.();
  } catch {
    // ignore
  }

  return {
    pages,
    pageCount,
    truncated: pageCount > maxPages,
  };
}
