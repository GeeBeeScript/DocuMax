import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** Needs local Supabase + Redis; Playwright starts the worker (see playwright.config.ts). */

const FIXTURE = path.join(__dirname, "../fixtures/pdf/sample-invoice-3-pages.pdf");

test("upload a PDF and watch it reach the final status live", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Uma Uploader");
  await page.getByLabel("Work email").fill(`uploader-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Sign up free" }).click();
  await page.getByLabel("Organization name").fill("Summit Trades");
  await page.getByText("Jobs", { exact: true }).click();
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/onboarding\/invite$/);

  await page.getByRole("link", { name: "Skip for now" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Documents" }).click();
  await page.evaluate(() => ((window as unknown as { marker: boolean }).marker = true));

  await page.locator("input[type=file]").setInputFiles([
    { name: "sample-invoice-3-pages.pdf", mimeType: "application/pdf", buffer: readFileSync(FIXTURE) },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a document") },
  ]);

  const tray = page.getByRole("region", { name: /Uploads/ });
  await expect(tray.getByRole("listitem").filter({ hasText: "notes.txt" })).toContainText(
    "Unsupported file type.",
  );
  await expect(tray.getByRole("listitem").filter({ hasText: "sample-invoice-3-pages.pdf" })).toContainText(
    "Uploaded",
  );

  const row = page.getByRole("row", { name: /sample-invoice-3-pages\.pdf/ });
  await expect(row).toContainText("Ready", { timeout: 30_000 });
  // Status arrived live — the page never reloaded.
  expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);

  await row.getByRole("link", { name: "sample-invoice-3-pages.pdf" }).click();
  await expect(page.getByRole("navigation", { name: "Pages" }).getByRole("button")).toHaveCount(3);
  await page.getByRole("button", { name: "Page 3 of 3" }).click();
  await expect(page.getByText("Page 3 of 3", { exact: true })).toBeVisible();
});

test("documents are gated behind login", async ({ page }) => {
  await page.goto("/app/documents");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fdocuments$/);
});

test("a scanned PDF is OCR'd and its text shown per page", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Olga OCR");
  await page.getByLabel("Work email").fill(`ocr-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Sign up free" }).click();
  await page.getByLabel("Organization name").fill("Scan Co");
  await page.getByText("Properties", { exact: true }).click();
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/onboarding\/invite$/);
  await page.goto("/app/documents");

  const scanned = path.join(__dirname, "../fixtures/pdf/scanned-invoice-3-pages.pdf");
  await page.locator("input[type=file]").setInputFiles(scanned);
  const row = page.getByRole("row", { name: /scanned-invoice-3-pages\.pdf/ });
  await expect(row).toContainText("Ready", { timeout: 60_000 });

  await row.getByRole("link", { name: "scanned-invoice-3-pages.pdf" }).click();
  await page.getByRole("tab", { name: "Extracted text" }).click();
  const pages = page.getByRole("tabpanel").getByRole("listitem");
  await expect(pages).toHaveCount(3);
  await expect(pages.first().getByText(/^OCR · \d+%$/)).toBeVisible();
  await expect(pages.first()).toContainText("Brightline Plumbing");
  await expect(pages.nth(2)).toContainText("Page 3 of 3");
});
