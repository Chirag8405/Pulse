import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __PULSE_E2E_AUTH__?: {
      uid: string;
      isAdmin?: boolean;
    };
  }
}

async function goToRevealStep(page: Page) {
  await page.goto("/join");
  await page.getByLabel("Seat number").fill("A-12-34");
  await page.getByRole("button", { name: "Continue" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__PULSE_E2E_AUTH__ = { uid: "e2e-user", isAdmin: false };
  });

  await page.context().addCookies([
    {
      name: "__session",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);
});

test("Valid seat advances to team reveal step", async ({ page }) => {
  await goToRevealStep(page);

  await expect(page.getByRole("heading", { level: 2 })).toContainText("North Stand Wolves");
});

test("Invalid seat format shows error message", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("Seat number").fill("abc");

  await expect(
    page.getByText("Format: Section-Row-Seat (e.g. A-12-34)")
  ).toBeVisible();
});

test("Step counter shows step 2 of 3 on reveal screen", async ({ page }) => {
  await goToRevealStep(page);

  await expect(page.getByText("Step 2 of 3")).toBeVisible();
});

test("Join This Team advances to confirmation screen", async ({ page }) => {
  await goToRevealStep(page);
  await page.getByRole("button", { name: "Join This Team" }).click();

  await expect(
    page.getByRole("heading", { name: "You are in. Here is how it works." })
  ).toBeVisible();
});

test("Back button returns to previous step", async ({ page }) => {
  await goToRevealStep(page);
  await page.getByRole("button", { name: "Back" }).click();

  await expect(
    page.getByRole("heading", { name: "Enter your seat number" })
  ).toBeVisible();
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
});

test("Enter the Arena navigates to /dashboard", async ({ page }) => {
  await goToRevealStep(page);
  await page.getByRole("button", { name: "Join This Team" }).click();
  await page.getByRole("button", { name: "Enter the Arena" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
});
