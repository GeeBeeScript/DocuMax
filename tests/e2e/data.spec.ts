import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

/** Needs local Supabase + Redis; Playwright starts the worker. */

test("import records from CSV, see them in review, export them again", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Ivy Import");
  await page.getByLabel("Work email").fill(`import-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Sign up free" }).click();
  await page.getByLabel("Organization name").fill("Ledger Co");
  await page.getByText("Properties", { exact: true }).click();
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/onboarding\/invite$/);

  await page.goto("/app/data");
  const template = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download a template" }).click();
  expect((await template).suggestedFilename()).toBe("DocuMax import template.csv");

  // A bookkeeping export with its own headers: auto-mapped; one bad row.
  const csv = [
    "Vendor,Bill Number,Date,Amount,VAT",
    "Acme Cleaning,AC-1,2026-10-02,240.00,0",
    'Bright Electric,BE-7,2026-10-09,"1,100.50",100.05',
    "Nobody,,10/09/2026,abc,",
  ].join("\n");
  await page
    .getByLabel("Choose a CSV file")
    .setInputFiles({ name: "bills.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("Match the columns of bills.csv (3 rows)")).toBeVisible();
  await expect(page.getByLabel("Supplier", { exact: true })).toHaveValue("Vendor");
  await expect(page.getByLabel("Total", { exact: true })).toHaveValue("Amount");
  await expect(page.getByRole("status")).toContainText("2 of 3 preview rows are ready to import.");
  await page.getByRole("button", { name: "Import", exact: true }).click();

  const history = page.getByRole("table", { name: "Recent imports" });
  await expect(history).toContainText("2 imported · 1 skipped", { timeout: 30_000 });
  const report = page.waitForEvent("download");
  await history.getByRole("link", { name: "Error report" }).click();
  const reportText = await readFile(await (await report).path(), "utf8");
  expect(reportText).toContain("4,Amount,");
  expect(reportText).toContain("4,Date,");

  // Imported records wait in review (no property assigned → flagged).
  await history.getByRole("link", { name: "Open in Review" }).click();
  await expect(page.getByRole("row", { name: /Acme Cleaning/ })).toContainText("No property or job");
  await expect(page.getByRole("row", { name: /Bright Electric/ })).toBeVisible();

  // Export what's awaiting review as CSV.
  await page.goto("/app/data");
  await page.getByLabel("Status").selectOption({ label: "Needs review" });
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const file = await exported;
  expect(file.suggestedFilename()).toMatch(/^Records - \d{4}-\d{2}-\d{2}\.csv$/);
  const text = await readFile(await file.path(), "utf8");
  expect(text).toContain("Acme Cleaning");
  expect(text).toContain("1100.50");
});
