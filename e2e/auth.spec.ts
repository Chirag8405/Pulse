import { expect, test } from "@playwright/test";

test("Landing page loads and shows hero headline", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "The crowd is not a problem to manage.",
    })
  ).toBeVisible();
});

test("Clicking Attend an Event navigates to /login", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Attend an Event" }).click();

  await expect(page).toHaveURL(/\/login/);
});

test("Login page shows Google sign-in button with aria-label", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("button", { name: "Sign in with Google account" })
  ).toBeVisible();
});

test("Google button is keyboard-focusable", async ({ page }) => {
  await page.goto("/login");
  const googleButton = page.getByRole("button", {
    name: "Sign in with Google account",
  });

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.keyboard.press("Tab");
    const focused = await googleButton.evaluate(
      (element) => element === document.activeElement
    );

    if (focused) {
      break;
    }
  }

  await expect(googleButton).toBeFocused();
});

test("Continue as Guest button is present and focusable", async ({ page }) => {
  await page.goto("/login");
  const guestButton = page.getByRole("button", {
    name: "Continue as guest attendee",
  });

  await expect(guestButton).toBeVisible();

  await guestButton.focus();
  await expect(guestButton).toBeFocused();
});
