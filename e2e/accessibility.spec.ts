import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __PULSE_E2E_AUTH__?: {
      uid: string;
      isAdmin?: boolean;
    };
  }
}

async function seedAttendeeAuth(page: import("@playwright/test").Page) {
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
}

test("Landing page has zero critical axe violations", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();
  const criticalViolations = results.violations.filter(
    (violation) => violation.impact === "critical"
  );

  expect(criticalViolations).toEqual([]);
});

test("Login page has zero critical axe violations", async ({ page }) => {
  await page.goto("/login");

  const results = await new AxeBuilder({ page }).analyze();
  const criticalViolations = results.violations.filter(
    (violation) => violation.impact === "critical"
  );

  expect(criticalViolations).toEqual([]);
});

test("Every tested page has exactly one h1", async ({ page }) => {
  const pagesToCheck = ["/", "/login"];

  for (const route of pagesToCheck) {
    await page.goto(route);
    await expect(page.locator("h1")).toHaveCount(1);
  }
});

test("All images have alt text or aria-hidden=true", async ({ page }) => {
  const pagesToCheck = ["/", "/login"];

  for (const route of pagesToCheck) {
    await page.goto(route);

    const images = page.locator("img");
    const imageCount = await images.count();

    for (let index = 0; index < imageCount; index += 1) {
      const image = images.nth(index);
      const alt = await image.getAttribute("alt");
      const ariaHidden = await image.getAttribute("aria-hidden");

      expect(Boolean((alt && alt.trim().length > 0) || ariaHidden === "true")).toBe(
        true
      );
    }
  }
});

test("Dashboard has required navigation landmarks", async ({ page }) => {
  await seedAttendeeAuth(page);
  await page.goto("/dashboard");

  await expect(
    page.getByRole("navigation", { name: "Main navigation" })
  ).toBeVisible();
});

test("Leaderboard and join pages have no serious or critical axe violations", async ({ page }) => {
  await seedAttendeeAuth(page);

  for (const route of ["/leaderboard", "/join"]) {
    await page.goto(route);

    const results = await new AxeBuilder({ page }).analyze();
    const blockingViolations = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    );

    expect(blockingViolations).toEqual([]);
  }
});
