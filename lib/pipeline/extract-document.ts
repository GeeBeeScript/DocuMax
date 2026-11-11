import { isPipelineError, PipelineError } from "./errors";
import { decodeImage } from "./images";
import type { OcrEngine } from "./ocr";
import { extractTextLayer, loadPdf, renderPdfPage } from "./pdf";
import { preprocessForOcr } from "./preprocess";
import { cleanText, pagesNeedingOcr } from "./route-text";

export type PageSource = "text_layer" | "ocr";

export interface ExtractedPage {
  pageNo: number;
  text: string;
  source: PageSource;
  /** 0–1 for OCR'd pages, null for text-layer pages. */
  ocrConfidence: number | null;
}

export interface ExtractionResult {
  pageCount: number;
  pages: ExtractedPage[];
  /** Pages that went through OCR (for logs/metrics). */
  ocrPages: number[];
}

async function ocrImage(image: Buffer, ocr: OcrEngine) {
  const { png } = await preprocessForOcr(image);
  const { text, confidence } = await ocr.recognize(png);
  return { text: cleanText(text), ocrConfidence: Math.round(confidence * 1000) / 1000 };
}

/**
 * Stage 1: per-page text for a PDF or image. PDFs use their text layer and OCR only sparse pages; images are
 * always OCR'd. Throws PipelineError for permanent problems (corrupt, password, too many pages, unreadable).
 */
export async function extractDocumentText(
  bytes: Uint8Array,
  mimeType: string,
  { ocr }: { ocr: OcrEngine },
): Promise<ExtractionResult> {
  if (mimeType === "application/pdf") {
    const pdf = await loadPdf(bytes);
    try {
      const textLayer = await extractTextLayer(pdf);
      const ocrPages = pagesNeedingOcr(textLayer);
      const pages: ExtractedPage[] = [];
      for (const [i, layer] of textLayer.entries()) {
        const pageNo = i + 1;
        if (!ocrPages.includes(pageNo)) {
          pages.push({ pageNo, text: cleanText(layer), source: "text_layer", ocrConfidence: null });
          continue;
        }
        let rendered: Buffer;
        try {
          rendered = await renderPdfPage(pdf, pageNo);
        } catch (error) {
          if (isPipelineError(error)) throw error;
          throw new PipelineError("corrupt_pdf");
        }
        pages.push({ pageNo, source: "ocr", ...(await ocrImage(rendered, ocr)) });
      }
      return { pageCount: textLayer.length, pages, ocrPages };
    } finally {
      await pdf.loadingTask.destroy(); // frees the pdf.js worker + memory
    }
  }

  const image = await decodeImage(bytes, mimeType);
  return {
    pageCount: 1,
    pages: [{ pageNo: 1, source: "ocr", ...(await ocrImage(image, ocr)) }],
    ocrPages: [1],
  };
}
