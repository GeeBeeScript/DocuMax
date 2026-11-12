// @vitest-environment node
/**
 * SLOW (real Tesseract): `npm run test:slow`. Excluded from `npm test`.
 * Fixtures: tests/fixtures (regenerate with tests/fixtures/generate.mjs).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extractDocumentText } from "./extract-document";
import { createTesseractEngine, type OcrEngine } from "./ocr";

const fixture = async (p: string) =>
  new Uint8Array(await readFile(path.join(process.cwd(), "tests/fixtures", p)));
const INVOICE_KEYS = [
  "Brightline Plumbing",
  "2026-10-14",
  "47-2291034",
  "1260.57",
  "Total due",
  "Copper fittings",
];
const RECEIPT_KEYS = ["HARDWARE DEPOT", "88213", "2026-10-20", "18.40", "28.49", "30.84", "TOTAL"];

let ocr: OcrEngine;
beforeAll(async () => {
  ocr = await createTesseractEngine({ workers: 2 });
}, 60_000);
afterAll(() => ocr?.terminate());

describe("stage 1 on fixtures", () => {
  it("digital PDF: text layer only, no OCR", async () => {
    const result = await extractDocumentText(await fixture("pdf/digital-invoice.pdf"), "application/pdf", {
      ocr,
    });
    expect(result.ocrPages).toEqual([]);
    expect(result.pages[0]).toMatchObject({ source: "text_layer", ocrConfidence: null });
    for (const key of [...INVOICE_KEYS, "INV-2041"]) expect(result.pages[0].text).toContain(key);
  });

  it("scanned 3-page PDF: every page OCR'd, key strings found, under 30 s", async () => {
    const started = Date.now();
    const result = await extractDocumentText(
      await fixture("pdf/scanned-invoice-3-pages.pdf"),
      "application/pdf",
      { ocr },
    );
    const elapsed = Date.now() - started;
    expect(result.ocrPages).toEqual([1, 2, 3]);
    for (const page of result.pages) {
      expect(page.source).toBe("ocr");
      expect(page.ocrConfidence).toBeGreaterThan(0.7);
      for (const key of [...INVOICE_KEYS, "INV-3307"]) expect(page.text).toContain(key);
    }
    expect(result.pages.map((p) => p.text.includes(`Page ${p.pageNo} of 3`))).toEqual([true, true, true]);
    expect(elapsed).toBeLessThan(30_000);
    console.info(`scanned 3-page invoice: ${elapsed} ms`);
  }, 60_000);

  it("mixed PDF: OCR only the scanned page", async () => {
    const result = await extractDocumentText(await fixture("pdf/mixed-invoice.pdf"), "application/pdf", {
      ocr,
    });
    expect(result.ocrPages).toEqual([2]);
    expect(result.pages.map((p) => p.source)).toEqual(["text_layer", "ocr"]);
    for (const page of result.pages) expect(page.text).toContain("INV-5120");
  }, 60_000);

  it("small screenshot receipt keeps its TOTAL line (regression: automatic layout dropped it)", async () => {
    const result = await extractDocumentText(await fixture("images/sample-receipt.png"), "image/png", {
      ocr,
    });
    for (const key of ["HARDWARE DEPOT", "88213", "18.40", "6.10", "TOTAL", "24.50"])
      expect(result.pages[0].text).toContain(key);
  }, 60_000);

  it("scanned European invoice: amounts and dates as printed", async () => {
    const result = await extractDocumentText(
      await fixture("pdf/euro-invoice-scanned.pdf"),
      "application/pdf",
      { ocr },
    );
    for (const key of ["Haustechnik Weber GmbH", "RE-2026-0815", "14.10.2026", "1.234,63"])
      expect(result.pages[0].text).toContain(key);
  }, 60_000);

  it("phone photo receipt (sideways, EXIF-rotated): OCR'd upright", async () => {
    const result = await extractDocumentText(await fixture("images/photo-receipt.jpg"), "image/jpeg", {
      ocr,
    });
    expect(result.pageCount).toBe(1);
    expect(result.pages[0].source).toBe("ocr");
    for (const key of RECEIPT_KEYS) expect(result.pages[0].text).toContain(key);
  }, 60_000);
});
