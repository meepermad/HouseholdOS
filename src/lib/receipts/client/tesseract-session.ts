"use client";

import type { OcrBlock, OcrDocumentResult, OcrLine, OcrPageResult, OcrWord } from "../local-ocr/types";
import { aggregateOcrPages } from "../local-ocr/parse";

export type OcrProgressStage =
  | "preparing"
  | "straightening"
  | "improving"
  | "reading"
  | "parsing"
  | "ready"
  | "cancelled"
  | "failed";

export type OcrProgress = {
  stage: OcrProgressStage;
  label: string;
  progress: number; // 0–1
  pageNumber?: number;
  pageCount?: number;
};

const STAGE_LABELS: Record<OcrProgressStage, string> = {
  preparing: "Preparing receipt…",
  straightening: "Straightening image…",
  improving: "Improving contrast…",
  reading: "Reading text…",
  parsing: "Finding totals and items…",
  ready: "Ready for review",
  cancelled: "Cancelled",
  failed: "Could not read receipt",
};

export const OCR_ASSET_PATHS = {
  workerPath: "/ocr/worker.min.js",
  langPath: "/ocr",
  corePath: "/ocr",
} as const;

type TessWorker = {
  recognize: (
    image: Blob | HTMLCanvasElement | string,
    options?: object,
    output?: object,
  ) => Promise<{ data: TessResult }>;
  setParameters: (params: Record<string, string>) => Promise<void>;
  terminate: () => Promise<void>;
};

type TessResult = {
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  lines?: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    words?: TessResult["words"];
  }>;
  blocks?: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    lines?: TessResult["lines"];
  }>;
};

let sharedWorker: TessWorker | null = null;
let initPromise: Promise<TessWorker> | null = null;
let activeReceiptKey: string | null = null;
let cancelRequested = false;

function mapWords(words: TessResult["words"] = []): OcrWord[] {
  return words.map((w) => ({
    text: w.text,
    confidence: w.confidence > 1 ? w.confidence / 100 : w.confidence,
    bbox: w.bbox,
  }));
}

function mapLines(lines: TessResult["lines"] = [], pageNumber: number): OcrLine[] {
  return lines.map((l) => ({
    text: l.text,
    confidence: l.confidence > 1 ? l.confidence / 100 : l.confidence,
    bbox: l.bbox,
    words: mapWords(l.words),
    pageNumber,
  }));
}

function mapBlocks(blocks: TessResult["blocks"] = [], pageNumber: number): OcrBlock[] {
  return blocks.map((b) => ({
    text: b.text,
    confidence: b.confidence > 1 ? b.confidence / 100 : b.confidence,
    bbox: b.bbox,
    lines: mapLines(b.lines, pageNumber),
    pageNumber,
  }));
}

async function ensureWorker(
  onProgress?: (p: OcrProgress) => void,
): Promise<TessWorker> {
  if (sharedWorker) return sharedWorker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    onProgress?.({
      stage: "preparing",
      label: STAGE_LABELS.preparing,
      progress: 0.05,
    });
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = (await createWorker("eng", 1, {
      workerPath: OCR_ASSET_PATHS.workerPath,
      langPath: OCR_ASSET_PATHS.langPath,
      corePath: OCR_ASSET_PATHS.corePath,
      logger: (m: { status?: string; progress?: number }) => {
        if (cancelRequested) return;
        if (m.status === "recognizing text") {
          onProgress?.({
            stage: "reading",
            label: STAGE_LABELS.reading,
            progress: 0.35 + (m.progress ?? 0) * 0.55,
          });
        }
      },
    })) as unknown as TessWorker;
    await worker.setParameters({
      tessedit_pageseg_mode: String(PSM.AUTO),
    });
    sharedWorker = worker;
    return worker;
  })();

  try {
    return await initPromise;
  } catch (e) {
    initPromise = null;
    throw e;
  }
}

export function cancelLocalOcr(): void {
  cancelRequested = true;
}

export async function terminateLocalOcrWorker(): Promise<void> {
  cancelRequested = true;
  activeReceiptKey = null;
  const w = sharedWorker;
  sharedWorker = null;
  initPromise = null;
  if (w) {
    try {
      await w.terminate();
    } catch {
      // ignore
    }
  }
  cancelRequested = false;
}

export async function runLocalOcrOnImages(
  images: Array<{ blob: Blob; pageNumber: number; width: number; height: number }>,
  options: {
    receiptKey: string;
    onProgress?: (p: OcrProgress) => void;
  },
): Promise<OcrDocumentResult> {
  if (activeReceiptKey && activeReceiptKey !== options.receiptKey) {
    throw new Error("Another receipt extraction is already running.");
  }
  if (activeReceiptKey === options.receiptKey) {
    throw new Error("Extraction already in progress for this receipt.");
  }

  cancelRequested = false;
  activeReceiptKey = options.receiptKey;
  const started = performance.now();
  const pages: OcrPageResult[] = [];

  try {
    const worker = await ensureWorker(options.onProgress);
    if (cancelRequested) throw new Error("cancelled");

    for (const image of images) {
      if (cancelRequested) throw new Error("cancelled");
      options.onProgress?.({
        stage: "reading",
        label: STAGE_LABELS.reading,
        progress: 0.3,
        pageNumber: image.pageNumber,
        pageCount: images.length,
      });

      const { data } = await worker.recognize(image.blob, {}, {
        text: true,
        blocks: true,
        confidences: true,
      });

      if (cancelRequested) throw new Error("cancelled");

      const blocks = mapBlocks(data.blocks, image.pageNumber);
      const lines =
        blocks.flatMap((b) => b.lines).length > 0
          ? blocks.flatMap((b) => b.lines)
          : mapLines(data.lines, image.pageNumber);
      const words =
        lines.flatMap((l) => l.words).length > 0
          ? lines.flatMap((l) => l.words)
          : mapWords(data.words);

      pages.push({
        pageNumber: image.pageNumber,
        fullText: data.text ?? "",
        blocks,
        lines,
        words,
        confidence: data.confidence > 1 ? data.confidence / 100 : data.confidence,
        width: image.width,
        height: image.height,
      });
    }

    options.onProgress?.({
      stage: "parsing",
      label: STAGE_LABELS.parsing,
      progress: 0.92,
    });

    const doc = aggregateOcrPages(pages, {
      durationMs: Math.round(performance.now() - started),
    });

    options.onProgress?.({
      stage: "ready",
      label: STAGE_LABELS.ready,
      progress: 1,
    });

    return doc;
  } catch (e) {
    if (e instanceof Error && e.message === "cancelled") {
      options.onProgress?.({
        stage: "cancelled",
        label: STAGE_LABELS.cancelled,
        progress: 0,
      });
    } else {
      options.onProgress?.({
        stage: "failed",
        label: STAGE_LABELS.failed,
        progress: 0,
      });
    }
    throw e;
  } finally {
    activeReceiptKey = null;
  }
}
