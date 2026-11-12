import { expect, test } from "@playwright/test";
import { orgOfOwner, setDocumentsUsed } from "./support/admin";

/** Free plan limits in the app. Stripe itself is never called from E2E (webhooks are covered by integration tests). */

test("free plan: usage meter, over-limit dialog, seat limit, billing page", async ({ page }) => {
  const email = `billing-${Date.now()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Bo Billing");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Sign up free" }).click();
  await page.getByLabel("Organization name").fill("Tiny Co");
  await page.getByText("Properties", { exact: true }).click();
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/onboarding\/invite$/);

  // One seat on Free: inviting is refused with an upgrade hint.
  await page.getByLabel("Email").fill("teammate@example.test");
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByText(/Your plan includes 1 seat/)).toBeVisible();

  const orgId = await orgOfOwner(email);
  await setDocumentsUsed(orgId, 24);
  await page.goto("/app/documents");
  await expect(page.getByRole("meter", { name: "24 of 25 documents used this month" }).first()).toBeVisible();

  // Two files, one slot left: asked first, then only the first is uploaded.
  const pdf = (name: string) => ({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  });
  await page.locator("input[type=file]").setInputFiles([pdf("one.pdf"), pdf("two.pdf")]);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Only 1 more document fits this month.");
  await dialog.getByRole("button", { name: "Upload the first 1" }).click();
  await expect(page.getByRole("region", { name: /Uploads/ })).toContainText("one.pdf");
  await expect(page.getByRole("region", { name: /Uploads/ })).not.toContainText("two.pdf");
  await expect(page.getByRole("meter", { name: "25 of 25 documents used this month" }).first()).toBeVisible();

  // At the cap: the dialog explains and links to the plans.
  await page.locator("input[type=file]").setInputFiles([pdf("three.pdf")]);
  await expect(dialog).toContainText("The Free plan includes 25 documents a month");
  await dialog.getByRole("link", { name: "See plans" }).click();
  await expect(page).toHaveURL(/\/app\/settings\/billing$/);
  await expect(page.getByRole("region", { name: "Current plan" })).toContainText("Free");
  await expect(page.getByRole("region", { name: "Current plan" })).toContainText("25 of 25");

  // Without Stripe keys, upgrading explains instead of failing.
  await page.getByRole("button", { name: "Upgrade to Pro" }).click();
  await expect(page.getByText("Billing isn't set up yet.")).toBeVisible();
});
