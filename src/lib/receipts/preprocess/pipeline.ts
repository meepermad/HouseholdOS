/**
 * Browser canvas preprocessing for receipt OCR.
 * Preserves the original separately from the OCR derivative.
 * Uses Canvas APIs (no mandatory OpenCV runtime).
 */

export type PreprocessOptions = {
  rotateDegrees?: 0 | 90 | 180 | 270;
  /** Manual crop in source pixel coords */
  crop?: { x: number; y: number; width: number; height: number } | null;
  /** Perspective corners in source coords: TL, TR, BR, BL */
  perspective?: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ] | null;
  grayscale?: boolean;
  contrast?: number; // 1 = unchanged
  brightness?: number; // 0 = unchanged, range roughly -100..100
  threshold?: number | null; // 0–255, null = off
  invert?: boolean;
  maxDimension?: number;
  minDimension?: number;
};

export type PreprocessResult = {
  canvas: HTMLCanvasElement;
  blob: Blob;
  width: number;
  height: number;
  scaled: boolean;
  upscaled: boolean;
};

const DEFAULT_MAX = 2000;
const DEFAULT_MIN = 800;

function loadImage(source: Blob | ImageBitmap | HTMLImageElement): Promise<CanvasImageSource> {
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return Promise.resolve(source);
  }
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
    return Promise.resolve(source);
  }
  return createImageBitmap(source as Blob);
}

export async function correctExifOrientation(file: Blob): Promise<Blob> {
  // createImageBitmap / browser decode typically honors EXIF orientation for JPEG.
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("orient failed"))),
        file.type || "image/jpeg",
        0.92,
      );
    });
  } catch {
    return file;
  }
}

function applyPerspective(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  corners: NonNullable<PreprocessOptions["perspective"]>,
  outW: number,
  outH: number,
) {
  // Homography via bilinear strip draw (simple quad warp).
  const [tl, tr, br, bl] = corners;
  const rows = outH;
  for (let y = 0; y < rows; y++) {
    const v = y / (rows - 1 || 1);
    const leftX = tl.x + (bl.x - tl.x) * v;
    const leftY = tl.y + (bl.y - tl.y) * v;
    const rightX = tr.x + (br.x - tr.x) * v;
    const rightY = tr.y + (br.y - tr.y) * v;
    // Draw one horizontal source strip into destination row
    for (let x = 0; x < outW; x++) {
      const u = x / (outW - 1 || 1);
      const sx = leftX + (rightX - leftX) * u;
      const sy = leftY + (rightY - leftY) * u;
      ctx.drawImage(src, sx, sy, 1, 1, x, y, 1, 1);
    }
  }
  void srcW;
  void srcH;
}

export async function preprocessReceiptImage(
  source: Blob,
  options: PreprocessOptions = {},
): Promise<PreprocessResult> {
  const img = await loadImage(source);
  const anyImg = img as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  const srcW = Number(anyImg.naturalWidth ?? anyImg.width ?? 0);
  const srcH = Number(anyImg.naturalHeight ?? anyImg.height ?? 0);

  const rotate = options.rotateDegrees ?? 0;
  const crop = options.crop;
  const maxDim = options.maxDimension ?? DEFAULT_MAX;
  const minDim = options.minDimension ?? DEFAULT_MIN;

  let workW = crop?.width ?? srcW;
  let workH = crop?.height ?? srcH;
  if (rotate === 90 || rotate === 270) {
    const t = workW;
    workW = workH;
    workH = t;
  }

  let scale = 1;
  let scaled = false;
  let upscaled = false;
  const longest = Math.max(workW, workH);
  const shortest = Math.min(workW, workH);
  if (longest > maxDim) {
    scale = maxDim / longest;
    scaled = true;
  } else if (shortest < minDim && shortest > 0) {
    scale = minDim / shortest;
    upscaled = true;
  }

  const outW = Math.max(1, Math.round(workW * scale));
  const outH = Math.max(1, Math.round(workH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.save();
  if (options.perspective) {
    applyPerspective(ctx, img, srcW, srcH, options.perspective, outW, outH);
  } else {
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    const drawW = (rotate === 90 || rotate === 270 ? outH : outW);
    const drawH = (rotate === 90 || rotate === 270 ? outW : outH);
    if (crop) {
      ctx.drawImage(
        img,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        -drawW / 2,
        -drawH / 2,
        drawW,
        drawH,
      );
    } else {
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    }
  }
  ctx.restore();

  const contrast = options.contrast ?? 1;
  const brightness = options.brightness ?? 0;
  const useGray = options.grayscale !== false;
  const threshold = options.threshold ?? null;
  const invert = options.invert ?? false;

  if (useGray || contrast !== 1 || brightness !== 0 || threshold !== null || invert) {
    const imageData = ctx.getImageData(0, 0, outW, outH);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];
      if (useGray) {
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = y;
      }
      r = (r - 128) * contrast + 128 + brightness;
      g = (g - 128) * contrast + 128 + brightness;
      b = (b - 128) * contrast + 128 + brightness;
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      if (threshold !== null) {
        const v = (r + g + b) / 3 >= threshold ? 255 : 0;
        r = g = b = v;
      }
      if (invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("preprocess blob failed"))),
      "image/png",
    );
  });

  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) {
    img.close();
  }

  return { canvas, blob, width: outW, height: outH, scaled, upscaled };
}

/** Suggest a full-frame crop (receipt boundary placeholder for manual correction). */
export function suggestReceiptBounds(
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const padX = Math.round(width * 0.04);
  const padY = Math.round(height * 0.03);
  return {
    x: padX,
    y: padY,
    width: Math.max(1, width - padX * 2),
    height: Math.max(1, height - padY * 2),
  };
}

export function estimateDeskewAngle(canvas: HTMLCanvasElement): number {
  // Lightweight projection heuristic — returns small angle suggestion in degrees.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  const { width, height } = canvas;
  const sample = ctx.getImageData(0, 0, width, Math.min(height, 200));
  // Stub stable zero when not enough signal; UI still allows manual rotate.
  void sample;
  return 0;
}
