// Regenerates the pipeline fixtures (deterministic content, synthetic data — no real customers).
//   node tests/fixtures/generate.mjs && python3 tests/fixtures/encrypt.py
// Needs Playwright's Chromium and sharp (both dev/runtime deps of this repo).
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = (p) => path.join(dir, p);

const invoiceHtml = (page, pages, invoiceNo = "INV-2041") => `
<section style="font-family:Helvetica,Arial,sans-serif;padding:48px;color:#111;page-break-after:always">
  <h1 style="margin:0 0 4px">Brightline Plumbing Co.</h1>
  <p style="margin:0">410 Canal Street, Springfield · Tax ID 47-2291034</p>
  <h2 style="margin:28px 0 8px">Invoice ${invoiceNo}</h2>
  <p style="margin:0">Issue date 2026-10-14 · Due 2026-11-13 · Page ${page} of ${pages}</p>
  <p>Bill to: Harbor &amp; Pine Property Management — 12 Elm Street</p>
  <table style="border-collapse:collapse;width:100%;font-size:16px" cellpadding="8">
    <tr style="border-bottom:2px solid #111"><th align="left">Description</th><th align="right">Qty</th><th align="right">Amount</th></tr>
    <tr><td>Replace water heater valve</td><td align="right">1</td><td align="right">420.00</td></tr>
    <tr><td>Labor 3.5 hours</td><td align="right">3.5</td><td align="right">560.00</td></tr>
    <tr><td>Copper fittings</td><td align="right">4</td><td align="right">184.50</td></tr>
  </table>
  <p style="text-align:right;margin-top:24px">Subtotal 1164.50<br>Tax 8.25% 96.07<br><b>Total due 1260.57</b></p>
</section>`;

const receiptHtml = `
<div style="font-family:'Courier New',monospace;font-size:22px;padding:28px;width:420px;background:#fff;color:#111">
  <h2 style="text-align:center;margin:0">HARDWARE DEPOT</h2>
  <p style="text-align:center;margin:4px 0 18px">Store 118 · Bayview</p>
  <p>Receipt 88213 2026-10-20</p>
  <p>PVC ELBOW 2X ........ 6.10</p>
  <p>COPPER FITTING 4X ... 18.40</p>
  <p>TEFLON TAPE ......... 3.99</p>
  <p>SUBTOTAL ............ 28.49</p>
  <p>TAX ................. 2.35</p>
  <p><b>TOTAL ............... 30.84</b></p>
  <p style="text-align:center">THANK YOU</p>
</div>`;

/** Screenshot of an HTML page section, like a scanner would capture (grayscale, slight tilt, noise). */
async function scan(page, html, width = 1240) {
  await page.setViewportSize({ width, height: 1754 });
  await page.setContent(`<body style="margin:0;background:#fff">${html}</body>`);
  const png = await page.screenshot({ fullPage: true });
  return sharp(png)
    .rotate(0.8, { background: "#f4f4f2" })
    .grayscale()
    .modulate({ brightness: 0.97 })
    .blur(0.4)
    .jpeg({ quality: 82 })
    .toBuffer();
}

/** PDF whose pages are images only (no text layer), like a scanner produces. */
async function imagePdf(page, images, textPages = {}) {
  const parts = images.map((img, i) =>
    textPages[i]
      ? textPages[i]
      : `<section style="page-break-after:always;margin:0"><img src="data:image/jpeg;base64,${img.toString("base64")}" style="width:100%"></section>`,
  );
  await page.setContent(`<body style="margin:0">${parts.join("")}</body>`);
  return page.pdf({ format: "A4", margin: { top: 0, bottom: 0, left: 0, right: 0 } });
}

// PW_CHROMIUM lets environments with a preinstalled browser point at it.
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const page = await browser.newPage();
await mkdir(out("pdf"), { recursive: true });
await mkdir(out("images"), { recursive: true });

// 1. Digital PDF (real text layer)
await page.setContent(invoiceHtml(1, 1));
await writeFile(out("pdf/digital-invoice.pdf"), await page.pdf({ format: "A4" }));

// 2. Scanned 3-page PDF (image-only)
const scans = [];
for (let i = 1; i <= 3; i++) scans.push(await scan(page, invoiceHtml(i, 3, "INV-3307")));
await writeFile(out("pdf/scanned-invoice-3-pages.pdf"), await imagePdf(page, scans));

// 3. Mixed PDF: page 1 digital, page 2 scanned
const mixedScan = await scan(page, invoiceHtml(2, 2, "INV-5120"));
await writeFile(
  out("pdf/mixed-invoice.pdf"),
  await imagePdf(page, [null, mixedScan], { 0: invoiceHtml(1, 2, "INV-5120") }),
);

// 4. Phone photo of a receipt: sideways (EXIF orientation 6 = rotate 90° to display), warm light, slight blur
await page.setViewportSize({ width: 480, height: 800 });
await page.setContent(`<body style="margin:0;background:#d8d2c4;padding:30px">${receiptHtml}</body>`);
const receipt = await page.screenshot({ fullPage: true });
// Separate pipelines: within one sharp pipeline, rotate always runs before resize.
const scaled = await sharp(receipt).resize({ width: 1100 }).toBuffer();
const photo = await sharp(scaled)
  .rotate(-90) // stored sideways…
  .modulate({ brightness: 0.95, saturation: 0.9 })
  .tint({ r: 255, g: 240, b: 220 })
  .blur(0.6)
  .withMetadata({ orientation: 6 }) // …and EXIF says "rotate 90° clockwise to view"
  .jpeg({ quality: 78 })
  .toBuffer();
await writeFile(out("images/photo-receipt.jpg"), photo);

// 5. Corrupt PDF: a real PDF truncated mid-file
const digital = await readFile(out("pdf/digital-invoice.pdf"));
await writeFile(out("pdf/corrupt.pdf"), digital.subarray(0, Math.floor(digital.length / 3)));

await browser.close();
console.log("fixtures written; now run: python3 tests/fixtures/encrypt.py");
