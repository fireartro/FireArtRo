const { test, expect } = require("@playwright/test");

const legalRoutes = [
  "/confidentialitate",
  "/termeni-si-conditii",
  "/cookies",
];

for (const route of legalRoutes) {
  test(`${route} uses the shared Night Runway legal shell`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });

    await expect(page.locator("main.legal-page[data-design='night-runway']")).toBeVisible();
    await expect(page.locator(".legal-hero")).toBeVisible();
    await expect(page.locator(".legal-layout")).toBeVisible();
    await expect(page.locator(".legal-nav")).toBeVisible();
    await expect(page.locator(".fa-footer")).toBeVisible();
    await expect(page.locator(".legal-nav a")).toHaveCount(3);

    const pageBackground = await page.locator("main.legal-page").evaluate((node) => {
      const style = getComputedStyle(node);
      return { color: style.backgroundColor, image: style.backgroundImage };
    });

    expect(pageBackground.color).toBe("rgb(5, 6, 8)");
    expect(pageBackground.image).toBe("none");
  });
}

test("legal navigation stays usable without horizontal page overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 467, height: 872 });
  await page.goto("/cookies", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".legal-nav")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    navigation: getComputedStyle(document.querySelector(".legal-nav")).overflowX,
  }));

  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.navigation).toBe("auto");
});
