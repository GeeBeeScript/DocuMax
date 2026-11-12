import { expect, test, type Page } from "@playwright/test";
import { orgOfOwner, setPlan } from "./support/admin";

/** Needs local Supabase running (npx supabase start) and its keys in .env.local. */

const unique = (label: string) => `${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;
const PASSWORD = "correct-horse-9";

async function signUp(page: Page, name: string, email: string) {
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up free" }).click();
}

test.describe("auth & onboarding", () => {
  test("the app is gated behind login", async ({ page }) => {
    await page.goto("/app/settings/members");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fsettings%2Fmembers$/);
  });

  test("sign up → create organization → dashboard", async ({ page }) => {
    await page.goto("/signup");
    await signUp(page, "Dana Whitfield", unique("owner"));

    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel("Organization name").fill("Harbor & Pine");
    await page.getByText("Jobs", { exact: true }).click();
    await page.getByRole("button", { name: "Create organization" }).click();

    await expect(page).toHaveURL(/\/onboarding\/invite$/);
    await page.getByRole("link", { name: "Skip for now" }).click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Dana");
    await expect(page.getByRole("button", { name: "Switch organization" })).toContainText("Harbor & Pine");
    // Entity wording follows the org's mode.
    await expect(page.getByRole("heading", { name: "Set up your jobs" })).toBeVisible();
  });

  test("an invited teammate signs up and joins with the invited role", async ({ page, browser }) => {
    const mate = unique("mate");
    const ownerEmail = unique("owner");
    await page.goto("/signup");
    await signUp(page, "Olive Owner", ownerEmail);
    await page.getByLabel("Organization name").fill("Keystone Homes");
    await page.getByText("Properties", { exact: true }).click();
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page).toHaveURL(/\/onboarding\/invite$/);
    await setPlan(await orgOfOwner(ownerEmail), "pro"); // Free has one seat (Phase 10)
    await page.getByLabel("Email").fill(mate);
    await page.getByLabel("Role").selectOption("reviewer");
    await page.getByRole("button", { name: "Create invite link" }).click();
    const link = await page.getByLabel("Invite link").inputValue();

    const other = await browser.newContext();
    const teammate = await other.newPage();
    await teammate.goto(link);
    await expect(teammate.getByRole("heading", { level: 1 })).toHaveText("Join Keystone Homes on DocuMax");
    await teammate.getByRole("link", { name: "Create an account to accept" }).click();
    await expect(teammate.getByLabel("Work email")).toHaveValue(mate);
    await signUp(teammate, "Sam Reviewer", mate);
    await teammate.getByRole("button", { name: "Accept invite" }).click();

    await expect(teammate).toHaveURL(/\/app$/);
    await expect(teammate.getByRole("button", { name: "Switch organization" })).toContainText("Reviewer");
    await teammate.goto("/app/settings/members");
    await expect(teammate.getByText("Only owners and admins can manage the team.")).toBeVisible();
    await other.close();

    await page.goto("/app/settings/members");
    await expect(page.getByRole("heading", { name: "Members (2)" })).toBeVisible();
  });
});
