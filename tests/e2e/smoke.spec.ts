import { expect, test } from "@playwright/test";

test("home page renders the DocuMax brand", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("DocuMax").first()).toBeVisible();
});
