// @vitest-environment node
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PIPELINE } from "./config";
import { ocrTargetWidth, otsuThreshold, preprocessForOcr } from "./preprocess";

const histogram = (bins: Record<number, number>) => Array.from({ length: 256 }, (_, i) => bins[i] ?? 0);

describe("otsuThreshold", () => {
  it("splits dark ink from light paper", () => {
    const t = otsuThreshold(histogram({ 30: 1_000, 40: 800, 235: 50_000, 246: 400_000 }));
    expect(t).toBeGreaterThan(40);
    expect(t).toBeLessThanOrEqual(235);
  });

  it("adapts to dim photos (paper at 150 instead of 245)", () => {
    const t = otsuThreshold(histogram({ 20: 2_000, 150: 60_000 }));
    expect(t).toBeGreaterThan(20);
    expect(t).toBeLessThanOrEqual(150);
  });

  it("falls back to the midpoint for an empty histogram", () => {
    expect(otsuThreshold(histogram({}))).toBe(128);
  });
});

describe("ocrTargetWidth", () => {
  it("never downscales", () => {
    expect(ocrTargetWidth(2480)).toBe(2480);
  });

  it("upscales small images up to the minimum OCR width, bounded", () => {
    expect(ocrTargetWidth(800)).toBe(PIPELINE.MIN_OCR_WIDTH);
    expect(ocrTargetWidth(400)).toBe(Math.round(400 * PIPELINE.MAX_UPSCALE));
  });
});

describe("preprocessForOcr", () => {
  it("applies EXIF rotation, removes transparency and binarizes", async () => {
    // 200×100 transparent image with a dark bar, stored with EXIF orientation 6 (display rotated 90°).
    const input = await sharp({
      create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: { create: { width: 120, height: 20, channels: 3, background: "#222" } }, left: 40, top: 40 },
      ])
      .withMetadata({ orientation: 6 })
      .png()
      .toBuffer();
    const result = await preprocessForOcr(input);
    const meta = await sharp(result.png).metadata();
    expect(meta.height! > meta.width!).toBe(true); // rotated to portrait
    expect(meta.hasAlpha).toBe(false);
    const { data } = await sharp(result.png).greyscale().raw().toBuffer({ resolveWithObject: true });
    expect(new Set(data)).toEqual(new Set([0, 255])); // pure black & white
    expect(data.filter((v) => v === 255).length).toBeGreaterThan(data.length / 2); // transparent → white paper
  });
});
