import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { createScheduler, createWorker, OEM, PSM } from "tesseract.js";
import { PIPELINE } from "./config";

export interface OcrResult {
  text: string;
  /** 0–1 (Tesseract's mean word confidence / 100). */
  confidence: number;
}

/** What the pipeline needs from OCR — a seam for tests. */
export interface OcrEngine {
  recognize(png: Buffer): Promise<OcrResult>;
  terminate(): Promise<void>;
}

/**
 * Directory with `eng.traineddata.gz`, shipped as the npm package `@tesseract.js-data/eng` — so the language
 * data is installed with node_modules (and baked into the worker image), never downloaded at runtime.
 */
export function bundledLangPath(): string {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  return path.join(path.dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int");
}

/**
 * A pool of `workers` Tesseract workers behind one scheduler. Create once per process and reuse across jobs
 * (start-up costs ~0.5 s per worker); call terminate() on shutdown.
 */
export async function createTesseractEngine({
  workers = 2,
  langPath = bundledLangPath(),
  lang = PIPELINE.OCR_LANG,
}: { workers?: number; langPath?: string; lang?: string } = {}): Promise<OcrEngine> {
  const scheduler = createScheduler();
  const cachePath = path.join(tmpdir(), "documax-tesseract");
  await Promise.all(
    Array.from({ length: workers }, async () => {
      const worker = await createWorker(lang, OEM.LSTM_ONLY, { langPath, cachePath, gzip: true });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        user_defined_dpi: String(PIPELINE.OCR_DPI),
        preserve_interword_spaces: "1",
      });
      scheduler.addWorker(worker);
    }),
  );

  return {
    async recognize(png) {
      const { data } = await scheduler.addJob("recognize", png);
      return { text: data.text, confidence: Math.max(0, Math.min(1, data.confidence / 100)) };
    },
    terminate: () => scheduler.terminate(),
  };
}
