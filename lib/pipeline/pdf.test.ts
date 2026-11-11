// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PipelineError } from "./errors";
import { decodeImage } from "./images";
import { extractTextLayer, loadPdf } from "./pdf";
import { pagesNeedingOcr } from "./route-text";

const fixture = async (p: string) =>
  new Uint8Array(await readFile(path.join(process.cwd(), "tests/fixtures", p)));
const layer = async (p: string) => extractTextLayer(await loadPdf(await fixture(p)));

vi.mock("heic-decode", () => ({
  default: async () => ({
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]),
  }),
}));

describe("PDF text layer (fixtures)", () => {
  it("digital invoice: real text, no OCR needed", async () => {
    const pages = await layer("pdf/digital-invoice.pdf");
    expect(pages).toHaveLength(1);
    for (const key of ["Brightline Plumbing Co.", "INV-2041", "47-2291034", "1260.57"])
      expect(pages[0]).toContain(key);
    expect(pagesNeedingOcr(pages)).toEqual([]);
  });

  it("scanned invoice: no text layer on any page → all OCR", async () => {
    expect(pagesNeedingOcr(await layer("pdf/scanned-invoice-3-pages.pdf"))).toEqual([1, 2, 3]);
  });

  it("mixed invoice: only the scanned page needs OCR", async () => {
    const pages = await layer("pdf/mixed-invoice.pdf");
    expect(pages[0]).toContain("INV-5120");
    expect(pagesNeedingOcr(pages)).toEqual([2]);
  });
});

describe("PDF failures map to readable errors", () => {
  it("corrupt PDF", async () => {
    await expect(layer("pdf/corrupt.pdf")).rejects.toMatchObject({
      code: "corrupt_pdf",
      message: expect.stringMatching(/damaged/),
    });
  });

  it("password-protected PDF", async () => {
    await expect(loadPdf(await fixture("pdf/password-protected.pdf"))).rejects.toMatchObject({
      code: "password_protected",
      message: expect.stringMatching(/password-protected/),
    });
  });

  it("not a PDF at all", async () => {
    await expect(loadPdf(new TextEncoder().encode("hello"))).rejects.toBeInstanceOf(PipelineError);
  });

  it("more pages than the v1 limit", async () => {
    const fake = { numPages: 31 } as Parameters<typeof extractTextLayer>[0];
    await expect(extractTextLayer(fake)).rejects.toMatchObject({
      code: "too_many_pages",
      message: expect.stringMatching(/31 pages; the limit is 30/),
    });
  });
});

describe("decodeImage", () => {
  it("passes through JPEG/PNG/WEBP after validating", async () => {
    const jpg = await fixture("images/photo-receipt.jpg");
    expect((await decodeImage(jpg, "image/jpeg")).equals(Buffer.from(jpg))).toBe(true);
  });

  it("converts HEIC via the WASM decoder", async () => {
    const png = await decodeImage(new Uint8Array([1, 2, 3]), "image/heic");
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });

  it("rejects unreadable images and unsupported types", async () => {
    await expect(decodeImage(new TextEncoder().encode("not an image"), "image/png")).rejects.toMatchObject({
      code: "unreadable_image",
    });
    await expect(decodeImage(new Uint8Array([1]), "text/plain")).rejects.toMatchObject({
      code: "unsupported_type",
    });
  });
});
