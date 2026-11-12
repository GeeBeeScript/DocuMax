import path from "node:path";
import { expect, test } from "@playwright/test";

/** Needs local Supabase + Redis; Playwright starts the worker (mock AI, real Chromium for PDFs). */

test("generate a statement, a quote and a batch, and download them", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Rory Reports");
  await page.getByLabel("Work email").fill(`reports-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Sign up free" }).click();
  await page.getByLabel("Organization name").fill("Summit Trades");
  await page.getByText("Jobs", { exact: true }).click();
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/onboarding\/invite$/);

  await page.goto("/app/entities");
  await page.getByRole("button", { name: "Add job" }).first().click();
  await page.getByLabel("Job name").fill("Deck build");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Deck build" })).toBeVisible();

  // One approved cost on the job (Oct 2026).
  await page.goto("/app/documents");
  await page.getByLabel("Assign to job (optional)").selectOption({ label: "Deck build" });
  await page
    .locator("input[type=file]")
    .setInputFiles(path.join(__dirname, "../fixtures/pdf/digital-invoice.pdf"));
  await expect(page.getByRole("row", { name: /digital-invoice\.pdf/ })).toContainText("Needs review", {
    timeout: 30_000,
  });
  await page.goto("/app/review");
  await page.getByRole("link", { name: "digital-invoice.pdf" }).click();
  await page.getByLabel("Currency", { exact: true }).fill("USD");
  await page.getByRole("button", { name: /^Approve/ }).click();
  await expect(page).toHaveURL(/\/app\/review$/);

  // Statement + quote from the job page.
  await page.goto("/app/entities");
  await page.getByRole("link", { name: "Deck build" }).click();
  await expect(page).toHaveURL(/\/app\/entities\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}?month=2026-10`);
  await page.getByRole("button", { name: "Generate statement" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Generating — it'll be ready in a moment.")).toBeVisible();
  await page.getByRole("button", { name: "Create quote" }).click();
  const quote = page.getByRole("dialog");
  await quote.getByLabel("Markup (%)").fill("20");
  await quote.getByLabel("Sales tax (%)").fill("10");
  await quote.getByRole("button", { name: "Generate" }).click();
  await expect(quote).toBeHidden();

  // Reports page: both become ready live; download them.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reports" }).click();
  const statementRow = page.getByRole("row", { name: /Statement - Deck build - 2026-10\.pdf/ });
  const year = new Date().getFullYear();
  const quoteRow = page.getByRole("row", { name: new RegExp(`Quote Q-${year}-0001 - Deck build\\.pdf`) });
  await expect(statementRow).toContainText("Ready", { timeout: 60_000 });
  await expect(quoteRow).toContainText("Ready", { timeout: 60_000 });
  for (const [row, name] of [
    [statementRow, "Statement - Deck build - 2026-10.pdf"],
    [quoteRow, `Quote Q-${year}-0001 - Deck build.pdf`],
  ] as const) {
    const download = page.waitForEvent("download");
    await row.getByRole("link", { name: /Download/ }).click();
    expect((await download).suggestedFilename()).toBe(name);
  }

  // Batch for October: progress, then the ZIP.
  await page.getByRole("button", { name: "Statements for all jobs" }).click();
  await page.getByRole("dialog").getByLabel("Month").fill("2026-10");
  await page.getByRole("dialog").getByRole("button", { name: "Generate" }).click();
  const batches = page.getByRole("list", { name: "Batches" });
  await expect(batches).toContainText("Statements · October 2026");
  await expect(batches.getByRole("link", { name: /Download ZIP/ })).toBeVisible({ timeout: 60_000 });
  const zip = page.waitForEvent("download");
  await batches.getByRole("link", { name: /Download ZIP/ }).click();
  expect((await zip).suggestedFilename()).toBe("Statements - 2026-10.zip");
});
