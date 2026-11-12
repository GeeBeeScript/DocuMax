import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { orgOfOwner, setPlan } from "./support/admin";

/**
 * Phase 11: the whole product in one go — sign up → organization → upload → review → approve → statement →
 * download — then what a viewer may and may not do. Needs local Supabase + Redis; Playwright starts the worker.
 */

const unique = (label: string) => `${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;

async function signUp(page: Page, name: string, email: string) {
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Sign up free" }).click();
}

test("happy path: upload → review → approve → statement → download; a viewer can only look", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const ownerEmail = unique("hp-owner");
  await page.goto("/signup");
  await signUp(page, "Hana Happy", ownerEmail);
  await page.getByLabel("Organization name").fill("Happy Homes");
  await page.getByText("Properties", { exact: true }).click();
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/onboarding\/invite$/);
  await setPlan(await orgOfOwner(ownerEmail), "pro");

  // Invite a viewer now (used at the end).
  const viewerEmail = unique("hp-viewer");
  await page.getByLabel("Email").fill(viewerEmail);
  await page.getByLabel("Role").selectOption("viewer");
  await page.getByRole("button", { name: "Create invite link" }).click();
  const invite = await page.getByLabel("Invite link").inputValue();

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

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Review", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/review$/);
  await page.getByRole("link", { name: "digital-invoice.pdf" }).click();
  await page.getByLabel("Currency", { exact: true }).fill("USD");
  await page.getByRole("button", { name: /^Approve/ }).click();
  await expect(page).toHaveURL(/\/app\/review$/);

  await page.goto("/app/entities");
  await page.getByRole("link", { name: "12 Elm Street" }).click();
  await expect(page).toHaveURL(/\/app\/entities\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}?month=2026-10`);
  await expect(page.getByText("$1,260.57").first()).toBeVisible();
  await page.getByRole("button", { name: "Generate statement" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Generate" }).click();
  await page.goto("/app/reports");
  const row = page.getByRole("row", { name: /Statement - 12 Elm Street - 2026-10\.pdf/ });
  await expect(row).toContainText("Ready", { timeout: 60_000 });
  const download = page.waitForEvent("download");
  await row.getByRole("link", { name: /Download/ }).click();
  expect((await download).suggestedFilename()).toBe("Statement - 12 Elm Street - 2026-10.pdf");

  // The viewer joins and can read, but not change anything.
  const other = await browser.newContext();
  const viewer = await other.newPage();
  await viewer.goto(invite);
  await viewer.getByRole("link", { name: "Create an account to accept" }).click();
  await signUp(viewer, "Vic Viewer", viewerEmail);
  await viewer.getByRole("button", { name: "Accept invite" }).click();
  await expect(viewer).toHaveURL(/\/app$/);

  await viewer.goto("/app/documents");
  await expect(viewer.getByText("You have read-only access, so uploading is turned off.")).toBeVisible();
  await expect(viewer.locator("input[type=file]")).toHaveCount(0);
  await viewer.goto("/app/reports");
  await expect(viewer.getByText("Only reviewers, admins and owners can generate reports.")).toBeVisible();
  await expect(viewer.getByRole("button", { name: /Statements for all/ })).toHaveCount(0);
  await expect(viewer.getByRole("row", { name: /Statement - 12 Elm Street/ })).toContainText("Ready"); // can download
  const nav = viewer.getByRole("navigation", { name: "Main" });
  for (const hidden of ["Audit log", "Billing", "Organization", "Review settings"]) {
    await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
  }
  await viewer.goto("/app/settings/audit");
  await expect(viewer.getByText("Only owners and admins can see the audit log.")).toBeVisible();
  await other.close();
});
