import { expect, test } from "@playwright/test";

test.describe("marketing site", () => {
  test("landing → pricing → sign up with email prefilled", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Polished statements");

    await page.getByRole("banner").getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("article", { name: "Pro" })).toBeVisible();

    await page.getByRole("radio", { name: "Monthly" }).click();
    await expect(page.getByRole("article", { name: "Pro" }).getByText("$49")).toBeVisible();

    await page.goto("/");
    await page.getByLabel("Work email").fill("owner@example.com");
    await page.getByRole("button", { name: "Sign up free" }).first().click();
    await expect(page).toHaveURL(/\/signup\?email=owner%40example\.com$/);
    await expect(page.getByLabel("Work email")).toHaveValue("owner@example.com");
  });

  test("persona pages share the industry template", async ({ page }) => {
    for (const path of ["/property-managers", "/contractors"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("tab")).toHaveCount(4);
    }
  });

  test("mobile menu opens and navigates", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Solutions" }).click();
    await page.getByRole("link", { name: "Home-service contractors" }).click();
    await expect(page).toHaveURL(/\/contractors$/);
  });

  test("SEO routes respond", async ({ request }) => {
    for (const path of ["/sitemap.xml", "/robots.txt", "/opengraph-image"]) {
      const res = await request.get(path);
      expect(res.ok(), path).toBeTruthy();
    }
  });
});
