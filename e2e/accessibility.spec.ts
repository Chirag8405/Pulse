import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
