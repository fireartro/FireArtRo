const { test, expect } = require("@playwright/test");

const routes = [
  ["/galerie", "[data-testid='gallery-stage']"],
  ["/pachete", "[data-testid='package-comparator']"],
  ["/intrebari-frecvente", ".nr-faq-hero"],
  ["/contact", "[data-testid='contact-section']"],
];

for (const [path, contentSelector] of routes) {
  test(`${path} has no ambient meteor canvas`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    await expect(page.locator(contentSelector)).toBeVisible();
    await expect(page.getByTestId("ambient-threads")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));

    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}
