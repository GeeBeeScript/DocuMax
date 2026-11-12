import path from "node:path";
import { expect, test } from "@playwright/test";

/** Needs local Supabase + Redis; Playwright starts the worker with the mock model (60% confidence → flagged). */

test("review, correct and approve a flagged document", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Rae Reviewer");
  await page.getByLabel("Work email").fill(`reviewer-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Sign up free" }).click();
  await page.getByLabel("Organization name").fill("Review Co");
  await page.getByText("Properties", { exact: true }).click();
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/onboarding\/invite$/);

  await page.goto("/app/entities");
  await page.getByRole("button", { name: "Add property" }).first().click();
  await page.getByLabel("Property name").fill("12 Elm Street");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "12 Elm Street" })).toBeVisible();

  await page.goto("/app/documents");
  await page
    .locator("input[type=file]")
    .setInputFiles(path.join(__dirname, "../fixtures/pdf/digital-invoice.pdf"));
  await expect(page.getByRole("row", { name: /digital-invoice\.pdf/ })).toContainText("Needs review", {
    timeout: 30_000,
  });

  // The queue: one record, flagged for low confidence.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Review", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /Low confidence/ })).toContainText("1");
  const row = page.getByRole("row", { name: /digital-invoice\.pdf/ });
  await expect(row).toContainText("Low confidence");
  await row.getByRole("link", { name: "digital-invoice.pdf" }).click();

  // Review screen: the mock model found no currency (an error) and read the rest at 60% (warnings).
  await expect(page.getByText("1 of 1")).toBeVisible();
  await expect(page.getByText("Missing field")).toBeVisible();
  await expect(page.getByLabel("Supplier", { exact: true })).toHaveValue("Brightline Plumbing Co.");
  // The shortcut list opens once the page is interactive.
  await page.getByRole("button", { name: "Keyboard shortcuts (?)" }).click();
  await expect(page.getByRole("region", { name: "Keyboard shortcuts" })).toContainText("Approve and go");

  // E jumps to the first flagged field; typing the currency clears its error live. Ctrl+S saves.
  await page.keyboard.press("e");
  const currency = page.getByLabel("Currency", { exact: true });
  await expect(currency).toBeFocused();
  await currency.fill("usd");
  await expect(currency).toHaveValue("USD");
  await expect(page.getByText("Missing field")).toHaveCount(0);
  await expect(page.getByText("1 unsaved change")).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Corrections saved")).toBeVisible();
  const history = page.getByRole("list", { name: "History" });
  await expect(history).toContainText("changed currency");
  await expect(history).toContainText("USD");

  // Approve with one keystroke: it was the last item, so we land back on an empty queue.
  await page.keyboard.press("Escape");
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/app\/review$/);
  await expect(page.getByText("Nothing to review")).toBeVisible();

  // The document is ready, and the audit log has the change with before → after.
  await page.goto("/app/documents");
  await expect(page.getByRole("row", { name: /digital-invoice\.pdf/ })).toContainText("Ready");
  await page.goto("/app/settings/audit?table=records");
  await expect(page.getByRole("row", { name: /Record created/ })).toContainText("DocuMax");
  await expect(page.getByRole("table", { name: "Audit log entries" })).toContainText(
    "Currency: (empty) → USD",
  );
});
