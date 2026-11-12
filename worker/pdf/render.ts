import { chromium, type Browser } from "playwright";
import { PDF_MARGINS, type RenderedReport } from "@/pdf/document";

/**
 * HTML → PDF with Chromium (docs/ARCHITECTURE.md → PDF rendering). One browser per worker process, one context per
 * job. `CHROMIUM_PATH` points at a specific binary when the default Playwright one isn't installed.
 */

let browser: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  browser ??= chromium
    .launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
    .then((b) => {
      b.on("disconnected", () => {
        browser = null;
      });
      return b;
    })
    .catch((error) => {
      browser = null;
      throw error;
    });
  return browser;
}

export async function renderPdf(report: RenderedReport): Promise<Uint8Array> {
  const context = await (await getBrowser()).newContext();
  try {
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    await page.setContent(report.html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: report.headerTemplate,
      footerTemplate: report.footerTemplate,
      margin: PDF_MARGINS,
    });
    return new Uint8Array(pdf);
  } finally {
    await context.close();
  }
}

export async function closeBrowser() {
  const b = browser;
  browser = null;
  if (b) await (await b).close().catch(() => undefined);
}
