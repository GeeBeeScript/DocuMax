import path from "node:path";
import { expect, test } from "@playwright/test";

/** Needs local Supabase + Redis; Playwright starts the worker with the mock model. */

test("approve a cost, split it across two properties, and see each property's figures", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Sam Splitter");
  await page.getByLabel("Work email").fill(`splitter-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Sign up free" }).click();
  await page.getByLabel("Organization name").fill("Split Co");
  await page.getByText("Properties", { exact: true }).click();
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/onboarding\/invite$/);

  await page.goto("/app/entities");
  for (const name of ["12 Elm Street", "4 Oak Court"]) {
    await page.getByRole("button", { name: "Add property" }).first().click();
    await page.getByLabel("Property name").fill(name);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }

  // Upload → the mock model matches "12 Elm Street" and misses the currency → fix it and approve.
  await page.goto("/app/documents");
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

  // 100% on Elm for October 2026.
  await page.goto("/app/entities");
  await page.getByRole("link", { name: "12 Elm Street" }).click();
  await page.getByLabel("Month", { exact: true }).fill("2026-10");
  await page.getByRole("button", { name: "Show" }).first().click();
  await expect(page.getByText("October 2026")).toBeVisible();
  await expect(page.getByText("$1,260.57").first()).toBeVisible();

  // Split 60 / 40 from the record.
  await page.getByRole("table", { name: "Approved costs in this period" }).getByRole("link").first().click();
  await page.getByRole("button", { name: "Split this cost" }).click();
  await page.getByLabel("Share (%), row 1").fill("60");
  await page.getByLabel("Property, row 2").selectOption({ label: "4 Oak Court" });
  await page.getByLabel("Share (%), row 2").fill("40");
  await expect(page.getByText("Total: 100%")).toBeVisible();
  await page.getByRole("button", { name: "Save split" }).click();
  await expect(page.getByText("Split saved")).toBeVisible();
  await expect(page.getByRole("region", { name: /Split across properties/ })).toContainText("40%");

  // Each property shows its share; together they equal the invoice total.
  await page.goto("/app/entities");
  await page.getByRole("link", { name: "4 Oak Court" }).click();
  await expect(page).toHaveURL(/\/app\/entities\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}?month=2026-10`);
  await expect(page.getByText("$504.23").first()).toBeVisible();
  await page.goto("/app/entities");
  await page.getByRole("link", { name: "12 Elm Street" }).click();
  await expect(page).toHaveURL(/\/app\/entities\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}?month=2026-10`);
  await expect(page.getByText("$756.34").first()).toBeVisible();
});
