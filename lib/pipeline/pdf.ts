import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import { PIPELINE } from "./config";
import { PipelineError } from "./errors";

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

/** Parse a PDF, mapping pdf.js failures to user-facing pipeline errors. */
export async function loadPdf(bytes: Uint8Array): Promise<PdfDocument> {
  try {
    // pdf.js may transfer/detach the buffer; give it a copy so callers can keep theirs.
    return await getDocumentProxy(bytes.slice());
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "PasswordException") throw new PipelineError("password_protected");
    throw new PipelineError("corrupt_pdf");
  }
}

/** The text layer of every page (empty string for image-only pages). */
export async function extractTextLayer(pdf: PdfDocument): Promise<string[]> {
  if (pdf.numPages > PIPELINE.MAX_PAGES) {
    throw new PipelineError(
      "too_many_pages",
      `This document has ${pdf.numPages} pages; the limit is ${PIPELINE.MAX_PAGES}. Split it and upload the parts.`,
    );
  }
  try {
    const { text } = await extractText(pdf, { mergePages: false });
    return text;
  } catch {
    throw new PipelineError("corrupt_pdf");
  }
}

/** Render one page (1-based) to PNG at `dpi`. */
export async function renderPdfPage(
  pdf: PdfDocument,
  pageNumber: number,
  dpi: number = PIPELINE.OCR_DPI,
): Promise<Buffer> {
  const png = await renderPageAsImage(pdf, pageNumber, {
    canvasImport: () => import("@napi-rs/canvas"),
    scale: dpi / 72,
  });
  return Buffer.from(png);
}
