import sharp from "sharp";
import { PIPELINE } from "./config";

/**
 * Otsu's method: the gray level that best separates a 256-bin histogram into two classes (ink vs paper).
 * Adapts per image, so dim phone photos and bright scans both binarize cleanly.
 */
export function otsuThreshold(histogram: readonly number[]): number {
  const total = histogram.reduce((a, b) => a + b, 0);
  if (total === 0) return 128;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * (histogram[i] ?? 0);

  let sumBackground = 0;
  let weightBackground = 0;
  let bestVariance = -1;
  let threshold = 128;
  for (let i = 0; i < 256; i++) {
    weightBackground += histogram[i] ?? 0;
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += i * (histogram[i] ?? 0);
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = i;
    }
  }
  // Pixels <= threshold become ink; sharp's threshold() maps >= value to white, so separate just above it.
  return Math.min(255, threshold + 1);
}

/** Target width for OCR: upscale narrow images (bounded), never downscale. */
export function ocrTargetWidth(width: number): number {
  if (width >= PIPELINE.MIN_OCR_WIDTH) return width;
  return Math.round(Math.min(PIPELINE.MIN_OCR_WIDTH, width * PIPELINE.MAX_UPSCALE));
}

export interface PreprocessResult {
  png: Buffer;
  width: number;
  height: number;
  threshold: number;
}

/**
 * Image → clean black-on-white PNG for Tesseract:
 * EXIF rotate → flatten transparency onto white → grayscale → (bounded upscale) → Otsu binarization.
 *
 * Deliberately NO `normalize()`: on pages that are > 99% paper it stretches a few gray levels of JPEG noise to
 * full contrast and shreds the text into stripes (measured: 0/7 key strings with it, 7/7 without).
 */
export async function preprocessForOcr(input: Buffer): Promise<PreprocessResult> {
  const oriented = sharp(input, { failOn: "error" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .removeAlpha();
  const meta = await oriented.clone().metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0; // size after EXIF rotation
  const gray = await oriented
    .grayscale()
    .resize({ width: ocrTargetWidth(width), withoutEnlargement: false, kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const histogram = new Array<number>(256).fill(0);
  for (const value of gray.data) histogram[value]++;
  const threshold = otsuThreshold(histogram);

  const png = await sharp(gray.data, { raw: gray.info }).threshold(threshold).png().toBuffer();
  return { png, width: gray.info.width, height: gray.info.height, threshold };
}
