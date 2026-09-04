/**
 * Local image normalization before receipt upload / OCR.
 * Converts HEIC when the browser can decode it, fixes EXIF rotation,
 * and compresses large phone photos so we never ship 20–40 MB originals.
 */

import {
  RECEIPT_HEIC_DECODE_MAX_BYTES,
  RECEIPT_UPLOAD_JPEG_QUALITY,
  RECEIPT_UPLOAD_MAX_DIMENSION,
  RECEIPT_UPLOAD_TARGET_BYTES,
} from "../types";
import { detectHeic } from "../heic";
import { mapReceiptUploadFailure } from "../upload-errors";

export type NormalizedReceiptFile = {
  file: File;
  convertedFromHeic: boolean;
  resized: boolean;
  originalBytes: number;
  outputBytes: number;
  width: number | null;
  height: number | null;
};

function mappedError(raw: string, stage: "preprocessing" = "preprocessing"): Error {
  return new Error(mapReceiptUploadFailure({ raw, stage }).message);
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not read image"))),
      "image/jpeg",
      quality,
    );
  });
}

async function drawToCanvas(
  source: ImageBitmap | HTMLImageElement,
  maxDimension: number,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number; resized: boolean }> {
  const srcW = "naturalWidth" in source ? source.naturalWidth || source.width : source.width;
  const srcH = "naturalHeight" in source ? source.naturalHeight || source.height : source.height;
  if (!srcW || !srcH) throw new Error("Could not read image");
  const longest = Math.max(srcW, srcH);
  const scale = longest > maxDimension ? maxDimension / longest : 1;
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read image");
  ctx.drawImage(source, 0, 0, width, height);
  return { canvas, width, height, resized: scale < 1 };
}

function loadHtmlImage(file: Blob): Promise<{ image: HTMLImageElement; revoke: () => void }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => {
      if (!el.naturalWidth || !el.naturalHeight) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image"));
        return;
      }
      resolve({
        image: el,
        revoke: () => URL.revokeObjectURL(url),
      });
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    el.src = url;
  });
}

async function decodeImage(
  file: Blob,
  heic: boolean,
): Promise<{ source: ImageBitmap | HTMLImageElement; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, close: () => bitmap.close() };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return { source: bitmap, close: () => bitmap.close() };
      } catch {
        // A second HEIC decode via <img> often hangs or OOMs iPhone Safari.
        if (heic) throw new Error("heic");
      }
    }
  }
  const loaded = await loadHtmlImage(file);
  return { source: loaded.image, close: loaded.revoke };
}

async function compressUntilTarget(
  canvas: HTMLCanvasElement,
  fileName: string,
): Promise<{ file: File; bytes: number }> {
  let quality = RECEIPT_UPLOAD_JPEG_QUALITY;
  let blob = await canvasToJpegBlob(canvas, quality);
  while (blob.size > RECEIPT_UPLOAD_TARGET_BYTES && quality > 0.5) {
    quality -= 0.08;
    blob = await canvasToJpegBlob(canvas, quality);
  }
  const name = fileName.replace(/\.(heic|heif|png|webp|jpe?g)$/i, "") + ".jpg";
  const file = new File([blob], name, { type: "image/jpeg" });
  return { file, bytes: blob.size };
}

/**
 * Prepare a selected receipt file for upload.
 * PDFs pass through (size-checked by the caller). Images are oriented,
 * optionally converted from HEIC, and resized/compressed.
 * Never throws a raw DOMException — callers always get a human message.
 */
export async function normalizeReceiptUpload(file: File): Promise<NormalizedReceiptFile> {
  const originalBytes = file.size;
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return {
      file,
      convertedFromHeic: false,
      resized: false,
      originalBytes,
      outputBytes: file.size,
      width: null,
      height: null,
    };
  }

  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const heic = detectHeic({
      bytes: header,
      mimeType: file.type,
      fileName: file.name,
    });

    if (heic && originalBytes > RECEIPT_HEIC_DECODE_MAX_BYTES) {
      throw mappedError("heic");
    }

    let decoded: { source: ImageBitmap | HTMLImageElement; close: () => void };
    try {
      decoded = await decodeImage(file, heic);
    } catch (error) {
      if (heic) throw mappedError("heic");
      throw mappedError(error instanceof Error ? error.message : "decode");
    }

    try {
      const drawn = await drawToCanvas(decoded.source, RECEIPT_UPLOAD_MAX_DIMENSION);
      decoded.close();
      const compressed = await compressUntilTarget(drawn.canvas, file.name);
      drawn.canvas.width = 0;
      drawn.canvas.height = 0;
      return {
        file: compressed.file,
        convertedFromHeic: heic,
        resized: drawn.resized || compressed.bytes < originalBytes,
        originalBytes,
        outputBytes: compressed.bytes,
        width: drawn.width,
        height: drawn.height,
      };
    } catch (error) {
      decoded.close();
      if (heic) throw mappedError("heic");
      throw mappedError(error instanceof Error ? error.message : "canvas");
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw mappedError("decode");
  }
}
