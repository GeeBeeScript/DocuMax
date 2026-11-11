/** Stage 1 (text extraction) settings — docs/DOCUMENT_PIPELINE.md. */
export const PIPELINE = {
  /** A page is sparse (→ OCR) below this many non-whitespace characters in its text layer. */
  OCR_MIN_CHARS_PER_PAGE: 40,
  /** v1 limit; larger documents fail with a clear message. */
  MAX_PAGES: 30,
  /** Render resolution for OCR'd PDF pages. */
  OCR_DPI: 300,
  /** Images narrower than this are upscaled before OCR (small phone crops). */
  MIN_OCR_WIDTH: 1600,
  /** Never upscale more than this factor (beyond it OCR gains nothing and memory balloons). */
  MAX_UPSCALE: 2.5,
  OCR_LANG: "eng",
} as const;
